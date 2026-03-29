import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CheckSystemAdmin } from '../check-system-admin.guard';
import { createMockExecutionContext } from '../../../../test/utils/test-helpers';

const makeJwtService = (verifyImpl?: () => unknown): jest.Mocked<JwtService> =>
  ({
    verify: jest
      .fn()
      .mockImplementation(
        verifyImpl ??
          (() => ({
            sub: 'user-id',
            email: 'admin@example.com',
            name: 'Admin',
          })),
      ),
  }) as unknown as jest.Mocked<JwtService>;

describe('CheckSystemAdmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret',
      SUPER_ADMIN_EMAILS: 'admin@example.com,super@example.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws UnauthorizedException when no authorization header is present', () => {
    const jwtService = makeJwtService();
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    req.headers.authorization = undefined;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access token is required',
    );
  });

  it('throws UnauthorizedException when authorization header is not a Bearer token', () => {
    const jwtService = makeJwtService();
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    req.headers.authorization = 'Basic somebase64value';

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('returns true when the JWT email is in SUPER_ADMIN_EMAILS', async () => {
    const jwtService = makeJwtService(() => ({
      sub: 'user-id',
      email: 'admin@example.com',
      name: 'Admin',
    }));
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('is case-insensitive for email comparison', async () => {
    const jwtService = makeJwtService(() => ({
      sub: 'user-id',
      email: 'ADMIN@EXAMPLE.COM',
      name: 'Admin',
    }));
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('returns false when the JWT email is NOT in SUPER_ADMIN_EMAILS', async () => {
    const jwtService = makeJwtService(() => ({
      sub: 'user-id',
      email: 'regular@example.com',
      name: 'Regular User',
    }));
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('returns false when SUPER_ADMIN_EMAILS env var is not set', async () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    const jwtService = makeJwtService(() => ({
      sub: 'user-id',
      email: 'admin@example.com',
      name: 'Admin',
    }));
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('returns false (does not throw) when JWT verification throws', async () => {
    const jwtService = makeJwtService(() => {
      throw new Error('invalid signature');
    });
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('trims whitespace from SUPER_ADMIN_EMAILS entries', async () => {
    process.env.SUPER_ADMIN_EMAILS =
      '  admin@example.com  ,  super@example.com  ';
    const jwtService = makeJwtService(() => ({
      sub: 'user-id',
      email: 'admin@example.com',
      name: 'Admin',
    }));
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('recognises the second email in the SUPER_ADMIN_EMAILS list', async () => {
    const jwtService = makeJwtService(() => ({
      sub: 'user-id-2',
      email: 'super@example.com',
      name: 'Super',
    }));
    const guard = new CheckSystemAdmin(jwtService);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
