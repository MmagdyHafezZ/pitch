/*
  Warnings:

  - You are about to drop the column `invitedbyUserId` on the `memberships` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."memberships" DROP COLUMN "invitedbyUserId",
ADD COLUMN     "invitedByUserId" TEXT;
