# Contributing to PITCH

Thank you for your interest in contributing to PITCH! This guide will help you
get started with development, understand our conventions, and submit quality
contributions.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Git Workflow](#git-workflow)
- [Architecture Patterns](#architecture-patterns)
- [API Guidelines](#api-guidelines)
- [Database Migrations](#database-migrations)
- [Redis Integration](#redis-integration)

---

## Development Setup

### Prerequisites

- **Node.js** 18+
- **pnpm** 9+
- **Docker** & Docker Compose
- **Git**
- **VS Code** (recommended)

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/pitch.git
cd pitch

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Start infrastructure
docker-compose up -d

# 5. Generate Prisma clients
cd apps/api
pnpm db:generate:all

# 6. Run migrations
pnpm db:migrate:all

# 7. Start development
pnpm dev
```

### VS Code Setup

Recommended extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss"
  ]
}
```

Settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## Project Structure

### Monorepo Organization

```
PITCH/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router pages
│   │   │   ├── features/      # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   └── simulation/
│   │   │   ├── components/    # Shared UI components
│   │   │   └── lib/           # Utilities
│   │   └── docs/
│   │
│   └── api/                    # NestJS Backend
│       ├── src/
│       │   ├── gateway/        # API Gateway
│       │   ├── microservices/  # All microservices
│       │   │   ├── userManagement/
│       │   │   │   ├── controllers/
│       │   │   │   ├── services/
│       │   │   │   ├── repositories/
│       │   │   │   ├── prisma/
│       │   │   │   └── *.module.ts
│       │   │   └── ...
│       │   └── common/         # Shared modules
│       │       ├── redis/      # Global Redis
│       │       ├── filters/    # Exception filters
│       │       ├── helpers/    # Utilities
│       │       └── interfaces/ # Types
│       └── docs/
│
└── packages/
    ├── shared/                 # Shared types
    └── eslint-config/          # ESLint config
```

### Directory Conventions

```
service/
├── controllers/          # HTTP/RPC controllers
├── services/            # Business logic
├── repositories/        # Data access layer
├── dto/                 # Data transfer objects
├── entities/            # Domain entities
├── prisma/              # Database schema & migrations
├── guards/              # Authorization guards
├── strategies/          # Auth strategies
├── interfaces/          # TypeScript interfaces
└── *.module.ts          # NestJS module
```

---

## Development Workflow

### Creating a New Feature

#### 1. Create Feature Branch

```bash
git checkout -b feature/SCRUM-123-new-feature
```

#### 2. Develop Feature

For frontend features:

```
apps/web/src/features/new-feature/
├── components/          # Feature-specific components
│   ├── FeatureForm.tsx
│   └── FeatureList.tsx
├── hooks/              # Feature-specific hooks
│   └── useFeature.ts
├── services/           # API integration
│   └── feature.service.ts
├── stores/             # State management
│   └── featureStore.ts
└── types.ts            # TypeScript types
```

For backend features:

```
apps/api/src/microservices/service/
├── controllers/
│   └── feature.controller.ts
├── services/
│   └── feature.service.ts
├── repositories/
│   └── feature.repository.ts
├── dto/
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
└── entities/
    └── feature.entity.ts
```

#### 3. Write Tests

```typescript
// Unit test
describe('FeatureService', () => {
  let service: FeatureService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FeatureService],
    }).compile()

    service = module.get<FeatureService>(FeatureService)
  })

  it('should create a feature', async () => {
    const result = await service.create({ name: 'Test' })
    expect(result).toBeDefined()
  })
})
```

#### 4. Update Documentation

- Update README if adding new dependencies
- Add/update API documentation
- Update environment variable examples
- Document configuration options

#### 5. Submit Pull Request

See [Git Workflow](#git-workflow) below.

### Running Development Servers

```bash
# All services
pnpm dev

# Frontend only
pnpm --filter web dev

# Backend only
pnpm --filter api dev

# Specific microservice
pnpm dev:gateway
pnpm dev:user
pnpm dev:simulation
```

### Hot Reload

- **Frontend**: Automatic with Next.js
- **Backend**: Automatic with NestJS watch mode
- **Docker**: Requires rebuild (`docker-compose restart service`)

---

## Code Style

### TypeScript

**General Rules:**

- Use TypeScript for everything
- Enable strict mode
- No `any` types (use `unknown` if needed)
- Prefer interfaces over types for objects
- Use enums for fixed sets of values

```typescript
// ✅ Good
interface User {
  id: string
  email: string
  name: string | null
}

enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

// ❌ Bad
type User = any
const ADMIN = 'ADMIN'
```

### Naming Conventions

```typescript
// Classes - PascalCase
class UserService {}

// Interfaces - PascalCase with 'I' prefix (optional)
interface IUser {}
interface User {} // Also acceptable

// Types - PascalCase
type UserId = string

// Functions/Methods - camelCase
function getUserById() {}

// Constants - UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3

// Private members - prefix with underscore
class Example {
  private _cache: Map<string, any>
}

// Files - kebab-case
user - service.ts
create - user.dto.ts
```

### NestJS Patterns

**Dependency Injection:**

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redis: RedisService
  ) {}
}
```

**DTOs:**

```typescript
import { IsString, IsEmail } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  name: string
}
```

**Controllers:**

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id)
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto)
  }
}
```

### React/Next.js Patterns

**Components:**

```typescript
// Use function components
export function UserCard({ user }: UserCardProps) {
  return (
    <Card>
      <Text>{user.name}</Text>
    </Card>
  );
}

// Props interface
interface UserCardProps {
  user: User;
  onEdit?: () => void;
}
```

**Hooks:**

```typescript
export function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getById(userId),
  })
}
```

**State Management:**

```typescript
// Zustand store
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))
```

### Linting & Formatting

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# TypeScript check
pnpm type-check
```

**Auto-format on save:**

Configure your editor to format on save using Prettier.

---

## Testing

### Testing Strategy

- **Unit Tests**: Test individual functions/classes
- **Integration Tests**: Test service interactions
- **E2E Tests**: Test full user flows

### Unit Tests

```typescript
// user.service.spec.ts
import { Test } from '@nestjs/testing'
import { UserService } from './user.service'
import { UserRepository } from './user.repository'

describe('UserService', () => {
  let service: UserService
  let repository: UserRepository

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
    repository = module.get<UserRepository>(UserRepository)
  })

  describe('create', () => {
    it('should create a user', async () => {
      const dto = { email: 'test@example.com', name: 'Test' }
      const user = { id: '1', ...dto }

      jest.spyOn(repository, 'create').mockResolvedValue(user)

      const result = await service.create(dto)

      expect(repository.create).toHaveBeenCalledWith(dto)
      expect(result).toEqual(user)
    })
  })
})
```

### Integration Tests

```typescript
// user.integration.spec.ts
describe('User Integration', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    await app.init()

    prisma = module.get<PrismaService>(PrismaService)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await app.close()
  })

  it('should create and retrieve user', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@example.com', name: 'Test' },
    })

    const found = await prisma.user.findUnique({
      where: { id: user.id },
    })

    expect(found).toEqual(user)
  })
})
```

### E2E Tests

```typescript
// user.e2e-spec.ts
describe('User E2E', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  it('/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@example.com', name: 'Test' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined()
      })
  })
})
```

### Running Tests

```bash
# All tests
pnpm test

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov

