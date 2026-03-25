import { of, throwError } from 'rxjs';
import { AdminRequestLogInterceptor } from '../admin-request-log.interceptor';
import { AdminRequestLogService } from '../../services/admin/admin-request-log.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeLogService = (): jest.Mocked<AdminRequestLogService> =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<AdminRequestLogService>;

const buildContext = (
  path: string,
  method = 'GET',
  userEmail?: string,
  statusCode = 200,
) => {
  const request = {
    path,
    method,
    user: userEmail ? { email: userEmail } : undefined,
  };
  const response = { statusCode };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
};

const makeCallHandler = (obs = of('response')) => ({
  handle: jest.fn().mockReturnValue(obs),
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('AdminRequestLogInterceptor', () => {
  it('passes through requests that are NOT under /api/v1/admin without logging', (done) => {
    const logService = makeLogService();
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext('/api/v1/something-else');
    const callHandler = makeCallHandler(of('data'));

    interceptor.intercept(ctx, callHandler).subscribe({
      next: (val) => {
        expect(val).toBe('data');
        expect(logService.log).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('calls logService.log after a successful response for admin routes', (done) => {
    const logService = makeLogService();
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext(
      '/api/v1/admin/users',
      'GET',
      'admin@example.com',
      200,
    );
    const callHandler = makeCallHandler(of('ok'));

    interceptor.intercept(ctx, callHandler).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(logService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              adminEmail: 'admin@example.com',
              method: 'GET',
              path: '/api/v1/admin/users',
              statusCode: 200,
            }),
          );
          done();
        });
      },
    });
  });

  it('uses "unknown" as adminEmail when req.user is undefined', (done) => {
    const logService = makeLogService();
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext(
      '/api/v1/admin/feature-flags',
      'POST',
      undefined,
      201,
    );
    const callHandler = makeCallHandler(of('created'));

    interceptor.intercept(ctx, callHandler).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(logService.log).toHaveBeenCalledWith(
            expect.objectContaining({ adminEmail: 'unknown' }),
          );
          done();
        });
      },
    });
  });

  it('calls logService.log with status 500 on an error response for admin routes', (done) => {
    const logService = makeLogService();
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext(
      '/api/v1/admin/impersonate',
      'POST',
      'admin@example.com',
    );
    const err = { status: 500, message: 'boom' };
    const callHandler = makeCallHandler(throwError(() => err));

    interceptor.intercept(ctx, callHandler).subscribe({
      error: () => {
        setImmediate(() => {
          expect(logService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              statusCode: 500,
              adminEmail: 'admin@example.com',
            }),
          );
          done();
        });
      },
    });
  });

  it('uses status code from the error object when available', (done) => {
    const logService = makeLogService();
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext('/api/v1/admin/something', 'DELETE', 'a@b.com');
    const err = { status: 403 };
    const callHandler = makeCallHandler(throwError(() => err));

    interceptor.intercept(ctx, callHandler).subscribe({
      error: () => {
        setImmediate(() => {
          expect(logService.log).toHaveBeenCalledWith(
            expect.objectContaining({ statusCode: 403 }),
          );
          done();
        });
      },
    });
  });

  it('includes durationMs in the log entry', (done) => {
    const logService = makeLogService();
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext(
      '/api/v1/admin/users',
      'GET',
      'admin@example.com',
      200,
    );
    const callHandler = makeCallHandler(of('ok'));

    interceptor.intercept(ctx, callHandler).subscribe({
      complete: () => {
        setImmediate(() => {
          const call = logService.log.mock.calls[0]?.[0] as {
            durationMs?: number;
          };
          expect(typeof call?.durationMs).toBe('number');
          expect(call?.durationMs).toBeGreaterThanOrEqual(0);
          done();
        });
      },
    });
  });

  it('silently ignores errors thrown by logService.log', (done) => {
    const logService = makeLogService();
    logService.log.mockRejectedValue(new Error('db down'));
    const interceptor = new AdminRequestLogInterceptor(logService);
    const ctx = buildContext(
      '/api/v1/admin/users',
      'GET',
      'admin@example.com',
      200,
    );
    const callHandler = makeCallHandler(of('ok'));

    // Should complete without propagating the log error
    interceptor.intercept(ctx, callHandler).subscribe({
      complete: () => done(),
      error: done,
    });
  });
});
