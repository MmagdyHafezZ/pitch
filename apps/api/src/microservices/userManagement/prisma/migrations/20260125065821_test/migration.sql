/*
  Warnings:

  - You are about to drop the column `limits` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `subscriptions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."subscriptions_teamId_status_idx";

-- AlterTable
ALTER TABLE "public"."plans" DROP COLUMN "limits";

-- AlterTable
ALTER TABLE "public"."subscriptions" DROP COLUMN "status",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "limits" INTEGER;

-- DropEnum
DROP TYPE "public"."SubscriptionStatus";

-- CreateIndex
CREATE INDEX "subscriptions_teamId_isActive_idx" ON "public"."subscriptions"("teamId", "isActive");