# Watch mode
pnpm test:watch

# Specific file
pnpm test user.service.spec.ts
```

### Test Coverage

Maintain minimum coverage:

- **Unit tests**: 80%
- **Integration tests**: 60%
- **E2E tests**: Critical paths

---

## Git Workflow

### Branch Naming

```
feature/SCRUM-123-short-description
bugfix/SCRUM-456-fix-description
hotfix/critical-issue-description
refactor/improve-something
docs/update-readme
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**

```
feat(user): add email verification

- Add email verification service
- Send verification emails
- Add verification endpoint

SCRUM-123
```

```
fix(simulation): resolve WebRTC connection issues

Fixed race condition in peer connection setup.

Fixes SCRUM-456
```

### Pull Request Process

#### 1. Create PR

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/SCRUM-123-new-feature

# Make changes and commit
git add .
git commit -m "feat(service): add new feature"

# Push to remote
git push origin feature/SCRUM-123-new-feature
```

#### 2. PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made

- List specific changes
- Be detailed but concise

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No console logs/debug code
- [ ] Tests pass locally
- [ ] Build succeeds

## Related Issues

Closes #123 Related to #456
```

#### 3. Code Review

**As Author:**

- Respond to all comments
- Make requested changes
- Mark conversations as resolved
- Keep PR updated with main

**As Reviewer:**

- Check code quality
- Verify tests exist and pass
- Test locally if needed
- Provide constructive feedback
- Approve when satisfied

#### 4. Merge

- **Squash and merge** for feature branches
- **Merge commit** for important milestones
- Delete branch after merge

---

## Architecture Patterns

### Layered Architecture

```
Controller → Service → Repository → Database
              ↓
           Redis Cache
```

**Controller Layer:**

- Handle HTTP/RPC requests
- Validate input (DTOs)
- Return responses

**Service Layer:**

- Business logic
- Orchestration
- Error handling

**Repository Layer:**

- Data access
- Database operations
- No business logic

### Microservices Communication

**RabbitMQ Patterns:**

