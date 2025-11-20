# Global Redis Module

A comprehensive, production-ready Redis caching module for all PITCH
microservices.

## Features

- ✅ **Global Module**: Use across all microservices with a single import
- ✅ **Type-Safe**: Full TypeScript support with generics
- ✅ **Flexible Configuration**: Synchronous and asynchronous setup
- ✅ **Connection Management**: Auto-reconnect with exponential backoff
- ✅ **Health Checks**: Built-in health indicator for @nestjs/terminus
- ✅ **Comprehensive Operations**: Key-value, hash, list, set, pub/sub
- ✅ **Distributed Locking**: Safe, reliable distributed locks
- ✅ **TTL Management**: Automatic expiration with configurable defaults
- ✅ **JSON Serialization**: Automatic handling of complex objects
- ✅ **Error Handling**: Graceful error handling with logging
- ✅ **Production Ready**: Used in production with connection pooling

## Installation

The module is already included in the monorepo. Required dependency:

```json
{
  "ioredis": "^5.8.2"
}
```

## Quick Start

### 1. Import the Module

#### Option A: Synchronous Configuration

```typescript
import { Module } from '@nestjs/common'
import { RedisModule } from '@/common/redis'

@Module({
  imports: [
    RedisModule.forRoot({
      url: process.env.REDIS_URL, // redis://localhost:6379
      keyPrefix: 'user:', // Optional: namespace your keys
      defaultTTL: 3600, // Default TTL in seconds (1 hour)
    }),
  ],
})
export class UserModule {}
```

#### Option B: Asynchronous Configuration (Recommended)

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisModule } from '@/common/redis'

