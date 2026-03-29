import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { GlobalJwtAuthGuard, extractBearer } from '../global-jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../microservices/userManagement/decorators/public.decorator';
import { createMockExecutionContext } from '../../../../test/utils/test-helpers';
import type { ExecutionContext } from '@nestjs/common';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeReflector = (isPublic = false): jest.Mocked<Reflector> =>
  ({
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  }) as unknown as jest.Mocked<Reflector>;

const makeJwtService = (verifyImpl?: () => unknown): jest.Mocked<JwtService> =>
  ({
    verify: jest.fn().mockImplementation(
      verifyImpl ??
        (() => ({
          sub: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
        })),
    ),
  }) as unknown as jest.Mocked<JwtService>;

const buildGuard = (
  isPublic = false,
  verifyImpl?: () => unknown,
): { guard: GlobalJwtAuthGuard; jwtService: jest.Mocked<JwtService> } => {
  const reflector = makeReflector(isPublic);
  const jwtService = makeJwtService(verifyImpl);
  return { guard: new GlobalJwtAuthGuard(reflector, jwtService), jwtService };
};

/** Build a context whose request has a valid Bearer token and optionally a pre-set user. */
const buildContext = (
  overrides: {
    authorization?: string | undefined;
    method?: string;
    url?: string;
    user?: object | undefined;
  } = {},
): ExecutionContext => {
  const ctx = createMockExecutionContext(overrides.user);
  const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
  req.method = overrides.method ?? 'GET';
  req.url = overrides.url ?? '/api/v1/something';
  req.headers = {
    authorization: Object.hasOwn(overrides, 'authorization')
      ? overrides.authorization
      : 'Bearer mock-token',
  };
  return ctx;
};

// ── extractBearer ────────────────────────────────────────────────────────────

describe('extractBearer', () => {
  it('returns the token for a valid Bearer header', () => {
    expect(extractBearer('Bearer abc123')).toBe('abc123');
  });

  it('is case-insensitive for the scheme', () => {
    expect(extractBearer('BEARER abc123')).toBe('abc123');
  });

  it('returns undefined when there is no header', () => {
    expect(extractBearer(undefined)).toBeUndefined();
  });

  it('returns undefined for a Basic auth header', () => {
    expect(extractBearer('Basic credentials')).toBeUndefined();
  });
});

// ── GlobalJwtAuthGuard ───────────────────────────────────────────────────────

describe('GlobalJwtAuthGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
    // Ensure dev bypass is off by default
    delete process.env.DEV_BYPASS_ENABLED;
    delete process.env.DEV_BYPASS_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── already-authenticated fast path ──────────────────────────────────────

  it('returns true immediately when req.user.id is already set', async () => {
    const { guard, jwtService } = buildGuard();
    const ctx = buildContext({ user: { id: 'existing-user' } });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  // ── @Public() decorator ───────────────────────────────────────────────────

  it('returns true for routes marked @Public() without validating the token', async () => {
    const { guard, jwtService } = buildGuard(true);
    const ctx = buildContext({ authorization: undefined });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('calls reflector with IS_PUBLIC_KEY and the handler/class', async () => {
    const reflector = makeReflector(true);
    const guard = new GlobalJwtAuthGuard(reflector, makeJwtService());
    const ctx = buildContext();

    await guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });

  // ── whitelisted routes ────────────────────────────────────────────────────

  it('returns true for a whitelisted route without a token', async () => {
    const { guard, jwtService } = buildGuard();
    const ctx = buildContext({
      method: 'POST',
      url: '/api/v1/auth/login',
      authorization: undefined,
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  // ── missing token ─────────────────────────────────────────────────────────

  it('throws UnauthorizedException when no Bearer token is provided', () => {
    const { guard } = buildGuard();
    const ctx = buildContext({ authorization: undefined });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Access token is required');
  });

  // ── successful JWT validation ─────────────────────────────────────────────

  it('returns true and populates req.user when the JWT is valid', async () => {
    const { guard, jwtService } = buildGuard(false, () => ({
      sub: 'uid-123',
      email: 'user@example.com',
      name: 'Alice',
    }));
    const ctx = buildContext();
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('mock-token', {
      secret: 'test-secret',
    });
    expect(
      (req as { user?: { id: string; email: string } }).user,
    ).toMatchObject({
      id: 'uid-123',
      email: 'user@example.com',
    });
  });

  // ── JWT error cases ───────────────────────────────────────────────────────

  it('throws UnauthorizedException on TokenExpiredError', () => {
    const { guard } = buildGuard(false, () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });
    const ctx = buildContext();

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException on JsonWebTokenError', () => {
    const { guard } = buildGuard(false, () => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });
    const ctx = buildContext();

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws generic UnauthorizedException for unknown JWT errors', () => {
    const { guard } = buildGuard(false, () => {
      throw new Error('something unexpected');
    });
    const ctx = buildContext();

    expect(() => guard.canActivate(ctx)).toThrow('Token validation failed');
  });

  // ── dev bypass ────────────────────────────────────────────────────────────

  it('accepts the dev bypass token and skips JWT verification', async () => {
    process.env.DEV_BYPASS_ENABLED = 'true';
    process.env.DEV_BYPASS_TOKEN = 'dev-secret';
    process.env.DEV_BYPASS_USER_ID = 'bypass-user';

    const { guard, jwtService } = buildGuard();
    const ctx = buildContext({ authorization: 'Bearer dev-secret' });
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
    expect((req as { user?: { id: string } }).user?.id).toBe('bypass-user');
  });

  it('does not treat a random token as bypass when DEV_BYPASS_ENABLED is false', async () => {
    process.env.DEV_BYPASS_ENABLED = 'false';
    process.env.DEV_BYPASS_TOKEN = 'dev-secret';

    const { guard } = buildGuard(false, () => ({
      sub: 'uid',
      email: 'x@x.com',
      name: 'X',
    }));
    // Use a normal mock-token — should go through regular JWT path
    const ctx = buildContext();

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
