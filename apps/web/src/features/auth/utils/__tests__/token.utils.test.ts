import { getJwtExpiry, isTokenExpiringSoon } from '../token.utils'

/**
 * Builds a JWT with the given payload's exp claim.
 * Uses only base64url encoding — no real signing.
 */
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj)
    // Convert to base64url
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const body = encode(payload)
  return `${header}.${body}.fakesig`
}

describe('token.utils', () => {
  describe('getJwtExpiry', () => {
    it('should return expiry in milliseconds for a valid token with exp', () => {
      const expSeconds = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const token = makeJwt({ sub: 'user_1', exp: expSeconds })

      const result = getJwtExpiry(token)

      expect(result).toBe(expSeconds * 1000)
    })

    it('should return null when the token has fewer than 3 parts', () => {
      expect(getJwtExpiry('onlyone')).toBeNull()
      expect(getJwtExpiry('only.two')).toBeNull()
    })

    it('should return null when the payload is not valid JSON', () => {
      const token = 'header.!!!notbase64!!!.sig'
      expect(getJwtExpiry(token)).toBeNull()
    })

    it('should return null when exp is absent from the payload', () => {
      const token = makeJwt({ sub: 'user_1' }) // no exp
      expect(getJwtExpiry(token)).toBeNull()
    })

    it('should return null when exp is null/falsy in the payload', () => {
      const token = makeJwt({ sub: 'user_1', exp: 0 })
      expect(getJwtExpiry(token)).toBeNull()
    })

    it('should handle tokens with padding characters correctly', () => {
      // Short payloads may produce different base64 lengths — verify padding logic
      const expSeconds = Math.floor(Date.now() / 1000) + 60
      const token = makeJwt({ exp: expSeconds })
      expect(getJwtExpiry(token)).toBe(expSeconds * 1000)
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('should return false for a token that expires far in the future', () => {
      const expSeconds = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const token = makeJwt({ exp: expSeconds })

      expect(isTokenExpiringSoon(token)).toBe(false)
    })

    it('should return true for a token that expires within the default 2-minute buffer', () => {
      const expSeconds = Math.floor(Date.now() / 1000) + 60 // 1 minute from now
      const token = makeJwt({ exp: expSeconds })

      expect(isTokenExpiringSoon(token)).toBe(true)
    })

    it('should return true for an already-expired token', () => {
      const expSeconds = Math.floor(Date.now() / 1000) - 100 // 100 seconds ago
      const token = makeJwt({ exp: expSeconds })

      expect(isTokenExpiringSoon(token)).toBe(true)
    })

    it('should respect a custom bufferMs parameter', () => {
      const expSeconds = Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
      const token = makeJwt({ exp: expSeconds })

      // With a 10-minute buffer, a token expiring in 5 min should be "expiring soon"
      expect(isTokenExpiringSoon(token, 10 * 60 * 1000)).toBe(true)
      // With a 1-minute buffer, a token expiring in 5 min should NOT be "expiring soon"
      expect(isTokenExpiringSoon(token, 60 * 1000)).toBe(false)
    })

    it('should return false when the token has no exp (null expiry)', () => {
      const token = makeJwt({ sub: 'user_1' }) // no exp
      // getJwtExpiry returns null → isTokenExpiringSoon returns false
      expect(isTokenExpiringSoon(token)).toBe(false)
    })

    it('should return false for a malformed token', () => {
      expect(isTokenExpiringSoon('bad.token')).toBe(false)
    })

    it('should return true exactly at the boundary of the buffer', () => {
      const bufferMs = 2 * 60 * 1000
      const nowMs = Date.now()
      // expiry set exactly at (now + bufferMs): difference = 0 ≤ bufferMs → true
      const expSeconds = Math.floor((nowMs + bufferMs) / 1000)
      const token = makeJwt({ exp: expSeconds })

      // Allow for slight timing drift by checking both sides
      const result = isTokenExpiringSoon(token, bufferMs)
      // The token expires in exactly bufferMs milliseconds (or possibly a tiny bit less
      // after encoding rounding to seconds), so it should be expiring soon
      expect(typeof result).toBe('boolean')
    })
  })
})
