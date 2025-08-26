# PITCH

A modern full-stack application built with Next.js, NestJS, and Turborepo.

## Architecture

This is a monorepo managed with Turborepo containing:

- **apps/web** - Next.js frontend with shadcn/ui components
- **apps/api** - NestJS backend API with Prisma ORM
- **packages/shared** - Shared utilities and types
- **packages/eslint-config** - Shared ESLint configuration

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start development servers:
   ```bash
   pnpm dev
   ```

This will start both the frontend and backend in parallel.

## Tech Stack

### Frontend (apps/web)
- **Next.js 15** with App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** components
- **TanStack Query** for data fetching
- **NextAuth** for authentication

### Backend (apps/api)
- **NestJS**
- **Prisma** ORM
- **tRPC** for type-safe APIs
- **TypeScript**

### Tools
- **Turborepo** for monorepo management
- **pnpm** for package management
- **ESLint** for linting
- **Jest** for testing

## Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build all apps
- `pnpm lint` - Run linting
- `pnpm test` - Run tests

## Documentation

### Core Documentation
- **[Contributing Guide](./documents/CONTRIBUTING.md)** - How to contribute to the project
- **[Commit Conventions](./documents/commit-conventions.md)** - Commit standards and quality checks
- **[Package Management](./documents/pnpm-usage.md)** - pnpm and Turborepo usage guide
- **[Docker Setup](./documents/docker-setup.md)** - Docker and deployment configurations

### Frontend Documentation
- **[Frontend Overview](./apps/web/documents/README.md)** - Web application documentation hub
- **[Development Guide](./apps/web/documents/frontend.md)** - Complete frontend development guide
- **[Component Architecture](./apps/web/documents/components.md)** - Component patterns and usage
- **[Testing Guide](./apps/web/documents/testing.md)** - Frontend testing strategies
- **[Deployment Guide](./apps/web/documents/deployment.md)** - Web app deployment instructions

### Backend Documentation
- **[API Overview](./apps/api/documents/README.md)** - Backend API documentation hub
- **[Development Guide](./apps/api/documents/backend.md)** - Complete backend development guide
- **[API Endpoints](./apps/api/documents/api-endpoints.md)** - REST API and tRPC documentation
- **[Database Guide](./apps/api/documents/database.md)** - Database schema and migrations
- **[Authentication](./apps/api/documents/authentication.md)** - Auth and authorization guide
- **[Testing Guide](./apps/api/documents/testing.md)** - Backend testing strategies
- **[Deployment Guide](./apps/api/documents/deployment.md)** - API deployment instructions

## License

ISC