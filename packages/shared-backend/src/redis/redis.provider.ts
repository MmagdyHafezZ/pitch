import { Provider } from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT, REDIS_MODULE_OPTIONS, REDIS_DEFAULTS } from './constants'
import { RedisModuleOptions } from './interfaces/redis-config.interface'

/**
 * Creates a Redis client provider
 *
 * @returns Provider configuration for Redis client
 */
export const createRedisProvider = (): Provider => ({
  provide: REDIS_CLIENT,
  useFactory: (options: RedisModuleOptions): Redis => {
    let redisClient: Redis

    if (options.url) {
      redisClient = new Redis(options.url, {
        connectTimeout: options.connectTimeout || REDIS_DEFAULTS.CONNECT_TIMEOUT,
        commandTimeout: options.commandTimeout || REDIS_DEFAULTS.COMMAND_TIMEOUT,
        maxRetriesPerRequest: options.maxRetriesPerRequest || REDIS_DEFAULTS.MAX_RETRIES,
        enableReadyCheck: options.enableReadyCheck ?? true,
        enableOfflineQueue: options.enableOfflineQueue ?? true,
        keyPrefix: options.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > REDIS_DEFAULTS.MAX_RECONNECT_ATTEMPTS) {
            return null
          }
          const delay = Math.min(times * REDIS_DEFAULTS.RETRY_DELAY, 10000)
          return delay
        },
        ...options.options,
      })
    } else {
      redisClient = new Redis({
        host: options.host || 'localhost',
        port: options.port || 6379,
        password: options.password,
        db: options.db || 0,
        connectTimeout: options.connectTimeout || REDIS_DEFAULTS.CONNECT_TIMEOUT,
        commandTimeout: options.commandTimeout || REDIS_DEFAULTS.COMMAND_TIMEOUT,
        maxRetriesPerRequest: options.maxRetriesPerRequest || REDIS_DEFAULTS.MAX_RETRIES,
        enableReadyCheck: options.enableReadyCheck ?? true,
        enableOfflineQueue: options.enableOfflineQueue ?? true,
        keyPrefix: options.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > REDIS_DEFAULTS.MAX_RECONNECT_ATTEMPTS) {
            return null
          }
          const delay = Math.min(times * REDIS_DEFAULTS.RETRY_DELAY, 10000)
          return delay
        },
        ...options.options,
      })
    }

    redisClient.on('connect', () => {})

    redisClient.on('ready', () => {})

    redisClient.on('error', (error: Error) => {})

    redisClient.on('close', () => {})

    redisClient.on('reconnecting', (delay: number) => {})

    redisClient.on('end', () => {})

    return redisClient
  },
  inject: [REDIS_MODULE_OPTIONS],
})
