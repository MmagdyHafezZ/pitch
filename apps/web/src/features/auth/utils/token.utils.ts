type JwtPayload = {
  exp?: number
}

const base64UrlDecode = (input: string): string => {
  const padLength = 4 - (input.length % 4 || 4)
  const padded = input + '='.repeat(padLength)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64)
}

export const getJwtExpiry = (token: string): number | null => {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload
    if (!payload.exp) return null
    return payload.exp * 1000
  } catch {
    return null
  }
}

export const isTokenExpiringSoon = (token: string, bufferMs = 2 * 60 * 1000): boolean => {
  const expiry = getJwtExpiry(token)
  if (!expiry) return false
  return expiry - Date.now() <= bufferMs
}
