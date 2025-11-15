/**
 * Redis Service Layer for Simulation Microservice
 *
 * Provides typed Redis operations for ephemeral and cached data.
 *
 * Design Principles:
 * 1. All Redis data is ephemeral with TTL
 * 2. Can be reconstructed from PostgreSQL/MongoDB
 * 3. Used for: cache, coordination, ephemeral state
 * 4. No critical business logic depends solely on Redis
 *
 * Usage:
 * - Import SimulationRedisService and inject into services
 * - Use typed methods for specific data patterns
 * - All serialization/deserialization handled automatically
 */

export { SimulationRedisService } from './redis.service';
export * from './redis-key-patterns';
