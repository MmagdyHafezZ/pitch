/**
 * OAuth utility functions for handling authentication tokens and redirects
 */

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
}

/**
 * Stores OAuth tokens in localStorage
 */
export function storeOAuthTokens(tokens: OAuthTokens): void {
  localStorage.setItem('authToken', tokens.access_token)
  if (tokens.refresh_token) {
    localStorage.setItem('refreshToken', tokens.refresh_token)
  }
}

/**
 * Retrieves OAuth tokens from localStorage
 */
export function getOAuthTokens(): OAuthTokens | null {
  const access_token = localStorage.getItem('authToken')
  const refresh_token = localStorage.getItem('refreshToken')

  if (!access_token) {
    return null
  }

  return {
    access_token,
    refresh_token: refresh_token || undefined,
  }
}

/**
 * Clears OAuth tokens from localStorage
 */
export function clearOAuthTokens(): void {
  localStorage.removeItem('authToken')
  localStorage.removeItem('refreshToken')
}

/**
 * Checks if user is authenticated by validating tokens
 */
export function isAuthenticated(): boolean {
  const tokens = getOAuthTokens()
  return !!tokens?.access_token
}

/**
 * Builds OAuth authorization URL
 */
export function buildOAuthUrl(baseUrl: string, provider: string): string {
  return `${baseUrl}/auth/oauth/${provider.toLowerCase()}`
}

/**
 * Parses OAuth callback URL parameters
 */
export function parseOAuthCallback(searchParams: URLSearchParams): {
  token?: string
  refresh_token?: string
  error?: string
} {
  return {
    token: searchParams.get('token') || undefined,
    refresh_token: searchParams.get('refresh') || undefined,
    error: searchParams.get('error') || undefined,
  }
}

/**
 * Redirects to OAuth provider
 */
export function redirectToOAuthProvider(baseUrl: string, provider: string): void {
  const oauthUrl = buildOAuthUrl(baseUrl, provider)
  window.location.href = oauthUrl
}

/**
 * Handles OAuth callback success
 */
export function handleOAuthSuccess(tokens: OAuthTokens, redirectUrl: string = '/dashboard'): void {
  storeOAuthTokens(tokens)

  // Use Next.js router if available, otherwise fallback to window.location
  if (typeof window !== 'undefined') {
    window.location.href = redirectUrl
  }
}

/**
 * Handles OAuth callback error
 */
export function handleOAuthError(error: string, redirectUrl: string = '/auth/login'): void {
  console.error('OAuth error:', error)
  clearOAuthTokens()

  // Use Next.js router if available, otherwise fallback to window.location
  if (typeof window !== 'undefined') {
    window.location.href = `${redirectUrl}?error=${encodeURIComponent(error)}`
  }
}
