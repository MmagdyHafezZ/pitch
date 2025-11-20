import { RpcException } from '@nestjs/microservices/exceptions'

export function toRpcException(error: unknown): RpcException {
  if (error instanceof Error) return new RpcException(error.message)
  return new RpcException(String(error))
}
