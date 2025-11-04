/**
 * JWT Configuration Utilities
 *
 * Provides secure JWT configuration with mandatory secret validation.
 * Prevents weak or missing JWT secrets from being used in production.
 */

const MIN_SECRET_LENGTH = 32;

/**
 * Validates and retrieves JWT secret from environment
 *
 * SECURITY: Enforces minimum secret length to prevent weak cryptography
 *
 * @returns JWT secret
 * @throws Error if JWT_SECRET is missing or too short
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
        `Must be at least ${MIN_SECRET_LENGTH} characters long.`,
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
        `Current length: ${secret.length}`,
    );
  }

  // Warn if using common weak secrets
  const weakSecrets = ['secret', 'your-secret-key', 'changeme', 'password'];
  if (weakSecrets.some((weak) => secret.toLowerCase().includes(weak))) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET appears to contain common weak patterns. ' +
        'Please use a cryptographically strong random secret.',
    );
  }

  return secret;
}

/**
 * Gets JWT access token expiration from environment
 * @returns Expiration time (default: 15m)
 */
export function getJwtAccessExpiration(): string {
  return process.env.JWT_ACCESS_EXPIRATION || '15m';
}

/**
 * Gets JWT refresh token expiration from environment
 * @returns Expiration time (default: 7d)
 */
export function getJwtRefreshExpiration(): string {
  return process.env.JWT_REFRESH_EXPIRATION || '7d';
}
