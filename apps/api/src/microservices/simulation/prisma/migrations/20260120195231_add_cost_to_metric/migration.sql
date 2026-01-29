-- AlterTable
ALTER TABLE "public"."Metric" ADD COLUMN     "costUsd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."LlmRoutingConfig" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "orgId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmRoutingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmRoutingConfig_scope_orgId_userId_isActive_idx" ON "public"."LlmRoutingConfig"("scope", "orgId", "userId", "isActive");

-- CreateIndex
CREATE INDEX "LlmRoutingConfig_name_idx" ON "public"."LlmRoutingConfig"("name");
