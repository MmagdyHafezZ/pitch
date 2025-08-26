# Contributing to PITCH

Thank you for your interest in contributing to PITCH! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Set up development environment: `./scripts/setup-hooks.sh`
5. Create a new branch for your feature or bug fix

## Development Workflow

### Quality Checks
Our project uses automated quality checks to ensure code consistency and prevent issues. These run automatically when you commit:

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

Before contributing, please familiarize yourself with our project structure and tools:

- **[Commit Conventions Guide](./commit-conventions.md)** - Learn about our commit message format and quality checks
- **[Package Management Guide](./pnpm-usage.md)** - Learn how to manage packages with pnpm and Turborepo
- **[Frontend Development Guide](../apps/web/documents/frontend.md)** - Frontend setup, shadcn/ui usage, and best practices
- **[Backend Development Guide](../apps/api/documents/backend.md)** - Backend API development with NestJS and Prisma

## Code Style

- Follow the existing code style (enforced by Prettier)
- Use TypeScript for all new code
- Write meaningful commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
- Add tests for new features
- Update documentation as needed
- All code is automatically formatted and linted before commit

## Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update the README.md if needed
3. Ensure all tests pass
4. Request review from maintainers

## Questions?

If you have questions about contributing, please open an issue or reach out to the maintainers.

## Development Environment

Make sure you have the following tools installed:

- **Node.js** (latest LTS version)
- **pnpm** (version specified in package.json)
- **Git**

For specific setup instructions for each part of the application, refer to the documentation links above.