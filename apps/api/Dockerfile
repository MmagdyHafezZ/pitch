# =============================================================================
# Single Dockerfile for all PITCH Microservices
# Builds once, runs any service via SERVICE_NAME environment variable
# =============================================================================

# Base image
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable pnpm

# =============================================================================
# Dependencies - Install all project dependencies
# =============================================================================
FROM base AS deps

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all package.json files
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# =============================================================================
# Builder - Generate Prisma clients and build all microservices
# =============================================================================
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy all source code
COPY . .

# Generate all Prisma clients
RUN cd apps/api && pnpm run db:generate:all

# Build all microservices (single build command)
RUN cd apps/api && pnpm build

# =============================================================================
# Runner - Production image that can run any microservice
# =============================================================================
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy workspace files
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy API package
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/

# Copy ALL built microservices (single dist folder)
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

# Copy Prisma client generated files
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schemas (needed for migrations)
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/microservices/*/prisma ./apps/api/src/microservices/

USER nestjs
WORKDIR /app/apps/api

# Default to gateway if SERVICE_NAME not specified
ENV SERVICE_NAME=gateway

# Smart CMD that runs the appropriate entry point based on SERVICE_NAME
# - gateway: dist/main.js
# - user|simulation|support|analytics|lti|s3: dist/src/microservices/${SERVICE_NAME}/main.js
CMD ["sh", "-c", "if [ \"$SERVICE_NAME\" = \"gateway\" ]; then node dist/main.js; else node dist/src/microservices/${SERVICE_NAME}/main.js; fi"]