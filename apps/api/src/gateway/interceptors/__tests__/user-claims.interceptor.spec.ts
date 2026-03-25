import { of } from 'rxjs';
import { UserClaimsInterceptor } from '../user-claims.interceptor';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeCallHandler = (returnValue: unknown = 'response') => ({
  handle: jest.fn().mockReturnValue(of(returnValue)),
});

const buildContext = (
  user?: Record<string, string>,
  method = 'GET',
  body: Record<string, unknown> = {},
) => {
  const request: Record<string, unknown> = { user, method, body };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  } as any;
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('UserClaimsInterceptor', () => {
  const interceptor = new UserClaimsInterceptor();

  it('calls next.handle() and returns the observable unchanged', (done) => {
    const ctx = buildContext();
    const callHandler = makeCallHandler('ok');

    interceptor.intercept(ctx, callHandler).subscribe({
      next: (val) => {
        expect(val).toBe('ok');
        expect(callHandler.handle).toHaveBeenCalled();
        done();
      },
    });
  });

  it('attaches userClaims to the request when user is present', (done) => {
    const user = { id: 'u1', email: 'u@x.com', name: 'User' };
    const { request, ...ctx } = buildContext(user, 'GET');

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).userClaims).toEqual(user);
        done();
      },
    });
  });

  it('injects __claims into body for non-GET requests', (done) => {
    const user = { id: 'u2', email: 'u@x.com', name: 'Tester' };
    const body = { name: 'New Item' };
    const { request, ...ctx } = buildContext(user, 'POST', body);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).body.__claims).toEqual({
          id: 'u2',
          email: 'u@x.com',
          name: 'Tester',
        });
        done();
      },
    });
  });

  it('does NOT inject __claims into body for GET requests', (done) => {
    const user = { id: 'u3', email: 'u@x.com', name: 'Tester' };
    const body = { q: 'query' };
    const { request, ...ctx } = buildContext(user, 'GET', body);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).body.__claims).toBeUndefined();
        done();
      },
    });
  });

  it('preserves existing body properties when injecting __claims', (done) => {
    const user = { id: 'u4', email: 'u@x.com', name: 'Tester' };
    const body = { foo: 'bar', count: 42 };
    const { request, ...ctx } = buildContext(user, 'PUT', body);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).body.foo).toBe('bar');
        expect((request as any).body.count).toBe(42);
        done();
      },
    });
  });

  it('does nothing when there is no user on the request', (done) => {
    const body = { key: 'val' };
    const { request, ...ctx } = buildContext(undefined, 'POST', body);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).userClaims).toBeUndefined();
        expect((request as any).body.__claims).toBeUndefined();
        done();
      },
    });
  });

  it('handles DELETE requests by injecting __claims', (done) => {
    const user = { id: 'u5', email: 'u@x.com', name: 'Tester' };
    const body = {};
    const { request, ...ctx } = buildContext(user, 'DELETE', body);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).body.__claims).toMatchObject({ id: 'u5' });
        done();
      },
    });
  });

  it('handles PATCH requests by injecting __claims', (done) => {
    const user = { id: 'u6', email: 'u@x.com', name: 'Patcher' };
    const body = { field: 'updated' };
    const { request, ...ctx } = buildContext(user, 'PATCH', body);

    interceptor.intercept(ctx, makeCallHandler()).subscribe({
      complete: () => {
        expect((request as any).body.__claims).toMatchObject({
          id: 'u6',
          email: 'u@x.com',
          name: 'Patcher',
        });
        done();
      },
    });
  });
});
