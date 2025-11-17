import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from './redis.service';
import { RedisHealthCheckResult } from './interfaces/redis-config.interface';

/**
 * Redis Health Indicator
 *
 * Provides health check functionality for Redis connections.
 * Used with @nestjs/terminus for comprehensive health monitoring.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  /**
   * Check Redis health
   *
   * @param key - Health check identifier key
   * @returns Health indicator result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      // Ping Redis to check connectivity
      const isAlive = await this.redisService.ping();

      if (!isAlive) {
        throw new Error('Redis ping failed');
      }

      const responseTime = Date.now() - startTime;

      // Get additional Redis info
      const info = await this.getRedisInfo();

      return {
        [key]: {
          status: 'up',
          healthy: true,
          responseTime,
          details: info,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new HealthCheckError('Redis check failed', {
        [key]: {
          status: 'down',
          healthy: false,
          responseTime,
          error: errorMessage,
        },
      });
    }
  }

  /**
   * Get detailed Redis information
   *
   * @returns Redis details or empty object if unavailable
   */
  private async getRedisInfo(): Promise<
    RedisHealthCheckResult['details'] | undefined
  > {
    try {
      const infoStr = await this.redisService.info();
      const info = this.parseRedisInfo(infoStr);

      return {
        connectedClients: info.connected_clients
          ? parseInt(info.connected_clients, 10)
          : undefined,
        usedMemory: info.used_memory
          ? parseInt(info.used_memory, 10)
          : undefined,
        version: info.redis_version,
        uptime: info.uptime_in_seconds
          ? parseInt(info.uptime_in_seconds, 10)
          : undefined,
      };
    } catch (error) {
      // If we can't get detailed info, that's okay
      return undefined;
    }
  }

  /**
   * Parse Redis INFO command output
   *
   * @param infoStr - Raw INFO output
   * @returns Parsed info as key-value pairs
   */
  private parseRedisInfo(infoStr: string): Record<string, string> {
    const info: Record<string, string> = {};

    const lines = infoStr.split('\r\n');
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || line.trim() === '') {
        continue;
      }

      const [key, value] = line.split(':');
      if (key && value) {
        info[key.trim()] = value.trim();
      }
    }

    return info;
  }
}
