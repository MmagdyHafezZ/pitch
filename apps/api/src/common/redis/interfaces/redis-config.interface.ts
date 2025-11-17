import { ModuleMetadata, Type } from '@nestjs/common';
import { RedisOptions as IORedisOptions } from 'ioredis';

/**
 * Redis module configuration options
 */
export interface RedisModuleOptions {
  /**
   * Redis connection URL
   * Format: redis://[username]:[password@]host:port[/db]
   * Example: redis://localhost:6379
   */
  url?: string;

  /**
   * Redis host
   * @default 'localhost'
   */
  host?: string;

  /**
   * Redis port
   * @default 6379
   */
  port?: number;

  /**
   * Redis password
   */
  password?: string;

  /**
   * Redis database number
   * @default 0
   */
  db?: number;

  /**
   * Connection timeout in milliseconds
   * @default 10000
   */
  connectTimeout?: number;

  /**
   * Command timeout in milliseconds
   * @default 5000
   */
  commandTimeout?: number;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetriesPerRequest?: number;

  /**
   * Enable auto-reconnect
   * @default true
   */
  enableReadyCheck?: boolean;

  /**
   * Enable offline queue
   * @default true
   */
  enableOfflineQueue?: boolean;

  /**
   * Key prefix for all Redis keys
   * Useful for namespacing in shared Redis instances
   */
  keyPrefix?: string;

  /**
   * Additional IORedis options
   */
  options?: Partial<IORedisOptions>;

  /**
   * Global default TTL in seconds
   * @default 3600 (1 hour)
   */
  defaultTTL?: number;
}

/**
 * Factory for creating RedisModuleOptions
 */
export interface RedisModuleOptionsFactory {
  createRedisModuleOptions(): Promise<RedisModuleOptions> | RedisModuleOptions;
}

/**
 * Async options for Redis module
 */
export interface RedisModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Injection token for the options
   */
  inject?: any[];

  /**
   * Factory function to create options
   */
  useFactory?: (
    ...args: any[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;

  /**
   * Class to use for creating options
   */
  useClass?: Type<RedisModuleOptionsFactory>;

  /**
   * Existing provider to use for creating options
   */
  useExisting?: Type<RedisModuleOptionsFactory>;
}

/**
 * Cache options for set operations
 */
export interface CacheSetOptions {
  /**
   * Time-to-live in seconds
   */
  ttl?: number;

  /**
   * Only set if key doesn't exist
   */
  nx?: boolean;

  /**
   * Only set if key exists
   */
  xx?: boolean;
}

/**
 * Result of a cache operation
 */
export interface CacheResult<T = any> {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * The cached value (if retrieved)
   */
  value?: T;

  /**
   * Error message if operation failed
   */
  error?: string;
}

/**
 * Redis health check result
 */
export interface RedisHealthCheckResult {
  /**
   * Whether Redis is healthy
   */
  healthy: boolean;

  /**
   * Response time in milliseconds
   */
  responseTime?: number;

  /**
   * Error message if unhealthy
   */
  error?: string;

  /**
   * Additional details
   */
  details?: {
    /**
     * Number of connected clients
     */
    connectedClients?: number;

    /**
     * Used memory in bytes
     */
    usedMemory?: number;

    /**
     * Redis version
     */
    version?: string;

    /**
     * Uptime in seconds
     */
    uptime?: number;
  };
}
