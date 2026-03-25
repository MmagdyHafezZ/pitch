import {
  storeOAuthTokens,
  clearOAuthTokens,
  isAuthenticated,
  buildOAuthUrl,
  parseOAuthCallback,
  redirectToOAuthProvider,
  handleOAuthSuccess,
  handleOAuthError,
} from '../oauth.utils'
import { getAccessToken, setAccessToken } from '@/lib/client'

describe('oauth.utils', () => {
  beforeEach(() => {
    setAccessToken(null)
  })

  afterEach(() => {
    setAccessToken(null)
    jest.restoreAllMocks()
  })

  describe('storeOAuthTokens', () => {
    it('should set the access token in the client', () => {
      storeOAuthTokens({ access_token: 'abc123' })
      expect(getAccessToken()).toBe('abc123')
    })

    it('should ignore refresh_token (not stored in client module-level state)', () => {
      storeOAuthTokens({ access_token: 'tok', refresh_token: 'reftok' })
      expect(getAccessToken()).toBe('tok')
    })
  })

  describe('clearOAuthTokens', () => {
    it('should set the access token to null', () => {
      setAccessToken('existing-token')
      clearOAuthTokens()
      expect(getAccessToken()).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when there is an access token', () => {
      setAccessToken('some-token')
      expect(isAuthenticated()).toBe(true)
    })

    it('should return false when there is no access token', () => {
      setAccessToken(null)
      expect(isAuthenticated()).toBe(false)
    })

    it('should return false for an empty string token', () => {
      setAccessToken('')
      expect(isAuthenticated()).toBe(false)
    })
  })

  describe('buildOAuthUrl', () => {
    it('should build the base OAuth URL without a login hint', () => {
      const url = buildOAuthUrl('https://api.example.com', 'google')
      expect(url).toBe('https://api.example.com/auth/oauth/google')
    })

    it('should lower-case the provider name', () => {
      const url = buildOAuthUrl('https://api.example.com', 'GOOGLE')
      expect(url).toBe('https://api.example.com/auth/oauth/google')
    })

    it('should append login_hint when provided', () => {
      const url = buildOAuthUrl('https://api.example.com', 'google', 'user@example.com')
      expect(url).toBe('https://api.example.com/auth/oauth/google?login_hint=user%40example.com')
    })

    it('should URL-encode special characters in login_hint', () => {
      const url = buildOAuthUrl('https://api.example.com', 'github', 'user+test@example.com')
      expect(url).toContain('login_hint=user%2Btest%40example.com')
    })

    it('should not append login_hint when it is undefined', () => {
      const url = buildOAuthUrl('https://api.example.com', 'github', undefined)
      expect(url).not.toContain('login_hint')
    })
  })

  describe('parseOAuthCallback', () => {
    it('should parse token and refresh_token from search params', () => {
      const params = new URLSearchParams('token=abc&refresh=xyz')
      const result = parseOAuthCallback(params)
      expect(result).toEqual({ token: 'abc', refresh_token: 'xyz', error: undefined })
    })

    it('should parse error from search params', () => {
      const params = new URLSearchParams('error=access_denied')
      const result = parseOAuthCallback(params)
      expect(result).toEqual({ token: undefined, refresh_token: undefined, error: 'access_denied' })
    })

    it('should return undefined fields when params are absent', () => {
      const params = new URLSearchParams('')
      const result = parseOAuthCallback(params)
      expect(result.token).toBeUndefined()
      expect(result.refresh_token).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle all three params simultaneously', () => {
      const params = new URLSearchParams('token=t&refresh=r&error=e')
      const result = parseOAuthCallback(params)
      expect(result).toEqual({ token: 't', refresh_token: 'r', error: 'e' })
    })
  })

  describe('redirectToOAuthProvider', () => {
    it('should call buildOAuthUrl and attempt navigation', () => {
      expect(() => redirectToOAuthProvider('http://localhost', 'google')).not.toThrow()
    })

    it('should not throw with login_hint', () => {
      expect(() =>
        redirectToOAuthProvider('http://localhost', 'google', 'me@example.com')
      ).not.toThrow()
    })
  })

  describe('handleOAuthSuccess', () => {
    it('should store tokens', () => {
      handleOAuthSuccess({ access_token: 'newtoken' })
      expect(getAccessToken()).toBe('newtoken')
    })

    it('should not throw with custom redirect URL', () => {
      expect(() => handleOAuthSuccess({ access_token: 'newtoken' }, '/dashboard')).not.toThrow()
      expect(getAccessToken()).toBe('newtoken')
    })
  })

  describe('handleOAuthError', () => {
    it('should clear tokens', () => {
      setAccessToken('existing')
      handleOAuthError('access_denied')
      expect(getAccessToken()).toBeNull()
    })

    it('should not throw with custom redirect URL', () => {
      expect(() => handleOAuthError('denied', '/custom-error')).not.toThrow()
      expect(getAccessToken()).toBeNull()
    })
  })
})
