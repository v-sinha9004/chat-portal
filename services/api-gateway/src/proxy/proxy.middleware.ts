import { Logger } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody, RequestHandler } from 'http-proxy-middleware';
import * as http from 'http';
import * as net from 'net';
import { RegisteredProxy, ServiceProxyOptions } from './proxy.types';

const logger = new Logger('ServiceProxy');

/**
 * Reusable custom function to create a reverse proxy for ANY microservice.
 *
 * Forwards the exact URL path untouched to the target service.
 * Handles:
 * - Dynamic path filtering
 * - Request body restoration (POST/PUT/PATCH) via fixRequestBody
 * - WebSocket upgrade support (if options.ws is true)
 * - Standardized 502 Bad Gateway JSON error responses
 * - Informative request logging
 */
export function createServiceProxy(options: ServiceProxyOptions): RequestHandler {
  const { name, target, pathPrefixes, ws = false, pathRewrite } = options;
  const sortedPrefixes = [...pathPrefixes].sort((a, b) => b.length - a.length);

  logger.log(
    `Registering proxy for [${name}] -> Target: "${target}", Prefixes: [${pathPrefixes.join(', ')}], ws: ${ws}`,
  );

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws,
    ...(pathRewrite ? { pathRewrite } : {}),
    pathFilter: (pathname: string) => {
      return sortedPrefixes.some(
        (prefix) =>
          pathname === prefix ||
          pathname.startsWith(`${prefix}/`) ||
          pathname.startsWith(`${prefix}?`),
      );
    },
    // No path rewriting: forwards the exact incoming path to the target service
    on: {
      proxyReq: (proxyReq, req) => {
        logger.log(`[Proxy:${name}] [${req.method}] ${req.url} -> ${target}${proxyReq.path}`);
        if (req.headers['x-user-id']) {
          proxyReq.setHeader('x-user-id', req.headers['x-user-id'] as string);
        }
        if (req.headers['x-user-role']) {
          proxyReq.setHeader('x-user-role', req.headers['x-user-role'] as string);
        }
        if (req.headers['x-user-email']) {
          proxyReq.setHeader('x-user-email', req.headers['x-user-email'] as string);
        }
        fixRequestBody(proxyReq, req);
      },
      proxyReqWs: (proxyReq, req) => {
        logger.log(`[Proxy:${name}] WebSocket: ${req.url} -> ${target}`);
      },
      error: (err, req, res: any) => {
        logger.error(`[Proxy:${name} Error] Target (${target}) unreachable: ${err.message}`);
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 502,
              message: `${name} is temporarily unavailable`,
              error: 'Bad Gateway',
              service: name,
              target,
              timestamp: new Date().toISOString(),
            }),
          );
        }
      },
    },
  });
}

/**
 * Registers multiple service proxies with the NestJS application and wires
 * up unified WebSocket upgrade handling on the underlying HTTP server.
 */
export function registerServiceProxies(
  app: { use: (...args: any[]) => void },
  server: http.Server,
  services: ServiceProxyOptions[],
): RegisteredProxy[] {
  const registered: RegisteredProxy[] = [];
  const wsProxies: RegisteredProxy[] = [];

  for (const service of services) {
    const middleware = createServiceProxy(service);
    app.use(middleware);

    const entry: RegisteredProxy = { options: service, middleware };
    registered.push(entry);

    if (service.ws) {
      wsProxies.push(entry);
    }
  }

  // Handle WebSocket Upgrade events dynamically across all WS-enabled services
  server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    const reqUrl = req.url || '';
    const matchingProxy = wsProxies.find((p) =>
      p.options.pathPrefixes.some(
        (prefix) =>
          reqUrl === prefix ||
          reqUrl.startsWith(`${prefix}/`) ||
          reqUrl.startsWith(`${prefix}?`),
      ),
    );

    if (matchingProxy) {
      matchingProxy.middleware.upgrade(req, socket, head);
    } else {
      logger.warn(`No WebSocket proxy matched for path: ${reqUrl}`);
      socket.destroy();
    }
  });

  return registered;
}
