# Backend Development Guide

This guide covers backend development for the PITCH application using NestJS microservices architecture, Prisma ORM, and RabbitMQ message queues.

## Architecture Overview

The API is built using a microservices architecture with an API Gateway pattern:

- **API Gateway** - Routes requests and handles authentication (`src/gateway/`)
- **User Microservice** - User management (`src/microservices/user/`)
- **Business Microservice** - Business logic (`src/microservices/business/`)
- **Authentication System** - JWT-based auth with refresh tokens

## Tech Stack

- **NestJS** - Progressive Node.js framework
- **Prisma** - Next-generation ORM
- **RabbitMQ** - Message queue for inter-service communication
- **PostgreSQL** - Primary database for user data
- **MongoDB** - Database for business data
- **Redis** - Caching and sessions
- **JWT** - Authentication tokens
- **TypeScript** - Type-safe development

## Getting Started

### Development Server

```bash
# Start the backend development server
cd apps/api
pnpm dev

# Or from the root (recommended)
pnpm dev
```

The API Gateway will be available at `http://localhost:8001`.

### Project Structure

```
apps/api/
├── src/
│   ├── gateway/                # API Gateway
│   │   ├── controllers/        # Gateway controllers
│   │   ├── guards/            # Authentication guards
│   │   ├── interceptors/      # Request/response interceptors
│   │   └── decorators/        # Custom decorators
│   ├── microservices/         # Microservices
│   │   ├── user/              # User microservice
│   │   ├── business/          # Business microservice
│   │   └── auth/              # Authentication (if separate)
│   ├── common/                # Shared modules
│   │   ├── filters/           # Exception filters
│   │   ├── helpers/           # Utility functions
│   │   └── interfaces/        # Type definitions
│   ├── app.module.ts          # Root application module
│   └── main.ts               # Application entry point
├── docs/                     # docs
├── dist/                     # Compiled output
└── package.json
```

## Microservices Architecture

### 1. API Gateway

The gateway acts as a single entry point for all client requests:

```typescript
// src/gateway/controllers/user-gateway.controller.ts
@Controller({ path: 'users', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
export class UserGatewayController {
  @Get()
  async getUsers(@UserClaims() userClaims: any) {
    return this.userService.send('get_users', { userClaims });
  }
}
```

### 2. Microservice Communication

Services communicate via RabbitMQ message patterns:

```typescript
// Microservice controller
@MessagePattern('get_users')
async getUsers(@Payload() data: MessageWithUserClaims) {
  this.logger.log(`Getting users - Requested by: ${data.userClaims.email}`);
  return await this.userService.findAll();
}

// Gateway calling microservice
this.userService.send('get_users', { userClaims })
```

### 3. Authentication Flow

JWT authentication is handled at the gateway level:

1. User sends request with JWT token
2. Gateway validates token and extracts user claims
3. User claims are forwarded to microservices
4. Microservices log operations with user context

## Database Setup

### Environment Configuration

Create `.env` file in `apps/api/`:

```env
# Database URLs
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_dev"
MONGODB_URL="mongodb://localhost:27017/pitch_business"
REDIS_URL="redis://localhost:6379"

# RabbitMQ
RABBITMQ_URL="amqp://admin:admin123@localhost:5672"

# JWT Configuration
JWT_SECRET="your-super-secure-secret-key-minimum-32-characters"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Application
NODE_ENV=development
PORT=8001
```

### Running Migrations

Each microservice has its own Prisma schema:

```bash
# User microservice migrations
cd src/microservices/user
npx prisma migrate dev
npx prisma generate

# Business microservice migrations
cd src/microservices/business
npx prisma migrate dev
npx prisma generate
```

### Database Services

Each microservice includes a Prisma service:

```typescript
// src/microservices/user/user-prisma.service.ts
@Injectable()
export class UserPrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

## Development Patterns

### Creating New Microservices

1. **Create Microservice Directory**:

   ```bash
   mkdir src/microservices/my-service
   cd src/microservices/my-service
   ```

2. **Set up Prisma Schema**:

   ```bash
   # Create schema file
   touch prisma/schema.prisma

   # Initialize package.json
   npm init -y
   ```

3. **Create Service Module**:

   ```typescript
   @Module({
     providers: [MyService, MyPrismaService],
     controllers: [MyController],
     exports: [MyService],
   })
   export class MyServiceModule {}
   ```

4. **Add Gateway Controller**:
   ```typescript
   @Controller({ path: 'my-resource', version: '1' })
   @UseGuards(GlobalJwtAuthGuard)
   export class MyGatewayController {
     constructor(@Inject('MY_SERVICE') private myService: ClientProxy) {}
   }
   ```

### Message Patterns

Use consistent naming for message patterns:

```typescript
// CRUD operations
'get_users'; // List resources
'get_user_by_id'; // Get single resource
'create_user'; // Create resource
'update_user'; // Update resource
'delete_user'; // Delete resource

