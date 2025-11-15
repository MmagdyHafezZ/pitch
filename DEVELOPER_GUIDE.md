# PITCH Developer Guide

**Complete Backend Documentation** **Last Updated**: November 2, 2025

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Hardware & Hosting Infrastructure](#hardware--hosting-infrastructure)
4. [Programming Languages & Frameworks](#programming-languages--frameworks)
5. [Database Technologies](#database-technologies)
6. [Integration APIs](#integration-apis)
7. [Technical Requirements & Performance Metrics](#technical-requirements--performance-metrics)
8. [Architecture](#architecture)
9. [Development Commands](#development-commands)
10. [Code Quality & Issues](#code-quality--issues)
11. [Recent Refactoring](#recent-refactoring)
12. [Architectural Principles](#architectural-principles)
13. [Next Steps](#next-steps)

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker & Docker Compose

### Setup in 5 Minutes

```bash
# 1. Install dependencies
pnpm install

# 2. Set required environment variables
cp apps/api/.env.example apps/api/.env
# Edit .env with your values (see Environment Variables section)

# 3. Start database services
docker-compose -f docker-compose.local.yml up -d

# 4. Run database migrations
pnpm db:generate:all
pnpm db:migrate:all

# 5. Start development servers
pnpm dev
```

**Access Points**:

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Project Overview

### What is PITCH?

PITCH is a modern business management platform built with:

- **Architecture**: Microservices with API Gateway pattern
- **Frontend**: Next.js 15, React 19, Mantine UI
- **Backend**: NestJS with RabbitMQ message queue
- **Databases**: PostgreSQL (users), MongoDB (business), Redis (cache)
- **Authentication**: JWT with OAuth integration

### Tech Stack

**Backend**:

- NestJS (microservices framework)
- Prisma ORM (type-safe database access)
- RabbitMQ (inter-service communication)
- JWT (authentication)
- TypeScript

**Frontend**:

- Next.js 15 with App Router
- React 19
- Mantine UI
- TanStack Query (server state)
- Zustand (client state)

**DevOps**:

- Turborepo (monorepo management)
- Docker & Docker Compose
- pnpm (package manager)
- Jest (testing)

---

## Hardware & Hosting Infrastructure

### Deployment Platforms

**Production Hosting**:

- **IBM Cloud** - Primary production infrastructure
  - **IBM Cloud Kubernetes Service (IKS)**: Container orchestration
  - **IBM Cloud Code Engine**: Serverless containers (alternative)
  - **IBM Cloud Foundry**: Platform-as-a-Service option
  - Auto-scaling and load balancing
  - Multi-region deployment (Dallas, Washington DC, London, Frankfurt, Tokyo,
    Sydney)
  - Integrated CI/CD with IBM Continuous Delivery
  - Built-in monitoring and logging (IBM Cloud Monitoring, Log Analysis)
  - Enterprise-grade security and compliance (SOC 2, ISO 27001, HIPAA, GDPR)

**IBM Cloud Services**:

- **Compute**: IBM Cloud Kubernetes Service (IKS) or Code Engine
- **Container Registry**: IBM Cloud Container Registry (private Docker registry)
- **Networking**: IBM Cloud Virtual Private Cloud (VPC), Load Balancers
- **Security**: IBM Cloud Identity and Access Management (IAM), Key Protect

**Containerization**:

- **Docker** - Application packaging
  - Multi-stage builds for optimization
  - Docker Compose for local development
  - Images pushed to IBM Cloud Container Registry
  - Kubernetes-ready deployments

### Infrastructure Services

**Local Development** (via `docker-compose.local.yml`):

```yaml
Services:
  - PostgreSQL 16 (User DB): Port 5432
  - PostgreSQL 16 (Support DB): Port 5433
  - MongoDB 7: Port 27017
  - Redis 7: Port 6380
  - RabbitMQ 3.12: Port 5672 (AMQP), 15672 (Management UI)
```

**IBM Cloud Production Infrastructure**:

- **Database Hosting**:
  - IBM Cloud Databases for PostgreSQL (managed, HA-enabled)
  - IBM Cloud Databases for MongoDB (replica sets)
- **Message Queue**:
  - IBM Cloud Messages for RabbitMQ (managed)
  - Alternative: IBM Event Streams (Apache Kafka)
- **Caching**:
  - IBM Cloud Databases for Redis (managed, clustered)
- **Object Storage**:
  - IBM Cloud Object Storage (S3-compatible)
- **CDN**:
  - IBM Cloud Internet Services (powered by Cloudflare)
  - Edge caching and DDoS protection
- **Monitoring**:
  - IBM Cloud Monitoring (Sysdig)
  - IBM Log Analysis (LogDNA)
  - IBM Cloud Activity Tracker

### Compute Resources

**Recommended Minimums**:

| Environment | CPU     | RAM  | Storage |
| ----------- | ------- | ---- | ------- |
| Development | 2 cores | 4 GB | 20 GB   |
| Staging     | 2 cores | 4 GB | 50 GB   |
| Production  | 4 cores | 8 GB | 100 GB  |
| Database    | 2 cores | 4 GB | 50 GB   |

**Auto-scaling Targets**:

- CPU usage: 70% threshold
- Memory usage: 80% threshold
- Request queue depth: < 100ms latency

---

## Programming Languages & Frameworks

### Primary Languages

**TypeScript 5.3+** (100% TypeScript codebase)

- Strict mode enabled
- ES2022 target
- Type-safe API contracts
- Shared types across frontend/backend

**Node.js 18+ LTS**

- ECMAScript modules (ESM)
- Native fetch API
- Built-in test runner (future migration)

### Backend Framework Stack

**NestJS 10.x** - Primary backend framework

- Dependency injection (IoC container)
- Modular architecture
- Decorator-based development
- Built-in microservices support
- OpenAPI/Swagger integration

**Core Backend Libraries**:

```json
{
  "framework": "NestJS 10.x",
  "orm": "Prisma 5.x",
  "validation": "class-validator + class-transformer",
  "authentication": "Passport.js + JWT",
  "messaging": "@nestjs/microservices + amqplib",
  "testing": "Jest 29.x + Supertest",
  "documentation": "@nestjs/swagger"
}
```

### Frontend Framework Stack

**Next.js 15** - React meta-framework

- App Router (RSC architecture)
- Server components by default
- API routes
- Image optimization
- Font optimization

**React 19** - UI library

- Server Components
- Concurrent rendering
- Automatic batching
- Transitions API

**Mantine UI 7.x** - Component library

- 100+ components
- Dark mode support
- TypeScript-first
- Accessible (WCAG 2.1)
- Responsive design

**State Management**:

- **TanStack Query 5.x**: Server state, caching, synchronization
- **Zustand**: Client-side global state
- **React Hook Form**: Form state management

**Frontend Utilities**:

```json
{
  "styling": "Mantine UI + CSS Modules",
  "http": "Axios + TanStack Query",
  "routing": "Next.js App Router",
  "forms": "React Hook Form + Zod validation",
  "i18n": "next-intl (if needed)",
  "testing": "Jest + React Testing Library + Playwright"
}
```

### Development Tools

**Monorepo Management**:

- **Turborepo**: Build orchestration, caching
- **pnpm Workspaces**: Dependency management
- **Changesets**: Version management (future)

**Code Quality**:

- **ESLint 8.x**: Linting with TypeScript support
- **Prettier 3.x**: Code formatting
- **Husky 8.x**: Git hooks
- **Commitizen**: Conventional commits
- **lint-staged**: Pre-commit checks

---

## Database Technologies

### Relational Databases (PostgreSQL 16)

**User Microservice Database** (`USER_DATABASE_URL`):

- **Purpose**: User accounts, authentication, teams, subscriptions
- **ORM**: Prisma with `@prisma/user-client`
- **Schema Location**: `apps/api/src/microservices/user/prisma/schema.prisma`
- **Key Tables**:
  - `User`: Core user accounts
  - `RefreshToken`: JWT refresh tokens
  - `Team`: Multi-tenant teams
  - `Subscription`: Billing/plans
  - `OAuthAccount`: Social login connections

**Support Microservice Database** (`SUPPORT_DATABASE_URL`):

- **Purpose**: Support tickets, customer service
- **ORM**: Prisma with `@prisma/support-client`
- **Schema Location**: `apps/api/src/microservices/support/prisma/schema.prisma`
- **Key Tables**:
  - `Ticket`: Support tickets
  - `Message`: Ticket conversations
  - `Attachment`: File uploads

**Features Used**:

- Foreign keys with cascade rules
- Indexes on frequently queried columns
- JSONB columns for flexible data
- Full-text search (planned)
- Row-level security (planned)

### Document Database (MongoDB 7)

**Business Microservice Database** (`MONGODB_URL`):

- **Purpose**: Business simulations, flexible schemas
- **Driver**: Official MongoDB Node.js driver or Mongoose
- **Collections** (planned):
  - `simulations`: Business simulation data
  - `scenarios`: What-if scenarios
  - `analytics`: Aggregated metrics

**Use Cases**:

- Schema-less business data
- High-volume time-series data
- Complex nested documents
- Rapid prototyping

### Caching Layer (Redis 7)

**Redis Database** (`REDIS_URL`):

- **Purpose**: Session storage, caching, rate limiting
- **Library**: `@nestjs/redis` or `ioredis`
- **Use Cases**:
  - JWT token blacklist
  - Session storage
  - Rate limiting counters
  - Temporary data caching
  - Pub/Sub for real-time features

**Caching Strategy**:

```typescript
// Cache TTLs
{
  "user-profile": "15m",
  "jwt-blacklist": "7d",
  "rate-limit": "1m",
  "api-response": "5m"
}
```

### Message Queue (RabbitMQ 3.12)

**RabbitMQ** (`RABBITMQ_URL`):

- **Purpose**: Microservice communication, async jobs
- **Pattern**: RPC (Request-Reply) + Event-driven
- **Exchanges**: Direct exchange per microservice
- **Queues**:
  - `user_service_queue`: User microservice
  - `support_service_queue`: Support microservice
  - `simulation_service_queue`: Business microservice

**Message Patterns**:

- `users.v1.create` - Create user (RPC)
- `users.v1.findById` - Get user (RPC)
- `auth.v1.login` - Login (RPC)
- `user.created` - Event notification

### Database Migration Strategy

**Prisma Migrations**:

```bash
# Development: Auto-generate migration
npx prisma migrate dev --name add_user_table

# Production: Apply migrations
npx prisma migrate deploy

# Schema changes workflow:
# 1. Update schema.prisma
# 2. Run migrate dev (creates SQL migration)
# 3. Review migration SQL
# 4. Commit migration files
# 5. CI/CD applies on deploy
```

**Data Seeding**:

```bash
# Seed development data
npx prisma db seed

# Location: prisma/seed.ts
```

---

## Integration APIs

### Planned AI/ML Integrations

**Speech-to-Text (STT)**:

- **Primary**: OpenAI Whisper API
- **Alternative**: Google Cloud Speech-to-Text
- **Use Cases**: Voice commands, meeting transcription
- **Features**: Multi-language support, real-time streaming

**Text-to-Speech (TTS)**:

- **Primary**: ElevenLabs API
- **Alternative**: Google Cloud Text-to-Speech
- **Use Cases**: Audio responses, accessibility
- **Features**: Natural voices, emotional tone control

**Large Language Models (LLMs)**:

- **Primary**: OpenAI GPT-4 API
- **Alternative**: Anthropic Claude API
- **Use Cases**:
  - Business insights generation
  - Natural language queries
  - Report summarization
  - Decision support

**Integration Pattern**:

```typescript
// apps/api/src/microservices/ai/
export class AIService {
  async transcribe(audio: Buffer): Promise<string> {
    // Whisper API integration
  }

  async synthesize(text: string): Promise<Buffer> {
    // TTS API integration
  }

  async complete(prompt: string): Promise<string> {
    // LLM completion
  }
}
```

### Vector Database (RAG - Retrieval Augmented Generation)

**Planned Implementation**:

**Option 1: Pinecone**

- Managed vector database
- Fast similarity search
- Scalable to billions of vectors
- Native metadata filtering

**Option 2: pgvector (PostgreSQL Extension)**

- Open-source
- Integrated with existing PostgreSQL
- Good for < 1M vectors
- Lower cost

**Option 3: Weaviate**

- Open-source vector database
- Built-in vectorization
- Hybrid search (vector + keyword)
- Self-hosted or cloud

**RAG Architecture**:

```typescript
// Document ingestion
1. Split documents into chunks (512 tokens)
2. Generate embeddings (OpenAI text-embedding-3-small)
3. Store in vector DB with metadata
4. Index for similarity search

// Query flow
1. User question → embedding
2. Vector similarity search (top-k=5)
3. Retrieved context + question → LLM
4. Generate answer with citations
```

**Use Cases**:

- Knowledge base search
- Document Q&A
- Contextual business insights
- Semantic search over simulations

### Third-Party Integrations

**OAuth Providers** (Implemented):

- Google OAuth 2.0
- Microsoft Azure AD
- IBM Cloud Identity (planned)

**Payment Processing** (Planned):

- Stripe API for subscriptions
- Webhooks for payment events

**Email Service** (Planned):

- SendGrid or Resend API
- Transactional emails
- Email templates

**Analytics** (Planned):

- PostHog for product analytics
- Sentry for error tracking
- Datadog for APM

---

## Technical Requirements & Performance Metrics

### Performance Targets

| Metric                   | Target Value       | Measurement Method               |
| ------------------------ | ------------------ | -------------------------------- |
| **API Response Time**    | < 2 seconds (p95)  | Per endpoint monitoring          |
| **Page Load Time**       | < 3 seconds (LCP)  | Lighthouse/Web Vitals            |
| **Database Query Time**  | < 500ms (p95)      | Prisma query logs                |
| **Uptime SLA**           | 99.9% (8.76h/year) | External uptime monitoring       |
| **AI Response Accuracy** | ≥ 80%              | User feedback + validation tests |
| **Concurrent Users**     | ≥ 10,000 users     | Load testing (k6, Artillery)     |
| **Throughput**           | 1,000 req/sec      | Stress testing                   |
| **Time to First Byte**   | < 600ms            | CDN + server optimization        |

### Availability & Reliability

**Uptime Requirements**:

- **Target**: 99.9% uptime (43.8 minutes downtime/month)
- **Monitoring**: IBM Cloud Monitoring (Sysdig) + IBM Log Analysis (LogDNA)
- **Incident Response**: < 15 minutes acknowledgment
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 5 minutes (data loss)

**Error Budgets**:

```
Monthly error budget (99.9%): 43.8 minutes
Weekly error budget: 10 minutes
Daily error budget: 1.4 minutes
```

**Health Checks**:

```typescript
// apps/api/src/health/
GET /health        → Overall system health
GET /health/db     → Database connectivity
GET /health/queue  → RabbitMQ status
GET /health/cache  → Redis status
```

### Scalability Targets

**Horizontal Scaling**:

- API servers: Auto-scale 2-10 instances
- Database: Read replicas for queries
- RabbitMQ: Clustered queue (3+ nodes)
- Redis: Sentinel or Cluster mode

**Vertical Scaling Limits**:

- Single API instance: 500 req/sec
- PostgreSQL: 1,000 connections
- RabbitMQ: 10,000 messages/sec

**Load Testing Benchmarks**:

```bash
# Target: 10,000 concurrent users
# Ramp-up: 0 → 10,000 over 5 minutes
# Sustained: 10,000 users for 30 minutes
# Metrics:
#   - p50 latency: < 500ms
#   - p95 latency: < 2s
#   - p99 latency: < 5s
#   - Error rate: < 0.1%
```

### Security Requirements

**Authentication**:

- JWT expiration: 15 minutes (access), 7 days (refresh)
- Password hashing: bcrypt (cost factor 10)
- MFA support: TOTP (planned)
- Session management: Redis-backed

**Rate Limiting**:

```typescript
{
  "auth_endpoints": "10 req/min per IP",
  "api_general": "100 req/min per user",
  "api_burst": "200 req/min per user",
  "public_endpoints": "50 req/min per IP"
}
```

**Data Protection**:

- Encryption at rest: Database-level encryption
- Encryption in transit: TLS 1.3
- Secrets management: Environment variables + vault
- PII handling: GDPR compliant

### Data Requirements

**Backup & Recovery**:

- Automated daily backups (PostgreSQL, MongoDB)
- Point-in-time recovery: 7-day window
- Backup retention: 30 days
- Disaster recovery: Multi-region replication (planned)

**Data Retention**:

```typescript
{
  "user_data": "Indefinite (until account deletion)",
  "session_data": "7 days",
  "logs": "30 days (90 days for production)",
  "analytics": "1 year",
  "support_tickets": "3 years"
}
```

### Monitoring & Observability

**Key Metrics** (Golden Signals):

1. **Latency**: Request duration distributions
2. **Traffic**: Requests per second
3. **Errors**: Error rate and types
4. **Saturation**: CPU, memory, disk usage

**Alerting Thresholds**:

```yaml
Critical Alerts:
  - API error rate > 5%
  - Database connections > 90%
  - Response time p95 > 5s
  - Service down (health check fails)

Warning Alerts:
  - API error rate > 1%
  - CPU usage > 80%
  - Memory usage > 85%
  - Response time p95 > 2s
```

**Logging Strategy**:

- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for distributed tracing
- Centralized logging (planned: Datadog, Loki)

### Compliance & Standards

**Code Quality Gates**:

- Test coverage: ≥ 80% (unit + integration)
- Linting: 0 errors, < 5 warnings
- Type safety: 100% TypeScript, strict mode
- Security: 0 critical vulnerabilities (Snyk, npm audit)

**API Standards**:

- REST: Resource-based URLs, standard HTTP methods
- Versioning: URL-based (`/api/v1/users`)
- Response format: JSON with consistent structure
- Error codes: Standard HTTP status codes
- Documentation: OpenAPI 3.0 (Swagger)

**Accessibility**:

- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios ≥ 4.5:1

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                         │
│              http://localhost:3000                           │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│              http://localhost:8000                           │
│  • JWT Validation                                            │
│  • Request Routing                                           │
│  • User Claims Forwarding                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ RabbitMQ (RPC)
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ User Service   │ │ Support Service│ │Business Service│
│  PostgreSQL    │ │  PostgreSQL    │ │   MongoDB      │
└────────────────┘ └────────────────┘ └────────────────┘
```

### Microservices Layering

Each microservice follows clean architecture with proper layering:

```
┌─────────────────────┐
│  Gateway Controller │  → HTTP/REST endpoint
└──────────┬──────────┘
           │ RabbitMQ RPC
           ↓
┌─────────────────────┐
│  RPC Controller     │  → Message handler (THIN)
│                     │  → Validates & delegates
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Application Service │  → Orchestration layer
│                     │  → Coordinates workflows
│                     │  → Manages transactions
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Domain Service     │  → Business logic
│                     │  → Domain rules
│                     │  → NO data access
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│    Repository       │  → Data access ONLY
│                     │  → Prisma operations
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   Database          │  → PostgreSQL/MongoDB
└─────────────────────┘
```

### Monorepo Structure

```
PITCH/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router
│   │   │   ├── features/      # Feature-based modules
│   │   │   ├── components/    # Shared UI components
│   │   │   └── lib/           # Utilities & config
│   │   └── package.json
│   │
│   └── api/                   # NestJS Backend
│       ├── src/
│       │   ├── gateway/       # API Gateway
│       │   │   ├── controllers/
│       │   │   ├── guards/
│       │   │   └── interceptors/
│       │   │
│       │   ├── microservices/ # Microservices
│       │   │   ├── user/      # User service (PostgreSQL)
│       │   │   │   ├── controllers/
│       │   │   │   ├── services/
│       │   │   │   ├── repositories/
│       │   │   │   ├── dto/
│       │   │   │   └── prisma/
│       │   │   │
│       │   │   ├── support/   # Support service
│       │   │   └── simulation/# Simulation service
│       │   │
│       │   ├── common/        # Shared code
│       │   │   ├── config/
│       │   │   ├── filters/
│       │   │   ├── helpers/
│       │   │   └── interfaces/
│       │   │
│       │   └── config/        # App configuration
│       └── package.json
│
├── packages/
│   ├── shared/                # Shared types & utilities
│   └── eslint-config/         # Shared ESLint config
│
└── docs/                      # Documentation
```

---

## Development Commands

### Daily Development

```bash
# Start everything
pnpm dev

# Start specific apps
pnpm dev:api      # Backend only
pnpm dev:web      # Frontend only

# Build for production
pnpm build
```

### Database Operations

**IMPORTANT**: Each microservice has its own Prisma schema and database.

```bash
# Generate all Prisma clients (run after schema changes)
pnpm db:generate:all

# Run all migrations
pnpm db:migrate:all

# User microservice operations
cd apps/api/src/microservices/user
npx prisma migrate dev          # Create & apply migration
npx prisma studio               # Visual database editor
npx prisma generate             # Generate client

# Support microservice operations
cd apps/api/src/microservices/support
npx prisma migrate dev
npx prisma studio

# Prisma clients are generated to:
# - User:    node_modules/@prisma/user-client
# - Support: node_modules/@prisma/support-client
```

### Testing

```bash
# Backend tests
pnpm --filter api test              # Unit tests
pnpm --filter api test:watch        # Watch mode
pnpm --filter api test:cov          # With coverage
pnpm --filter api test:integration  # Integration tests
pnpm --filter api test:e2e          # End-to-end tests
pnpm --filter api test:all          # All test suites

# Frontend tests
pnpm --filter web test              # Unit tests
pnpm --filter web test:watch        # Watch mode
pnpm --filter web test:coverage     # With coverage

# Run specific test file
pnpm --filter api test src/microservices/user/services/user.service.spec.ts
```

### Code Quality

```bash
# Linting
pnpm lint                    # Lint all packages
pnpm --filter api lint:fix   # Fix backend issues
pnpm --filter web lint:fix   # Fix frontend issues

# Type checking
pnpm type-check

# Formatting
pnpm format                  # Format all files
pnpm format:check            # Check formatting
```

### Environment Variables

**Backend** (`apps/api/.env`):

```bash
# Database URLs
USER_DATABASE_URL="postgresql://username:password@localhost:5432/pitch_user"
SUPPORT_DATABASE_URL="postgresql://username:password@localhost:5433/pitch_support"
MONGODB_URL="mongodb://localhost:27017/pitch_business"

# Redis
REDIS_URL="redis://localhost:6380"

# RabbitMQ (REQUIRED - no default)
RABBITMQ_URL="amqp://username:password@localhost:5672/pitch_local"

# JWT (REQUIRED - minimum 32 characters)
JWT_SECRET="your-super-secure-minimum-32-char-secret-key-here"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# OAuth (optional - only needed if using OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Environment
NODE_ENV="development"
PORT="8000"
```

**Frontend** (`apps/web/.env.local`):

```bash
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Code Quality & Issues

### Status Overview

**Total Issues Identified**: 40 **Issues Fixed**: 3 (7.5%) **Issues Remaining**:
37 (92.5%)

| Severity     | Found | Fixed | Remaining |
| ------------ | ----- | ----- | --------- |
| **Critical** | 6     | 3     | 3 ⚠️      |
| **High**     | 11    | 0     | 11 ⚠️     |
| **Medium**   | 14    | 0     | 14        |
| **Low**      | 9     | 0     | 9         |

### Critical Issues Fixed ✅

#### 1. Hardcoded RabbitMQ Credentials ✅

- **Was**: `'amqp://admin:admin123@localhost:5672'` in source code
- **Now**: Requires `RABBITMQ_URL` environment variable
- **File**: `apps/api/src/config/microservices.config.ts`

#### 2. Weak JWT Secrets ✅

- **Was**: `process.env.JWT_SECRET || 'secret'`
- **Now**: Enforces minimum 32 characters, throws error if missing
- **File**: `apps/api/src/common/config/jwt.config.ts`

#### 3. Missing DTO Validation ✅

- **Was**: No validation on RegisterDto, LoginDto
- **Now**: Full validation with `class-validator` decorators
- **File**: `apps/api/src/microservices/user/dto/auth.dto.ts`

### Critical Issues Remaining ⚠️

#### 4. No Rate Limiting (Security)

**Problem**: Auth endpoints open to brute force attacks

**Fix**:

```bash
pnpm add @nestjs/throttler

# In app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1 minute
      limit: 10,   // 10 requests
    }]),
  ],
  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  }],
})
```

#### 5. No Tests for Gateway Controllers (Quality)

**Problem**: Entry-point controllers have 0% test coverage

**Missing Files**:

```
apps/api/src/gateway/controllers/__tests__/auth-gateway.controller.spec.ts
apps/api/src/gateway/controllers/__tests__/user-gateway.controller.spec.ts
apps/api/src/microservices/user/controllers/__tests__/auth.controller.spec.ts
```

**Action**: Create test files with Jest

#### 6. OAuth Credential Validation (Security)

**Problem**: Empty string fallbacks for OAuth credentials

**Fix**:

```typescript
// In google.strategy.ts
const clientID = process.env.GOOGLE_CLIENT_ID
if (!clientID) {
  throw new Error('GOOGLE_CLIENT_ID is required')
}
```

### High Priority Issues

**Complete list of 11 high-priority issues**:

1. Multiple auth services doing same work (architecture)
2. Missing error context in catch blocks (code quality)
3. Console.log instead of Logger (observability)
4. Unsafe type casting in exception filter (code quality)
5. No integration tests (quality)
6. Hardcoded CORS origins (security)
7. Missing database indexes (performance)
8. No pagination on list endpoints (performance)
9. Inconsistent error responses (architecture)
10. Untyped error handling in strategies (code quality)
11. Missing README files (documentation)

**See Full List**: All 40 issues are documented with fixes at the end of this
document.

---

## Recent Refactoring

### What Was Changed (October 30, 2025)

#### Files Created (10)

1. **auth.controller.ts** - RPC message handler for auth (~100 lines)
2. **auth-application.service.ts** - Orchestration layer (~330 lines)
3. **auth.repository.ts** - Data access layer (~160 lines)
4. **jwt.config.ts** - Secure JWT configuration (~60 lines)
5. **DEVELOPER_GUIDE.md** - This unified documentation

#### Files Modified (15)

- `microservices.config.ts` - Removed hardcoded credentials
- `gateway.module.ts` - Uses secure JWT config
- `auth.dto.ts` - Added validation decorators
- `user.module.ts` - Registered new services
- `auth.service.ts` - Refactored to use repositories
- `oauth.controller.ts` - Replaced console.log with Logger
- `user-prisma.service.ts` - Added OnModuleDestroy
- `auth-gateway.controller.ts` - Added retry logic
- And 7 more files

### Architecture Before & After

**Before Refactoring** ❌:

```
Gateway → ❌ Missing handlers → Timeout
        → ❌ Direct Prisma in services
        → ❌ No orchestration layer
        → ❌ console.log everywhere
```

**After Refactoring** ✅:

```
Gateway → RPC Controller (thin)
       → Application Service (orchestration)
       → Domain Service (business logic)
       → Repository (data access)
       → Prisma → Database
```

---

## Architectural Principles

### 1. API Gateway Pattern Rules

✅ **DO**:

- Keep gateway controllers thin (validate & proxy only)
- Use RabbitMQ `ClientProxy` for microservice communication
- Add timeouts to all RPC calls
- Version message patterns (`users.v1.create`)

❌ **DON'T**:

- Put business logic in gateway controllers
- Call microservice HTTP endpoints directly
- Skip timeouts or error handling
- Break existing message contracts

### 2. Microservices Layering

**Gateway Layer** (route → validate → map → RPC):

- No business logic
- Only validation, auth, routing

**Controller Layer** (RPC handler):

- Receives messages
- Validates with `@UsePipes(ValidationPipe)`
- Delegates to application service
- Wraps errors with `toRpcException()`

**Application Service Layer** (orchestration):

- Coordinates workflows
- Manages transactions
- Calls multiple services/repositories
- Maps DTOs

**Domain Service Layer** (business logic):

- Pure business rules
- No data access
- No external calls

**Repository Layer** (data access):

- Prisma operations ONLY
- One interface per aggregate
- Returns domain objects

### 3. Error Handling Pattern

```typescript
// RPC Controller
@MessagePattern('users.v1.create')
async createUser(@Payload() dto: CreateUserDto) {
  try {
    return await this.appService.createUser(dto);
  } catch (error) {
    throw toRpcException(error);  // ✅ Converts to RpcException
  }
}

// Application Service
async createUser(dto: CreateUserDto) {
  // Validate
  if (!dto.email) {
    throw new BadRequestException('Email is required');
  }

  // Orchestrate
  const user = await this.userRepo.create(dto);
  await this.emailService.sendWelcome(user.email);

  return user;
}
```

### 4. Repository Pattern

```typescript
// Define interface
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

// Implement
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private prisma: UserPrismaService) {}

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    return await this.prisma.user.create({ data });
  }
}

// Inject interface, not concrete class
constructor(
  @Inject(IUserRepository) private userRepo: IUserRepository
) {}
```

### 5. DTO Validation

```typescript
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(2)
  name: string;
}

// In controller
@MessagePattern('users.v1.create')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
async createUser(@Payload() dto: CreateUserDto) {
  // dto is validated and transformed
}
```

### 6. Common Failure Modes to Avoid

❌ **Controller Bloat**: Orchestration in controllers

- **Fix**: Move to application service

❌ **Tight Coupling**: Gateway imports service DTOs

- **Fix**: Use separate gateway DTOs

❌ **Hidden N+1**: Gateway fans out sync calls

- **Fix**: Use read models or batch queries

❌ **No Idempotency**: Missing `Idempotency-Key`

- **Fix**: Accept header, cache responses

❌ **Transaction Holes**: Events published out of band

- **Fix**: Use Outbox pattern

❌ **Missing Timeouts**: RPC calls hang forever

- **Fix**: Add timeout operator

---

## Next Steps

### Phase 1: Critical (This Week) - 4-6 hours

**Security Fixes**:

1. Add rate limiting on auth endpoints
   - Install `@nestjs/throttler`
   - Configure limits: 10 requests/minute for auth

2. Fix OAuth credential validation
   - Throw errors on missing `GOOGLE_CLIENT_ID`, etc.
   - Update all strategy files

3. Fix type casting in exception filter
   - Add type guard functions
   - Validate error structure before casting

### Phase 2: Quality (Next Sprint) - 2-3 days

**Testing**:

1. Create gateway controller tests
   - Test auth flow end-to-end
   - Mock RabbitMQ communication

2. Create integration tests
   - Test gateway → microservice → database

3. Add unit tests for services
   - Test AuthApplicationService
   - Test repositories

**Architecture**: 4. Consolidate auth services

- Remove AuthService or clarify responsibilities
- Update OAuth strategies

5. Fix error handling patterns
   - Add error context to all catch blocks
   - Use structured logging

### Phase 3: Performance (Next Month) - 1 week

1. Add database indexes
   - Index on `User.isActive`, `User.createdAt`
   - Index on `RefreshToken.expiresAt`

2. Implement pagination
   - Add to `UserRepository.findMany()`
   - Return `{ data, total, page, totalPages }`

3. Optimize queries
   - Fix N+1 patterns
   - Cache JWT secrets
   - Use query batching

### Phase 4: Documentation (Ongoing) - 2-3 weeks

1. Add README files
   - Create for each subdirectory
   - Document module responsibilities

2. Complete JSDoc
   - Add to all public methods
   - Document complex logic

3. API documentation
   - Expand Swagger/OpenAPI docs
   - Add examples

---

## Appendix: Complete Issue List

### Critical (6 issues)

1. ✅ **Hardcoded RabbitMQ credentials** - FIXED
2. ✅ **Weak JWT secrets** - FIXED
3. ✅ **Missing DTO validation** - FIXED
4. ⚠️ **Unsafe type casting** in exception filter
5. ⚠️ **No tests** for gateway controllers
6. ⚠️ **OAuth credentials** with empty defaults

### High (11 issues)

7. ⚠️ Multiple auth services (architecture)
8. ⚠️ Missing error context in catch blocks
9. ⚠️ Console.log instead of Logger (partially fixed)
10. ⚠️ No rate limiting
11. ⚠️ No integration tests
12. ⚠️ Hardcoded CORS origins
13. ⚠️ Missing database indexes
14. ⚠️ No pagination
15. ⚠️ Inconsistent error responses
16. ⚠️ Untyped error handling
17. ⚠️ Missing README files

### Medium (14 issues)

18-31. See detailed descriptions in original audit

### Low (9 issues)

32-40. See detailed descriptions in original audit

---

## Support & Questions

### Documentation Locations

- **This Guide**: Complete reference (you are here)
- **README.md**: Project overview and quick setup
- **CLAUDE.md**: AI assistant guidelines

### Useful Commands

```bash
# Get help
pnpm --help

# View package scripts
cat package.json | grep scripts -A 20

# Check database connection
cd apps/api/src/microservices/user
npx prisma db pull

# View logs
pnpm dev 2>&1 | tee logs.txt
```

### Troubleshooting

**Problem**: `JWT_SECRET must be at least 32 characters` **Solution**: Update
`.env` with a longer secret

**Problem**: `RABBITMQ_URL environment variable is required` **Solution**: Add
`RABBITMQ_URL` to `.env`

**Problem**: Tests failing **Solution**: Run `pnpm db:generate:all` first

**Problem**: Port already in use **Solution**: Kill process or change port in
`.env`

---

**Last Updated**: November 2, 2025 **Maintained By**: Development Team
**Status**: ✅ Active Development
