/*
  Warnings:

  - You are about to drop the column `orgSnapshot` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `userSnapshot` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Turn` table. All the data in the column will be lost.
  - You are about to drop the `SessionInvitation` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sessionMemberId` to the `Turn` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SessionMemberRole" AS ENUM ('owner', 'editor', 'viewer');

-- DropForeignKey
ALTER TABLE "public"."SessionInvitation" DROP CONSTRAINT "SessionInvitation_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Turn" DROP CONSTRAINT "Turn_sessionId_fkey";

-- DropIndex
DROP INDEX "public"."Session_orgId_userId_idx";

-- DropIndex
DROP INDEX "public"."Turn_sessionId_order_idx";

-- AlterTable
ALTER TABLE "public"."CallSession" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."DraftEmail" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."EvalArtifact" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Event" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."MediaAsset" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Metric" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."ReportRequest" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Scorecard" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Session" DROP COLUMN "orgSnapshot",
DROP COLUMN "userId",
DROP COLUMN "userSnapshot";

-- AlterTable
ALTER TABLE "public"."ToolCall" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Transcript" ADD COLUMN     "sessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Turn" DROP COLUMN "sessionId",
ADD COLUMN     "sessionMemberId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."SessionInvitation";

-- DropEnum
DROP TYPE "public"."InvitationStatus";

-- CreateTable
CREATE TABLE "public"."SessionMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."SessionMemberRole" NOT NULL DEFAULT 'viewer',
    "userSnapshot" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionMember_userId_idx" ON "public"."SessionMember"("userId");

-- CreateIndex
CREATE INDEX "SessionMember_sessionId_role_idx" ON "public"."SessionMember"("sessionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMember_sessionId_userId_key" ON "public"."SessionMember"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "Session_orgId_idx" ON "public"."Session"("orgId");

-- CreateIndex
CREATE INDEX "Turn_sessionMemberId_order_idx" ON "public"."Turn"("sessionMemberId", "order");

-- AddForeignKey
ALTER TABLE "public"."SessionMember" ADD CONSTRAINT "SessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Turn" ADD CONSTRAINT "Turn_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ToolCall" ADD CONSTRAINT "ToolCall_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Metric" ADD CONSTRAINT "Metric_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DraftEmail" ADD CONSTRAINT "DraftEmail_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallSession" ADD CONSTRAINT "CallSession_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transcript" ADD CONSTRAINT "Transcript_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvalArtifact" ADD CONSTRAINT "EvalArtifact_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scorecard" ADD CONSTRAINT "Scorecard_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportRequest" ADD CONSTRAINT "ReportRequest_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
