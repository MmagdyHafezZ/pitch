# CI/CD Workflows Documentation

This document describes the GitHub Actions workflows configured for the PITCH
project.

## Overview

The project uses two main workflows for continuous integration and deployment:

1. **Quality Check** (`quality-check.yml`) - Fast feedback for PRs and commits
2. **Build All Services** (`build-all-services.yml`) - Comprehensive security,
   testing, and deployment

## Workflow Details

### 1. Quality Check Workflow

**Triggers:**

- Push to `main`, `develop`, `init-version-1` branches
- Pull requests to `main`, `develop`, `init-version-1` branches

**Purpose:** Provides fast feedback for code quality and basic security checks.

**Jobs:**

- **Code Quality Check** - Formatting, linting, type checking, testing, building
- **Security Audit** - Dependency vulnerabilities and secrets detection

**Key Features:**

- Uses pnpm for faster dependency installation
- Generates Prisma clients for microservices
- Runs detect-secrets scan for security
- Non-blocking security audits (informational)
- Commit message validation

### 2. Build All Services Workflow

**Triggers:**

- Push to any branch with service/config changes
- Pull requests to `main`, `init-version-1` branches
- Daily scheduled runs at 5 AM UTC
- Manual workflow dispatch
- Repository dispatch events

**Purpose:** Comprehensive security scanning, testing, and Docker image
building.

**Jobs:**

#### Security Scan (Matrix: api, web)

- Filesystem vulnerability scanning with Trivy
- Dependency security audit with pnpm
- Secrets detection with detect-secrets
- SARIF report uploads to GitHub Security tab
- Comprehensive security artifacts

#### Lint & Test (Matrix: api, web)

- Code linting and formatting validation
- TypeScript type checking
- Test execution with coverage
- Database client generation for API

#### Build & Deploy (Matrix: api, web)

- Docker image building with multi-stage optimization
- Container vulnerability scanning
- Push to GitHub Container Registry (ghcr.io)
- Image signing and attestation
- Build provenance generation

## Service Configuration

### Services

- **api** - NestJS microservices backend
- **web** - Next.js frontend application

### Image Naming

Images are pushed to `ghcr.io/[REPO]/pitch-[service]:[tag]`

**Tag Strategy:**

- Tags: `v1.0.0` → `v1.0.0`
- Branches: `main` → `main-[short-sha]`
- PRs: `sha-[short-sha]`
- Custom suffix support via workflow dispatch

## Change Detection

Both workflows include intelligent change detection to skip unnecessary builds:

**Monitored Paths:**

- `apps/api/**` - API service changes
- `apps/web/**` - Web service changes
- `package.json` - Root dependencies
- `pnpm-lock.yaml` - Lock file changes
- `turbo.json` - Build configuration
- `.github/workflows/` - Workflow changes

**Always Run:**

- Scheduled runs (daily at 5 AM)
- Manual workflow dispatch
- Tagged releases

## Security Features

### Vulnerability Scanning

- **Filesystem Scanning**: Trivy scans source code for vulnerabilities
- **Container Scanning**: Trivy scans final Docker images
- **Dependency Auditing**: pnpm audit checks for known vulnerable packages
- **Secrets Detection**: detect-secrets prevents credential commits

### Security Reporting

- SARIF reports uploaded to GitHub Security tab
- Security artifacts stored for 30 days
- Detailed vulnerability summaries in workflow output
- All severities reported (UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL)

### Supply Chain Security

- Docker image signing with GitHub attestations
- Build provenance generation
- Dependency pinning with lock files
- Multi-stage Docker builds for minimal attack surface

## Environment Requirements

### Required Secrets

- `GITHUB_TOKEN` - Automatic GitHub token (no setup needed)

### Optional Secrets

- Custom registry tokens (if using other registries)
- External service tokens (for notifications, etc.)

## Performance Optimizations

### Caching Strategy

- **pnpm Cache**: Node.js dependencies cached per lockfile
- **Docker Layer Cache**: Build cache stored in GitHub Actions cache
- **Turbo Cache**: Monorepo task caching for faster builds

### Parallel Execution

- Matrix builds run services in parallel
- Security scanning runs concurrently with build jobs
- Build stages optimized for concurrent execution

### Resource Management

- Workflow timeouts prevent hanging jobs
- Memory limits prevent OOM issues
- Concurrency groups prevent duplicate runs

## Monitoring and Debugging

### Workflow Artifacts

- Security scan reports (SARIF + JSON)
- Test coverage reports
- Build artifacts and logs
- Container scan results

### Security Dashboard

- View security alerts in GitHub Security tab
- SARIF integration for vulnerability tracking
- Historical security trends

### Debugging Tips

1. **Check Change Detection**: Review diff to see if changes trigger builds
2. **Review Security Scans**: Check artifacts for detailed vulnerability info
3. **Monitor Resource Usage**: Watch for timeout or memory issues
4. **Validate Dependencies**: Ensure pnpm-lock.yaml is up to date

## Best Practices

### Development Workflow

1. Create feature branches from `main` or `develop`
2. Push commits trigger quality checks
3. Create PRs to trigger full build workflow
4. Address security findings before merging
5. Use conventional commit messages

### Security Practices

1. Review security scan results regularly
2. Address HIGH and CRITICAL vulnerabilities promptly
3. Keep dependencies updated
4. Never commit secrets (detect-secrets will catch them)
5. Use environment variables for configuration

### Performance Tips

1. Keep Docker images minimal
2. Use .dockerignore to exclude unnecessary files
3. Leverage build caches effectively
4. Group related changes in single commits

## Customization

### Adding New Services

1. Add service name to matrix in both workflows
2. Ensure service has Dockerfile in `apps/[service]/`
3. Update turbo.json with service-specific tasks
4. Add service-specific build steps if needed

### Custom Security Scans

1. Add additional Trivy scans with different configurations
2. Integrate SAST tools like CodeQL
3. Add custom security validation scripts
4. Configure notification webhooks

### Integration Extensions

1. Add deployment to staging/production environments
2. Integrate with monitoring and observability tools
3. Add performance testing stages
4. Configure notification systems

## Troubleshooting

### Common Issues

1. **pnpm install fails**: Check pnpm-lock.yaml is committed
2. **Docker build fails**: Verify Dockerfile syntax and dependencies
3. **Security scans timeout**: Increase timeout or split scans
4. **Tests fail**: Ensure test databases/dependencies are available

### Emergency Procedures

1. **Disable workflows temporarily**: Use workflow file renaming
2. **Skip security checks**: Use workflow dispatch with custom inputs
3. **Force rebuild**: Push empty commit or use manual trigger
4. **Rollback deployment**: Use previous image tags

## Future Enhancements

### Planned Features

- [ ] Multi-environment deployments (staging, production)
- [ ] Performance testing integration
- [ ] Advanced security scanning (SAST/DAST)
- [ ] Automated dependency updates
- [ ] Integration with external security tools

### Monitoring Improvements

- [ ] Workflow execution metrics
- [ ] Security trend analysis
- [ ] Build performance tracking
- [ ] Cost optimization reporting
