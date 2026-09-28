import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import {
  RateLimiterOptions,
  ClientRecord,
  RateLimiterMiddlewareFn,
} from './rate-limiter.types';

const logger = new Logger('RateLimiter');

/**
 * Extracts client IP address taking into account reverse proxy headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Creates an in-memory rate limiting middleware with automatic cleanup to prevent memory leaks.
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiterMiddlewareFn {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 100;
  const statusCode = options.statusCode ?? 429;
  const standardHeaders = options.standardHeaders ?? true;
  const legacyHeaders = options.legacyHeaders ?? true;
  const keyGenerator = options.keyGenerator ?? getClientIp;
  const skip = options.skip ?? (() => false);

  // In-memory store: Map<clientKey, ClientRecord>
  const store = new Map<string, ClientRecord>();

  // Periodic cleanup interval to prevent memory leaks from inactive clients
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, Math.min(windowMs, 60_000));

  // Ensure timer does not block process exit
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const middleware: RateLimiterMiddlewareFn = Object.assign(
    (req: Request, res: Response, next: NextFunction): void => {
      // Check if request should bypass rate limiting
      if (skip(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();

      let record = store.get(key);

      if (!record || now > record.resetTime) {
        // First request or window expired: start new window
        record = {
          count: 1,
          resetTime: now + windowMs,
        };
        store.set(key, record);
      } else {
        record.count += 1;
      }

      const remaining = Math.max(0, max - record.count);
      const resetSeconds = Math.max(0, Math.ceil((record.resetTime - now) / 1000));

      // Set rate limit headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', resetSeconds);
      }

      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      }

      // Check if limit exceeded
      if (record.count > max) {
        res.setHeader('Retry-After', resetSeconds);

        logger.warn(
          `Rate limit exceeded for client [${key}] - ${record.count}/${max} reqs in ${windowMs / 1000}s`,
        );

        const errorPayload =
          typeof options.message === 'object'
            ? options.message
            : {
                statusCode,
                error: 'Too Many Requests',
                message:
                  options.message ||
                  `Too many requests from this IP, please try again after ${resetSeconds} seconds.`,
                retryAfter: resetSeconds,
              };

        res.status(statusCode).json(errorPayload);
        return;
      }

      next();
    },
    {
      reset: () => store.clear(),
      getStoreSize: () => store.size,
    },
  );

  return middleware;
}

/**
 * NestJS-compatible middleware class wrapping createRateLimiter.
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly limiter = createRateLimiter();

  use(req: Request, res: Response, next: NextFunction) {
    return this.limiter(req, res, next);
  }
}
