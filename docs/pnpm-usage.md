# Package Management with pnpm and Turborepo

This guide covers how to manage packages in the PITCH monorepo using pnpm and
Turborepo.

## Overview

The project uses:

- **pnpm** as the package manager for fast, efficient installations
- **Turborepo** for build system orchestration and caching
- **Workspaces** to manage multiple packages in a single repository

## Project Structure

```
PITCH/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   ├── shared/       # Shared utilities and types
│   └── eslint-config/# Shared ESLint configuration
├── package.json      # Root workspace configuration
├── pnpm-workspace.yaml
└── turbo.json       # Turborepo configuration
```

## Common Commands

### Installation

```bash
# Install all dependencies
pnpm install

# Install in specific workspace
pnpm --filter web add package-name
pnpm --filter api add package-name

# Install dev dependencies
pnpm --filter web add -D package-name
```

### Development

```bash
# Start all apps in development mode
pnpm dev

# Start specific app
pnpm --filter web dev
pnpm --filter api dev

# Build all apps
pnpm build

# Build specific app
pnpm --filter web build
```

### Package Management

```bash
# Add dependency to specific workspace
pnpm --filter web add react-query
pnpm --filter api add @nestjs/jwt

# Add dependency to root (affects all workspaces)
pnpm add -w eslint

# Remove dependency
pnpm --filter web remove package-name

# Update dependencies
pnpm update
pnpm --filter web update package-name
```

### Workspace Commands

```bash
# Run command in all workspaces
pnpm -r exec npm run test

# Run command in specific workspace
pnpm --filter web exec npm run test

# List all workspaces
pnpm list -r
```

## Turborepo Integration

### Task Pipeline

Tasks are defined in `turbo.json`:

- `dev` - Development servers (runs in parallel)
- `build` - Production builds (respects dependencies)
- `lint` - Code linting
- `test` - Test suites

### Caching

Turborepo automatically caches:

- Build outputs
- Test results
- Lint results

Cache is invalidated when source files or dependencies change.

### Task Dependencies

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    }
  }
}
```

## Shared Packages

### packages/shared

Contains utilities and types shared between frontend and backend:

```bash
# Add to shared package
pnpm --filter shared add lodash

# Use in web app
pnpm --filter web add shared@*

# Use in api
pnpm --filter api add shared@*
```

### packages/eslint-config

Shared ESLint configuration:

```bash
# Update ESLint config
pnpm --filter eslint-config add eslint-plugin-react
```

## Best Practices

### Dependencies

- Add shared dependencies to `packages/shared`
- Keep app-specific dependencies in their respective `apps/` folders
- Use exact versions for critical dependencies
- Regularly audit and update dependencies

### Workspace Management

- Use descriptive workspace names
- Keep workspace dependencies minimal
- Document any cross-workspace dependencies

### Performance

- Leverage Turborepo caching for faster builds
- Use `--filter` to target specific workspaces
- Run tasks in parallel when possible with `--parallel`

## Troubleshooting

### Common Issues

**Cache Issues:**

```bash
# Clear Turborepo cache
turbo clean

# Clear pnpm cache
pnpm store prune
```

**Dependency Conflicts:**

```bash
# Remove all node_modules and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

**Workspace Not Found:**

```bash
# Verify workspace configuration
cat pnpm-workspace.yaml
pnpm list -r
```

## Configuration Files

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### package.json (root)

```json
{
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "pnpm@10.12.4"
}
```

### turbo.json

Defines the task pipeline and caching strategy for the monorepo.
