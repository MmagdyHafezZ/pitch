import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { Response } from 'express'
import type { Request } from 'express'
import { normalizeError, safeStringify } from '../utils/error-logging'
@Catch()
export class MicroserviceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MicroserviceExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = typeof ctx.getRequest === 'function' ? ctx.getRequest<Request>() : undefined
    const error = normalizeError(exception)

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      message = exception.message
    } else if (exception instanceof RpcException) {
      const error = exception.getError()
      if (typeof error === 'string') {
        message = error
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as { statusCode?: number; message?: string }
        status = errorObj.statusCode ?? status
        message = errorObj.message ?? message
      }
    }

    const requestContext = request
      ? {
          method: request.method,
          url: request.originalUrl ?? request.url,
          params: request.params,
          query: request.query,
          body: request.body,
          requestId:
            (request.headers['x-request-id'] as string | undefined) ??
            (request.headers['x-correlation-id'] as string | undefined),
          userId: (request as { user?: { id?: string } }).user?.id,
        }
      : undefined

    this.logger.error(`HTTP error ${status}: ${message}`, error.stack)
    this.logger.error(
      `HTTP error context: ${safeStringify({
        status,
        message,
        request: requestContext,
        error,
      })}`
    )

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    })
  }
}
