const REDACT_KEYS = new Set([
  'authorization',
  'password',
  'pass',
  'token',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'secret',
  'api_key',
  'apikey',
  'cookie',
  'set-cookie',
])

const MAX_LOG_LENGTH = 4000

export type NormalizedError = {
  name?: string
  message: string
  stack?: string
  details?: unknown
}

export const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      details: (error as { cause?: unknown }).cause,
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { name?: string; message?: unknown; stack?: string }
    const message = typeof maybeError.message === 'string' ? maybeError.message : 'Unknown error'
    return {
      name: maybeError.name,
      message,
      stack: maybeError.stack,
      details: error,
    }
  }

  return { message: 'Unknown error' }
}

const shouldRedactKey = (key: string): boolean => REDACT_KEYS.has(key.toLowerCase())

export const safeStringify = (value: unknown, maxLength: number = MAX_LOG_LENGTH): string => {
  try {
    const seen = new WeakSet<object>()
    const json = JSON.stringify(value, (key, val) => {
      if (key && shouldRedactKey(key)) {
        return '[REDACTED]'
      }
      if (typeof val === 'bigint') {
        return val.toString()
      }
      if (val && typeof val === 'object') {
        if (seen.has(val as object)) {
          return '[Circular]'
        }
        seen.add(val as object)
      }
      return val
    })

    if (!json) {
      return String(value)
    }

    if (json.length > maxLength) {
      return `${json.slice(0, maxLength)}...`
    }

    return json
  } catch (error) {
    return `"[Unserializable payload: ${String((error as Error)?.message ?? error)}]"`
  }
}