@Module({
  imports: [
    ConfigModule,
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        url: configService.get<string>('REDIS_URL'),
        keyPrefix: 'user:',
        defaultTTL: 3600,
        connectTimeout: 10000,
        commandTimeout: 5000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class UserModule {}
```

### 2. Use in Your Services

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '@/common/redis'

@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name)

  constructor(private readonly redis: RedisService) {}

  // Basic key-value operations
  async cacheUser(userId: string, user: User): Promise<void> {
    await this.redis.set(`user:${userId}`, user, { ttl: 3600 })
  }

  async getUser(userId: string): Promise<User | null> {
    return await this.redis.get<User>(`user:${userId}`)
  }

  async deleteUser(userId: string): Promise<void> {
    await this.redis.delete(`user:${userId}`)
  }

  // Check if user is cached
  async isUserCached(userId: string): Promise<boolean> {
    return await this.redis.exists(`user:${userId}`)
  }

  // Get remaining TTL
  async getUserCacheTTL(userId: string): Promise<number> {
    return await this.redis.ttl(`user:${userId}`)
  }
}
```

## Configuration Options

```typescript
interface RedisModuleOptions {
  // Connection
  url?: string // Redis URL (takes precedence)
  host?: string // Redis host (default: 'localhost')
  port?: number // Redis port (default: 6379)
  password?: string // Redis password
  db?: number // Database number (default: 0)

  // Timeouts
  connectTimeout?: number // Connection timeout in ms (default: 10000)
  commandTimeout?: number // Command timeout in ms (default: 5000)

  // Retry & Reconnection
  maxRetriesPerRequest?: number // Max retries per request (default: 3)
  enableReadyCheck?: boolean // Enable ready check (default: true)
  enableOfflineQueue?: boolean // Enable offline queue (default: true)

  // Namespacing
  keyPrefix?: string // Prefix for all keys (e.g., 'user:')

  // Caching
  defaultTTL?: number // Default TTL in seconds (default: 3600)

  // Advanced
  options?: Partial<RedisOptions> // Additional ioredis options
}
```

## API Reference

### Basic Operations

```typescript
// Get a value
const user = await redis.get<User>('user:123')

// Set a value with TTL
await redis.set('user:123', userData, { ttl: 3600 })

// Set only if doesn't exist (NX)
await redis.set('user:123', userData, { nx: true, ttl: 3600 })

// Set only if exists (XX)
await redis.set('user:123', userData, { xx: true, ttl: 3600 })

// Delete keys
await redis.delete('user:123', 'user:456')

// Check existence
const exists = await redis.exists('user:123')

// Set expiration
await redis.expire('user:123', 7200) // 2 hours

// Get TTL
const ttl = await redis.ttl('user:123')
```

### Pattern Operations

```typescript
// Find keys by pattern
const userKeys = await redis.keys('user:*')

// Delete all keys matching pattern
const deleted = await redis.deletePattern('session:*')
```

### Hash Operations

```typescript
// Set hash field
await redis.hset('user:123:profile', 'name', 'John Doe')

// Get hash field
const name = await redis.hget<string>('user:123:profile', 'name')

// Get all hash fields
const profile = await redis.hgetall<any>('user:123:profile')

// Delete hash fields
await redis.hdel('user:123:profile', 'name', 'email')
```

### List Operations

```typescript
// Push to list (left/head)
await redis.lpush('notifications', notification1, notification2)

// Push to list (right/tail)
await redis.rpush('logs', log1, log2)

// Get range
const recent = await redis.lrange<Notification>('notifications', 0, 9)

// Get list length
const count = await redis.llen('notifications')
```

### Set Operations

```typescript
// Add members to set
await redis.sadd('online_users', 'user:123', 'user:456')

// Get all members
const onlineUsers = await redis.smembers<string>('online_users')

// Check membership
const isOnline = await redis.sismember('online_users', 'user:123')

// Remove members
await redis.srem('online_users', 'user:123')
```

### Distributed Locks

```typescript
// Acquire a lock
const lockValue = await redis.acquireLock('job:process', 30) // 30 seconds TTL

if (lockValue) {
  try {
    // Critical section - only one process can execute this
    await processJob()
  } finally {
    // Always release the lock
    await redis.releaseLock('job:process', lockValue)
  }
} else {
  console.log('Job is already being processed')
}
```

### Increment/Decrement

```typescript
// Increment counter
const views = await redis.incr('article:123:views')

// Increment by amount
const score = await redis.incr('user:123:score', 10)

// Decrement
const remaining = await redis.decr('rate_limit:user:123')
```

### Pub/Sub

```typescript
// Publisher service
await redis.publish('notifications', {
  userId: '123',
  message: 'New message received',
})

// Subscriber service
await redis.subscribe<NotificationEvent>('notifications', (notification) => {
  console.log('Received:', notification)
  // Handle notification
})
```

### Utility Methods

```typescript
// Ping Redis
const isAlive = await redis.ping()

// Get Redis info
const info = await redis.info('memory')

// Get underlying client for advanced operations
const client = redis.getClient()
await client.eval(luaScript, 1, 'key1', 'arg1')

// Flush database (WARNING: Deletes all data!)
await redis.flushDb() // Use with caution!
```

## Health Checks

Integrate with @nestjs/terminus for health monitoring:

```typescript
import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { RedisHealthIndicator } from '@/common/redis'

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private redisHealth: RedisHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.redisHealth.isHealthy('redis')])
  }
}
```

Response example:

```json
{
  "status": "ok",
  "info": {
    "redis": {
      "status": "up",
      "healthy": true,
      "responseTime": 5,
      "details": {
        "connectedClients": 2,
        "usedMemory": 1234567,
        "version": "7.0.11",
        "uptime": 86400
      }
    }
  }
}
```

## Best Practices

### 1. Use Key Prefixes

Always use key prefixes to namespace your data:

```typescript
RedisModule.forRoot({
  url: process.env.REDIS_URL,
  keyPrefix: 'user:', // All keys will be prefixed
})

// Keys will be stored as "user:123", "user:456"
await redis.set('123', userData)
```

### 2. Set Appropriate TTLs

Always set TTLs to prevent memory bloat:

```typescript
// Short-lived data (5 minutes)
await redis.set('otp:123', code, { ttl: 300 })

// Medium-lived data (1 hour)
await redis.set('session:abc', session, { ttl: 3600 })

// Long-lived data (24 hours)
await redis.set('cache:report', data, { ttl: 86400 })
```

### 3. Handle Errors Gracefully

The service logs errors but returns safe defaults:

```typescript
// Returns null if key doesn't exist or error occurs
const user = await redis.get<User>('user:123')
if (!user) {
  // Fetch from database
  user = await this.userRepository.findById('123')
  // Cache for next time
  await redis.set('user:123', user, { ttl: 3600 })
}
```

### 4. Use Distributed Locks for Critical Sections

```typescript
async processExpensiveOperation(jobId: string) {
  const lock = await this.redis.acquireLock(
    `lock:job:${jobId}`,
    60, // 60 seconds
  );

  if (!lock) {
    throw new Error('Job is already being processed');
  }

  try {
    await this.doExpensiveWork(jobId);
  } finally {
    await this.redis.releaseLock(`lock:job:${jobId}`, lock);
  }
}
```

### 5. Leverage Type Safety

Use TypeScript generics for type-safe caching:

```typescript
interface User {
  id: string
  email: string
  name: string
}

// Type-safe get
const user = await redis.get<User>('user:123')
// user is typed as User | null

// Type-safe set
await redis.set<User>('user:123', {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
})
```

## Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration
REDIS_URL="redis://localhost:6379"

# Or individual settings
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"
```

## Docker Configuration

Redis is already configured in `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: pitch-redis
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data
  command:
    redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy
    allkeys-lru
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 5s
    retries: 5
```

## Migration from Simulation Redis Service

If you're migrating from the simulation-specific Redis service:

### Before (Simulation Service)

```typescript
import { SimulationRedisService } from '../services/redis/redis.service';

constructor(private readonly redis: SimulationRedisService) {}

await this.redis.setSessionCache(sessionId, data, ttl);
const data = await this.redis.getSessionCache(sessionId);
```

### After (Global Service)

```typescript
import { RedisService } from '@/common/redis';

constructor(private readonly redis: RedisService) {}

await this.redis.set(`session:${sessionId}`, data, { ttl });
const data = await this.redis.get(`session:${sessionId}`);
```

**Note**: The simulation service has domain-specific methods. You can:

1. Use the global RedisService directly with proper key patterns
2. Keep the SimulationRedisService for domain logic, inject global RedisService
3. Create a wrapper service that uses RedisService internally

## Troubleshooting

### Connection Issues

```typescript
// Check Redis connection
const isAlive = await redis.ping()
console.log('Redis is alive:', isAlive)

// Get detailed info
const info = await redis.info()
console.log('Redis info:', info)
```

### Memory Issues

```bash
# Check Redis memory usage
docker exec pitch-redis redis-cli INFO memory

# Monitor Redis in real-time
docker exec -it pitch-redis redis-cli
> MONITOR
```

### Key Debugging

```typescript
// List all keys (use carefully in production!)
const allKeys = await redis.keys('*')
console.log('All keys:', allKeys)

// Check specific pattern
const userKeys = await redis.keys('user:*')
console.log('User keys:', userKeys)

// Check TTL
const ttl = await redis.ttl('user:123')
console.log('TTL remaining:', ttl, 'seconds')
```

## Performance Tips

1. **Use Pipelining** for bulk operations:

```typescript
const client = redis.getClient()
const pipeline = client.pipeline()
pipeline.set('key1', 'value1')
pipeline.set('key2', 'value2')
pipeline.set('key3', 'value3')
await pipeline.exec()
```

2. **Use Lua Scripts** for atomic operations:

```typescript
const client = redis.getClient()
const script = `
  local value = redis.call('GET', KEYS[1])
  if value then
    return redis.call('INCR', KEYS[1])
  else
    redis.call('SET', KEYS[1], ARGV[1])
    return tonumber(ARGV[1])
  end
`
const result = await client.eval(script, 1, 'counter', '1')
```

3. **Set memory limits** in docker-compose.yml:

```yaml
command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## Support

For issues or questions:

1. Check this README
2. Review the source code documentation
3. Check Redis logs: `docker logs pitch-redis`
4. Create an issue in the repository

## License

Internal use only - PITCH Platform
