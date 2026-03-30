const DEFAULT_DEV_BYPASS_EMAIL = 'dev@local';

export function parseSystemAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isSystemAdminEmail(email: string | undefined | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const configuredAdmins = parseSystemAdminEmails(
    process.env.SUPER_ADMIN_EMAILS,
  );
  if (configuredAdmins.includes(normalizedEmail)) {
    return true;
  }

  if (process.env.DEV_BYPASS_ENABLED === 'true') {
    const bypassEmail = (
      process.env.DEV_BYPASS_EMAIL ?? DEFAULT_DEV_BYPASS_EMAIL
    )
      .trim()
      .toLowerCase();

    if (normalizedEmail === bypassEmail) {
      return true;
    }
  }

  return false;
}
