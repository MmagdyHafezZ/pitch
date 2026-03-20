import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { CheckSystemAdmin } from './check-system-admin.guard';

describe('CheckSystemAdmin', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function makeHttpContext(user?: { email?: string }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  it('allows emails configured in SUPER_ADMIN_EMAILS', async () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com,owner@example.com';
    const guard = new CheckSystemAdmin();

    await expect(
      guard.canActivate(makeHttpContext({ email: 'Admin@Example.com' })),
    ).resolves.toBe(true);
  });

  it('matches SUPER_ADMIN_EMAILS case-insensitively and trims whitespace', async () => {
    process.env.SUPER_ADMIN_EMAILS =
      '  admin@example.com  , owner@example.com ';
    const guard = new CheckSystemAdmin();

    await expect(
      guard.canActivate(makeHttpContext({ email: 'ADMIN@example.com' })),
    ).resolves.toBe(true);
  });

  it('rejects authenticated non-admin users', async () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com';
    const guard = new CheckSystemAdmin();

    await expect(
      guard.canActivate(makeHttpContext({ email: 'user@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows DEV_BYPASS_EMAIL when dev bypass is enabled', async () => {
    process.env.DEV_BYPASS_ENABLED = 'true';
    process.env.DEV_BYPASS_EMAIL = 'dev@local';
    const guard = new CheckSystemAdmin();

    await expect(
      guard.canActivate(makeHttpContext({ email: 'dev@local' })),
    ).resolves.toBe(true);
  });

  it('allows the default dev bypass email when no override is configured', async () => {
    process.env.DEV_BYPASS_ENABLED = 'true';
    delete process.env.DEV_BYPASS_EMAIL;
    const guard = new CheckSystemAdmin();

    await expect(
      guard.canActivate(makeHttpContext({ email: '  DEV@LOCAL  ' })),
    ).resolves.toBe(true);
  });

  it('rejects users when no admin emails are configured and bypass is disabled', async () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    delete process.env.DEV_BYPASS_ENABLED;
    const guard = new CheckSystemAdmin();

    await expect(
      guard.canActivate(makeHttpContext({ email: 'admin@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing authenticated user context', async () => {
    const guard = new CheckSystemAdmin();

    await expect(guard.canActivate(makeHttpContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
