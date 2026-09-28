import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from api-gateway root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface GatewayConfig {
  port: number;
  nodeEnv: string;
  chatServiceUrl: string;
  corsOrigin: string;
}

export const getGatewayConfig = (): GatewayConfig => {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    chatServiceUrl: (process.env.CHAT_SERVICE_URL || 'http://localhost:3001').replace(/\/+$/, ''),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  };
};
