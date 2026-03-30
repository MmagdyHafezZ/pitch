import {
  isSystemAdminEmail,
  parseSystemAdminEmails,
} from './system-admin-access';

describe('system-admin-access', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('normalizes configured admin emails from csv input', () => {
    expect(
      parseSystemAdminEmails('  Admin@Example.com, owner@example.com ,, '),
    ).toEqual(['admin@example.com', 'owner@example.com']);
  });

  it('returns false for blank email values', () => {
    delete process.env.SUPER_ADMIN_EMAILS;

    expect(isSystemAdminEmail(undefined)).toBe(false);
    expect(isSystemAdminEmail(null)).toBe(false);
    expect(isSystemAdminEmail('   ')).toBe(false);
  });

  it('matches configured admin emails case-insensitively', () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com,owner@example.com';

    expect(isSystemAdminEmail(' Admin@Example.com ')).toBe(true);
    expect(isSystemAdminEmail('owner@example.com')).toBe(true);
    expect(isSystemAdminEmail('user@example.com')).toBe(false);
  });

  it('allows the dev bypass email only when bypass is enabled', () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    process.env.DEV_BYPASS_EMAIL = 'dev-admin@local';

    expect(isSystemAdminEmail('dev-admin@local')).toBe(false);

    process.env.DEV_BYPASS_ENABLED = 'true';
    expect(isSystemAdminEmail(' DEV-ADMIN@LOCAL ')).toBe(true);
  });

  it('falls back to the default dev bypass email', () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    process.env.DEV_BYPASS_ENABLED = 'true';
    delete process.env.DEV_BYPASS_EMAIL;

    expect(isSystemAdminEmail('dev@local')).toBe(true);
    expect(isSystemAdminEmail('other@local')).toBe(false);
  });
});
