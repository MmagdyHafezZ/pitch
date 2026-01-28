import { Catch, Logger, ArgumentsHost } from '@nestjs/common'
import { BaseRpcExceptionFilter } from '@nestjs/microservices'
import { Observable } from 'rxjs'
import { normalizeError, safeStringify } from '../utils/error-logging'

@Catch()
export class RpcExceptionLoggingFilter extends BaseRpcExceptionFilter {
  private readonly logger = new Logger(RpcExceptionLoggingFilter.name)

  catch(exception: unknown, host: ArgumentsHost): Observable<unknown> {
    const rpcHost = host.switchToRpc()
    const error = normalizeError(exception)
    const pattern = (rpcHost as any).getPattern?.()
    const data = rpcHost.getData?.()
    const context = rpcHost.getContext?.()

    const rmqMessage =
      context && typeof context.getMessage === 'function' ? context.getMessage() : undefined

    const rmqMeta = rmqMessage
      ? {
          messageId: rmqMessage.properties?.messageId,
          correlationId: rmqMessage.properties?.correlationId,
          routingKey: rmqMessage.fields?.routingKey,
          exchange: rmqMessage.fields?.exchange,
        }
      : undefined

    this.logger.error(`RPC error: ${error.message}`, error.stack)
    this.logger.error(
      `RPC error context: ${safeStringify({
        pattern,
        data,
        rmq: rmqMeta,
        error,
      })}`
    )

    return super.catch(exception, host)
  }
}
