import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from api-gateway root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface GatewayConfig {
  port: number;
  nodeEnv: string;
  authServiceUrl: string;
  chatServiceUrl: string;
  userServiceUrl: string;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  jwtAccessSecret: string;
}

export const getGatewayConfig = (): GatewayConfig => {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    authServiceUrl: (process.env.AUTH_SERVICE_URL || 'http://localhost:3003').replace(/\/+$/, ''),
    chatServiceUrl: (process.env.CHAT_SERVICE_URL || 'http://localhost:3001').replace(/\/+$/, ''),
    userServiceUrl: (process.env.USER_SERVICE_URL || 'http://localhost:3002').replace(/\/+$/, ''),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET || 'chat-portal-jwt-access-secret-key-32chars',
  };
};
