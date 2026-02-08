/*
  Warnings:

  - You are about to drop the column `autoSync` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncAt` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncError` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncStatus` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `syncInterval` on the `integrations` table. All the data in the column will be lost.
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

-- AlterTable
ALTER TABLE "public"."integrations" DROP COLUMN "autoSync",
DROP COLUMN "lastSyncAt",
DROP COLUMN "lastSyncError",
DROP COLUMN "lastSyncStatus",
DROP COLUMN "syncInterval";

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
