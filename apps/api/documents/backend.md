# Backend Development Guide

This guide covers backend development for the PITCH application using NestJS, Prisma, and tRPC.

## Tech Stack

- **NestJS** - Progressive Node.js framework
- **Prisma** - Next-generation ORM
- **tRPC** - End-to-end typesafe APIs
- **PostgreSQL** - Primary database
- **TypeScript** - Type-safe development
- **Jest** - Testing framework

## Getting Started

### Development Server
```bash
# Start the backend development server
pnpm --filter api dev

# Or from the root
pnpm dev
```

The API will be available at `http://localhost:3001`.

### Project Structure
```
apps/api/
├── src/
│   ├── app.controller.ts    # Main app controller
│   ├── app.module.ts        # Root application module
│   ├── app.service.ts       # Main app service
│   └── main.ts             # Application entry point
├── prisma/
│   └── schema.prisma       # Database schema
├── test/                   # E2E tests
├── dist/                   # Compiled output
└── package.json
```

## Database Setup with Prisma

### Configuration
The database is configured to use PostgreSQL with Prisma ORM:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Environment Variables
Create `.env` file in `apps/api/`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_db"
```

### Common Prisma Commands
```bash
# Navigate to API directory
cd apps/api

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Deploy migrations to production
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Push schema changes without migration
npx prisma db push
```

### Database Schema Example
```prisma
// Add to prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]

  @@map("users")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("posts")
}
```

## NestJS Development

### Creating Modules
```bash
# Generate a new module
nest generate module users
nest generate controller users
nest generate service users

# Or generate all at once
nest generate resource users
```

### Module Example
```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
```

### Service with Prisma
```typescript
// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: { email: string; name?: string }) {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: { email?: string; name?: string }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
```

### Controller Example
```typescript
// src/users/users.controller.ts
import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() createUserDto: { email: string; name?: string }) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: { email?: string; name?: string }) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

## tRPC Integration

### Setup tRPC Router
```typescript
// src/trpc/trpc.router.ts
import { Injectable } from '@nestjs/common';
import { TRPCRouter } from '@trpc/server';
import { UsersService } from '../users/users.service';

@Injectable()
export class AppRouter {
  constructor(private usersService: UsersService) {}

  router = router({
    users: {
      list: publicProcedure.query(() => {
        return this.usersService.findAll();
      }),
      
      byId: publicProcedure
        .input(z.string())
        .query(({ input }) => {
          return this.usersService.findOne(input);
        }),
      
      create: publicProcedure
        .input(z.object({
          email: z.string().email(),
          name: z.string().optional(),
        }))
        .mutation(({ input }) => {
          return this.usersService.create(input);
        }),
    },
  });
}
```

## Database Migration Workflow

### Development
1. Modify `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name description`
3. Generate client: `npx prisma generate`

### Production
1. Deploy migrations: `npx prisma migrate deploy`
2. Generate client: `npx prisma generate`

## Testing

### Unit Tests
```typescript
// src/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all users', async () => {
    const users = [{ id: '1', email: 'test@example.com', name: 'Test' }];
    jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users);

    expect(await service.findAll()).toEqual(users);
  });
});
```

### E2E Tests
```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

### Running Tests
```bash
# Unit tests
pnpm --filter api test

# E2E tests
pnpm --filter api test:e2e

# Test coverage
pnpm --filter api test:cov

# Watch mode
pnpm --filter api test:watch
```

## Development Commands

### Build and Development
```bash
# Development mode
pnpm --filter api dev

# Production build
pnpm --filter api build

# Start production server
pnpm --filter api start:prod

# Debug mode
pnpm --filter api start:debug
```

### Code Quality
```bash
# Lint code
pnpm --filter api lint

# Format code
pnpm --filter api format
```

## Environment Configuration

### Development (.env)
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_dev"

# Application
NODE_ENV=development
PORT=3001

# JWT (if using authentication)
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d
```

### Production (.env.production)
```env
# Database
DATABASE_URL="postgresql://username:password@prod-host:5432/pitch_prod"

# Application
NODE_ENV=production
PORT=3001

# Security
JWT_SECRET=strong-production-secret
JWT_EXPIRES_IN=1d
```

## Best Practices

1. **Database Design**
   - Use meaningful table and column names
   - Add proper indexes for query performance
   - Use transactions for complex operations
   - Implement soft deletes when appropriate

2. **API Design**
   - Follow RESTful conventions
   - Use proper HTTP status codes
   - Implement proper error handling
   - Add input validation and sanitization

3. **Security**
   - Validate all inputs
   - Use environment variables for secrets
   - Implement proper authentication/authorization
   - Sanitize database queries

4. **Performance**
   - Use database indexes appropriately
   - Implement caching strategies
   - Optimize Prisma queries
   - Use connection pooling

5. **Testing**
   - Write unit tests for services
   - Add E2E tests for endpoints
   - Mock external dependencies
   - Achieve good test coverage

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Check DATABASE_URL format
# Ensure database server is running
# Verify credentials and permissions
```

**Prisma client not generated:**
```bash
cd apps/api
npx prisma generate
```

**Migration conflicts:**
```bash
# Reset database (development only)
npx prisma migrate reset

# Or resolve conflicts manually
npx prisma migrate resolve --applied migration-name
```

**Module not found errors:**
```bash
# Check import paths
# Verify module registration in app.module.ts
# Ensure proper exports from modules
```