import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import {
  REDIS_CLIENT,
  REDIS_MODULE_OPTIONS,
  REDIS_DEFAULTS,
} from './constants';
import * as redisConfigInterface from './interfaces/redis-config.interface';

/**
 * Global Redis Service
 *
 * Provides common Redis caching operations that can be used across all microservices.
 * Features:
 * - Basic key-value operations (get, set, delete)
 * - JSON serialization/deserialization
 * - TTL management
 * - Pattern-based operations
 * - Hash operations
 * - List operations
 * - Set operations
 * - Distributed locking
 * - Pub/Sub support
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly defaultTTL: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(REDIS_MODULE_OPTIONS)
    private readonly options: redisConfigInterface.RedisModuleOptions,
  ) {
    this.defaultTTL = options.defaultTTL || REDIS_DEFAULTS.DEFAULT_TTL;
  }

  // ============================================================================
  // Core Key-Value Operations
  // ============================================================================

  /**
   * Get a value from Redis
   *
   * @param key - Redis key
   * @returns The cached value or null if not found
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return this.deserialize<T>(value);
    } catch (error) {
      this.logger.error(`Error getting key "${key}":`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis
   *
   * @param key - Redis key
   * @param value - Value to cache
   * @param options - Cache options (TTL, NX, XX)
   * @returns True if successful, false otherwise
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: redisConfigInterface.CacheSetOptions,
  ): Promise<boolean> {
    try {
      const serialized = this.serialize(value);
      const ttl = options?.ttl || this.defaultTTL;

      if (options?.nx) {
        // Only set if key doesn't exist
        const result = await this.redis.set(key, serialized, 'EX', ttl, 'NX');
        return result === 'OK';
      } else if (options?.xx) {
        // Only set if key exists
        const result = await this.redis.set(key, serialized, 'EX', ttl, 'XX');
        return result === 'OK';
      } else {
        // Normal set
        await this.redis.setex(key, ttl, serialized);
        return true;
      }
    } catch (error) {
      this.logger.error(`Error setting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Delete one or more keys
   *
   * @param keys - Key(s) to delete
   * @returns Number of keys deleted
   */
  async delete(...keys: string[]): Promise<number> {
    try {
      return await this.redis.del(...keys);
    } catch (error) {
      this.logger.error(`Error deleting keys:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   *
   * @param key - Redis key
   * @returns True if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking existence of key "${key}":`, error);
      return false;
    }
  }

  /**
   * Set a key's TTL (time to live)
   *
   * @param key - Redis key
   * @param seconds - TTL in seconds
   * @returns True if successful, false otherwise
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error setting expiration for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Get a key's TTL
   *
   * @param key - Redis key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for key "${key}":`, error);
      return -2;
    }
  }

  // ============================================================================
  // Pattern-based Operations
  // ============================================================================

  /**
   * Find keys matching a pattern
   *
   * @param pattern - Redis key pattern (e.g., "user:*")
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error(`Error finding keys with pattern "${pattern}":`, error);
      return [];
    }
  }

  /**
   * Delete all keys matching a pattern
   *
   * @param pattern - Redis key pattern
   * @returns Number of keys deleted
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.delete(...keys);
    } catch (error) {
      this.logger.error(
        `Error deleting keys with pattern "${pattern}":`,
        error,
      );
      return 0;
    }
  }

  // ============================================================================
  // Hash Operations
  // ============================================================================

  /**
   * Set a hash field
   *
   * @param key - Redis key
   * @param field - Hash field
   * @param value - Field value
   * @returns True if successful, false otherwise
   */
  async hset<T = any>(key: string, field: string, value: T): Promise<boolean> {
    try {
      const serialized = this.serialize(value);
      await this.redis.hset(key, field, serialized);
      return true;
    } catch (error) {
      this.logger.error(
        `Error setting hash field "${field}" in "${key}":`,
        error,
      );
      return false;
    }
  }

  /**
   * Get a hash field
   *
   * @param key - Redis key
   * @param field - Hash field
   * @returns Field value or null if not found
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (!value) return null;
      return this.deserialize<T>(value);
    } catch (error) {
      this.logger.error(
        `Error getting hash field "${field}" from "${key}":`,
        error,
      );
      return null;
    }
  }

  /**
   * Get all fields and values in a hash
   *
   * @param key - Redis key
   * @returns Object with all fields and values
   */
  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    try {
      const data = await this.redis.hgetall(key);
      const result: Record<string, T> = {};

      for (const [field, value] of Object.entries(data)) {
        result[field] = this.deserialize<T>(value);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error getting all hash fields from "${key}":`, error);
      return {};
    }
  }

  /**
   * Delete hash fields
   *
   * @param key - Redis key
   * @param fields - Field(s) to delete
   * @returns Number of fields deleted
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.redis.hdel(key, ...fields);
    } catch (error) {
      this.logger.error(`Error deleting hash fields from "${key}":`, error);
      return 0;
    }
  }

  // ============================================================================
  // List Operations
  // ============================================================================

  /**
   * Push values to the left (head) of a list
   *
   * @param key - Redis key
   * @param values - Values to push
   * @returns Length of list after push
   */
  async lpush<T = any>(key: string, ...values: T[]): Promise<number> {
    try {
      const serialized = values.map((v) => this.serialize(v));
      return await this.redis.lpush(key, ...serialized);
    } catch (error) {
      this.logger.error(`Error pushing to list "${key}":`, error);
      return 0;
    }
  }

  /**
   * Push values to the right (tail) of a list
   *
   * @param key - Redis key
   * @param values - Values to push
   * @returns Length of list after push
   */
  async rpush<T = any>(key: string, ...values: T[]): Promise<number> {
    try {
      const serialized = values.map((v) => this.serialize(v));
      return await this.redis.rpush(key, ...serialized);
    } catch (error) {
      this.logger.error(`Error pushing to list "${key}":`, error);
      return 0;
    }
  }

  /**
   * Get a range of elements from a list
   *
   * @param key - Redis key
   * @param start - Start index
   * @param stop - Stop index
   * @returns Array of values
   */
  async lrange<T = any>(
    key: string,
    start: number,
    stop: number,
  ): Promise<T[]> {
    try {
      const values = await this.redis.lrange(key, start, stop);
      return values.map((v) => this.deserialize<T>(v));
    } catch (error) {
      this.logger.error(`Error getting range from list "${key}":`, error);
      return [];
    }
  }

  /**
   * Get list length
   *
   * @param key - Redis key
   * @returns List length
   */
  async llen(key: string): Promise<number> {
    try {
      return await this.redis.llen(key);
    } catch (error) {
      this.logger.error(`Error getting length of list "${key}":`, error);
      return 0;
    }
  }

  // ============================================================================
  // Set Operations
  // ============================================================================

  /**
   * Add members to a set
   *
   * @param key - Redis key
   * @param members - Members to add
   * @returns Number of members added
   */
  async sadd<T = any>(key: string, ...members: T[]): Promise<number> {
    try {
      const serialized = members.map((m) => this.serialize(m));
      return await this.redis.sadd(key, ...serialized);
    } catch (error) {
      this.logger.error(`Error adding to set "${key}":`, error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   *
   * @param key - Redis key
   * @returns Array of members
   */
  async smembers<T = any>(key: string): Promise<T[]> {
    try {
      const members = await this.redis.smembers(key);
      return members.map((m) => this.deserialize<T>(m));
    } catch (error) {
      this.logger.error(`Error getting members from set "${key}":`, error);
      return [];
    }
  }

  /**
   * Check if a value is a member of a set
   *
   * @param key - Redis key
   * @param member - Member to check
   * @returns True if member exists, false otherwise
   */
  async sismember<T = any>(key: string, member: T): Promise<boolean> {
    try {
      const serialized = this.serialize(member);
      const result = await this.redis.sismember(key, serialized);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking set membership in "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove members from a set
   *
   * @param key - Redis key
   * @param members - Members to remove
   * @returns Number of members removed
   */
  async srem<T = any>(key: string, ...members: T[]): Promise<number> {
    try {
      const serialized = members.map((m) => this.serialize(m));
      return await this.redis.srem(key, ...serialized);
    } catch (error) {
      this.logger.error(`Error removing from set "${key}":`, error);
      return 0;
    }
  }

  // ============================================================================
  // Distributed Lock
  // ============================================================================

  /**
   * Acquire a distributed lock
   *
   * @param key - Lock key
   * @param ttl - Lock TTL in seconds
   * @param value - Lock value (defaults to random UUID)
   * @returns Lock value if acquired, null otherwise
   */
  async acquireLock(
    key: string,
    ttl: number = 30,
    value?: string,
  ): Promise<string | null> {
    try {
      const lockValue = value || this.generateLockId();
      const result = await this.redis.set(key, lockValue, 'EX', ttl, 'NX');
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      this.logger.error(`Error acquiring lock "${key}":`, error);
      return null;
    }
  }

  /**
   * Release a distributed lock
   *
   * @param key - Lock key
   * @param value - Lock value (must match the value used to acquire the lock)
   * @returns True if released, false otherwise
   */
  async releaseLock(key: string, value: string): Promise<boolean> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await this.redis.eval(script, 1, key, value);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error releasing lock "${key}":`, error);
      return false;
    }
  }

  // ============================================================================
  // Increment/Decrement Operations
  // ============================================================================

  /**
   * Increment a key's value
   *
   * @param key - Redis key
   * @param increment - Amount to increment (default: 1)
   * @returns New value after increment
   */
  async incr(key: string, increment: number = 1): Promise<number> {
    try {
      if (increment === 1) {
        return await this.redis.incr(key);
      }
      return await this.redis.incrby(key, increment);
    } catch (error) {
      this.logger.error(`Error incrementing key "${key}":`, error);
      return 0;
    }
  }

  /**
   * Decrement a key's value
   *
   * @param key - Redis key
   * @param decrement - Amount to decrement (default: 1)
   * @returns New value after decrement
   */
  async decr(key: string, decrement: number = 1): Promise<number> {
    try {
      if (decrement === 1) {
        return await this.redis.decr(key);
      }
      return await this.redis.decrby(key, decrement);
    } catch (error) {
      this.logger.error(`Error decrementing key "${key}":`, error);
      return 0;
    }
  }

  // ============================================================================
  // Pub/Sub Operations
  // ============================================================================

  /**
   * Publish a message to a channel
   *
   * @param channel - Channel name
   * @param message - Message to publish
   * @returns Number of subscribers that received the message
   */
  async publish<T = any>(channel: string, message: T): Promise<number> {
    try {
      const serialized = this.serialize(message);
      return await this.redis.publish(channel, serialized);
    } catch (error) {
      this.logger.error(`Error publishing to channel "${channel}":`, error);
      return 0;
    }
  }

  /**
   * Subscribe to a channel
   * Note: This creates a new Redis connection for subscribing
   *
   * @param channel - Channel name
   * @param callback - Callback function to handle messages
   */
  async subscribe<T = any>(
    channel: string,
    callback: (message: T) => void,
  ): Promise<void> {
    try {
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe(channel);

      subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          const deserialized = this.deserialize<T>(message);
          callback(deserialized);
        }
      });
    } catch (error) {
      this.logger.error(`Error subscribing to channel "${channel}":`, error);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Ping Redis server
   *
   * @returns True if Redis responds, false otherwise
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Error pinging Redis:', error);
      return false;
    }
  }

  /**
   * Flush all keys in current database
   * WARNING: This deletes all data!
   *
   * @returns True if successful, false otherwise
   */
  async flushDb(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      this.logger.error('Error flushing database:', error);
      return false;
    }
  }

  /**
   * Get Redis info
   *
   * @param section - Info section (e.g., 'server', 'memory', 'stats')
   * @returns Redis info string
   */
  async info(section?: string): Promise<string> {
    try {
      if (section) {
        return await this.redis.info(section);
      }
      return await this.redis.info();
    } catch (error) {
      this.logger.error('Error getting Redis info:', error);
      return '';
    }
  }

  /**
   * Get the underlying Redis client
   * Use this for advanced operations not covered by this service
   *
   * @returns Redis client instance
   */
  getClient(): Redis {
    return this.redis;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Serialize a value to JSON string
   */
  private serialize<T>(value: T): string {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  /**
   * Deserialize a JSON string to value
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      // If parsing fails, return as-is (probably a plain string)
      return value as unknown as T;
    }
  }

  /**
   * Generate a unique lock ID
   */
  private generateLockId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
