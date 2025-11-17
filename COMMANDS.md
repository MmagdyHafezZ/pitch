# Available Commands Reference

All commands can be run from the root directory using `pnpm [command]`.

## 🚀 Quick Start

```bash
# Start everything
pnpm dev

# Start only API
pnpm dev:api

# Start only Web
pnpm dev:web

# Start specific microservice
pnpm dev:user
pnpm dev:simulation
```

---

## Development Commands

### Run All Services

```bash
pnpm dev              # Start all services in parallel (API + Web)
```

### API Services

```bash
pnpm dev:api          # Start all API services
pnpm dev:gateway      # API Gateway
pnpm dev:user         # User Management service
pnpm dev:simulation   # Simulation service
pnpm dev:support      # Support service
pnpm dev:analytics    # Analytics service
pnpm dev:lti          # LTI service
pnpm dev:s3           # S3 service
pnpm dev:crm          # CRM service
```

### Web Application

```bash
pnpm dev:web          # Start Next.js frontend
```

---

## Build Commands

### Build All

```bash
pnpm build            # Build all workspaces
```

### Build Specific

```bash
pnpm build:api        # Build API only
pnpm build:web        # Build Web only
```

---

## Start Production

```bash
pnpm start            # Start all services in production mode
pnpm start:api        # Start API in production
pnpm start:api:prod   # Start API with node dist/main
pnpm start:api:debug  # Start API with debug mode
pnpm start:web        # Start Next.js in production
```

---

## Testing Commands

### Run All Tests

```bash
pnpm test             # Run tests for all workspaces
pnpm test:watch       # Run tests in watch mode
pnpm test:ci          # Run tests in CI mode with coverage
```

### API Tests

```bash
pnpm test:api                    # Run API unit tests
pnpm test:api:watch              # API tests in watch mode
pnpm test:cov                    # API tests with coverage
pnpm test:api:integration        # API integration tests
pnpm test:api:integration:watch  # Integration tests in watch mode
pnpm test:api:e2e                # API end-to-end tests
pnpm test:api:e2e:watch          # E2E tests in watch mode
pnpm test:api:debug              # Debug API tests
pnpm test:all                    # Run all API test types
```

### Web Tests

```bash
pnpm test:web          # Run Web unit tests
pnpm test:web:watch    # Web tests in watch mode
pnpm test:coverage     # Web tests with coverage
```

---

## Database Commands

### Generate Prisma Clients

```bash
pnpm db:generate:all            # Generate all Prisma clients
pnpm db:generate:userManagement # User Management client
pnpm db:generate:simulation     # Simulation client
pnpm db:generate:support        # Support client
pnpm db:generate:analytics      # Analytics client
pnpm db:generate:crm            # CRM client
```

### Run Migrations (Development)

```bash
pnpm db:migrate:all            # Run all migrations
pnpm db:migrate:userManagement # User Management migrations
pnpm db:migrate:simulation     # Simulation migrations
pnpm db:migrate:support        # Support migrations
pnpm db:migrate:analytics      # Analytics migrations
pnpm db:migrate:crm            # CRM migrations
```

### Push Schema (Development Only)

```bash
pnpm db:push:all            # Push all schemas
pnpm db:push:userManagement # Push User Management schema
pnpm db:push:simulation     # Push Simulation schema
pnpm db:push:support        # Push Support schema
pnpm db:push:analytics      # Push Analytics schema
pnpm db:push:crm            # Push CRM schema
```

### Prisma Studio

```bash
pnpm db:studio:userManagement  # Open User Management database
pnpm db:studio:simulation      # Open Simulation database
pnpm db:studio:support         # Open Support database
pnpm db:studio:analytics       # Open Analytics database
pnpm db:studio:crm             # Open CRM database
```

### Reset Databases (⚠️ Development Only)

```bash
pnpm db:reset:all            # Reset all databases
pnpm db:reset:userManagement # Reset User Management
pnpm db:reset:simulation     # Reset Simulation
pnpm db:reset:support        # Reset Support
pnpm db:reset:analytics      # Reset Analytics
pnpm db:reset:crm            # Reset CRM
```

### Deploy Migrations (Production)

```bash
pnpm db:deploy:all            # Deploy all migrations
pnpm db:deploy:userManagement # Deploy User Management migrations
pnpm db:deploy:simulation     # Deploy Simulation migrations
pnpm db:deploy:support        # Deploy Support migrations
pnpm db:deploy:analytics      # Deploy Analytics migrations
pnpm db:deploy:crm            # Deploy CRM migrations
```

---

## Code Quality Commands

### Linting

