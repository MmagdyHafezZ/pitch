-- CreateEnum
CREATE TYPE "public"."AssessmentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AssessmentLabelValue" AS ENUM ('PositiveExample', 'NegativeExample', 'Neutral', 'ObjectiveMet', 'ObjectiveNotMet', 'InsightfulQuestion', 'MissedOpportunity');

-- CreateEnum
CREATE TYPE "public"."AssessmentMode" AS ENUM ('live', 'final');

-- CreateTable
CREATE TABLE "public"."AssessmentRun" (
    "id" TEXT NOT NULL,
    "sessionMemberId" TEXT NOT NULL,
    "status" "public"."AssessmentRunStatus" NOT NULL DEFAULT 'queued',
    "mode" "public"."AssessmentMode" NOT NULL,
    "inputHash" TEXT,
    "config" JSONB NOT NULL,
    "engineVersion" TEXT,
    "totalScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "mongoReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TurnAssessmentLabel" (
    "id" TEXT NOT NULL,
    "assessmentRunId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "label" "public"."AssessmentLabelValue" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "scoreDelta" DOUBLE PRECISION,
    "evidence" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnAssessmentLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssessmentSummary" (
    "id" TEXT NOT NULL,
    "assessmentRunId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "scoreBreakdown" JSONB,
    "narrativeSummary" TEXT,
    "coachTips" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentRun_inputHash_key" ON "public"."AssessmentRun"("inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentRun_mongoReportId_key" ON "public"."AssessmentRun"("mongoReportId");

-- CreateIndex
CREATE INDEX "AssessmentRun_sessionMemberId_status_idx" ON "public"."AssessmentRun"("sessionMemberId", "status");

-- CreateIndex
CREATE INDEX "AssessmentRun_sessionMemberId_createdAt_idx" ON "public"."AssessmentRun"("sessionMemberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TurnAssessmentLabel_assessmentRunId_idx" ON "public"."TurnAssessmentLabel"("assessmentRunId");

-- CreateIndex
CREATE INDEX "TurnAssessmentLabel_turnId_idx" ON "public"."TurnAssessmentLabel"("turnId");

-- CreateIndex
CREATE INDEX "TurnAssessmentLabel_label_idx" ON "public"."TurnAssessmentLabel"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSummary_assessmentRunId_key" ON "public"."AssessmentSummary"("assessmentRunId");

-- AddForeignKey
ALTER TABLE "public"."AssessmentRun" ADD CONSTRAINT "AssessmentRun_sessionMemberId_fkey" FOREIGN KEY ("sessionMemberId") REFERENCES "public"."SessionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TurnAssessmentLabel" ADD CONSTRAINT "TurnAssessmentLabel_assessmentRunId_fkey" FOREIGN KEY ("assessmentRunId") REFERENCES "public"."AssessmentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TurnAssessmentLabel" ADD CONSTRAINT "TurnAssessmentLabel_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "public"."Turn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentSummary" ADD CONSTRAINT "AssessmentSummary_assessmentRunId_fkey" FOREIGN KEY ("assessmentRunId") REFERENCES "public"."AssessmentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
