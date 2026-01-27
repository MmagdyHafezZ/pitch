# PITCH Platform

A modern business simulation and management platform built with Next.js, NestJS
microservices, and Turborepo. Features AI-powered simulations, JWT
authentication, multi-database architecture, and real-time communication.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# Install dependencies
pnpm install

# Start infrastructure (databases, Redis, RabbitMQ)
docker-compose up -d

# Generate Prisma clients
cd apps/api
pnpm db:generate:all

# Run migrations
pnpm db:migrate:all

# Start development
pnpm dev
```

### Access Points

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **API Gateway:** [http://localhost:8000](http://localhost:8000)
- **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **RabbitMQ UI:** [http://localhost:15672](http://localhost:15672)

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide (Docker,
  databases, Redis, production setup)
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development workflow, code
  guidelines, testing

## 🏗️ Architecture

PITCH follows a microservices architecture with database-per-service pattern:

### Microservices

| Service             | Port | Database             | Description                                   |
| ------------------- | ---- | -------------------- | --------------------------------------------- |
| **Gateway**         | 8000 | -                    | API Gateway, JWT validation, routing          |
| **User Management** | -    | PostgreSQL           | Authentication, users, teams, organizations   |
| **Simulation**      | -    | PostgreSQL + MongoDB | AI-powered simulations, voice/video, feedback |
| **Support**         | -    | PostgreSQL           | FAQ, tickets, chat support                    |
| **Analytics**       | -    | PostgreSQL           | Metrics, dashboards, reporting                |
| **CRM**             | -    | PostgreSQL           | Salesforce/HubSpot integrations, OAuth tokens |
| **LTI**             | -    | -                    | LMS integration (LTI 1.3)                     |
| **S3**              | -    | -                    | File storage management                       |

### Infrastructure

- **PostgreSQL** (6 instances) - ACID-compliant relational data
- **MongoDB** - Flexible schema for simulation chat logs
- **Redis** - Distributed caching and session storage
- **RabbitMQ** - Message queue for inter-service communication

## 🛠️ Tech Stack

### Frontend (`apps/web`)

- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Mantine UI** - Modern component library
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **NextAuth** - Authentication

### Backend (`apps/api`)

- **NestJS** - Microservices framework
- **Prisma ORM** - Type-safe database operations
- **RabbitMQ** - Message bus
- **Redis** - Global caching layer
- **JWT** - Authentication tokens
- **PostgreSQL** - Primary databases
- **MongoDB** - Simulation data
- **TypeScript** - End-to-end type safety

### AI/ML Services

- **OpenAI GPT-4** - Conversational AI
- **Anthropic Claude** - Advanced reasoning
- **Deepgram** - Speech-to-text
- **ElevenLabs** - Text-to-speech
- **WebRTC** - Real-time video/voice

### DevOps

- **Turborepo** - Monorepo management
- **Docker & Docker Compose** - Containerization
- **pnpm** - Package management
- **Prisma Accelerate** - Connection pooling (production)
- **Kubernetes** - Production orchestration (Helm charts included)

## 📁 Monorepo Structure

```
PITCH/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router
│   │   │   ├── features/        # Feature-based modules
│   │   │   ├── components/      # Shared UI components
│   │   │   └── lib/             # Utilities & configs
│   │   └── docs/                # Frontend documentation
│   │
│   └── api/                      # NestJS backend
│       ├── src/
│       │   ├── gateway/         # API Gateway
│       │   ├── microservices/   # All microservices
│       │   │   ├── userManagement/
│       │   │   ├── simulation/
│       │   │   ├── support/
│       │   │   ├── analytics/
│       │   │   ├── crm/
│       │   │   ├── lti/
│       │   │   └── s3/
│       │   └── common/          # Shared modules (Redis, filters, etc.)
│       └── Dockerfile           # Single image for all services
│
├── packages/
│   ├── shared/                  # Shared types & utilities
│   └── eslint-config/           # Shared ESLint config
│
├── docker-compose.yml           # Local development
├── docker-compose.staging.yml   # Staging environment
├── helm/                        # Kubernetes Helm charts
└── docs/                        # Documentation
```

## 🔑 Key Features

### Core Platform

- ✅ **Microservices Architecture** - Independent, scalable services
- ✅ **API Gateway Pattern** - Centralized auth & routing
- ✅ **Database per Service** - Isolated data storage
- ✅ **Message-Driven** - RabbitMQ for async communication
- ✅ **Global Redis Cache** - Shared caching layer across all services
- ✅ **JWT Authentication** - Secure access & refresh tokens
- ✅ **Multi-tenancy** - Organization-based isolation
- ✅ **Type Safety** - Full TypeScript coverage

### AI-Powered Simulations

- ✅ **Conversational AI** - GPT-4 & Claude integration
- ✅ **Voice Chat** - Real-time speech-to-text & text-to-speech
- ✅ **Video Sessions** - WebRTC for live simulations
- ✅ **Intelligent Feedback** - AI-generated performance analysis
- ✅ **Persona Management** - Configurable AI characters
- ✅ **Session Recording** - MongoDB-backed chat history

### CRM Integrations

- ✅ **Salesforce Integration** - OAuth 2.0, real-time data access
- ✅ **Automatic Token Refresh** - Seamless authentication management
- ✅ **Contact Management** - Fetch contacts, accounts, opportunities, leads
- ✅ **Custom Queries** - Execute SOQL queries and SOSL searches
- ✅ **Secure Token Storage** - Encrypted OAuth tokens in PostgreSQL
- 🚧 **HubSpot Integration** - Coming soon

### Developer Experience

- ✅ **Single Build** - One Docker image for all services
- ✅ **Hot Reload** - Fast development iteration
- ✅ **Type-Safe APIs** - Prisma + TypeScript
- ✅ **Health Checks** - Built-in service monitoring
- ✅ **API Documentation** - Swagger/OpenAPI
- ✅ **Comprehensive Testing** - Unit, integration, e2e tests

## 🚢 Deployment

### Local Development

```bash
# Use Docker Compose
docker-compose up -d