```bash
pnpm lint           # Lint all workspaces
pnpm lint:fix       # Fix linting issues in all workspaces
pnpm lint:api       # Lint API only
pnpm lint:web       # Lint Web only
pnpm lint:api:fix   # Fix API linting issues
pnpm lint:web:fix   # Fix Web linting issues
```

### Type Checking

```bash
pnpm type-check       # Check types in all workspaces
pnpm type-check:api   # Check API types
pnpm type-check:web   # Check Web types
```

### Formatting

```bash
pnpm format              # Format all code
pnpm format:check        # Check formatting without changes
pnpm format:api          # Format API code
pnpm format:web          # Format Web code
pnpm format:api:check    # Check API formatting
pnpm format:web:check    # Check Web formatting
```

---

## Docker Commands

### Build & Run

```bash
pnpm docker:build    # Build Docker image (pitch-api:latest)
pnpm docker:up       # Start all Docker containers
pnpm docker:down     # Stop all containers
pnpm docker:restart  # Restart all containers
pnpm docker:clean    # Stop and remove volumes (⚠️ DATA LOSS)
```

### Monitoring

```bash
pnpm docker:logs     # View logs from all containers
pnpm docker:ps       # List running containers
```

---

## Git & Commit Commands

```bash
pnpm commit          # Interactive commit with commitizen
pnpm pre-commit      # Run pre-commit hooks
```

---

## Documentation & Diagrams

### Architecture Diagrams

```bash
pnpm diagrams:all        # Generate all diagrams
pnpm diagrams:simulation # Generate Simulation diagrams
pnpm diagrams:user       # Generate User diagrams
pnpm diagrams:support    # Generate Support diagrams
pnpm diagrams:convert    # Convert Mermaid diagrams
pnpm compile:architecture # Compile architecture files
```

---

## Utility Commands

```bash
pnpm secrets:allow   # Manage secrets allowlist
```

---

## Common Workflows

### Initial Setup

```bash
pnpm install              # Install dependencies
pnpm db:generate:all      # Generate Prisma clients
pnpm db:migrate:all       # Run migrations
pnpm dev                  # Start development
```

### Add New Feature

```bash
# 1. Create feature branch
git checkout -b feature/SCRUM-123-feature-name

# 2. Develop with hot reload
pnpm dev:api             # or pnpm dev:web

# 3. Run tests
pnpm test:api            # or pnpm test:web

# 4. Check code quality
pnpm lint:fix
pnpm type-check
pnpm format

# 5. Commit changes
pnpm commit
```

### Database Changes

```bash
# 1. Modify Prisma schema
# Edit apps/api/src/microservices/[service]/prisma/schema.prisma

# 2. Generate migration
pnpm db:migrate:userManagement  # (replace with your service)

# 3. Regenerate client
pnpm db:generate:userManagement

# 4. Test changes
pnpm dev:user
```

### Production Deployment

```bash
# 1. Build everything
pnpm build

# 2. Run tests
pnpm test:ci

# 3. Generate Prisma clients
pnpm db:generate:all

# 4. Deploy migrations
pnpm db:deploy:all

# 5. Build Docker image
pnpm docker:build

# 6. Deploy
# (see DEPLOYMENT.md for details)
```

### Before Committing

```bash
# Check everything is good
pnpm lint:fix
pnpm type-check
pnpm format
pnpm test

# Commit with convention
pnpm commit
```

---

## Tips

### Run commands in specific workspace

You can also use `pnpm --filter` directly:

```bash
pnpm --filter api [command]
pnpm --filter web [command]
```

### Parallel execution

Some commands use Turbo for parallel execution:

```bash
pnpm dev           # Runs API and Web in parallel
pnpm test          # Runs tests in parallel
pnpm build         # Builds in parallel
```

### Check available scripts

```bash
# In root
pnpm run

# In specific workspace
cd apps/api && pnpm run
cd apps/web && pnpm run
```

---

## Command Categories Quick Reference

| Category         | Commands                                                    |
| ---------------- | ----------------------------------------------------------- |
| **Development**  | `dev`, `dev:api`, `dev:web`, `dev:*`                        |
| **Building**     | `build`, `build:api`, `build:web`                           |
| **Testing**      | `test`, `test:api`, `test:web`, `test:*`                    |
| **Database**     | `db:generate:*`, `db:migrate:*`, `db:push:*`, `db:studio:*` |
| **Code Quality** | `lint`, `type-check`, `format`                              |
| **Docker**       | `docker:build`, `docker:up`, `docker:down`                  |
| **Production**   | `start`, `db:deploy:*`                                      |

---

For more details, see:

- [README.md](README.md) - Project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
