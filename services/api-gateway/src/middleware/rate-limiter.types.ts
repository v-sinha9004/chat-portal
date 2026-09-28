import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  /**
   * Time window in milliseconds.
   * Default: 60,000ms (1 minute).
   */
  windowMs?: number;

  /**
   * Maximum number of requests allowed within the time window per client IP.
   * Default: 100.
   */
  max?: number;

  /**
   * HTTP status code sent when the limit is exceeded.
   * Default: 429.
   */
  statusCode?: number;

  /**
   * Error message or response body sent when the limit is exceeded.
   */
  message?: string | object;

  /**
   * Optional function to determine whether to skip rate limiting for a request.
   * (e.g. bypass internal health checks).
   */
  skip?: (req: Request) => boolean;

  /**
   * Function to generate a unique key identifying the client.
   * Defaults to extracting the client's IP address.
   */
  keyGenerator?: (req: Request) => string;

  /**
   * Whether to set standard RateLimit-* headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers).
   * Default: true.
   */
  standardHeaders?: boolean;

  /**
   * Whether to set legacy X-RateLimit-* headers.
   * Default: true.
   */
  legacyHeaders?: boolean;
}

export interface ClientRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterMiddlewareFn {
  (req: Request, res: Response, next: NextFunction): void;
  reset: () => void;
  getStoreSize: () => number;
}