```typescript
// Publisher
@Injectable()
export class UserService {
  constructor(@Inject('RABBITMQ_SERVICE') private client: ClientProxy) {}

  async createUser(dto: CreateUserDto) {
    const user = await this.userRepository.create(dto)

    // Emit event
    this.client.emit('user.created', {
      userId: user.id,
      email: user.email,
    })

    return user
  }
}

// Subscriber
@Controller()
export class AnalyticsController {
  @EventPattern('user.created')
  handleUserCreated(@Payload() data: any) {
    console.log('User created:', data)
    // Track analytics
  }
}
```

### Error Handling

```typescript
// Custom exceptions
export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`)
  }
}

// Global exception filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Log error
    // Return formatted response
  }
}
```

---

## API Guidelines

### REST Conventions

```typescript
// Resources - plural nouns
GET    /users           # List users
GET    /users/:id       # Get user
POST   /users           # Create user
PATCH  /users/:id       # Update user
DELETE /users/:id       # Delete user

// Nested resources
GET    /users/:id/teams
POST   /users/:id/teams
```

### Response Format

```typescript
// Success
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}

// Error
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/users/123"
}
```

### Swagger Documentation

```typescript
@ApiTags('users')
@Controller('users')
export class UserController {
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id)
  }
}
```

---

## Database Migrations

### Creating Migrations

```bash
# Development - interactive
cd apps/api
pnpm db:migrate:userManagement

# Name your migration descriptively
# Example: "add_email_verification_fields"
```

### Migration Best Practices

1. **Test migrations locally first**
2. **Make migrations reversible when possible**
3. **Separate schema and data migrations**
4. **Review generated SQL**
5. **Test rollback scenarios**

### Example Migration

```prisma
// Add new field
model User {
  id        String   @id
  email     String   @unique
  verified  Boolean  @default(false) // New field
  createdAt DateTime @default(now())
}
```

```bash
# Generate migration
pnpm db:migrate:userManagement

# Generates:
# 20240101000000_add_email_verification/
#   └── migration.sql
```

### Production Migrations

```bash
# Generate clients
pnpm db:generate:all

# Deploy migrations
pnpm db:deploy:all

# Or per service
pnpm db:deploy:userManagement
```

---

## Redis Integration

### Adding Redis to a Microservice

```typescript
// 1. Import RedisModule
import { RedisModule } from '@/common/redis'

@Module({
  imports: [
    RedisModule.forRoot({
      url: process.env.REDIS_URL,
      keyPrefix: 'myservice:',
      defaultTTL: 3600,
    }),
  ],
})
export class MyServiceModule {}

// 2. Inject RedisService
@Injectable()
export class MyService {
  constructor(private readonly redis: RedisService) {}

  async cacheData(key: string, data: any) {
    await this.redis.set(key, data, { ttl: 3600 })
  }

  async getData(key: string) {
    return await this.redis.get(key)
  }
}
```

### Cache Patterns

**Cache-Aside:**

```typescript
async getUser(userId: string): Promise<User> {
  // Try cache
  const cached = await this.redis.get<User>(`user:${userId}`);
  if (cached) return cached;

  // Cache miss - fetch from DB
  const user = await this.userRepository.findById(userId);

  // Cache for next time
  if (user) {
    await this.redis.set(`user:${userId}`, user, { ttl: 3600 });
  }

  return user;
}
```

**Write-Through:**

```typescript
async updateUser(userId: string, data: UpdateUserDto): Promise<User> {
  // Update DB
  const user = await this.userRepository.update(userId, data);

  // Update cache
  await this.redis.set(`user:${userId}`, user, { ttl: 3600 });

  return user;
}
```

---

## Common Tasks

### Adding a New Microservice

```bash
# 1. Create directory structure
mkdir -p apps/api/src/microservices/newservice/{controllers,services,repositories,dto,prisma}

# 2. Create module
touch apps/api/src/microservices/newservice/newservice.module.ts

# 3. Create Prisma schema
touch apps/api/src/microservices/newservice/prisma/schema.prisma

# 4. Add to nest-cli.json
# 5. Create main.ts entry point
# 6. Add database scripts to package.json
# 7. Update docker-compose.yml
```

### Adding Dependencies

```bash
# Add to specific app
pnpm --filter api add package-name
pnpm --filter web add package-name

# Add to workspace root
pnpm add -w package-name

# Dev dependency
pnpm add -D package-name
```

### Debugging

**VS Code Launch Config:**

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug NestJS",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["dev:user"],
  "console": "integratedTerminal",
  "restart": true
}
```

---

## Questions?

- Check [README.md](README.md) for project overview
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- Review existing code for examples
- Ask in team chat/discussions

**Thank you for contributing!** 🎉
