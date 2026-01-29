/*
  Warnings:

  - You are about to drop the column `mode` on the `Session` table. All the data in the column will be lost.
  - Added the required column `type` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SessionType" AS ENUM ('text', 'voice', 'video');

-- AlterTable
ALTER TABLE "public"."Session" DROP COLUMN "mode",
ADD COLUMN     "sessionConfig" JSONB,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "type" "public"."SessionType" NOT NULL;

-- DropEnum
DROP TYPE "public"."SessionMode";
