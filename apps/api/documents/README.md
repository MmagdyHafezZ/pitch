# API Documentation

This directory contains documentation specific to the backend API built with NestJS, Prisma, and tRPC.

## Documentation Files

- **[backend.md](./backend.md)** - Complete backend development guide
- **[api-endpoints.md](./api-endpoints.md)** - REST API endpoint documentation
- **[database.md](./database.md)** - Database schema and migrations guide
- **[authentication.md](./authentication.md)** - Authentication and authorization
- **[testing.md](./testing.md)** - Backend testing strategies
- **[deployment.md](./deployment.md)** - API deployment guide

## Quick Links

- [Main Project README](../../../README.md)
- [Web Documentation](../../web/documents/README.md)
- [Contributing Guide](../../../documents/CONTRIBUTING.md)

## Tech Stack

- **NestJS** - Progressive Node.js framework
- **Prisma** - Next-generation ORM
- **tRPC** - End-to-end typesafe APIs
- **PostgreSQL** - Primary database
- **TypeScript** - Type-safe development
- **Jest** - Testing framework

## API Overview

- **Base URL**: `http://localhost:3001` (development)
- **Authentication**: JWT-based
- **API Format**: REST + tRPC procedures
- **Database**: PostgreSQL with Prisma ORM

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up database
cp .env.example .env
# Edit database URL in .env

# Run migrations
pnpm exec prisma migrate dev

# Start development server
pnpm dev
```