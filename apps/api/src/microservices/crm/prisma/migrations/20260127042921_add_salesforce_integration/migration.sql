-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('SALESFORCE', 'HUBSPOT');

-- CreateEnum
CREATE TYPE "public"."IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "status" "public"."IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "instanceUrl" TEXT,
    "providerId" TEXT,
    "providerEmail" TEXT,
    "providerData" JSONB,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "syncInterval" INTEGER DEFAULT 3600,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integrations_userId_idx" ON "public"."integrations"("userId");

-- CreateIndex
CREATE INDEX "integrations_provider_idx" ON "public"."integrations"("provider");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "public"."integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_userId_provider_key" ON "public"."integrations"("userId", "provider");
