# PITCH Documentation Hub

Welcome to the comprehensive documentation for the PITCH project. This documentation is organized by domain and complexity to help you find what you need quickly.

## 📖 Documentation Structure

```
documents/
├── README.md                    # This file - documentation hub
├── CONTRIBUTING.md              # How to contribute to the project
├── pnpm-usage.md               # Package management with pnpm and Turborepo
└── docker-setup.md             # Docker deployment configurations

apps/web/documents/
├── README.md                    # Frontend documentation hub
├── frontend.md                 # Complete frontend development guide
├── components.md               # Component architecture and patterns
├── testing.md                  # Frontend testing strategies
└── deployment.md               # Web app deployment guide

apps/api/documents/
├── README.md                    # Backend documentation hub
├── backend.md                  # Complete backend development guide
├── api-endpoints.md            # REST API and tRPC documentation
├── database.md                 # Database schema and migrations
├── authentication.md           # Authentication and authorization
├── testing.md                  # Backend testing strategies
└── deployment.md               # API deployment guide
```

## 🚀 Getting Started

### New to the Project?
1. **[Contributing Guide](./CONTRIBUTING.md)** - Start here for project setup and contribution guidelines
2. **[Package Management](./pnpm-usage.md)** - Learn about our monorepo setup with pnpm and Turborepo
3. **[Docker Setup](./docker-setup.md)** - Get the full stack running with Docker

### Frontend Development
1. **[Frontend Overview](../apps/web/documents/README.md)** - Introduction to the frontend stack
2. **[Development Guide](../apps/web/documents/frontend.md)** - Comprehensive frontend development guide
3. **[Component Architecture](../apps/web/documents/components.md)** - How we structure and build components
4. **[Frontend Testing](../apps/web/documents/testing.md)** - Testing strategies and best practices

### Backend Development
1. **[API Overview](../apps/api/documents/README.md)** - Introduction to the backend stack
2. **[Development Guide](../apps/api/documents/backend.md)** - Comprehensive backend development guide
3. **[API Documentation](../apps/api/documents/api-endpoints.md)** - REST endpoints and tRPC procedures
4. **[Database Guide](../apps/api/documents/database.md)** - Schema design and migration strategies
5. **[Authentication](../apps/api/documents/authentication.md)** - Security and auth implementation
6. **[Backend Testing](../apps/api/documents/testing.md)** - Testing strategies for APIs and services

### DevOps & Deployment
1. **[Docker Setup](./docker-setup.md)** - Local and production Docker configurations
2. **[Frontend Deployment](../apps/web/documents/deployment.md)** - Deploy the web application
3. **[Backend Deployment](../apps/api/documents/deployment.md)** - Deploy the API server

## 🏗️ Architecture Overview

### Tech Stack Summary

**Frontend (Next.js)**
- React 19 with Next.js 15 App Router
- TypeScript for type safety
- Tailwind CSS + shadcn/ui for styling
- TanStack Query for data fetching
- NextAuth for authentication

**Backend (NestJS)**
- Node.js with NestJS framework
- Prisma ORM with PostgreSQL
- tRPC for type-safe APIs
- JWT-based authentication
- Redis for caching

**DevOps**
- Turborepo for monorepo management
- pnpm for efficient package management
- Docker for containerization
- Comprehensive testing with Jest
- CI/CD ready configurations

### Project Structure
```
PITCH/
├── apps/
│   ├── web/           # Next.js frontend application
│   └── api/           # NestJS backend API
├── packages/
│   ├── shared/        # Shared utilities and types
│   └── eslint-config/ # Shared ESLint configuration
├── documents/         # Core project documentation
└── docker/           # Docker configurations and scripts
```

## 🔍 Quick Reference

### Common Tasks
- **Start development**: `pnpm dev`
- **Run tests**: `pnpm test`
- **Build for production**: `pnpm build`
- **Run with Docker**: `docker-compose -f docker-compose.local.yml up`

### Key Concepts
- **Monorepo**: All code in one repository with shared tooling
- **Type Safety**: End-to-end TypeScript with tRPC
- **Component System**: Reusable UI components with shadcn/ui
- **Database-First**: Schema-driven development with Prisma
- **Testing**: Comprehensive unit, integration, and E2E testing

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for:
- Development setup instructions
- Code style and conventions
- Pull request process
- Issue reporting guidelines

## 📞 Support

- **Documentation Issues**: Open an issue if you find gaps in documentation
- **Technical Questions**: Check existing issues or create a new one
- **Feature Requests**: Use the issue tracker with the enhancement label

## 🔗 External Resources

### Framework Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Turborepo Documentation](https://turbo.build/repo/docs)

### Learning Resources
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

*This documentation is maintained by the PITCH development team. Last updated: 2024*