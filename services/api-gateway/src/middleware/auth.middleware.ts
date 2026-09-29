import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { isPublicRoute } from '../config/public-routes.config';

export interface JwtAuthPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Creates Edge Auth & JWT verification middleware.
 * Verifies JWT signature for protected routes, extracts user claims,
 * and attaches x-user-id, x-user-role, and x-user-email headers.
 */
export function createAuthMiddleware(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.url || '';

    // 1. Skip authentication for declared public routes
    if (isPublicRoute(path, req.method)) {
      return next();
    }

    // 2. Extract Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Authorization header is missing or malformed',
        error: 'Unauthorized',
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Authorization token is missing',
        error: 'Unauthorized',
      });
    }

    // 3. Verify JWT signature in-memory
    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtAuthPayload;

      if (!decoded || !decoded.sub) {
        return res.status(401).json({
          statusCode: 401,
          message: 'Invalid token payload',
          error: 'Unauthorized',
        });
      }

      // 4. Inject verified user claims into request headers for downstream microservices
      req.headers['x-user-id'] = decoded.sub;
      req.headers['x-user-role'] = decoded.role;
      req.headers['x-user-email'] = decoded.email;

      return next();
    } catch (err: any) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        statusCode: 401,
        message: isExpired ? 'Token has expired' : 'Invalid authorization token',
        error: 'Unauthorized',
      });
    }
  };
}
