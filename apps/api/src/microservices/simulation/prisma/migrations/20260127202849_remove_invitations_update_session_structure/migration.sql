/*
  Warnings:

  - You are about to drop the column `sessionId` on the `CallSession` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `DraftEmail` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `EvalArtifact` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `ownerSessionId` on the `MediaAsset` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `MediaAsset` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Metric` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `ReportRequest` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Scorecard` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `ToolCall` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Transcript` table. All the data in the column will be lost.
  - Made the column `sessionMemberId` on table `CallSession` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `DraftEmail` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `EvalArtifact` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `Message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `Metric` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `ReportRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `Scorecard` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sessionMemberId` on table `ToolCall` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."CallSession" DROP CONSTRAINT "CallSession_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CallSession" DROP CONSTRAINT "CallSession_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DraftEmail" DROP CONSTRAINT "DraftEmail_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DraftEmail" DROP CONSTRAINT "DraftEmail_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EvalArtifact" DROP CONSTRAINT "EvalArtifact_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EvalArtifact" DROP CONSTRAINT "EvalArtifact_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MediaAsset" DROP CONSTRAINT "MediaAsset_ownerSessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MediaAsset" DROP CONSTRAINT "MediaAsset_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Metric" DROP CONSTRAINT "Metric_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Metric" DROP CONSTRAINT "Metric_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReportRequest" DROP CONSTRAINT "ReportRequest_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReportRequest" DROP CONSTRAINT "ReportRequest_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Scorecard" DROP CONSTRAINT "Scorecard_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Scorecard" DROP CONSTRAINT "Scorecard_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ToolCall" DROP CONSTRAINT "ToolCall_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ToolCall" DROP CONSTRAINT "ToolCall_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transcript" DROP CONSTRAINT "Transcript_sessionId_fkey";

-- DropIndex
DROP INDEX "public"."DraftEmail_sessionId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."EvalArtifact_sessionId_kind_idx";

-- DropIndex
DROP INDEX "public"."Event_sessionId_type_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Message_sessionId_turnId_idx";

-- DropIndex
DROP INDEX "public"."Metric_sessionId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."ReportRequest_sessionId_format_status_idx";

-- DropIndex
DROP INDEX "public"."Scorecard_sessionId_idx";

-- DropIndex
DROP INDEX "public"."ToolCall_sessionId_turnId_name_idx";

-- DropIndex
DROP INDEX "public"."Transcript_sessionId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Transcript_sessionId_idx";

-- AlterTable
ALTER TABLE "public"."CallSession" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."DraftEmail" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."EvalArtifact" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Event" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."MediaAsset" DROP COLUMN "ownerSessionId",
DROP COLUMN "sessionMemberId",
ADD COLUMN     "ownerSessionMemberId" TEXT;

-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Metric" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."ReportRequest" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Scorecard" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Session" ADD COLUMN     "orgSnapshot" JSONB;

-- AlterTable
ALTER TABLE "public"."ToolCall" DROP COLUMN "sessionId",
ALTER COLUMN "sessionMemberId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Transcript" DROP COLUMN "sessionId";

-- CreateIndex
CREATE INDEX "DraftEmail_sessionMemberId_createdAt_idx" ON "public"."DraftEmail"("sessionMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "EvalArtifact_sessionMemberId_kind_idx" ON "public"."EvalArtifact"("sessionMemberId", "kind");

-- CreateIndex
CREATE INDEX "Event_sessionMemberId_type_createdAt_idx" ON "public"."Event"("sessionMemberId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Message_sessionMemberId_turnId_idx" ON "public"."Message"("sessionMemberId", "turnId");

-- CreateIndex
CREATE INDEX "Metric_sessionMemberId_createdAt_idx" ON "public"."Metric"("sessionMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportRequest_sessionMemberId_format_status_idx" ON "public"."ReportRequest"("sessionMemberId", "format", "status");

-- CreateIndex
CREATE INDEX "Scorecard_sessionMemberId_idx" ON "public"."Scorecard"("sessionMemberId");

-- CreateIndex
CREATE INDEX "ToolCall_sessionMemberId_turnId_name_idx" ON "public"."ToolCall"("sessionMemberId", "turnId", "name");

-- CreateIndex
CREATE INDEX "Transcript_sessionMemberId_idx" ON "public"."Transcript"("sessionMemberId");

-- CreateIndex
CREATE INDEX "Transcript_sessionMemberId_createdAt_idx" ON "public"."Transcript"("sessionMemberId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ToolCall" ADD CONSTRAINT "ToolCall_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Metric" ADD CONSTRAINT "Metric_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DraftEmail" ADD CONSTRAINT "DraftEmail_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallSession" ADD CONSTRAINT "CallSession_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_ownerSessionMemberId_fkey" FOREIGN KEY ("ownerSessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvalArtifact" ADD CONSTRAINT "EvalArtifact_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scorecard" ADD CONSTRAINT "Scorecard_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportRequest" ADD CONSTRAINT "ReportRequest_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
