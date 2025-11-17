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

// Module
export { RedisModule } from './redis.module';

// Services
export { RedisService } from './redis.service';
export { RedisHealthIndicator } from './redis-health.indicator';

// Interfaces
export * from './interfaces/redis-config.interface';

// Constants
export * from './constants';
