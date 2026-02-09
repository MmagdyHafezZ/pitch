/*
  Warnings:

  - You are about to drop the column `interval` on the `plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."plans" DROP COLUMN "interval";

-- AlterTable
ALTER TABLE "public"."subscriptions" ADD COLUMN     "interval" "public"."BillingInterval" NOT NULL DEFAULT 'MONTH';
