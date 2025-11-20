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

Before you begin, you'll need to install the following tools:

#### 1. Install Node.js

**macOS (using Homebrew):**

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (version 18 or higher)
brew install node@20
```

**macOS/Linux (using asdf - recommended for version management):**

```bash
# Install asdf
git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.13.1

# Add to shell (for bash)
echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
echo '. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc

# Or for zsh
echo '. "$HOME/.asdf/asdf.sh"' >> ~/.zshrc

# Restart your shell
exec $SHELL

# Install Node.js plugin
asdf plugin add nodejs

# Install Node.js 20
asdf install nodejs 20.11.0
asdf global nodejs 20.11.0

# Verify installation
node --version  # Should show v20.x.x
```

**Windows:**

```powershell
# Download and install from official website
# https://nodejs.org/en/download/

# Or use winget
winget install OpenJS.NodeJS.LTS

# Verify installation
node --version
```

#### 2. Install pnpm

**All platforms:**

```bash
# Using npm (comes with Node.js)
npm install -g pnpm@9

# Or using Homebrew (macOS)
brew install pnpm

# Or using standalone script
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Verify installation
pnpm --version  # Should show 9.x.x
```

#### 3. Install Docker (Rancher Desktop or Docker Desktop)

**Option A: Rancher Desktop (Recommended - Free & Open Source)**

Rancher Desktop provides Kubernetes and container management with Docker CLI
compatibility.

**macOS:**

```bash
# Using Homebrew
brew install --cask rancher

# Or download from https://rancherdesktop.io/
```

**Linux:**

```bash
# Download the .deb or .rpm package from
# https://github.com/rancher-sandbox/rancher-desktop/releases

# For Ubuntu/Debian
wget https://github.com/rancher-sandbox/rancher-desktop/releases/download/v1.12.0/rancher-desktop-1.12.0-amd64.deb
sudo dpkg -i rancher-desktop-1.12.0-amd64.deb
```

**Windows:**

```powershell
# Using winget
winget install rancher-sandbox.rancher-desktop

# Or download installer from https://rancherdesktop.io/
```

**After Installing Rancher Desktop:**

1. Launch Rancher Desktop
2. Go to **Preferences** → **Container Engine** → Select **dockerd (moby)**
3. Enable **Kubernetes** (optional for local development)
4. Wait for initialization to complete

**Option B: Docker Desktop**

**macOS:**

```bash
brew install --cask docker
```

**Windows/Linux:** Download from
[https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

**Verify Docker Installation:**

```bash
docker --version
docker-compose --version

# Test Docker is running
docker run hello-world
```

#### 4. Install Git

**macOS:**

```bash
brew install git
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get update
sudo apt-get install git
```

**Windows:**

```powershell
winget install Git.Git
```

**Verify:**

```bash
git --version
```

#### 5. Install VS Code (Optional but Recommended)

**All platforms:** Download from
[https://code.visualstudio.com/](https://code.visualstudio.com/)

Or using package managers:

```bash
# macOS
brew install --cask visual-studio-code

# Windows
winget install Microsoft.VisualStudioCode

# Linux (Ubuntu/Debian)
sudo snap install code --classic
```

---

### Initial Setup

Once you have all prerequisites installed, follow these steps:

#### 1. Clone the Repository

```bash
git clone https://github.com/your-org/pitch.git
cd pitch
```

#### 2. Install Dependencies

```bash
# Install all dependencies for all packages
pnpm install
```

This will install dependencies for:

- Frontend (`apps/web`)
- Backend (`apps/api`)
- Shared packages (`packages/shared`, `packages/shared-backend`)

#### 3. Set Up Environment Variables

If you are a PITCH developer, Ask @MmagdyHafezZ for .env file and skip the
following steps

**Backend Environment (.env):**

```bash
# Copy the example file
cp apps/api/.env.example apps/api/.env

# Edit the file with your settings
nano apps/api/.env  # or use your preferred editor
```

**Required environment variables for `apps/api/.env`:**

```bash
# Database URLs - PostgreSQL instances
DATABASE_URL_USER="postgresql://pitch:pitch123@localhost:5432/pitch_user"
DATABASE_URL_SIMULATION="postgresql://pitch:pitch123@localhost:5433/pitch_simulation"
DATABASE_URL_SUPPORT="postgresql://pitch:pitch123@localhost:5434/pitch_support"
DATABASE_URL_ANALYTICS="postgresql://pitch:pitch123@localhost:5435/pitch_analytics"
DATABASE_URL_CRM="postgresql://pitch:pitch123@localhost:5436/pitch_crm"

# MongoDB
MONGODB_URI="mongodb://pitch:pitch123@localhost:27017/pitch_simulation?authSource=admin"

# Redis
REDIS_URL="redis://localhost:6379"

# RabbitMQ
RABBITMQ_URL="amqp://guest:guest@localhost:5672"

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET="your-secret-key-min-32-characters-long"
JWT_REFRESH_SECRET="your-refresh-secret-key-min-32-characters"

# API Configuration
PORT=8000
NODE_ENV=development

# OAuth - Google (optional for development)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:8000/auth/oauth/google/callback"

# Frontend URL
FRONTEND_URL="http://localhost:3000"
```

**Frontend Environment (.env.local):**

```bash
# Copy the example file
cp apps/web/.env.example apps/web/.env.local

