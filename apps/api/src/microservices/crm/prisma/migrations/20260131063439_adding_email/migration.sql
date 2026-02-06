/*
  Warnings:

  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contact_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `email_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opportunities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sales_goals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tags` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('SALESFORCE', 'HUBSPOT');

-- CreateEnum
CREATE TYPE "public"."IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "public"."accounts" DROP CONSTRAINT "accounts_parentAccountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."activities" DROP CONSTRAINT "activities_accountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."activities" DROP CONSTRAINT "activities_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."activities" DROP CONSTRAINT "activities_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."contact_tags" DROP CONSTRAINT "contact_tags_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."contact_tags" DROP CONSTRAINT "contact_tags_tagId_fkey";

-- DropForeignKey
ALTER TABLE "public"."contacts" DROP CONSTRAINT "contacts_accountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notes" DROP CONSTRAINT "notes_accountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notes" DROP CONSTRAINT "notes_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notes" DROP CONSTRAINT "notes_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."opportunities" DROP CONSTRAINT "opportunities_accountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."opportunities" DROP CONSTRAINT "opportunities_contactId_fkey";

-- DropTable
DROP TABLE "public"."accounts";

-- DropTable
DROP TABLE "public"."activities";

-- DropTable
DROP TABLE "public"."contact_tags";

-- DropTable
DROP TABLE "public"."contacts";

-- DropTable
DROP TABLE "public"."email_templates";

-- DropTable
DROP TABLE "public"."notes";

-- DropTable
DROP TABLE "public"."opportunities";

-- DropTable
DROP TABLE "public"."sales_goals";

-- DropTable
DROP TABLE "public"."tags";

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
