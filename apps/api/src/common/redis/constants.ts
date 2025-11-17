/**
 * Redis Constants and Tokens
 *
 * Defines injection tokens and constants used throughout the Redis module
 */

/**
 * Injection token for Redis client
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Injection token for Redis module options
 */
export const REDIS_MODULE_OPTIONS = 'REDIS_MODULE_OPTIONS';

/**
 * Default Redis configuration values
 */
export const REDIS_DEFAULTS = {
  /**
   * Default connection timeout in milliseconds
   */
  CONNECT_TIMEOUT: 10000,

  /**
   * Default command timeout in milliseconds
   */
  COMMAND_TIMEOUT: 5000,

  /**
   * Default number of retry attempts
   */
  MAX_RETRIES: 3,

  /**
   * Default retry delay in milliseconds
   */
  RETRY_DELAY: 500,

  /**
   * Default TTL for cache entries (1 hour)
   */
  DEFAULT_TTL: 3600,

  /**
   * Maximum number of reconnection attempts
   */
  MAX_RECONNECT_ATTEMPTS: 10,

  /**
   * Reconnection delay in milliseconds
   */
  RECONNECT_DELAY: 3000,
} as const;

/**
 * Common Redis key prefixes for different domains
 */
export const REDIS_KEY_PREFIXES = {
  SESSION: 'session',
  CACHE: 'cache',
  RATE_LIMIT: 'rate_limit',
  LOCK: 'lock',
  QUEUE: 'queue',
  PUBSUB: 'pubsub',
} as const;

/**
 * Common TTL values (in seconds)
 */
export const REDIS_TTL = {
  /** 5 minutes */
  SHORT: 300,
  /** 15 minutes */
  MEDIUM: 900,
  /** 1 hour */
  LONG: 3600,
  /** 6 hours */
  EXTRA_LONG: 21600,
  /** 24 hours */
  DAY: 86400,
  /** 7 days */
  WEEK: 604800,
} as const;