# Or run services individually
pnpm dev:gateway
pnpm dev:user
pnpm dev:simulation
```

### Production

```bash
# Build single Docker image
docker build -f apps/api/Dockerfile -t pitch-api:latest .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or deploy to Kubernetes
helm install pitch ./helm/pitch -f values.prod.yaml
```

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed deployment instructions.

## 🧪 Development

### Available Commands

```bash
# Development
pnpm dev                        # Start all services
pnpm dev:gateway                # Start gateway only
pnpm dev:user                   # Start user service

# Building
pnpm build                      # Build all apps
pnpm --filter api build         # Build backend only

# Testing
pnpm test                       # Run all tests
pnpm test:unit                  # Unit tests
pnpm test:integration           # Integration tests
pnpm test:e2e                   # End-to-end tests
pnpm test:cov                   # Coverage report

# Database
pnpm db:generate:all            # Generate all Prisma clients
pnpm db:generate:crm            # Generate CRM Prisma client
pnpm db:migrate:all             # Run all migrations
pnpm db:migrate:crm             # Run CRM migrations only
pnpm db:push:all                # Push schema changes (dev only)
pnpm db:studio:user             # Open Prisma Studio (User DB)
pnpm db:studio:crm              # Open Prisma Studio (CRM DB)

# Docker
pnpm docker:up                  # Start containers
pnpm docker:down                # Stop containers
pnpm docker:logs                # View logs
pnpm docker:build               # Build image

# Code Quality
pnpm lint                       # Lint all packages
pnpm lint:fix                   # Fix linting issues
pnpm type-check                 # TypeScript check
pnpm format                     # Format code
```

### Environment Configuration

```bash
# Backend (.env in apps/api)
cp apps/api/.env.example apps/api/.env

# Frontend (.env.local in apps/web)
cp apps/web/.env.example apps/web/.env.local
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for development guidelines.

## 🔐 Security

- JWT secrets must be 32+ characters
- All database passwords should be strong and unique
- Production uses Prisma Accelerate for connection pooling
- SSL/TLS required for production databases
- Environment variables never committed to version control
- Regular security audits recommended

## 📊 Monitoring & Observability

- **Health Checks** - Built into each microservice
- **Redis Health Indicator** - Cache monitoring
- **Prisma Query Logging** - Database performance
- **RabbitMQ Management UI** - Message queue metrics
- **Sentry Integration** - Error tracking (configurable)
- **Grafana/Prometheus** - Metrics (production setup)

## 🤝 Contributing

We welcome contributions! Please see **[CONTRIBUTING.md](CONTRIBUTING.md)** for:

- Development workflow
- Code style guidelines
- Testing requirements
- Pull request process
- Architecture decisions

## 📄 License

ISC

## 🆘 Getting Help

- Check **[DEPLOYMENT.md](DEPLOYMENT.md)** for infrastructure issues
- Check **[CONTRIBUTING.md](CONTRIBUTING.md)** for development questions
- Review service-specific README files in `apps/` directories
- Check Docker logs: `docker-compose logs -f [service]`
- Verify environment variables are set correctly

## 🎯 Roadmap

- [ ] GraphQL API option
- [ ] Websocket support for real-time features
- [ ] Advanced analytics dashboards
- [ ] Multi-language support (i18n)
- [ ] Mobile app (React Native)
- [ ] Enhanced AI features
- [ ] Performance optimizations
- [ ] Extended LMS integrations

---

**Built with ❤️ using modern web technologies**
