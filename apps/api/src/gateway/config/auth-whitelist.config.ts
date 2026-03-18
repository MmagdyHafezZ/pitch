/**
 * Configuration for routes that should bypass the global JWT auth guard
 */

export interface WhitelistRoute {
  /** HTTP method (GET, POST, etc.) - use '*' for all methods */
  method: string;
  /** Route path pattern - supports wildcards */
  path: string;
  /** Optional description for documentation */
  description?: string;
}

/**
 * Routes that should bypass authentication
 */
export const AUTH_WHITELIST_ROUTES: WhitelistRoute[] = [
  {
    method: 'POST',
    path: '/api/v1/auth/register',
    description: 'User registration endpoint',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    description: 'User login endpoint',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/refresh',
    description: 'Token refresh endpoint',
  },
  {
    method: 'GET',
    path: '/api/v1/auth/oauth/providers',
    description: 'Get available OAuth providers',
  },

  {
    method: '*',
    path: '/api/v1/auth/oauth/*',
    description: 'OAuth authentication endpoints',
  },

  {
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint',
  },
  {
    method: 'GET',
    path: '/api/v1/health',
    description: 'API health check endpoint',
  },

  {
    method: 'GET',
    path: '/api/calendar/google/callback',
    description: 'Google Calendar OAuth callback',
  },
  {
    method: 'GET',
    path: '/api/calendar/microsoft/callback',
    description: 'Microsoft Calendar OAuth callback',
  },

  {
    method: 'POST',
    path: '/api/v1/lti/v1.1/launch',
    description: 'LTI 1.1 launch (OAuth HMAC-SHA1 signed)',
  },
  {
    method: 'GET',
    path: '/api/v1/lti/v1.3/oidc/login',
    description: 'LTI 1.3 OIDC login initiation (GET)',
  },
  {
    method: 'POST',
    path: '/api/v1/lti/v1.3/oidc/login',
    description: 'LTI 1.3 OIDC login initiation (POST)',
  },
  {
    method: 'POST',
    path: '/api/v1/lti/v1.3/launch',
    description: 'LTI 1.3 launch (id_token form POST from LMS)',
  },
  {
    method: 'GET',
    path: '/api/v1/lti/v1.3/jwks',
    description: "Tool's public JWKS for LMS signature verification",
  },
];

/**
 * Check if a route should bypass authentication
 */
export function isWhitelistedRoute(method: string, path: string): boolean {
  return AUTH_WHITELIST_ROUTES.some((route) => {
    const methodMatches =
      route.method === '*' ||
      route.method.toLowerCase() === method.toLowerCase();
    const pathMatches = matchesPathPattern(route.path, path);
    return methodMatches && pathMatches;
  });
}

/**
 * Check if a path matches a pattern (supports wildcards)
 */
function matchesPathPattern(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regexPattern = escaped.replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Get all whitelisted routes for documentation/debugging
 */
export function getWhitelistedRoutes(): WhitelistRoute[] {
  return [...AUTH_WHITELIST_ROUTES];
}
