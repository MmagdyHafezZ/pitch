# =============================================================================
# Single Dockerfile for all PITCH Microservices
# Builds once, runs any service via SERVICE_NAME environment variable
# =============================================================================

ARG SERVICE_NAME=gateway

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable pnpm

# =============================================================================
# Dependencies - Install all project dependencies
# =============================================================================
FROM base AS deps

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY turbo.json ./

COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/

RUN pnpm install --frozen-lockfile

# =============================================================================
# Builder - Generate Prisma clients and build all microservices
# =============================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

RUN pnpm --filter @pitch/shared-backend build

RUN cd apps/api && pnpm run db:generate:all

RUN cd apps/api && pnpm build

# =============================================================================
# Runner - Production image that can run any microservice
# =============================================================================
FROM base AS runner

ENV NODE_ENV=production
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

COPY --from=builder --chown=nestjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/microservices/*/prisma ./apps/api/src/microservices/

COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-backend ./packages/shared-backend

USER nestjs
WORKDIR /app/apps/api

CMD ["sh", "-c", "if [ \"$SERVICE_NAME\" = \"gateway\" ]; then node dist/main.js; else node dist/src/microservices/${SERVICE_NAME}/main.js; fi"]
