/*
  Warnings:

  - You are about to drop the column `sessionMemberId` on the `AssessmentRun` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `CallSession` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `DraftEmail` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `EvalArtifact` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `ownerSessionMemberId` on the `MediaAsset` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `Metric` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `ReportRequest` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `Scorecard` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `ToolCall` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `Transcript` table. All the data in the column will be lost.
  - You are about to drop the column `sessionMemberId` on the `Turn` table. All the data in the column will be lost.
  - Added the required column `iterationId` to the `AssessmentRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `CallSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `DraftEmail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `EvalArtifact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `Metric` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `ReportRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `Scorecard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `ToolCall` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iterationId` to the `Turn` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."AssessmentRun" DROP CONSTRAINT "AssessmentRun_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CallSession" DROP CONSTRAINT "CallSession_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DraftEmail" DROP CONSTRAINT "DraftEmail_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."EvalArtifact" DROP CONSTRAINT "EvalArtifact_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MediaAsset" DROP CONSTRAINT "MediaAsset_ownerSessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Metric" DROP CONSTRAINT "Metric_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReportRequest" DROP CONSTRAINT "ReportRequest_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Scorecard" DROP CONSTRAINT "Scorecard_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ToolCall" DROP CONSTRAINT "ToolCall_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transcript" DROP CONSTRAINT "Transcript_sessionMemberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Turn" DROP CONSTRAINT "Turn_sessionMemberId_fkey";

-- DropIndex
DROP INDEX "public"."AssessmentRun_sessionMemberId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."AssessmentRun_sessionMemberId_status_idx";

-- DropIndex
DROP INDEX "public"."DraftEmail_sessionMemberId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."EvalArtifact_sessionMemberId_kind_idx";

-- DropIndex
DROP INDEX "public"."Event_sessionMemberId_type_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Message_sessionMemberId_turnId_idx";

-- DropIndex
DROP INDEX "public"."Metric_sessionMemberId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."ReportRequest_sessionMemberId_format_status_idx";

-- DropIndex
DROP INDEX "public"."Scorecard_sessionMemberId_idx";

-- DropIndex
DROP INDEX "public"."ToolCall_sessionMemberId_turnId_name_idx";

-- DropIndex
DROP INDEX "public"."Transcript_sessionMemberId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Transcript_sessionMemberId_idx";

-- DropIndex
DROP INDEX "public"."Turn_sessionMemberId_order_idx";

-- AlterTable
ALTER TABLE "public"."AssessmentRun" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."CallSession" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."DraftEmail" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."EvalArtifact" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Event" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."MediaAsset" DROP COLUMN "ownerSessionMemberId",
ADD COLUMN     "ownerIterationId" TEXT;

-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Metric" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."ReportRequest" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Scorecard" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."ToolCall" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Transcript" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT;

-- AlterTable
ALTER TABLE "public"."Turn" DROP COLUMN "sessionMemberId",
ADD COLUMN     "iterationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."Iteration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionMemberId" TEXT NOT NULL,
    "iterationNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "endedReason" TEXT,
    "userSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Iteration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Iteration_sessionId_sessionMemberId_idx" ON "public"."Iteration"("sessionId", "sessionMemberId");

-- CreateIndex
CREATE INDEX "Iteration_status_idx" ON "public"."Iteration"("status");

-- CreateIndex
CREATE INDEX "Iteration_sessionMemberId_startedAt_idx" ON "public"."Iteration"("sessionMemberId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Iteration_sessionMemberId_iterationNumber_key" ON "public"."Iteration"("sessionMemberId", "iterationNumber");

-- CreateIndex
CREATE INDEX "AssessmentRun_iterationId_status_idx" ON "public"."AssessmentRun"("iterationId", "status");

-- CreateIndex
CREATE INDEX "AssessmentRun_iterationId_createdAt_idx" ON "public"."AssessmentRun"("iterationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DraftEmail_iterationId_createdAt_idx" ON "public"."DraftEmail"("iterationId", "createdAt");

-- CreateIndex
CREATE INDEX "EvalArtifact_iterationId_kind_idx" ON "public"."EvalArtifact"("iterationId", "kind");

-- CreateIndex
CREATE INDEX "Event_iterationId_type_createdAt_idx" ON "public"."Event"("iterationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Message_iterationId_turnId_idx" ON "public"."Message"("iterationId", "turnId");

-- CreateIndex
CREATE INDEX "Metric_iterationId_createdAt_idx" ON "public"."Metric"("iterationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportRequest_iterationId_format_status_idx" ON "public"."ReportRequest"("iterationId", "format", "status");

-- CreateIndex
CREATE INDEX "Scorecard_iterationId_idx" ON "public"."Scorecard"("iterationId");

-- CreateIndex
CREATE INDEX "ToolCall_iterationId_turnId_name_idx" ON "public"."ToolCall"("iterationId", "turnId", "name");

-- CreateIndex
CREATE INDEX "Transcript_iterationId_idx" ON "public"."Transcript"("iterationId");

-- CreateIndex
CREATE INDEX "Transcript_iterationId_createdAt_idx" ON "public"."Transcript"("iterationId", "createdAt");

-- CreateIndex
CREATE INDEX "Turn_iterationId_order_idx" ON "public"."Turn"("iterationId", "order");

-- AddForeignKey
ALTER TABLE "public"."Iteration" ADD CONSTRAINT "Iteration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Iteration" ADD CONSTRAINT "Iteration_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Turn" ADD CONSTRAINT "Turn_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ToolCall" ADD CONSTRAINT "ToolCall_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Metric" ADD CONSTRAINT "Metric_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DraftEmail" ADD CONSTRAINT "DraftEmail_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallSession" ADD CONSTRAINT "CallSession_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_ownerIterationId_fkey" FOREIGN KEY ("ownerIterationId") REFERENCES "public"."Iteration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transcript" ADD CONSTRAINT "Transcript_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvalArtifact" ADD CONSTRAINT "EvalArtifact_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scorecard" ADD CONSTRAINT "Scorecard_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentRun" ADD CONSTRAINT "AssessmentRun_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportRequest" ADD CONSTRAINT "ReportRequest_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "public"."Iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
