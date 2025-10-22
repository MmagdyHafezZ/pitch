# API docs

This directory contains docs specific to the PITCH API backend built with NestJS microservices architecture, Prisma ORM, and RabbitMQ message queues.

## Architecture Overview

The PITCH API follows a microservices architecture with an API Gateway pattern:

- **API Gateway** - Centralized authentication and request routing
- **User Microservice** - User management with PostgreSQL database
- **Business Microservice** - Business logic with MongoDB database
- **Authentication System** - JWT-based auth with access and refresh tokens

## docs Files

- **[development.md](./development.md)** - Microservices development guide and patterns
- **[database.md](./database.md)** - Multi-database setup and schema management
- **[testing.md](./testing.md)** - Testing strategies for microservices
- **[backend.md](./backend.md)** - Legacy backend patterns (deprecated)

## Quick Links

- [Main Project README](../../../README.md)
- [Frontend docs](../../web/docs/README.md)
- [API README](../README.md) - Main API setup guide

## Tech Stack

### API Gateway

- **NestJS** - Progressive Node.js framework
- **JWT Authentication** - Access and refresh tokens
- **Request Routing** - Route to appropriate microservices
- **User Claims Forwarding** - Send authenticated user context to services

### Microservices

- **User Service** - PostgreSQL with Prisma ORM
- **Business Service** - MongoDB with Prisma ORM
- **RabbitMQ** - Message queue for inter-service communication
- **TypeScript** - Type-safe development across all services

### Databases

- **PostgreSQL** - User data, authentication, sessions
- **MongoDB** - Business data, docs, projects
- **Redis** - Caching and session management

## API Overview

- **Base URL**: `http://localhost:8000` (development)
- **Authentication**: JWT-based with gateway validation
- **Communication**: RabbitMQ message patterns between services
- **Databases**: Multi-database approach with service isolation

## Quick Start

```bash
# Install dependencies
pnpm install

# Start database services
docker-compose -f docker-compose.local.yml up -d postgres mongodb redis rabbitmq

# Set up environment
cp .env.example .env
# Edit database URLs and JWT secrets in .env

# Run database migrations
cd src/microservices/user
npx prisma migrate dev
npx prisma generate

cd ../business
npx prisma db push
npx prisma generate

# Start development server
cd ../../..
pnpm dev
```

## Microservices Communication

### Message Patterns

Services communicate via RabbitMQ using consistent message patterns:

```typescript
// Gateway sends request
const users = await this.userService.send('get_users', { userClaims });

// Microservice handles pattern
@MessagePattern('get_users')
async getUsers(@Payload() data: MessageWithUserClaims) {
  return await this.userService.findAll();
}
```

### Authentication Flow

1. Client sends JWT token to API Gateway
2. Gateway validates token and extracts user claims
3. User claims forwarded to microservices with requests
4. Microservices process with authenticated user context

## Environment Variables

```env
# Application
NODE_ENV=development
PORT=8000

# Databases
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_dev"
MONGODB_URL="mongodb://localhost:27017/pitch_business"
REDIS_URL="redis://localhost:6380"

# Message Queue
RABBITMQ_URL="amqp://admin:admin123@localhost:5672"

# JWT Configuration
JWT_SECRET="your-super-secure-secret-key-minimum-32-characters"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
```

## Development Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm --filter api dev      # Start API only

# Database Operations
pnpm db:migrate:user       # User service migrations
pnpm db:migrate:business   # Business service schema push
pnpm db:studio            # Open Prisma Studio

# Testing
pnpm test                  # Unit tests
pnpm test:e2e             # Integration tests
pnpm test:cov             # Test coverage

# Code Quality
pnpm lint                  # ESLint
pnpm type-check           # TypeScript checking
```

## Service Architecture

### User Microservice (PostgreSQL)

- User registration and authentication
- Session management
- User profile operations
- Role-based access control

### Business Microservice (MongoDB)

- Business entity management
- Project operations
- Document storage
- Business logic workflows

### API Gateway

- JWT token validation
- Request routing to microservices
- User claims extraction and forwarding
- Cross-cutting concerns (logging, monitoring)

## Key Features

- 🔐 **JWT Authentication** - Secure token-based auth
- 🎯 **API Gateway Pattern** - Centralized request handling
- 📨 **Message Queues** - Reliable inter-service communication
- 🗄️ **Multi-Database** - Service-specific data storage
- 📊 **Structured Logging** - User context in all operations
- 🧪 **Comprehensive Testing** - Unit, integration, and E2E tests

## Next Steps

1. Review the [development guide](./development.md) for detailed microservices patterns
2. Check the [database guide](./database.md) for schema management
3. See [testing strategies](./testing.md) for microservice testing approaches
4. Refer to the main [API README](../README.md) for setup instructions
