# API Deployment Guide

Comprehensive guide for deploying the PITCH API across different environments.

## Deployment Options

### 1. Docker Deployment (Recommended)
- Consistent environment across all stages
- Easy scaling and orchestration
- Includes database and Redis setup

### 2. Platform as a Service (PaaS)
- Heroku, Railway, Render
- Managed databases and services
- Easy CI/CD integration

### 3. Cloud Providers
- AWS (ECS, Lambda, EC2)
- Google Cloud Platform (Cloud Run, Compute Engine)
- Azure (Container Instances, App Service)

### 4. Kubernetes
- Production-grade orchestration
- Auto-scaling and load balancing
- High availability setup

## Environment Setup

### Development Environment
```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Configure database
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_dev"

# Run migrations
pnpm exec prisma migrate dev

# Start development server
pnpm dev
```

### Staging Environment
```env
# .env.staging
NODE_ENV=staging
PORT=3001

# Database
DATABASE_URL="postgresql://user:password@staging-db:5432/pitch_staging"

# Authentication
JWT_SECRET="staging-jwt-secret-32-characters-minimum"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# External Services
REDIS_URL="redis://staging-redis:6379"
EMAIL_SERVICE_API_KEY="staging-email-key"

# Monitoring
LOG_LEVEL="info"
ENABLE_SWAGGER="true"
```

### Production Environment
```env
# .env.production
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL="postgresql://user:secure_password@prod-db:5432/pitch_prod"
DATABASE_SSL=true

# Authentication
JWT_SECRET="production-super-secure-secret-key-64-chars-minimum"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
BCRYPT_ROUNDS=12

# External Services
REDIS_URL="redis://prod-redis:6379"
EMAIL_SERVICE_API_KEY="production-email-key"

# Security
CORS_ORIGIN="https://yourdomain.com"
RATE_LIMIT_WINDOW="15m"
RATE_LIMIT_MAX="100"

# Monitoring
LOG_LEVEL="warn"
ENABLE_SWAGGER="false"
SENTRY_DSN="https://your-sentry-dsn"

# Performance
DATABASE_CONNECTION_LIMIT="20"
DATABASE_POOL_TIMEOUT="20"
```

## Docker Deployment

### Using Docker Compose
```bash
# Local development
docker-compose -f docker-compose.local.yml up -d

# Staging deployment
docker-compose -f docker-compose.staging.yml up -d

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Building and Pushing Images
```bash
# Build API image
docker build -f apps/api/Dockerfile -t pitch-api:latest .

# Tag for registry
docker tag pitch-api:latest your-registry.com/pitch-api:v1.0.0

# Push to registry
docker push your-registry.com/pitch-api:v1.0.0
```

### Health Checks
```dockerfile
# In Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
```

## Platform Deployments

### Heroku Deployment
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create pitch-api-staging

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Add Redis addon
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key

# Deploy
git subtree push --prefix apps/api heroku main

# Run migrations
heroku run pnpm exec prisma migrate deploy

# Check logs
heroku logs --tail
```

#### Heroku Configuration
```json
// apps/api/package.json
{
  "scripts": {
    "start": "node dist/main.js",
    "postbuild": "prisma generate",
    "heroku-postbuild": "npm run build"
  },
  "engines": {
    "node": "20.x",
    "pnpm": "10.x"
  }
}
```

### Railway Deployment
```yaml
# railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build",
    "watchPatterns": ["apps/api/**"]
  },
  "deploy": {
    "startCommand": "cd apps/api && pnpm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Render Deployment
```yaml
# render.yaml
services:
  - type: web
    name: pitch-api
    env: node
    plan: starter
    buildCommand: cd apps/api && pnpm install && pnpm build
    startCommand: cd apps/api && pnpm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: pitch-db
          property: connectionString
