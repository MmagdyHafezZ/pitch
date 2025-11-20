import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { Response } from 'express'
@Catch()
export class MicroserviceExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

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

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    })
  }
}
