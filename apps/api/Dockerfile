# =============================================================================
# Single Dockerfile for PITCH (apps/api) + its microservices
# Builds once, runs any service via SERVICE_NAME env var
# =============================================================================

ARG NODE_IMAGE=node:22-alpine
ARG SERVICE_NAME=gateway

# -----------------------------------------------------------------------------
# Base
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl \
  && corepack enable pnpm

# -----------------------------------------------------------------------------
# Deps (cache-friendly install)
# -----------------------------------------------------------------------------
FROM base AS deps

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY turbo.json ./

COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
 && pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder
# -----------------------------------------------------------------------------
FROM base AS builder
ENV CI=true

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
 && pnpm --filter @pitch/shared-backend... build

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
 && pnpm --filter ./apps/api... db:generate:all

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
 && pnpm --filter ./apps/api... build

# Optional: reduce runtime size (remove if you need dev deps at runtime)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
 && pnpm prune --prod

# -----------------------------------------------------------------------------
# Runner
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

RUN apk add --no-cache libc6-compat openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

COPY --from=builder --chown=nestjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/microservices ./apps/api/src/microservices
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-backend ./packages/shared-backend

USER nestjs
WORKDIR /app/apps/api

CMD ["sh", "-c", "if [ \"$SERVICE_NAME\" = \"gateway\" ]; then node dist/main.js; else node dist/src/microservices/${SERVICE_NAME}/main.js; fi"]
