# =============================================================================
# Dockerfile for Analytics Microservice
# =============================================================================

ARG NODE_IMAGE=node:22-alpine

# -----------------------------------------------------------------------------
# 1. Base (Shared OS setup)
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS alpine
RUN apk update && apk add --no-cache libc6-compat openssl

# -----------------------------------------------------------------------------
# 2. Prune (Isolate analytics dependencies)
# -----------------------------------------------------------------------------
FROM alpine AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=analytics --docker

# -----------------------------------------------------------------------------
# 3. Builder (Full Deps + Build)
# -----------------------------------------------------------------------------
FROM alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store 
    pnpm config set store-dir /pnpm-store 
    && HUSKY=0 pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

RUN pnpm turbo run build --filter=analytics...

# -----------------------------------------------------------------------------
# 4. Prod Deps (Clean Production Dependencies)
# -----------------------------------------------------------------------------
FROM alpine AS prod_deps
WORKDIR /app
RUN corepack enable pnpm

ENV CI=true

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN npm pkg delete scripts.prepare

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store 
    pnpm config set store-dir /pnpm-store 
    && HUSKY=0 pnpm install --prod --frozen-lockfile

# -----------------------------------------------------------------------------
# 5. Runner (Final Production Image)
# -----------------------------------------------------------------------------
FROM alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs 
    && adduser --system --uid 1001 nestjs

COPY --from=prod_deps --chown=nestjs:nodejs /app/node_modules /app/node_modules

COPY --from=builder --chown=nestjs:nodejs /app/apps/analytics/dist /app/apps/analytics/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/analytics/package.json /app/apps/analytics/package.json

COPY --from=builder --chown=nestjs:nodejs /app/packages /app/packages

USER nestjs
WORKDIR /app/apps/analytics

CMD ["node", "dist/main.js"]
