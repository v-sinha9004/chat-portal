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
}

export interface RegisteredProxy {
  options: ServiceProxyOptions;
  middleware: RequestHandler;
}
