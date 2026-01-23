import {
  ExceptionFilter,
  Catch,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  ArgumentsHost,
} from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import type { Request } from 'express'
import { normalizeError, safeStringify } from '../utils/error-logging'

@Catch(PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter<PrismaClientKnownRequestError> {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name)

  catch(exception: PrismaClientKnownRequestError, host?: ArgumentsHost) {
    const error = normalizeError(exception)
    const httpHost = host?.switchToHttp()
    const request =
      httpHost && typeof httpHost.getRequest === 'function'
        ? httpHost.getRequest<Request>()
        : undefined
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

    this.logger.error(`Prisma error ${exception.code}: ${exception.message}`, error.stack)
    this.logger.error(
      `Prisma error context: ${safeStringify({
        code: exception.code,
        meta: exception.meta,
        request: requestContext,
        error,
      })}`
    )

    switch (exception.code) {
      case 'P2025': {
        throw new NotFoundException('Record not found')
      }
      case 'P2002': {
        throw new ConflictException('Unique constraint failed')
      }
      default: {
        throw new InternalServerErrorException('Database error')
      }
    }
  }
}
