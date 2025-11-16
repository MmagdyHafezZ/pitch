# PITCH

A modern business management platform built with Next.js, NestJS microservices,
and Turborepo. Features JWT authentication, multi-database architecture, and
real-time communication via RabbitMQ.

## 📚 Documentation

**👉 [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Complete developer
documentation (START HERE)

**Other Resources**:

- [docs/](docs/README.md) - Additional documentation (CI/CD, contributing,
  security)

## Architecture Overview

PITCH follows a microservices architecture with an API Gateway pattern:

- **API Gateway** - Centralized authentication and request routing
- **User Microservice** - User management with PostgreSQL
- **Support Microservice** - Support tickets with PostgreSQL
- **Frontend Application** - React/Next.js with Mantine UI

### Key Features

- 🔐 **JWT Authentication** - Secure auth with 32+ char secrets
- 🎯 **API Gateway Pattern** - Centralized validation & routing
- 📨 **Message Queues** - RabbitMQ for inter-service communication
- 🗄️ **Multi-Database** - PostgreSQL for relational data
- ⚡ **Real-time** - WebSocket support & event-driven architecture
- 🎨 **Modern UI** - Mantine components with TypeScript
- ✅ **Type Safe** - Full TypeScript with Prisma ORM

## Monorepo Structure

```
PITCH/
├── apps/
│   ├── web/                 # Next.js 15 frontend
│   └── api/                 # NestJS microservices
├── packages/
│   ├── shared/              # Shared types & utilities
│   └── eslint-config/       # Shared ESLint config
└── docs/                    # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker & Docker Compose

### Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start database services:**

   ```bash
   docker-compose -f docker-compose.local.yml up -d
   ```

3. **Run database migrations:**

   ```bash
   # User microservice (PostgreSQL)
   cd apps/api/src/microservices/userManagement
   npx prisma migrate dev

   # Business microservice (MongoDB)
   cd ../business
   npx prisma db push
   ```

4. **Start development servers:**
   ```bash
   pnpm dev
   ```

### Access Points

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **API Gateway:** [http://localhost:8000](http://localhost:8000)
- **API docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

## Tech Stack

### Frontend (apps/web)

- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Mantine UI** - Modern component library
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **NextAuth** - Authentication integration

### Backend (apps/api)

- **NestJS** - Microservices framework
- **Prisma ORM** - Type-safe database operations
- **RabbitMQ** - Message queue for inter-service communication
- **JWT Authentication** - Access & refresh tokens
- **PostgreSQL** - User data storage
- **MongoDB** - Business data storage
- **Redis** - Caching and sessions
- **TypeScript** - Type safety across services

### DevOps & Tools

- **Turborepo** - Monorepo management
- **Docker & Docker Compose** - Development databases
- **pnpm** - Fast package management
- **ESLint** - Code linting
- **Jest** - Unit testing
- **Playwright** - E2E testing

## Development Workflow

### Environment Variables

Each app requires its own environment configuration:

```bash
# Frontend (.env.local in apps/web)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Backend (.env in apps/api)
NODE_ENV=development
PORT=8000
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_dev"
MONGODB_URL="mongodb://localhost:27017/pitch_business"
REDIS_URL="redis://localhost:6380"
RABBITMQ_URL="amqp://admin:admin123@localhost:5672"
JWT_SECRET="your-super-secure-secret-key"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
```

### Available Scripts

```bash
# Development
pnpm dev                    # Start all development servers
pnpm --filter web dev      # Start frontend only
pnpm --filter api dev      # Start backend only

# Building
pnpm build                  # Build all applications
pnpm --filter web build    # Build frontend
pnpm --filter api build    # Build backend

# Testing
pnpm test                   # Run all tests
pnpm test:unit             # Run unit tests
pnpm test:e2e              # Run end-to-end tests
pnpm test:cov              # Run tests with coverage

# Linting & Formatting
pnpm lint                   # Lint all packages
pnpm lint:fix              # Fix linting issues
pnpm type-check            # TypeScript checking

# Database
pnpm db:migrate            # Run database migrations
pnpm db:seed               # Seed development data
pnpm db:studio             # Open Prisma Studio
```

## Project Structure

```
PITCH/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router (pages)
│   │   │   ├── features/      # Feature-based architecture
│   │   │   │   └── auth/      # Authentication feature
│   │   │   │       ├── components/  # Auth UI components
│   │   │   │       ├── hooks/       # Auth hooks
│   │   │   │       ├── services/    # Auth API services
│   │   │   │       └── stores/      # Zustand auth store
│   │   │   ├── components/    # Shared UI components
│   │   │   └── lib/           # Utilities & configurations
│   │   │       ├── providers.tsx    # App providers
│   │   │       └── client.ts        # API client
│   │   └── docs/         # docs
│   └── api/                   # NestJS Backend
│       ├── src/
│       │   ├── gateway/       # API Gateway
│       │   │   ├── controllers/     # Gateway controllers
│       │   │   ├── guards/          # JWT guards
│       │   │   └── interceptors/    # Request interceptors
│       │   ├── microservices/ # Microservices
│       │   │   ├── user/            # User service (PostgreSQL)
│       │   │   │   ├── prisma/      # Database schema
│       │   │   │   ├── user.controller.ts
│       │   │   │   ├── user.service.ts
│       │   │   │   └── user-prisma.service.ts
│       │   │   └── business/        # Business service (MongoDB)
│       │   │       ├── prisma/
│       │   │       ├── business.controller.ts
│       │   │       ├── business.service.ts
│       │   │       └── business-prisma.service.ts
│       │   └── common/        # Shared modules
│       │       ├── filters/         # Exception filters
│       │       ├── helpers/         # Utility functions
│       │       └── interfaces/      # Type definitions
│       └── docs/              # API docs
├── packages/
│   ├── shared/                # Shared types & utilities
│   └── eslint-config/         # Shared ESLint config
├── docker/                    # Docker configurations
│   ├── rabbitmq/             # RabbitMQ config
│   └── docker-compose files
└── docs/                      # Project docs
```

## Authentication Architecture

### JWT Flow

1. **User Authentication** - Login via API Gateway
2. **Token Generation** - JWT access & refresh tokens issued
3. **Gateway Validation** - All requests validated at gateway level
4. **Claims Forwarding** - User claims sent to microservices
5. **Service Context** - Microservices receive authenticated user context

### API Gateway Pattern

```
Client → API Gateway → User Microservice (PostgreSQL)
           ↓
       Business Microservice (MongoDB)
```

## docs

### Quick References

- **[Frontend README](./apps/web/README.md)** - Web app setup and features
- **[API README](./apps/api/README.md)** - Backend architecture and setup
- **[Frontend Guide](./apps/web/docs/frontend.md)** - Mantine UI development
- **[Components Guide](./apps/web/docs/components.md)** - Component patterns

### Development Guides

- **[Backend Development](./apps/api/docs/development.md)** - Microservices
  patterns
- **[Database Guide](./apps/api/docs/database.md)** - Multi-database setup
- **[API Endpoints](./apps/api/docs/development.md#api-endpoints)** - Available
  endpoints

## Contributing

1. **Feature Development** - Use feature-based architecture
2. **Database Changes** - Run migrations in correct microservice
3. **Testing** - Write tests for both unit and integration
4. **docs** - Update relevant docs for changes
5. **Type Safety** - Maintain TypeScript across the stack

## Technology Decisions

### Why Microservices?

- **Scalability** - Independent scaling of services
- **Domain Separation** - Clear business domain boundaries
- **Technology Flexibility** - Different databases per service
- **Team Independence** - Teams can work on services independently

### Why Multi-Database?

- **PostgreSQL** - ACID compliance for user data
- **MongoDB** - Flexible schema for business docs
- **Redis** - Fast caching and session storage

### Why API Gateway?

- **Centralized Auth** - Single authentication point
- **Request Routing** - Route to appropriate microservice
- **Cross-Cutting Concerns** - Logging, monitoring, rate limiting

## Getting Help

- **Frontend Issues** - Check [frontend docs](./apps/web/docs/frontend.md)
- **Backend Issues** - Check [development guide](./apps/api/docs/development.md)
- **Database Issues** - Check [database guide](./apps/api/docs/database.md)
- **Environment Setup** - Verify Docker services are running

## License

ISC

🔍 RECOMMENDATIONS

Immediate removals (14 packages)

# Web app

pnpm remove @emotion/cache @emotion/react @emotion/server pnpm remove
@tiptap/extension-link @tiptap/pm @tiptap/react @tiptap/starter-kit pnpm remove
chroma-js date-fns embla-carousel embla-carousel-react pnpm remove lucide-react
react-day-picker react-hook-form

# API (if bcryptjs is used instead)

pnpm remove bcrypt @types/bcrypt

Consider removing (if no future plans)

- @mantine unused packages (6 packages)
- @trpc/server (unless tRPC implementation planned)
- amqp packages (unless message queue planned)

Potential savings: ~15-20MB bundle size reduction
