# Deployment Guide

Complete guide for deploying PITCH platform in local, staging, and production
environments.

## Table of Contents

- [Docker Setup](#docker-setup)
- [Database Configuration](#database-configuration)
- [Redis Setup](#redis-setup)
- [Environment Configuration](#environment-configuration)
- [Production Deployment](#production-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Troubleshooting](#troubleshooting)

---

## Docker Setup

### Single-Image Architecture

PITCH uses a **single Docker image** for all microservices following modern
monorepo best practices:

```
apps/api/Dockerfile → pitch-api:latest → All 8 services
```

**Benefits:**

- ✅ Build once, deploy many times
- ✅ Faster CI/CD (no rebuilding 8 different images)
- ✅ Independent scaling per service
- ✅ Smaller storage footprint
- ✅ Simpler maintenance

### Building the Image

```bash
# Build single image for all microservices
docker build -f apps/api/Dockerfile -t pitch-api:latest .
```

This command:

1. Installs all dependencies
2. Generates all Prisma clients
3. Builds all microservices
4. Creates one image that can run any service via `SERVICE_NAME` environment
   variable

### How It Works

Each container sets `SERVICE_NAME` to specify which service to run:

```yaml
# docker-compose.yml
services:
  gateway:
    image: pitch-api:latest
    environment:
      SERVICE_NAME: gateway # Runs dist/main.js

  user:
    image: pitch-api:latest
    environment:
      SERVICE_NAME: user # Runs dist/src/microservices/user/main.js
```

### Local Development

#### Start All Services

```bash
# Start infrastructure + microservices
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service
docker-compose logs -f simulation
```

#### Start Infrastructure Only

```bash
# Start only databases, Redis, RabbitMQ
docker-compose up -d postgres-user postgres-simulation postgres-support postgres-analytics postgres-crm mongodb redis rabbitmq

# Then run microservices locally
pnpm dev:gateway
pnpm dev:user
pnpm dev:simulation
```

#### Rebuilding After Changes

```bash
# Rebuild the image
docker build -f apps/api/Dockerfile -t pitch-api:latest .

# Restart specific service
docker-compose restart user

# Or restart all services
docker-compose restart
```

### Docker Compose Environments

| Environment             | File                         | Purpose                          |
| ----------------------- | ---------------------------- | -------------------------------- |
| **Local**               | `docker-compose.yml`         | Development with local databases |
| **Local (external DB)** | `docker-compose.local.yml`   | Development with external DBs    |
| **Staging**             | `docker-compose.staging.yml` | Pre-production testing           |
| **Production**          | `docker-compose.prod.yml`    | Production deployment            |

### Infrastructure Services

#### PostgreSQL (6 instances)

```yaml
postgres-user: # Port 5433 → pitch_user
postgres-simulation: # Port 5434 → pitch_simulation
postgres-support: # Port 5435 → pitch_support
postgres-analytics: # Port 5436 → pitch_analytics
postgres-crm: # Port 5437 → pitch_crm
```

#### MongoDB

```yaml
mongodb:
  image: mongo:7
  ports:
    - '27017:27017'
  environment:
    MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
```

#### Redis

```yaml
redis:
  image: redis:7-alpine
  ports:
    - '6379:6379'
  command:
    redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy
    allkeys-lru
```

#### RabbitMQ

```yaml
rabbitmq:
  image: rabbitmq:3-management-alpine
  ports:
    - '5672:5672' # AMQP
    - '15672:15672' # Management UI
  environment:
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
```

### Scaling Services

Since all services use the same image, scale any microservice independently:

```bash
# Scale simulation to 3 replicas
docker-compose up -d --scale simulation=3

# Scale user service to 2 replicas
docker-compose up -d --scale user=2
```

RabbitMQ automatically distributes messages across replicas.

---

## Database Configuration

### Database-Per-Service Architecture

Each microservice has its own PostgreSQL database:

| Microservice    | Database           | Port | Description                       |
| --------------- | ------------------ | ---- | --------------------------------- |
| User Management | `pitch_user`       | 5433 | Users, auth, teams, organizations |
| Simulation      | `pitch_simulation` | 5434 | Simulations, sessions, feedback   |
| Support         | `pitch_support`    | 5435 | Tickets, FAQ, chat history        |
| Analytics       | `pitch_analytics`  | 5436 | Metrics, dashboards, reports      |
| CRM             | `pitch_crm`        | 5437 | Contacts, accounts, opportunities |

**Note:** LTI and S3 services do NOT have databases.

### Local Development Setup

#### 1. Environment Configuration

```bash
# Copy local environment file
cp apps/api/.env.example apps/api/.env
```

Configure database URLs:

```env
USER_DATABASE_URL="postgresql://pitch_user:pitch_password@localhost:5433/pitch_user"
SIMULATION_DATABASE_URL="postgresql://pitch_user:pitch_password@localhost:5434/pitch_simulation"
SUPPORT_DATABASE_URL="postgresql://pitch_user:pitch_password@localhost:5435/pitch_support"
ANALYTICS_DATABASE_URL="postgresql://pitch_user:pitch_password@localhost:5436/pitch_analytics"
CRM_DATABASE_URL="postgresql://pitch_user:pitch_password@localhost:5437/pitch_crm"
```

#### 2. Start Databases

```bash
docker-compose up -d postgres-user postgres-simulation postgres-support postgres-analytics postgres-crm mongodb
```

#### 3. Generate Prisma Clients

```bash
cd apps/api
pnpm db:generate:all

# Or generate individually
pnpm db:generate:userManagement
pnpm db:generate:simulation
pnpm db:generate:support
pnpm db:generate:analytics
pnpm db:generate:crm
```

#### 4. Run Migrations

```bash
# Run all migrations
pnpm db:migrate:all

# Or migrate individually
pnpm db:migrate:userManagement
pnpm db:migrate:simulation
pnpm db:migrate:support
pnpm db:migrate:analytics
pnpm db:migrate:crm
```

### Production Setup (Prisma Accelerate)

#### Prerequisites

- Prisma Accelerate account ([console.prisma.io](https://console.prisma.io/))
- Remote PostgreSQL server (AWS RDS, DigitalOcean, Supabase, etc.)
- Database credentials with admin access

#### 1. Get Prisma Accelerate API Key

1. Visit https://console.prisma.io/
2. Create project or select existing
3. Enable Prisma Accelerate
4. Copy API key (starts with "eyJhbGci...")

#### 2. Configure Environment

```bash
cp apps/api/.env.production apps/api/.env
```

Update with your values:

```env
# Prisma Accelerate Token
PRISMA_ACCELERATE_TOKEN="eyJhbGci..."

# Database URLs (Accelerate Pooler)
USER_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
SIMULATION_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
SUPPORT_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
ANALYTICS_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
CRM_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
```

#### 3. Create Databases

Connect to your PostgreSQL server and create databases:

```sql
-- Connect to PostgreSQL
psql -h your-db-host.com -U admin -d postgres

-- Create databases
CREATE DATABASE pitch_user;
CREATE DATABASE pitch_simulation;
CREATE DATABASE pitch_support;
CREATE DATABASE pitch_analytics;
CREATE DATABASE pitch_crm;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE pitch_user TO your_app_user;
GRANT ALL PRIVILEGES ON DATABASE pitch_simulation TO your_app_user;
GRANT ALL PRIVILEGES ON DATABASE pitch_support TO your_app_user;
GRANT ALL PRIVILEGES ON DATABASE pitch_analytics TO your_app_user;
GRANT ALL PRIVILEGES ON DATABASE pitch_crm TO your_app_user;
```

#### 4. Deploy Migrations

```bash
# Generate Prisma clients
pnpm db:generate:all

# Deploy migrations to production
pnpm db:deploy:all
```

### Database Connection Strings

#### Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?[options]
```

#### Common Options

| Option                | Description        | Example                |
| --------------------- | ------------------ | ---------------------- |
| `sslmode=require`     | Force SSL          | `?sslmode=require`     |
| `schema=public`       | Specify schema     | `?schema=public`       |
| `connection_limit=10` | Max connections    | `?connection_limit=10` |
| `pool_timeout=10`     | Pool timeout (sec) | `?pool_timeout=10`     |
| `pgbouncer=true`      | PgBouncer mode     | `?pgbouncer=true`      |

#### Examples

**Local Docker:**

```
postgresql://pitch_user:pitch_password@localhost:5433/pitch_user
```

**AWS RDS with SSL:**

```
postgresql://admin:password@pitch-db.abc123.us-east-1.rds.amazonaws.com:5432/pitch_user?sslmode=require
```

**Supabase with PgBouncer:**

```
postgresql://postgres:password@db.abc123xyz.supabase.co:5432/pitch_user?pgbouncer=true&sslmode=require
```

### Database Commands

```bash
# Generate Prisma clients
pnpm db:generate:all              # All services
pnpm db:generate:userManagement   # User service only

# Create and apply migrations (development)
pnpm db:migrate:all               # All services
pnpm db:migrate:userManagement    # User service only

# Push schema without migrations (dev only)
pnpm db:push:all                  # All services
pnpm db:push:userManagement       # User service only

# Deploy migrations (production)
pnpm db:deploy:all                # All services
pnpm db:deploy:userManagement     # User service only

# Open Prisma Studio
pnpm db:studio:userManagement     # User database
pnpm db:studio:simulation         # Simulation database
```

### Database Management

```bash
# Backup database
docker exec pitch-postgres-user pg_dump -U pitch_user pitch_user > backup.sql

# Restore database
docker exec -i pitch-postgres-user psql -U pitch_user pitch_user < backup.sql

# Connect to database shell
docker exec -it pitch-postgres-user psql -U pitch_user -d pitch_user

# View logs
docker-compose logs -f postgres-user

# Reset database (⚠️ DATA LOSS)
docker-compose down -v
docker-compose up -d postgres-user
```

---

## Redis Setup

### Global Redis Cache

PITCH uses a **single shared Redis instance** for all microservices.

#### Redis Module Location

```
apps/api/src/common/redis/
├── redis.module.ts           # NestJS module
├── redis.service.ts          # Service with 50+ operations
├── redis.provider.ts         # Connection provider
├── redis-health.indicator.ts # Health checks
├── constants.ts              # Constants & TTLs
└── interfaces/               # TypeScript interfaces
```

#### Docker Configuration

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

#### Integration in Microservices

```typescript
// apps/api/src/microservices/user/user.module.ts
import { RedisModule } from '@/common/redis'

@Module({
  imports: [
    RedisModule.forRoot({
      url: process.env.REDIS_URL,
      keyPrefix: 'user:', // Namespace keys per service
      defaultTTL: 3600, // 1 hour default
    }),
  ],
})
export class UserModule {}
```

#### Using Redis Service

```typescript
import { RedisService } from '@/common/redis'

@Injectable()
export class UserCacheService {
  constructor(private readonly redis: RedisService) {}

  async cacheUser(userId: string, user: User) {
    await this.redis.set(`profile:${userId}`, user, { ttl: 3600 })
  }

  async getUser(userId: string) {
    return await this.redis.get<User>(`profile:${userId}`)
  }
}
```

#### Available Operations

```typescript
// Key-value
redis.get(key)
redis.set(key, value, { ttl: 3600 })
redis.delete(...keys)
redis.exists(key)
redis.expire(key, seconds)

// Patterns
redis.keys(pattern)
redis.deletePattern(pattern)

// Hash
redis.hset(key, field, value)
redis.hget(key, field)
redis.hgetall(key)

// Lists
redis.lpush(key, ...values)
redis.rpush(key, ...values)
redis.lrange(key, start, stop)

// Sets
redis.sadd(key, ...members)
redis.smembers(key)
redis.sismember(key, member)

// Distributed locks
redis.acquireLock(key, ttl)
redis.releaseLock(key, value)

// Pub/Sub
redis.publish(channel, message)
redis.subscribe(channel, callback)

// Counters
redis.incr(key, amount)
redis.decr(key, amount)

// Utility
redis.ping()
redis.info(section)
redis.getClient() // For advanced operations
```

#### Health Checks

```typescript
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

#### Redis Monitoring

```bash
# Test connection
docker exec pitch-redis redis-cli ping

# Check memory
docker exec pitch-redis redis-cli INFO memory

# Monitor commands
docker exec -it pitch-redis redis-cli MONITOR

# View all keys (development only!)
docker exec pitch-redis redis-cli KEYS "*"

# Check specific pattern
docker exec pitch-redis redis-cli KEYS "user:*"
```

#### Redis Configuration

Environment variables:

```env
# Redis URL
REDIS_URL="redis://localhost:6379"

# Or individual settings
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""  # Set in production!
REDIS_DB="0"
```

#### Production Redis

**Managed Redis Services:**

- AWS ElastiCache
- Redis Cloud
- DigitalOcean Managed Redis
- Azure Cache for Redis

**Configuration:**

```env
# AWS ElastiCache
REDIS_URL="rediss://master.pitch-redis.abc123.use1.cache.amazonaws.com:6379?tls=true"

# Redis Cloud
REDIS_URL="rediss://:password@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345"

# DigitalOcean
REDIS_URL="rediss://default:password@pitch-redis-do-user-123456-0.db.ondigitalocean.com:25061?tls=true&tlsCheckPeers=false"
```

---

## Environment Configuration

### Environment Files

```
apps/api/
├── .env                    # Active environment (gitignored)
├── .env.example            # Template with all variables
├── .env.local              # Local development
├── .env.staging            # Staging environment
└── .env.production         # Production environment
```

### Required Variables

#### Application

```env
NODE_ENV=production
PORT=8000
LOG_LEVEL=info
```

#### API Documentation

```env
SWAGGER_TITLE="PITCH Microservices API"
SWAGGER_DESCRIPTION="Microservices REST API"
SWAGGER_VERSION="1.0.0"
SWAGGER_PATH="docs"
```

#### Databases (PostgreSQL)

```env
USER_DATABASE_URL="postgresql://..."
SIMULATION_DATABASE_URL="postgresql://..."
SUPPORT_DATABASE_URL="postgresql://..."
ANALYTICS_DATABASE_URL="postgresql://..."
CRM_DATABASE_URL="postgresql://..."
```

#### MongoDB

```env
MONGODB_URL="mongodb://user:password@host:27017/pitch_simulation?authSource=admin"
```

#### Redis

```env
REDIS_URL="redis://localhost:6379"
```

#### RabbitMQ

```env
RABBITMQ_URL="amqp://admin:password@localhost:5672/pitch"
RABBITMQ_USER="admin"
RABBITMQ_PASSWORD="secure_password"
```

#### JWT Authentication

```env
JWT_SECRET="your_super_secure_secret_min_32_characters"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
JWT_EXPIRES_IN="15m"  # Alternative naming
JWT_REFRESH_SECRET="your_super_secure_secret_min_32_characters"
JWT_REFRESH_EXPIRES_IN="7d"
```

#### OAuth Providers

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:8000/api/v1/auth/oauth/google/callback"
```

#### AI Services (Simulation)

```env
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4-turbo-preview"
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-3-opus-20240229"
DEEPGRAM_API_KEY="..."
ELEVENLABS_API_KEY="..."
```

#### AWS S3

```env
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="pitch-files-bucket"
```

#### LTI Integration

```env
LTI_PLATFORM_URL="https://your-lms-platform.com"
LTI_CLIENT_ID="..."
LTI_DEPLOYMENT_ID="..."
LTI_KEY_SET_URL="https://your-lms-platform.com/api/lti/security/jwks"
LTI_AUTH_TOKEN_URL="https://your-lms-platform.com/api/lti/authorize"
```

### Frontend Environment

```env
# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret_min_32_chars"
NEXT_TELEMETRY_DISABLED="1"
```

---

## Production Deployment

### Prerequisites

- Docker & Docker Compose installed
- SSL certificates (Let's Encrypt recommended)
- Domain name configured
- Production databases set up
- Redis instance (managed service recommended)
- RabbitMQ instance

### 1. Build Production Image

```bash
# Build image
docker build -f apps/api/Dockerfile -t pitch-api:v1.0.0 .

# Tag for registry
docker tag pitch-api:v1.0.0 your-registry.com/pitch-api:v1.0.0

# Push to registry
docker push your-registry.com/pitch-api:v1.0.0
```

### 2. Configure Production Environment

```bash
cp apps/api/.env.production apps/api/.env
# Edit with production values
```

**Critical Security Settings:**

- Use strong, unique passwords
- Enable SSL/TLS for all connections
- Use secrets management (AWS Secrets Manager, Vault)
- Set proper CORS origins
- Enable rate limiting
- Configure monitoring

### 3. Deploy with Docker Compose

```bash
# Deploy production stack
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check health
docker-compose -f docker-compose.prod.yml ps
```

### 4. Run Production Migrations

```bash
# Generate clients
pnpm db:generate:all

# Deploy migrations
pnpm db:deploy:all
```

### 5. Verify Deployment

```bash
# Check all services
curl https://api.yourdomain.com/health

# Check Redis
docker exec pitch-redis redis-cli ping

# Check RabbitMQ
curl http://admin:password@localhost:15672/api/overview

# View service logs
docker logs pitch-gateway
docker logs pitch-user
```

---

## Vercel Backend Deployment

Use this flow when deploying the backend API as a dedicated Vercel project.

### Project Settings

1. Set **Root Directory** to the repository root (do not set it to `apps/api`).
2. Keep framework auto-detection off for this backend project.
3. Configure backend environment variables in Vercel (DB URLs, RabbitMQ, Redis,
   JWT, OAuth, etc.).

### Repo Files

- `vercel.json` at repo root:
  - runs workspace install (`pnpm install --frozen-lockfile`)
  - builds shared package + backend
    (`pnpm --filter @pitch/shared-backend build && pnpm --filter api build`)
  - routes requests to `apps/api/api/index.js`
- `apps/api/api/index.js`:
  - boots the Nest app once per runtime
  - reuses the same server instance on warm invocations

### Deploy

```bash
vercel --prod
```

---

## Kubernetes Deployment

### Helm Charts

PITCH includes Helm charts in `helm/pitch/` directory.

#### Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured
- Helm 3 installed
- Container registry

#### 1. Configure Values

```bash
# Copy values file
cp helm/pitch/values.yaml helm/pitch/values.prod.yaml
```

Edit `values.prod.yaml`:

```yaml
image:
  registry: your-registry.com
  repository: pitch-api
  tag: v1.0.0

postgresql:
  enabled: false # Using managed database

redis:
  enabled: true
  persistence:
    enabled: true
    size: 5Gi

rabbitmq:
  enabled: true
  auth:
    username: admin
    password: secure_password

gateway:
  replicas: 2
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi

user:
  replicas: 2

simulation:
  replicas: 5 # High traffic service
```

#### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace pitch

# Deploy Helm chart
helm install pitch ./helm/pitch \
  -f helm/pitch/values.prod.yaml \
  --namespace pitch

# Check deployment
kubectl get pods -n pitch
kubectl get services -n pitch
```

#### 3. Update Deployment

```bash
# Update values
helm upgrade pitch ./helm/pitch \
  -f helm/pitch/values.prod.yaml \
  --namespace pitch

# Rollback if needed
helm rollback pitch --namespace pitch
```

#### 4. Scaling Services

```bash
# Scale simulation service
kubectl scale deployment simulation --replicas=10 -n pitch

# Or update in values.yaml and helm upgrade
```

---

## Troubleshooting

### Docker Issues

**Services fail to start:**

```bash
# Check logs
docker-compose logs gateway

# Common issues:
# - Missing environment variables → Check .env file
# - Database not ready → Wait for healthchecks
# - Port conflicts → Change ports in docker-compose.yml
```

**Database connection errors:**

```bash
# Verify database is running
docker-compose ps postgres-user

# Check connection string
docker-compose exec user env | grep DATABASE_URL

# Test connection
docker exec -it pitch-postgres-user psql -U pitch_user -d pitch_user
```

**Redis connection issues:**

```bash
# Check Redis
docker-compose ps redis
docker exec pitch-redis redis-cli ping

# View Redis logs
docker-compose logs redis
```

**Out of memory:**

```bash
# Check resource usage
docker stats

# Increase Docker memory
# Docker Desktop → Preferences → Resources → Memory (allocate 8GB+)
```

### Database Issues

**Migration fails:**

```bash
# Check Prisma schema
npx prisma validate --schema=./src/microservices/user/prisma/schema.prisma

# View migration status
npx prisma migrate status

# Reset database (development only!)
pnpm db:reset:userManagement
```

**Prisma client not found:**

```bash
# Regenerate clients
pnpm db:generate:all

# Verify client location
ls -la node_modules/@prisma/user-client
```

### Redis Issues

**Cache not working:**

```bash
# Test Redis connection
docker exec pitch-redis redis-cli ping

# Check keys
docker exec pitch-redis redis-cli KEYS "*"

# Monitor commands
docker exec -it pitch-redis redis-cli MONITOR

# Check memory
docker exec pitch-redis redis-cli INFO memory
```

### Application Issues

**Service not responding:**

```bash
# Check logs
docker logs pitch-gateway --tail=100

# Check health endpoint
curl http://localhost:8000/health

# Restart service
docker-compose restart gateway
```

**RabbitMQ connection errors:**

```bash
# Check RabbitMQ
docker-compose ps rabbitmq

# Access management UI
open http://localhost:15672

# Check queues
docker-compose exec rabbitmq rabbitmqctl list_queues
```

### Complete Reset

```bash
# Stop everything
docker-compose down -v

# Remove images
docker rmi pitch-api:latest

# Rebuild
docker build -f apps/api/Dockerfile -t pitch-api:latest .

# Start fresh
docker-compose up -d
```

---

## Best Practices

### Security

- ✅ Use strong passwords (32+ characters)
- ✅ Enable SSL/TLS for all connections
- ✅ Use secrets management systems
- ✅ Rotate credentials regularly
- ✅ Limit database user permissions
- ✅ Enable audit logging
- ✅ Use VPC/private networks
- ✅ Regular security scans

### Performance

- ✅ Use connection pooling (Prisma Accelerate)
- ✅ Configure Redis memory limits
- ✅ Set proper cache TTLs
- ✅ Enable log rotation
- ✅ Monitor resource usage
- ✅ Scale services independently
- ✅ Use CDN for static assets

### Monitoring

- ✅ Set up health checks
- ✅ Configure alerting
- ✅ Monitor logs (ELK stack)
- ✅ Track metrics (Prometheus/Grafana)
- ✅ Error tracking (Sentry)
- ✅ Performance monitoring (APM)
- ✅ Database query analysis

### Backup

- ✅ Automated database backups
- ✅ Redis persistence enabled
- ✅ Regular backup testing
- ✅ Disaster recovery plan
- ✅ Point-in-time recovery

---

**For development workflow and code guidelines, see
[CONTRIBUTING.md](CONTRIBUTING.md)**
