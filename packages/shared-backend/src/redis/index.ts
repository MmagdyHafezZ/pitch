/**
 * Redis Module Exports
 *
 * Central export point for the global Redis module.
 * Import from this file to access Redis functionality in your microservices.
 *
 * @example
 * ```typescript
 * import { RedisModule, RedisService } from '@/common/redis';
 * ```
 */

export { RedisModule } from './redis.module'

export { RedisService } from './redis.service'
export { RedisHealthIndicator } from './redis-health.indicator'

export * from './interfaces/redis-config.interface'

export * from './constants'
