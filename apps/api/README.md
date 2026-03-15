# PITCH API

The backend for the PITCH business management platform built with NestJS microservices architecture, Prisma ORM, and RabbitMQ message queues.

## Architecture Overview

The API follows a microservices architecture with an API Gateway pattern:

- **API Gateway** - Routes requests and handles JWT authentication (`src/gateway/`)
- **User Microservice** - User management with PostgreSQL (`src/microservices/userManagement/`)
- **Business Microservice** - Business logic with MongoDB (`src/microservices/business/`)
- **Authentication System** - JWT-based auth with access and refresh tokens

## Tech Stack

- **NestJS** - Progressive Node.js framework with TypeScript
- **Prisma** - Next-generation ORM for database operations
- **RabbitMQ** - Message queue for inter-service communication
- **PostgreSQL** - Primary database for user data
- **MongoDB** - Database for business data and docs
- **Redis** - Caching and session management
- **JWT** - Authentication tokens (access + refresh)
- **Docker** - Containerization for development databases

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (package manager)
- Docker & Docker Compose (for databases)

### Development Setup

1. **Start database services:**

   ```bash
   # From project root
   docker-compose -f docker-compose.local.yml up -d postgres mongodb redis rabbitmq
   ```

2. **Set up environment:**

   ```bash
   # Copy environment template
   cp .env.example .env

   # Update .env with your configuration
   ```

3. **Run database migrations:**

   ```bash
   # User microservice (PostgreSQL)
   cd src/microservices/userManagement
   npx prisma migrate dev
   npx prisma generate

   # Business microservice (MongoDB)
   cd ../business
   npx prisma db push
   npx prisma generate
   ```

4. **Start development server:**

   ```bash
   # From project root (recommended)
   pnpm dev

   # Or API only
   pnpm --filter api dev
   ```

