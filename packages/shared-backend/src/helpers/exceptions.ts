import { RpcException } from '@nestjs/microservices/exceptions'
import type { ServiceError } from '../interfaces/error.interface'

export function normalizeError(error: unknown): ServiceError {
  if (error instanceof Error) {
    const nestLike = error as Error & {
      getStatus?: () => number
      getResponse?: () => unknown
      code?: unknown
    }

    let status: number | undefined
    if (typeof nestLike.getStatus === 'function') {
      try {
        const value = nestLike.getStatus()
        status = typeof value === 'number' ? value : undefined
      } catch {
        // noop
      }
    }

    let message = error.message
    if (typeof nestLike.getResponse === 'function') {
      try {
        const response = nestLike.getResponse() as
          | string
          | { message?: string | string[] }
          | undefined
        if (typeof response === 'string') {
          message = response
        } else if (Array.isArray(response?.message)) {
          message = response.message.join(', ')
        } else if (typeof response?.message === 'string') {
          message = response.message
        }
      } catch {
        // noop
      }
    }

    return {
      status,
      message,
      stack: error.stack ?? undefined,
      code: typeof nestLike.code === 'string' ? nestLike.code : undefined,
    }
  }
  if (typeof error === 'object' && error !== null) {
    const maybe = error as {
      status?: unknown
      message?: unknown
      stack?: unknown
      code?: unknown
    }

    return {
      status: typeof maybe.status === 'number' ? maybe.status : undefined,
      message: typeof maybe.message === 'string' ? maybe.message : undefined,
      stack: typeof maybe.stack === 'string' ? maybe.stack : undefined,
      code: typeof maybe.code === 'string' ? maybe.code : undefined,
    }
  }
  return {
    message: String(error),
  }
}

export function toRpcException(error: unknown): RpcException {
  const normalized = normalizeError(error)
  return new RpcException({
    message: normalized.message ?? 'Internal service error',
    status: normalized.status,
    code: normalized.code,
  })
}
