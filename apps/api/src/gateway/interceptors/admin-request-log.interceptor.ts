import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminRequestLogService } from '../services/admin/admin-request-log.service';

@Injectable()
export class AdminRequestLogInterceptor implements NestInterceptor {
  constructor(private readonly logService: AdminRequestLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      user?: { email?: string };
    }>();

    if (!req.path?.startsWith('/api/v1/admin')) {
      return next.handle();
    }

    const start = Date.now();
    const method = req.method ?? 'GET';
    const path = req.path;
    const adminEmail = req.user?.email ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
          this.logService
            .log({
              adminEmail,
              method,
              path,
              statusCode: res.statusCode ?? 200,
              durationMs: Date.now() - start,
            })
            .catch(() => {
              // ignore log errors
            });
        },
        error: (err: { status?: number }) => {
          this.logService
            .log({
              adminEmail,
              method,
              path,
              statusCode: err?.status ?? 500,
              durationMs: Date.now() - start,
            })
            .catch(() => {
              // ignore log errors
            });
        },
      }),
    );
  }
}