// Custom operations
'activate_user'; // Custom action
'search_users'; // Search operation
```

### Error Handling

Implement consistent error handling across services:

```typescript
// src/common/filters/microservice-exception.filter.ts
@Catch()
export class MicroserviceExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Handle different error types
    if (exception instanceof RpcException) {
      return response.status(400).json({
        statusCode: 400,
        message: exception.message,
        error: 'Bad Request',
      });
    }

    // Default error response
    return response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}
```

## Testing

### Unit Testing

```typescript
// Example service test
describe('UserService', () => {
  let service: UserService;
  let prisma: UserPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserPrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<UserPrismaService>(UserPrismaService);
  });

  it('should find all users', async () => {
    const mockUsers = [{ id: '1', email: 'test@example.com' }];
    jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers);

    const result = await service.findAll();
    expect(result).toEqual(mockUsers);
  });
});
```

### Integration Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test user.service.spec.ts

# Run tests with coverage
pnpm test:cov

# Run E2E tests
pnpm test:e2e
```

## Performance Optimization

### Database Query Optimization

```typescript
// Use select to limit returned fields
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    // Exclude password and other sensitive fields
  },
});

// Use pagination
const users = await this.prisma.user.findMany({
  take: limit,
  skip: (page - 1) * limit,
  orderBy: { createdAt: 'desc' },
});
```

### Caching Strategies

```typescript
// Implement Redis caching
@Injectable()
export class CacheService {
  constructor(@Inject('REDIS') private redis: Redis) {}

  async get(key: string): Promise<any> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

## Deployment

### Docker Support

The API includes Docker configuration:

```bash
# Build Docker image
docker build -f apps/api/Dockerfile -t pitch-api:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

Production environment requires:

```env
NODE_ENV=production
PORT=8001
DATABASE_URL="postgresql://prod-user:prod-pass@prod-host:5432/pitch_prod"
JWT_SECRET="production-secret-key-64-characters-minimum"
RABBITMQ_URL="amqp://prod-user:prod-pass@rabbitmq-host:5672"
```

## Monitoring and Logging

### Structured Logging

```typescript
// Use consistent logging across services
this.logger.log(
  `User operation - Action: ${action}, User: ${userClaims.email}, Target: ${targetId}`,
);
this.logger.error(
  `Database error - Service: ${serviceName}, Error: ${error.message}`,
);
```

### Health Checks

```typescript
@Get('health')
async healthCheck(): Promise<HealthCheckResult> {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.messaging.pingCheck('rabbitmq'),
    () => this.cache.pingCheck('redis'),
  ]);
}
```

## Best Practices

1. **Microservice Design**
   - Keep services focused on single business domains
   - Use event-driven communication between services
   - Implement proper error handling and retries

2. **Database Management**
   - Use separate databases per microservice when appropriate
   - Implement proper migrations and rollback strategies
   - Monitor query performance and optimize indexes

3. **Security**
   - Validate all inputs at gateway level
   - Use environment variables for secrets
   - Implement proper CORS and security headers
   - Log security events for auditing

4. **Performance**
   - Implement caching strategies for frequently accessed data
   - Use database connection pooling
   - Monitor and optimize slow queries
   - Implement proper pagination for large datasets

5. **Testing**
   - Write unit tests for business logic
   - Implement integration tests for API endpoints
   - Mock external dependencies properly
   - Maintain good test coverage (>80%)

## Troubleshooting

### Common Issues

**Service Connection Errors:**

```bash
# Check RabbitMQ connection
docker logs rabbitmq-container

# Check service registration
curl http://localhost:8001/health
```

**Database Connection Issues:**

```bash
# Test database connectivity
npx prisma studio --schema=./src/microservices/user/prisma/schema.prisma

# Check migrations status
npx prisma migrate status
```

**Authentication Problems:**

```bash
# Verify JWT configuration
echo $JWT_SECRET

# Test token validation
curl -H "Authorization: Bearer <token>" http://localhost:8001/api/v1/users
```
