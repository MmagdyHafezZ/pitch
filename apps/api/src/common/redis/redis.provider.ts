import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import {
  REDIS_CLIENT,
  REDIS_MODULE_OPTIONS,
  REDIS_DEFAULTS,
} from './constants';
import { RedisModuleOptions } from './interfaces/redis-config.interface';

/**
 * Creates a Redis client provider
 *
 * @returns Provider configuration for Redis client
 */
export const createRedisProvider = (): Provider => ({
  provide: REDIS_CLIENT,
  useFactory: (options: RedisModuleOptions): Redis => {
    let redisClient: Redis;

    // Create Redis client from URL if provided
    if (options.url) {
      redisClient = new Redis(options.url, {
        connectTimeout:
          options.connectTimeout || REDIS_DEFAULTS.CONNECT_TIMEOUT,
        commandTimeout:
          options.commandTimeout || REDIS_DEFAULTS.COMMAND_TIMEOUT,
        maxRetriesPerRequest:
          options.maxRetriesPerRequest || REDIS_DEFAULTS.MAX_RETRIES,
        enableReadyCheck: options.enableReadyCheck ?? true,
        enableOfflineQueue: options.enableOfflineQueue ?? true,
        keyPrefix: options.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > REDIS_DEFAULTS.MAX_RECONNECT_ATTEMPTS) {
            // Stop retrying and return null to close connection
            return null;
          }
          // Exponential backoff with max delay of 10 seconds
          const delay = Math.min(times * REDIS_DEFAULTS.RETRY_DELAY, 10000);
          return delay;
        },
        ...options.options,
      });
    } else {
      // Create Redis client from individual options
      redisClient = new Redis({
        host: options.host || 'localhost',
        port: options.port || 6379,
        password: options.password,
        db: options.db || 0,
        connectTimeout:
          options.connectTimeout || REDIS_DEFAULTS.CONNECT_TIMEOUT,
        commandTimeout:
          options.commandTimeout || REDIS_DEFAULTS.COMMAND_TIMEOUT,
        maxRetriesPerRequest:
          options.maxRetriesPerRequest || REDIS_DEFAULTS.MAX_RETRIES,
        enableReadyCheck: options.enableReadyCheck ?? true,
        enableOfflineQueue: options.enableOfflineQueue ?? true,
        keyPrefix: options.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > REDIS_DEFAULTS.MAX_RECONNECT_ATTEMPTS) {
            return null;
          }
          const delay = Math.min(times * REDIS_DEFAULTS.RETRY_DELAY, 10000);
          return delay;
        },
        ...options.options,
      });
    }

    // Connection event handlers
    redisClient.on('connect', () => {
      console.log('[Redis] Connecting to Redis server...');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Redis client ready');
    });

    redisClient.on('error', (error: Error) => {
      console.error('[Redis] Redis client error:', error.message);
    });

    redisClient.on('close', () => {
      console.log('[Redis] Redis connection closed');
    });

    redisClient.on('reconnecting', (delay: number) => {
      console.log(`[Redis] Reconnecting in ${delay}ms...`);
    });

    redisClient.on('end', () => {
      console.log('[Redis] Redis connection ended');
    });

    return redisClient;
  },
  inject: [REDIS_MODULE_OPTIONS],
});
