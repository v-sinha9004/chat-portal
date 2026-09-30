import { getGatewayConfig } from '../config/configuration';
import { ServiceProxyOptions } from './proxy.types';

/**
 * Declarative configuration for all downstream services to proxy.
 *
 * Incoming requests matching pathPrefixes are forwarded with the exact path untouched.
 *
 * To add a new service, simply append a new object to this array with:
 * - name: Identifier for logs, health checks, and 502 messages
 * - target: Base URL of the downstream microservice
 * - pathPrefixes: URL path prefixes to route through this gateway
 * - ws: (optional, default false) whether to enable WebSocket upgrade proxying
 */
export const getServicesConfig = (): ServiceProxyOptions[] => {
  const config = getGatewayConfig();

  return [
    // Auth Microservice: HTTP Endpoints
    {
      name: 'auth-service',
      target: config.authServiceUrl,
      pathPrefixes: ['/api/auth', '/auth'],
      pathRewrite: {
        '^/auth': '/api/auth',
      },
      healthPath: '/api/auth/health',
    },
    // Chat Microservice: HTTP Endpoints
    {
      name: 'chat-service',
      target: config.chatServiceUrl,
      pathPrefixes: ['/api/chat', '/chat'],
      pathRewrite: {
        '^/chat': '/api/chat',
      },
      healthPath: '/api/chat/health',
    },
    // Chat Microservice: Real-time Socket.IO
    {
      name: 'chat-socket',
      target: config.chatServiceUrl,
      pathPrefixes: ['/socket.io'],
      ws: true,
    },
    // User Microservice: HTTP Endpoints
    {
      name: 'user-service',
      target: config.userServiceUrl,
      pathPrefixes: ['/api/users', '/users', '/api/user', '/user'],
      pathRewrite: {
        '^/users': '/api/users',
        '^/user(?=/|$)': '/api/users',
        '^/api/user(?=/|$)': '/api/users',
      },
      healthPath: '/api/users/health',
    },
    // Media Microservice: HTTP Endpoints
    {
      name: 'media-service',
      target: config.mediaServiceUrl,
      pathPrefixes: ['/api/media', '/media'],
      pathRewrite: {
        '^/media': '/api/media',
      },
      healthPath: '/api/media/health',
    },
  ];
};
