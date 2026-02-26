/*
  Warnings:

  - You are about to drop the column `maxTokens` on the `plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."plans" DROP COLUMN "maxTokens",
ADD COLUMN     "maxCoins" INTEGER NOT NULL DEFAULT 0;
