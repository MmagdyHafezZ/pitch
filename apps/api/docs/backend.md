# Microservices Backend Development Guide

**Note: This document contains legacy backend patterns. For current microservices architecture, refer to [development.md](./development.md).**

This guide covers the evolution from monolithic to microservices architecture in the PITCH application. While the patterns below show traditional NestJS development, the current implementation uses a microservices approach with API Gateway pattern.

## Current Architecture (Microservices)

The PITCH API now follows a microservices architecture:

- **API Gateway** - Centralized authentication and routing (`src/gateway/`)
- **User Microservice** - PostgreSQL with Prisma (`src/microservices/user/`)
- **Business Microservice** - MongoDB with Prisma (`src/microservices/business/`)
- **RabbitMQ** - Message queue communication between services

For current development patterns, see:
- [Development Guide](./development.md) - Current microservices patterns
- [Database Guide](./database.md) - Multi-database setup
- [Main API README](../README.md) - Setup and architecture

## Legacy Patterns (Reference Only)

The patterns below show traditional NestJS development that has been superseded by the microservices architecture.

### Traditional Project Structure
```
src/
├── app.controller.ts    # Main app controller
├── app.module.ts        # Root application module
├── app.service.ts       # Main app service
├── main.ts             # Application entry point
├── users/              # Users module (now User Microservice)
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── projects/           # Projects module (now Business Microservice)
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   └── projects.module.ts
└── prisma/             # Single database (now split across services)
    └── schema.prisma
```

### Current Project Structure
```
src/
├── gateway/                # API Gateway
│   ├── controllers/        # Gateway controllers
│   ├── guards/            # JWT authentication
│   └── interceptors/      # Request/response handling
├── microservices/         # Individual microservices
│   ├── user/              # User microservice
│   │   ├── prisma/        # PostgreSQL schema
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user-prisma.service.ts
│   └── business/          # Business microservice
│       ├── prisma/        # MongoDB schema
│       ├── business.controller.ts
│       ├── business.service.ts
│       └── business-prisma.service.ts
└── common/               # Shared utilities
    ├── filters/          # Exception filters
    ├── helpers/          # Utility functions
    └── interfaces/       # Type definitions
```

## Migration from Legacy to Microservices

### 1. Database Separation
**Before (Single Database):**
```prisma
// Single schema.prisma
model User {
  id       String @id @default(cuid())
  email    String @unique
  projects Project[]
}

model Project {
  id     String @id @default(cuid())
  title  String
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

**After (Separate Databases):**
```prisma
// User microservice - PostgreSQL
model User {
  id    String @id @default(cuid())
  email String @unique
  // No direct relation to projects
}

// Business microservice - MongoDB
model Project {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  title  String
  ownerId String  // References User.id from User service
}
```

### 2. Service Communication
**Before (Direct Method Calls):**
```typescript
@Injectable()
export class ProjectsService {
  constructor(private usersService: UsersService) {}

  async createProject(data: CreateProjectDto) {
    const user = await this.usersService.findOne(data.userId);
    // Direct service call
  }
}
```

**After (Message Patterns):**
```typescript
// Gateway Controller
@Controller('projects')
export class ProjectGatewayController {
  constructor(
    @Inject('USER_SERVICE') private userService: ClientProxy,
    @Inject('BUSINESS_SERVICE') private businessService: ClientProxy
  ) {}

  async createProject(data: CreateProjectDto) {
    const user = await this.userService.send('get_user_by_id', { id: data.userId });
    const project = await this.businessService.send('create_project', data);
    return project;
  }
}

// Business Microservice
@MessagePattern('create_project')
async createProject(@Payload() data: CreateProjectDto) {
  return await this.businessService.create(data);
}
```

### 3. Authentication Evolution
**Before (Monolithic Auth):**
```typescript
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  @Get('profile')
  getProfile(@Request() req) {
    return req.user; // Direct access to user
  }
}
```

**After (Gateway Auth with Claims Forwarding):**
```typescript
// Gateway Controller
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
export class UserGatewayController {
  @Get('profile')
  async getProfile(@UserClaims() userClaims: any) {
    return this.userService.send('get_profile', { userClaims });
  }
}

// User Microservice
@MessagePattern('get_profile')
async getProfile(@Payload() data: MessageWithUserClaims) {
  this.logger.log(`Profile requested by: ${data.userClaims.email}`);
  return await this.userService.findProfile(data.userClaims.id);
}
```

## Deprecated Technologies

### tRPC (No Longer Used)
The original architecture planned to use tRPC for type-safe APIs:

```typescript
// Deprecated tRPC setup
export const appRouter = router({
  users: {
    list: publicProcedure.query(() => {
      return this.usersService.findAll();
    }),
    byId: publicProcedure
      .input(z.string())
      .query(({ input }) => {
        return this.usersService.findOne(input);
      }),
  },
});
```

**Why Removed:** tRPC doesn't fit well with microservices architecture. RabbitMQ message patterns provide better service isolation and reliability.

### Single Database Approach
```typescript
// Deprecated single Prisma service
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

**Why Changed:** Single database creates tight coupling between services. Separate databases allow independent scaling and technology choices.

## Benefits of Microservices Migration

### 1. Service Isolation
- User service can scale independently
- Business logic separated from user management
- Database technology optimized per service (PostgreSQL vs MongoDB)

### 2. Development Independence
- Teams can work on services independently
- Separate deployment cycles
- Technology stack flexibility per service

### 3. Fault Tolerance
- Failure in one service doesn't bring down entire system
- Message queues provide retry mechanisms
- Better error isolation and recovery

### 4. Security
- Centralized authentication at gateway level
- User context forwarded securely to services
- No direct database access from external clients

## Migration Best Practices

### 1. Gradual Migration
- Start with API Gateway for authentication
- Migrate one domain at a time (users first, then business logic)
- Keep legacy endpoints during transition

### 2. Data Consistency
- Plan for eventual consistency between services
- Use saga patterns for distributed transactions
- Implement proper rollback mechanisms

### 3. Testing Strategy
- Test individual microservices in isolation
- Integration tests for message patterns
- End-to-end tests through API Gateway

### 4. Monitoring and Logging
- Centralized logging with correlation IDs
- Service health checks
- Performance monitoring per service

## Current Recommendations

1. **Follow microservices patterns** described in [development.md](./development.md)
2. **Use the multi-database setup** detailed in [database.md](./database.md)
3. **Implement proper testing** as outlined in [testing.md](./testing.md)
4. **Avoid the legacy patterns** shown in this document

This document serves as a reference for the architectural evolution and should not be used for new development.