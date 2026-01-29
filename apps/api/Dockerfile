# =============================================================================
# Single Dockerfile for PITCH (apps/api) + its microservices
# Builds once, runs any service via SERVICE_NAME env var
# Optimized for: correct pnpm filters, caching, smaller runtime, deterministic builds
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

# Workspace + root manifests
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy ONLY package manifests to maximize layer cache reuse
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/

# Cache pnpm store across builds (works great in GitHub Actions with BuildKit)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder (build API + generate prisma)
# -----------------------------------------------------------------------------
FROM base AS builder

# Bring node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /pnpm /pnpm

# Copy full repo
COPY . .

# Build shared packages first (adjust if your shared-backend build script differs)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm --filter @pitch/shared-backend... build

# Generate prisma (filter by PATH so it always matches)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm --filter ./apps/api... db:generate:all

# Build API (Nest should output to apps/api/dist by default; if not, fix build config or adjust runner COPY)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm --filter ./apps/api... build

# Optional: prune dev deps to reduce runtime size (keeps prod deps only)
# This works best if your repo scripts don’t require dev deps at runtime.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm prune --prod

# -----------------------------------------------------------------------------
# Runner (small(er) production image)
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

RUN apk add --no-cache libc6-compat openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Copy only what runtime needs
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

# Prisma engines / clients (needed at runtime if Prisma used)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# If your runtime needs schema/migrations/prisma folders for each microservice, copy the whole microservices tree.
# This preserves folder structure (unlike copying */prisma into a flattened dir).
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/microservices ./apps/api/src/microservices

# Shared backend package runtime code (if imported at runtime)
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-backend ./packages/shared-backend

USER nestjs
WORKDIR /app/apps/api

# Runs gateway by default (dist/main.js). For other services: dist/src/microservices/<SERVICE_NAME>/main.js
CMD ["sh", "-c", "if [ \"$SERVICE_NAME\" = \"gateway\" ]; then node dist/main.js; else node dist/src/microservices/${SERVICE_NAME}/main.js; fi"]
