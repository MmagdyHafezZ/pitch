import { getAccessToken, setAccessToken } from '@/lib/client'

/**
 * OAuth utility functions for handling authentication tokens and redirects
 */

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
}

export function storeOAuthTokens(tokens: OAuthTokens): void {
  setAccessToken(tokens.access_token)
}

export function clearOAuthTokens(): void {
  setAccessToken(null)
}

/**
 * Checks if user is authenticated by validating tokens
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

/**
 * Builds OAuth authorization URL
 */
export function buildOAuthUrl(baseUrl: string, provider: string, loginHint?: string): string {
  const url = `${baseUrl}/auth/oauth/${provider.toLowerCase()}`
  if (loginHint) {
    return `${url}?login_hint=${encodeURIComponent(loginHint)}`
  }
  return url
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
 * @param baseUrl - The base API URL
 * @param provider - The OAuth provider name (e.g., 'google', 'github')
 * @param loginHint - Optional email to pre-fill and skip account picker
 */
export function redirectToOAuthProvider(
  baseUrl: string,
  provider: string,
  loginHint?: string
): void {
  const oauthUrl = buildOAuthUrl(baseUrl, provider, loginHint)
  window.location.href = oauthUrl
}

/**
 * Handles OAuth callback success
 */
export function handleOAuthSuccess(
  tokens: OAuthTokens,
  redirectUrl: string = '/studio/home'
): void {
  storeOAuthTokens(tokens)

  if (typeof window !== 'undefined') {
    window.location.href = redirectUrl
  }
}

/**
 * Handles OAuth callback error
 */
export function handleOAuthError(error: string, redirectUrl: string = '/auth/login'): void {
  clearOAuthTokens()

  if (typeof window !== 'undefined') {
    window.location.href = `${redirectUrl}?error=${encodeURIComponent(error)}`
  }
}
