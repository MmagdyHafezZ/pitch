# Contributing to PITCH

Thank you for your interest in contributing to PITCH! This guide will help you
get started.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Set up development environment: `./scripts/setup-hooks.sh`
5. Create a new branch for your feature or bug fix

## Development Workflow

### Quality Checks

Our project uses automated quality checks to ensure code consistency and prevent
issues. These run automatically when you commit:

1. **Pre-commit hooks** - Automatically run before each commit:
   - Code formatting with Prettier
   - Linting with ESLint
   - Type checking with TypeScript
   - Tests for changed files
   - Build verification

2. **Commit message validation** - Ensures conventional commit format

### Making Changes

1. Make your changes
2. Test your changes locally: `pnpm test`
3. Stage your files: `git add .`
4. Commit with conventional format: `git commit -m "feat(web): add new feature"`
   - Or use interactive commit: `pnpm commit`
5. Quality checks will run automatically
6. Push your changes and create a pull request

### Manual Quality Checks

You can run quality checks manually at any time:

```bash
pnpm lint          # Run linting
pnpm lint:fix      # Fix linting issues automatically
pnpm type-check    # Run type checking
pnpm test          # Run tests
pnpm build         # Build the project
pnpm format        # Format code with Prettier
```

## Documentation

Before contributing, please familiarize yourself with our project structure and
tools:

- **[Commit Conventions Guide](./commit-conventions.md)** - Learn about our
  commit message format and quality checks
- **[Package Management Guide](./pnpm-usage.md)** - Learn how to manage packages
  with pnpm and Turborepo
- **[Frontend Development Guide](../apps/web/docs/frontend.md)** - Frontend
  setup, shadcn/ui usage, and best practices
- **[Backend Development Guide](../apps/api/docs/backend.md)** - Backend API
  development with NestJS and Prisma

## Code Style

- Follow the existing code style (enforced by Prettier)
- Use TypeScript for all new code
- Write meaningful commit messages following
  [Conventional Commits](https://www.conventionalcommits.org/)
- Add tests for new features
- Update documentation as needed
- All code is automatically formatted and linted before commit

## Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update the README.md if needed
3. Ensure all tests pass
4. Request review from maintainers

## Questions?

If you have questions about contributing, please open an issue or reach out to
the maintainers.

## Development Environment

Make sure you have the following tools installed:

- **Node.js** (latest LTS version)
- **pnpm** (version specified in package.json)
- **Git**

For specific setup instructions for each part of the application, refer to the
documentation links above.

Quick Start Options

Option 1: Start Everything (Recommended for Development)

# From the root directory (/Users/magdyhafez/Personal/PITCH)

pnpm run dev This starts both the API backend and web frontend in parallel.

Option 2: Start Just the Backend API

# From the root directory

pnpm run dev:api This starts only the API server with all microservices.

Option 3: Start Just the Frontend

# From the root directory

pnpm run dev:web This starts only the Next.js web application.

Option 4: Start Individual Apps Manually

Backend API: cd apps/api pnpm run start:dev

Frontend Web: cd apps/web pnpm run dev

🔧 Prerequisites Before Starting

Before you can start the app, make sure you have:

1. Environment Variables

Create .env files from the examples:

# Copy API environment variables

cp apps/api/.env.example apps/api/.env

# Copy Web environment variables (if needed)

cp apps/web/.env.example apps/web/.env

2. Database Setup

Set up your PostgreSQL databases and update the .env file:

# In apps/api/.env

DATABASE_URL="postgresql://username:password@localhost:5432/pitch_db"
AUTH_DATABASE_URL="postgresql://username:password@localhost:5432/pitch_auth_db"
USER_DATABASE_URL="postgresql://username:password@localhost:5432/pitch_users_db"
BUSINESS_DATABASE_URL="postgresql://username:password@localhost:5432/pitch_business_db"

3. RabbitMQ Setup

Make sure RabbitMQ is running:

# If using Docker

docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Or install locally and start

brew install rabbitmq brew services start rabbitmq

4. Generate Prisma Client for Auth

cd apps/api/src/microservices/auth npx prisma generate
--schema=./prisma/schema.prisma npx prisma db push
--schema=./prisma/schema.prisma

🎯 Recommended Development Workflow

1. Start everything: pnpm run dev
2. Access your applications:
   - API: http://localhost:8001
   - API Docs (Swagger): http://localhost:8001/docs
   - Frontend: http://localhost:3000

3. Test the authentication flow:
   - Go to http://localhost:3000
   - Should redirect to login
   - Register a new user
   - Test protected routes

🚨 Common Issues & Solutions

If you get database errors:

# Create the databases first

createdb pitch_auth_db createdb pitch_users_db createdb pitch_business_db

If you get RabbitMQ connection errors:

# Check RabbitMQ is running

brew services list | grep rabbitmq

# Or check Docker container

docker ps | grep rabbitmq

If you get port conflicts:

- API runs on port 8001
- Frontend runs on port 3000
- Make sure these ports are available

The quickest way to get started is simply:

cd /Users/magdyhafez/Personal/PITCH pnpm run dev
