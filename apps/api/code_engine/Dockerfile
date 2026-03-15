FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl \
    && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-backend/package.json packages/shared-backend/package.json

RUN HUSKY=0 pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared-backend ./packages/shared-backend

RUN pnpm --filter @pitch/shared-backend build \
    && pnpm --filter api db:generate:all \
    && pnpm --filter api build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["pnpm", "start:prod"]
