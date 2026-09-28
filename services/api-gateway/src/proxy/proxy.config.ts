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
    // Chat Microservice: HTTP Endpoints
    {
      name: 'chat-service',
      target: config.chatServiceUrl,
      pathPrefixes: ['/api/chat', '/chat'],
    },
    // Chat Microservice: Real-time Socket.IO
    {
      name: 'chat-socket',
      target: config.chatServiceUrl,
      pathPrefixes: ['/socket.io'],
      ws: true,
    },
  ];
};