5. **Open the application:**
   - API Gateway: [http://localhost:8000](http://localhost:8000)
   - API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Project Structure

```
apps/api/
├── src/
│   ├── gateway/                    # API Gateway
│   │   ├── controllers/            # Gateway controllers
│   │   ├── guards/                # JWT authentication guards
│   │   ├── interceptors/          # Request/response interceptors
│   │   └── decorators/            # Custom decorators
│   ├── microservices/             # Microservices
│   │   ├── user/                  # User microservice (PostgreSQL)
│   │   │   ├── prisma/            # Database schema & migrations
│   │   │   ├── user.controller.ts # Message pattern handlers
│   │   │   ├── user.service.ts    # Business logic
│   │   │   └── user-prisma.service.ts # Database service
│   │   └── business/              # Business microservice (MongoDB)
│   │       ├── prisma/            # Database schema
│   │       ├── business.controller.ts
│   │       ├── business.service.ts
│   │       └── business-prisma.service.ts
│   ├── common/                    # Shared modules
│   │   ├── filters/               # Exception filters
│   │   ├── helpers/               # Utility functions
│   │   └── interfaces/            # Type definitions
│   ├── app.module.ts              # Root application module
│   └── main.ts                   # Application entry point
├── docs/                         # API docs
├── docker-compose.rabbitmq.yml   # RabbitMQ configuration
└── package.json
```

## Features

### Authentication System

- **JWT-based authentication** with access and refresh tokens
- **API Gateway pattern** - centralized auth validation
- **User claims forwarding** - microservices receive authenticated user context
- **Role-based access control** with admin/user roles

### Microservices Communication

- **RabbitMQ message patterns** for inter-service communication
- **Request/response pattern** for synchronous operations
- **Event-driven architecture** for asynchronous operations
- **Service isolation** with separate databases per domain

### Database Management

- **Multi-database approach** - PostgreSQL for users, MongoDB for business data
- **Prisma ORM** for type-safe database operations
- **Database migrations** and schema management
- **Connection pooling** and performance optimization

## API Endpoints

### Authentication

```
POST /api/v1/auth/register    # User registration
POST /api/v1/auth/login       # User login
POST /api/v1/auth/refresh     # Refresh access token
POST /api/v1/auth/logout      # User logout
GET  /api/v1/auth/me         # Get current user
```

### Users

```
GET    /api/v1/users          # List users (admin only)
GET    /api/v1/users/:id      # Get user by ID
PUT    /api/v1/users/:id      # Update user
DELETE /api/v1/users/:id      # Delete user (admin only)
```

### Business

```
GET    /api/v1/businesses     # List user's businesses
POST   /api/v1/businesses     # Create business
GET    /api/v1/businesses/:id # Get business details
PUT    /api/v1/businesses/:id # Update business
DELETE /api/v1/businesses/:id # Delete business
```

## Development Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server

# Database
pnpm migrate:user          # Run user service migrations
pnpm migrate:business      # Push business service schema
pnpm db:seed              # Bootstrap SQL schemas, then seed demo data across Prisma + Mongo services

# Testing
pnpm test                  # Run unit tests
pnpm test:e2e             # Run integration tests
pnpm test:cov             # Run tests with coverage

# Linting
pnpm lint                  # Run ESLint
pnpm lint:fix             # Fix linting issues
```

## Environment Variables

Create `.env` file in the API directory:

```env
# Application
NODE_ENV=development
PORT=8000

# Database URLs
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_dev"
MONGODB_URL="mongodb://localhost:27017/pitch_business"
REDIS_URL="redis://localhost:6380"

# RabbitMQ
RABBITMQ_URL="amqp://admin:admin123@localhost:5672"

# JWT Configuration
JWT_SECRET="your-super-secure-secret-key-minimum-32-characters"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
```

## Microservices Communication

### Message Patterns

Services communicate using RabbitMQ message patterns:

```typescript
// Gateway sends request to microservice
const users = await this.userService.send('get_users', { userClaims });

// Microservice handles the pattern
@MessagePattern('get_users')
async getUsers(@Payload() data: MessageWithUserClaims) {
  this.logger.log(`Getting users - Requested by: ${data.userClaims.email}`);
  return await this.userService.findAll();
}
```

### Authentication Flow

1. Client sends request with JWT token to API Gateway
2. Gateway validates token and extracts user claims
3. User claims are forwarded to relevant microservice
4. Microservice processes request with user context
5. Response is returned through the gateway

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific service tests
pnpm test user.service.spec.ts

# Watch mode
pnpm test:watch
```

### Integration Tests

```bash
# Run E2E tests
pnpm test:e2e

# Test specific endpoints
pnpm test:e2e --grep "auth"
```

## Deployment

### Docker Build

```bash
# Build API image
docker build -f apps/api/Dockerfile -t pitch-api:latest .

# Run with production compose
docker-compose -f docker-compose.prod.yml up -d
```

### Production Environment

```env
NODE_ENV=production
PORT=8000
DATABASE_URL="postgresql://prod-user:prod-pass@prod-host:5432/pitch_prod"
JWT_SECRET="production-secret-key-64-characters-minimum"
RABBITMQ_URL="amqp://prod-user:prod-pass@rabbitmq-host:5672"
```

## Monitoring

### Health Checks

```bash
# Check API health
curl http://localhost:8000/health

# Check individual services
curl http://localhost:8000/health/database
curl http://localhost:8000/health/rabbitmq
```

### Logging

The API uses structured logging with user context:

```typescript
this.logger.log(
  `User operation - Action: ${action}, User: ${userClaims.email}`,
);
```

## Learn More

- [Development Guide](./docs/development.md) - Detailed development setup and patterns
- [Database Guide](./docs/database.md) - Database schema and management
- [Deployment Guide](./docs/deployment.md) - Production deployment instructions
- [NestJS docs](https://docs.nestjs.com) - Framework docs
- [Prisma docs](https://www.prisma.io/docs) - ORM docs
