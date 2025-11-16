/*
  Warnings:

  - The values [GITHUB,LINKEDIN,DISCORD] on the enum `AuthProvider` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "public"."PlanLevel" AS ENUM ('FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."AuthProvider_new" AS ENUM ('GOOGLE', 'MICROSOFT', 'IBM');
ALTER TABLE "public"."oauth_accounts" ALTER COLUMN "provider" TYPE "public"."AuthProvider_new" USING ("provider"::text::"public"."AuthProvider_new");
ALTER TYPE "public"."AuthProvider" RENAME TO "AuthProvider_old";
ALTER TYPE "public"."AuthProvider_new" RENAME TO "AuthProvider";
DROP TYPE "public"."AuthProvider_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "lastSeen" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableTokens" INTEGER NOT NULL DEFAULT 0,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "billingEmail" TEXT,
    "billingAddress" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TokenHistory" (
    "id" TEXT NOT NULL,
    "availableTokens" INTEGER NOT NULL DEFAULT 0,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "teamId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'MEMBER',
    "tokenLimit" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "invitedbyUserId" TEXT,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planLevel" "public"."PlanLevel" NOT NULL DEFAULT 'FREE',
    "interval" "public"."BillingInterval" NOT NULL DEFAULT 'MONTH',
    "maxTokens" INTEGER NOT NULL DEFAULT 0,
    "limits" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "public"."teams"("slug");

-- CreateIndex
CREATE INDEX "memberships_teamId_idx" ON "public"."memberships"("teamId");

-- CreateIndex
CREATE INDEX "memberships_userId_role_idx" ON "public"."memberships"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_teamId_key" ON "public"."memberships"("userId", "teamId");

-- CreateIndex
CREATE INDEX "subscriptions_teamId_status_idx" ON "public"."subscriptions"("teamId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "public"."subscriptions"("planId");

-- AddForeignKey
ALTER TABLE "public"."TokenHistory" ADD CONSTRAINT "TokenHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
