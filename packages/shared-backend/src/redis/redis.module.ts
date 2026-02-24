import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { RedisService } from './redis.service'
import { createRedisProvider } from './redis.provider'
import { RedisHealthIndicator } from './redis-health.indicator'
import { REDIS_CLIENT, REDIS_MODULE_OPTIONS } from './constants'
import {
  RedisModuleOptions,
  RedisModuleAsyncOptions,
  RedisModuleOptionsFactory,
} from './interfaces/redis-config.interface'

/**
 * Redis Module
 *
 * Global module that provides Redis caching functionality across all microservices.
 *
 * Usage:
 *
 * 1. Synchronous configuration:
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRoot({
 *       url: process.env.REDIS_URL,
 *       keyPrefix: 'myservice:',
 *       defaultTTL: 3600,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * 2. Asynchronous configuration:
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (configService: ConfigService) => ({
 *         url: configService.get('REDIS_URL'),
 *         keyPrefix: 'myservice:',
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * 3. Using in services:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly redisService: RedisService) {}
 *
 *   async cacheData(key: string, data: any) {
 *     await this.redisService.set(key, data, { ttl: 3600 });
 *   }
 * }
 * ```
 */
@Global()
@Module({})
export class RedisModule {
  /**
   * Register Redis module synchronously
   *
   * @param options - Redis module options
   * @returns Dynamic module
   */
  static forRoot(options: RedisModuleOptions): DynamicModule {
    const redisProvider = createRedisProvider()

    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_MODULE_OPTIONS,
          useValue: options,
        },
        redisProvider,
        RedisService,
        RedisHealthIndicator,
      ],
      exports: [REDIS_CLIENT, RedisService, RedisHealthIndicator],
    }
  }

  /**
   * Register Redis module asynchronously
   *
   * @param options - Async Redis module options
   * @returns Dynamic module
   */
  static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const redisProvider = createRedisProvider()

    return {
      module: RedisModule,
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        redisProvider,
        RedisService,
        RedisHealthIndicator,
      ],
      exports: [REDIS_CLIENT, RedisService, RedisHealthIndicator],
    }
  }

  /**
   * Create async providers for module options
   */
  private static createAsyncProviders(options: RedisModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: REDIS_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ]
    }

    if (options.useClass) {
      return [
        {
          provide: REDIS_MODULE_OPTIONS,
          useFactory: async (optionsFactory: RedisModuleOptionsFactory) =>
            await optionsFactory.createRedisModuleOptions(),
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ]
    }

    if (options.useExisting) {
      return [
        {
          provide: REDIS_MODULE_OPTIONS,
          useFactory: async (optionsFactory: RedisModuleOptionsFactory) =>
            await optionsFactory.createRedisModuleOptions(),
          inject: [options.useExisting],
        },
      ]
    }

    return []
  }
}