# Edit the file
nano apps/web/.env.local
```

**Required environment variables for `apps/web/.env.local`:**

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="your-nextauth-secret-min-32-characters"

# OAuth - Google (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**Generate secure secrets:**

```bash
# On macOS/Linux, generate random secrets
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 4. Start Infrastructure Services

Start all required services (PostgreSQL, MongoDB, Redis, RabbitMQ):

```bash
docker-compose up -d
```

**Verify services are running:**

```bash
docker-compose ps

# You should see:
# - pitch-postgres-user-local
# - pitch-rabbitmq-local
# - pitch-redis-local

```

**To check for service logs:**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f pitch-postgres-user-local
```

#### 5. Generate Prisma Clients

Generate TypeScript clients for all databases:

```bash
cd apps/api
pnpm db:generate:all
```

This generates Prisma clients for:

- `@prisma/user-client`
- `@prisma/simulation-client`
- `@prisma/support-client`
- `@prisma/analytics-client`
- `@prisma/crm-client`

#### 6. Run Database Migrations

Create database tables and initial schema:

```bash
# Still in apps/api directory
pnpm db:migrate:all
```

This runs migrations for all microservices.

**Troubleshooting migrations:**

```bash
# If migrations fail, check database connectivity
docker-compose ps

# Reset a specific database (development only!)
pnpm db:reset:userManagement

# Or reset all databases
pnpm db:reset:all
```

#### 7. Start Development Servers

**Option A: Start All Services**

```bash
# From project root
pnpm dev
```

This starts:

- Frontend at [http://localhost:3000](http://localhost:3000)
- API Gateway at [http://localhost:8000](http://localhost:8000)
- All microservices

**Option B: Start Services Individually**

```bash
# Terminal 1 - Frontend
pnpm --filter web dev

# Terminal 2 - Backend
pnpm --filter api dev

# Or specific microservices
pnpm dev:gateway
pnpm dev:user
pnpm dev:simulation
```

#### 8. Verify Installation

**Check Frontend:** Open [http://localhost:3000](http://localhost:3000) in your
browser.

**Check API:**

```bash
# Health check
curl http://localhost:8000/health

# API Documentation
# Open http://localhost:8000/docs in browser
```

**Check RabbitMQ Management UI:** Open
[http://localhost:15672](http://localhost:15672)

- Username: `guest`
- Password: `guest`

**Database Tools:** Install [sqlelectron](https://sqlectron.github.io/) or
similar apps

### Useful Commands

#### Development

```bash
# Start all services
pnpm dev

# Start frontend only
pnpm --filter web dev

# Start backend only
pnpm --filter api dev

# Start specific microservice
pnpm dev:gateway
pnpm dev:user
pnpm dev:simulation
pnpm dev:support
pnpm dev:analytics
pnpm dev:crm
pnpm dev:lti
pnpm dev:s3
```

#### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter api build
pnpm --filter web build
pnpm --filter @pitch/shared-backend build

# Clean build artifacts
pnpm clean
```

#### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test user.service.spec.ts

# Run tests with coverage
pnpm test:cov

# Run E2E tests
pnpm test:e2e

# Frontend tests
pnpm --filter web test
```

#### Database Operations

```bash
# Generate Prisma clients
pnpm db:generate:all              # All databases
pnpm db:generate:userManagement   # Specific database

# Run migrations
pnpm db:migrate:all               # All databases
pnpm db:migrate:userManagement    # Specific database

# Push schema (development only)
pnpm db:push:all                  # All databases
pnpm db:push:userManagement       # Specific database

# Reset database (⚠️ deletes all data)
pnpm db:reset:all
pnpm db:reset:userManagement

# Deploy migrations (production)
pnpm db:deploy:all
pnpm db:deploy:userManagement

# Prisma Studio (GUI for database)
pnpm db:studio:user
pnpm db:studio:simulation
pnpm db:studio:support
pnpm db:studio:analytics
pnpm db:studio:crm

# Create a new migration
cd apps/api
pnpm prisma migrate dev --schema=./src/microservices/userManagement/prisma/schema.prisma
```

#### Docker Operations

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f postgres_user
docker-compose logs -f rabbitmq

# Restart specific service
docker-compose restart postgres_user

# Rebuild and start services
docker-compose up -d --build

# Check service status
docker-compose ps

# Execute command in container
docker-compose exec postgres_user psql -U pitch -d pitch_user
docker-compose exec redis redis-cli
docker-compose exec mongodb mongosh
```

#### Code Quality

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter api lint
pnpm --filter web lint

# Fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm format

# Type check
pnpm type-check
```

#### Package Management

```bash
# Install dependency for specific app
pnpm --filter api add package-name
pnpm --filter web add package-name

# Install dev dependency
pnpm --filter api add -D package-name

# Install workspace dependency
pnpm add -w package-name

# Update dependencies
pnpm update

# Update specific package
pnpm --filter api update package-name

# Remove dependency
pnpm --filter api remove package-name
```

#### Troubleshooting Commands

```bash
# Clear all node_modules and reinstall
pnpm clean:modules
pnpm install

# Clear Turbo cache
rm -rf .turbo

# Regenerate Prisma clients
pnpm db:generate:all

# Check Docker resource usage
docker stats

# View Docker disk usage
docker system df

# Clean Docker system
docker system prune -a

# Reset entire development environment
docker-compose down -v
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
pnpm db:generate:all
docker-compose up -d
pnpm db:migrate:all
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

## Questions?

- Check [README.md](README.md) for project overview
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- Review existing code for examples
- Ask in team chat/discussions

**Thank you for contributing!** 🎉
