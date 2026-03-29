import {
  AUTH_WHITELIST_ROUTES,
  isWhitelistedRoute,
  getWhitelistedRoutes,
} from '../auth-whitelist.config';

describe('auth-whitelist.config', () => {
  describe('AUTH_WHITELIST_ROUTES', () => {
    it('is a non-empty array of routes', () => {
      expect(AUTH_WHITELIST_ROUTES.length).toBeGreaterThan(0);
    });

    it('each route has method and path', () => {
      for (const route of AUTH_WHITELIST_ROUTES) {
        expect(typeof route.method).toBe('string');
        expect(typeof route.path).toBe('string');
        expect(route.method.length).toBeGreaterThan(0);
        expect(route.path.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isWhitelistedRoute', () => {
    it('returns true for POST /api/v1/auth/register', () => {
      expect(isWhitelistedRoute('POST', '/api/v1/auth/register')).toBe(true);
    });

    it('returns true for POST /api/v1/auth/login', () => {
      expect(isWhitelistedRoute('POST', '/api/v1/auth/login')).toBe(true);
    });

    it('returns true for POST /api/v1/auth/refresh', () => {
      expect(isWhitelistedRoute('POST', '/api/v1/auth/refresh')).toBe(true);
    });

    it('returns true for GET /api/v1/auth/oauth/providers', () => {
      expect(isWhitelistedRoute('GET', '/api/v1/auth/oauth/providers')).toBe(
        true,
      );
    });

    it('returns true for wildcard OAuth routes regardless of method', () => {
      expect(
        isWhitelistedRoute('GET', '/api/v1/auth/oauth/google/callback'),
      ).toBe(true);
      expect(
        isWhitelistedRoute('POST', '/api/v1/auth/oauth/github/callback'),
      ).toBe(true);
    });

    it('returns true for health check endpoints', () => {
      expect(isWhitelistedRoute('GET', '/health')).toBe(true);
      expect(isWhitelistedRoute('GET', '/api/v1/health')).toBe(true);
      expect(
        isWhitelistedRoute('GET', '/api/v1/simulation/sessions/health'),
      ).toBe(true);
      expect(
        isWhitelistedRoute('GET', '/api/v1/simulation/invitations/health'),
      ).toBe(true);
      expect(isWhitelistedRoute('GET', '/api/v1/simulation/llm/health')).toBe(
        true,
      );
    });

    it('returns true for LTI endpoints', () => {
      expect(isWhitelistedRoute('POST', '/api/v1/lti/v1.1/launch')).toBe(true);
      expect(isWhitelistedRoute('GET', '/api/v1/lti/v1.3/oidc/login')).toBe(
        true,
      );
      expect(isWhitelistedRoute('POST', '/api/v1/lti/v1.3/oidc/login')).toBe(
        true,
      );
      expect(isWhitelistedRoute('POST', '/api/v1/lti/v1.3/launch')).toBe(true);
      expect(isWhitelistedRoute('GET', '/api/v1/lti/v1.3/jwks')).toBe(true);
    });

    it('returns false for non-whitelisted routes', () => {
      expect(isWhitelistedRoute('GET', '/api/v1/users/profile')).toBe(false);
      expect(isWhitelistedRoute('POST', '/api/v1/sessions')).toBe(false);
      expect(isWhitelistedRoute('DELETE', '/api/v1/auth/register')).toBe(false);
    });

    it('is case-insensitive for method', () => {
      expect(isWhitelistedRoute('post', '/api/v1/auth/login')).toBe(true);
      expect(isWhitelistedRoute('Post', '/api/v1/auth/login')).toBe(true);
    });

    it('returns false for wrong method on specific routes', () => {
      expect(isWhitelistedRoute('GET', '/api/v1/auth/register')).toBe(false);
      expect(isWhitelistedRoute('DELETE', '/api/v1/auth/login')).toBe(false);
    });

    it('returns false for partial path matches', () => {
      expect(isWhitelistedRoute('GET', '/api/v1/health/extra')).toBe(false);
      expect(isWhitelistedRoute('POST', '/api/v1/auth/login/extra')).toBe(
        false,
      );
    });
  });

  describe('getWhitelistedRoutes', () => {
    it('returns a copy of the whitelist', () => {
      const routes = getWhitelistedRoutes();

      expect(routes).toEqual(AUTH_WHITELIST_ROUTES);
      expect(routes).not.toBe(AUTH_WHITELIST_ROUTES);
    });

    it('mutating the returned array does not affect the original', () => {
      const routes = getWhitelistedRoutes();
      const originalLength = AUTH_WHITELIST_ROUTES.length;

      routes.push({ method: 'GET', path: '/test' });

      expect(AUTH_WHITELIST_ROUTES.length).toBe(originalLength);
    });
  });
});
