import { RpcException } from '@nestjs/microservices/exceptions'
import type { ServiceError } from '../interfaces/error.interface'

export function normalizeError(error: unknown): ServiceError {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? undefined,
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
