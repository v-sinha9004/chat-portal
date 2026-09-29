export interface PublicRouteRule {
  /** Exact path or prefix */
  path: string;
  /** If true, matches any subpath under this path (e.g. /socket.io matches /socket.io/...) */
  prefix?: boolean;
  /** Optional HTTP method (GET, POST, etc). If omitted, matches all HTTP methods */
  method?: string;
}

/**
 * Central declarative list of public routes that bypass JWT verification at the API Gateway.
 * Developers can easily add or remove public endpoints here.
 */
export const PUBLIC_ROUTES: PublicRouteRule[] = [
  // Auth Service public endpoints
  { path: '/api/auth/register', method: 'POST' },
  { path: '/api/auth/login', method: 'POST' },
  { path: '/api/auth/refresh', method: 'POST' },
  { path: '/api/auth/logout', method: 'POST' },
  { path: '/api/auth/health', method: 'GET' },

  // Rewritten /auth aliases
  { path: '/auth/register', method: 'POST' },
  { path: '/auth/login', method: 'POST' },
  { path: '/auth/refresh', method: 'POST' },
  { path: '/auth/logout', method: 'POST' },
  { path: '/auth/health', method: 'GET' },

  // Health check endpoints across all services
  { path: '/health', method: 'GET' },
  { path: '/api/health', method: 'GET' },
  { path: '/api/users/health', method: 'GET' },
  { path: '/users/health', method: 'GET' },
  { path: '/api/chat/health', method: 'GET' },
  { path: '/chat/health', method: 'GET' },

  // WebSocket endpoints (Handshake token verified directly in chat-service)
  { path: '/socket.io', prefix: true },
];

/**
 * Checks if an incoming request matches any public route rule.
 */
export function isPublicRoute(pathname: string, method: string): boolean {
  const cleanPath = pathname.split('?')[0]; // Strip query parameters

  return PUBLIC_ROUTES.some((rule) => {
    // Check HTTP method if specified
    if (rule.method && rule.method.toUpperCase() !== method.toUpperCase()) {
      return false;
    }

    // Check path matching
    if (rule.prefix) {
      return cleanPath === rule.path || cleanPath.startsWith(`${rule.path}/`);
    }
    return cleanPath === rule.path;
  });
}