```

## Cloud Provider Deployments

### AWS ECS Deployment

#### Task Definition
```json
{
  "family": "pitch-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "pitch-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/pitch-api:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:pitch/database"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:pitch/jwt"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/pitch-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### ECS Service Configuration
```json
{
  "serviceName": "pitch-api-service",
  "cluster": "pitch-cluster",
  "taskDefinition": "pitch-api",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-12345", "subnet-67890"],
      "securityGroups": ["sg-api-access"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:region:account:targetgroup/pitch-api-tg",
      "containerName": "pitch-api",
      "containerPort": 3001
    }
  ]
}
```

### Google Cloud Run
```yaml
# clouddeploy.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: pitch-api
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu: 1
        run.googleapis.com/memory: 2Gi
        run.googleapis.com/max-scale: 10
        run.googleapis.com/min-scale: 1
    spec:
      containers:
      - image: gcr.io/project-id/pitch-api:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          limits:
            cpu: 1
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Azure Container Instances
```json
{
  "location": "East US",
  "properties": {
    "containers": [
      {
        "name": "pitch-api",
        "properties": {
          "image": "yourregistry.azurecr.io/pitch-api:latest",
          "ports": [
            {
              "port": 3001,
              "protocol": "TCP"
            }
          ],
          "resources": {
            "requests": {
              "cpu": 1,
              "memoryInGB": 2
            }
          },
          "environmentVariables": [
            {
              "name": "NODE_ENV",
              "value": "production"
            }
          ],
          "secureEnvironmentVariables": [
            {
              "name": "DATABASE_URL",
              "value": "postgresql://..."
            },
            {
              "name": "JWT_SECRET",
              "value": "your-secret-key"
            }
          ]
        }
      }
    ],
    "osType": "Linux",
    "ipAddress": {
      "type": "Public",
      "ports": [
        {
          "port": 3001,
          "protocol": "TCP"
        }
      ]
    }
  }
}
```

## Kubernetes Deployment

### Deployment Configuration
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pitch-api
  labels:
    app: pitch-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pitch-api
  template:
    metadata:
      labels:
        app: pitch-api
    spec:
      containers:
      - name: pitch-api
        image: pitch-api:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pitch-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: pitch-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: pitch-api-service
spec:
  selector:
    app: pitch-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

### ConfigMap and Secrets
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pitch-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3001"
---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: pitch-secrets
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  jwt-secret: <base64-encoded-jwt-secret>
  redis-url: <base64-encoded-redis-url>
```

### Horizontal Pod Autoscaler
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pitch-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pitch-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Database Deployment

### Migration Strategy
```bash
# Production migration workflow
# 1. Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# 2. Run migrations
pnpm exec prisma migrate deploy

# 3. Verify deployment
pnpm exec prisma migrate status

# 4. Rollback if needed
psql $DATABASE_URL < backup-$(date +%Y%m%d).sql
```

### Database Scaling
```typescript
// Database connection pooling
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection pool settings
  connectionLimit = 20
  poolTimeout = 20
  socketTimeout = 60
}
```

### Read Replicas
```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readReplica: PrismaClient

  constructor() {
    super()
    
    // Initialize read replica if URL is provided
    if (process.env.DATABASE_READ_URL) {
      this.readReplica = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_READ_URL,
          },
        },
      })
    }
  }

  async onModuleInit() {
    await this.$connect()
    if (this.readReplica) {
      await this.readReplica.$connect()
    }
  }

  // Use read replica for read operations
  get reader() {
    return this.readReplica || this
  }
}
```

## CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy API

on:
  push:
    branches: [main]
    paths: ['apps/api/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm --filter api test
      - run: pnpm --filter api build

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -f apps/api/Dockerfile -t pitch-api:${{ github.sha }} .
          docker tag pitch-api:${{ github.sha }} pitch-api:latest
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push pitch-api:${{ github.sha }}
          docker push pitch-api:latest

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          # Deploy to staging environment
          # This could be updating ECS service, Cloud Run, etc.

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          # Deploy to production environment
```

## Monitoring and Logging

### Health Check Endpoint
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
    ])

    const status = checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'unhealthy'

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        external: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`
  }

  private async checkRedis() {
    // Redis health check
  }

  private async checkExternalServices() {
    // External service health checks
  }
}
```

### Application Logging
```typescript
// src/common/logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common'
import * as winston from 'winston'

@Injectable()
export class CustomLogger implements LoggerService {
  private logger: winston.Logger

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    })

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple(),
      }))
    }
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context })
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context })
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context })
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context })
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context })
  }
}
```

## Security Configuration

### Production Security Headers
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import helmet from 'helmet'
import * as compression from 'compression'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }))

  // Compression
  app.use(compression())

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || false,
    credentials: true,
  })

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }))

  await app.listen(process.env.PORT || 3001)
}
bootstrap()
```

## Performance Optimization

### Caching Strategy
```typescript
// src/common/cache.service.ts
import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class CacheService {
  private redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL)
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value)
    } else {
      await this.redis.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return this.redis.mget(...keys)
  }
}
```

### Database Query Optimization
```typescript
// Optimize queries with proper indexes and pagination
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Only select needed fields
  },
  where: {
    role: 'USER',
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: limit,
  skip: (page - 1) * limit,
})
```

## Troubleshooting

### Common Deployment Issues

**Database Connection Errors:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Verify migrations
pnpm exec prisma migrate status

# Check connection pooling
netstat -an | grep 5432
```

**Memory Issues:**
```bash
# Monitor memory usage
docker stats

# Check Node.js heap usage
curl http://localhost:3001/health

# Increase memory limits
NODE_OPTIONS="--max-old-space-size=2048"
```

**High Response Times:**
```bash
# Check slow queries
# Enable PostgreSQL logging
log_min_duration_statement = 1000

# Monitor API performance
curl -w "@curl-format.txt" http://localhost:3001/api/endpoint
```

### Rollback Strategies

**Docker Rollback:**
```bash
# Roll back to previous image
docker pull pitch-api:previous-tag
docker-compose up -d

# Database rollback
pg_restore --clean --if-exists -d $DATABASE_URL backup.sql
```

**Kubernetes Rollback:**
```bash
# Roll back deployment
kubectl rollout undo deployment/pitch-api

# Check rollout status
kubectl rollout status deployment/pitch-api
```

## Best Practices

1. **Environment Separation**: Keep environments isolated
2. **Secret Management**: Use secure secret storage
3. **Health Checks**: Implement comprehensive health checks
4. **Monitoring**: Set up alerts and logging
5. **Database Migrations**: Always backup before migrations
6. **Rollback Strategy**: Have a clear rollback plan
7. **Security**: Follow security best practices
8. **Performance**: Monitor and optimize regularly
9. **Documentation**: Keep deployment docs updated
10. **Testing**: Test deployments in staging first