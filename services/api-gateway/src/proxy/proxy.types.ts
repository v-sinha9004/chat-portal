import { RequestHandler } from 'http-proxy-middleware';

export interface ServiceProxyOptions {
  /** Name of the service used for logging, metrics, and error reporting */
  name: string;
  /** Downstream base target URL (e.g. 'http://localhost:3001') */
  target: string;
  /** Path prefix(es) to match on the gateway (e.g. ['/api/chat', '/socket.io']) */
  pathPrefixes: string[];
  /** Whether to enable WebSocket proxying and upgrade handling (default: false) */
  ws?: boolean;
  /** Optional path rewrite rules (e.g. { '^/chat': '/api/chat' }) */
  pathRewrite?: Record<string, string> | ((path: string, req: any) => string);
  /** Optional health check path for this service (default: '/health') */
  healthPath?: string;
}

export interface RegisteredProxy {
  options: ServiceProxyOptions;
  middleware: RequestHandler;
}
