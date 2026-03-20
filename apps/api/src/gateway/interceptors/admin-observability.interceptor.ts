import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { AdminObservabilityService } from '../controllers/admin/admin-observability.service';

type RequestWithUser = Request & {
  user?: {
    id?: string;
    email?: string;
  };
};

@Injectable()
export class AdminObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly adminObservability: AdminObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithUser>();
    const res = http.getResponse<Response>();
    const startedAt = Date.now();
    let capturedError: unknown;

    return next.handle().pipe(
      catchError((error: unknown) => {
        capturedError = error;
        const normalized = normalizeError(error);
        this.adminObservability.recordError({
          message: normalized.message ?? 'Request failed',
          name:
            error instanceof Error
              ? error.name
              : error instanceof HttpException
                ? error.name
                : undefined,
          statusCode:
            error instanceof HttpException
              ? error.getStatus()
              : normalized.status,
          method: req.method,
          path: req.originalUrl || req.url,
          stack: error instanceof Error ? error.stack : undefined,
          details:
            typeof normalized === 'object' && normalized
              ? {
                  code: normalized.code,
                }
              : undefined,
          userId: req.user?.id,
          userEmail: req.user?.email,
        });
        return throwError(() => error);
      }),
      finalize(() => {
        const completedAt = new Date();
        const statusCode =
          capturedError instanceof HttpException
            ? capturedError.getStatus()
            : res.statusCode;

        this.adminObservability.recordRequest({
          method: req.method,
          path: req.path || req.originalUrl || req.url,
          url: req.originalUrl || req.url,
          statusCode,
          durationMs: Date.now() - startedAt,
          requestAt: new Date(startedAt).toISOString(),
          completedAt: completedAt.toISOString(),
          ip: req.ip,
          userId: req.user?.id,
          userEmail: req.user?.email,
        });
      }),
    );
  }
}
