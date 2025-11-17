CREATE EXTENSION IF NOT EXISTS vector;


-- CreateEnum
CREATE TYPE "public"."SessionMode" AS ENUM ('text', 'voice', 'video');

-- CreateEnum
CREATE TYPE "public"."TurnRole" AS ENUM ('user', 'system', 'assistant', 'tool');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('simulation_started', 'turn_completed', 'simulation_completed', 'recording_available', 'stt_completed', 'media_ingested', 'analytics_updated');

-- CreateEnum
CREATE TYPE "public"."IngestPipeline" AS ENUM ('transcribe', 'transcribe_enrich', 'full');

-- CreateEnum
CREATE TYPE "public"."IngestStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."RecordingLayout" AS ENUM ('grid', 'speaker', 'screen');

-- CreateEnum
CREATE TYPE "public"."ReportFormat" AS ENUM ('pdf', 'json');

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userSnapshot" JSONB,
    "orgSnapshot" JSONB,
    "mode" "public"."SessionMode" NOT NULL,
    "scenarioId" TEXT,
    "personaId" TEXT,
    "language" TEXT,
    "crmContextId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "endedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Turn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "public"."TurnRole" NOT NULL,
    "text" TEXT,
    "audioAssetId" TEXT,
    "attachments" JSONB,
    "metadata" JSONB,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnId" TEXT,
    "role" "public"."TurnRole" NOT NULL,
    "content" TEXT,
    "redaction" JSONB,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ToolCall" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnId" TEXT,
    "name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "latencyMs" INTEGER,
    "success" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "public"."EventType" NOT NULL,
    "payload" JSONB,
    "mongoEventLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Metric" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "toolCount" INTEGER,
    "latencyMs" INTEGER,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scenario" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Persona" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "traits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DraftEmail" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tone" TEXT,
    "bullets" JSONB,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CallSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tracks" TEXT[],
    "sdpOffer" TEXT,
    "sdpAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recording" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "layout" "public"."RecordingLayout",
    "tracks" TEXT[],
    "assetId" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MediaAsset" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "ownerSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IngestionJob" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "pipeline" "public"."IngestPipeline" NOT NULL,
    "status" "public"."IngestStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "transcriptId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transcript" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sessionId" TEXT,
    "language" TEXT,
    "text" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RedactionSpan" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "spans" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedactionSpan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvalArtifact" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnId" TEXT,
    "kind" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmbeddingRow" (
    "id" TEXT NOT NULL,
    "embedding" vector NOT NULL,
    "namespace" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rubric" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Criterion" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scorecard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rubricId" TEXT,
    "totalScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScoreItem" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "criterionId" TEXT,
    "score" DOUBLE PRECISION,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoachTip" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,
    "excerptRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Benchmark" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "window" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "format" "public"."ReportFormat" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "assetId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_orgId_userId_idx" ON "public"."Session"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "public"."Session"("status");

-- CreateIndex
CREATE INDEX "Session_scenarioId_idx" ON "public"."Session"("scenarioId");

-- CreateIndex
CREATE INDEX "Session_personaId_idx" ON "public"."Session"("personaId");

-- CreateIndex
CREATE INDEX "Turn_sessionId_order_idx" ON "public"."Turn"("sessionId", "order");

-- CreateIndex
CREATE INDEX "Turn_role_idx" ON "public"."Turn"("role");

-- CreateIndex
CREATE INDEX "Message_sessionId_turnId_idx" ON "public"."Message"("sessionId", "turnId");

-- CreateIndex
CREATE INDEX "ToolCall_sessionId_turnId_name_idx" ON "public"."ToolCall"("sessionId", "turnId", "name");

-- CreateIndex
CREATE INDEX "Event_sessionId_type_createdAt_idx" ON "public"."Event"("sessionId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Metric_sessionId_createdAt_idx" ON "public"."Metric"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Scenario_orgId_idx" ON "public"."Scenario"("orgId");

-- CreateIndex
CREATE INDEX "Persona_orgId_idx" ON "public"."Persona"("orgId");

-- CreateIndex
CREATE INDEX "DraftEmail_sessionId_createdAt_idx" ON "public"."DraftEmail"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Recording_callId_createdAt_idx" ON "public"."Recording"("callId", "createdAt");

-- CreateIndex
CREATE INDEX "Recording_assetId_idx" ON "public"."Recording"("assetId");

-- CreateIndex
CREATE INDEX "MediaAsset_storageKey_idx" ON "public"."MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "IngestionJob_assetId_status_idx" ON "public"."IngestionJob"("assetId", "status");

-- CreateIndex
CREATE INDEX "Transcript_assetId_idx" ON "public"."Transcript"("assetId");

-- CreateIndex
CREATE INDEX "Transcript_sessionId_idx" ON "public"."Transcript"("sessionId");

-- CreateIndex
CREATE INDEX "Transcript_sessionId_createdAt_idx" ON "public"."Transcript"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RedactionSpan_messageId_idx" ON "public"."RedactionSpan"("messageId");

-- CreateIndex
CREATE INDEX "EvalArtifact_sessionId_kind_idx" ON "public"."EvalArtifact"("sessionId", "kind");

-- CreateIndex
CREATE INDEX "EvalArtifact_turnId_idx" ON "public"."EvalArtifact"("turnId");

-- CreateIndex
CREATE INDEX "EmbeddingRow_namespace_idx" ON "public"."EmbeddingRow"("namespace");

-- CreateIndex
CREATE INDEX "EmbeddingRow_refType_refId_idx" ON "public"."EmbeddingRow"("refType", "refId");

-- CreateIndex
CREATE INDEX "Rubric_orgId_idx" ON "public"."Rubric"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_orgId_name_version_key" ON "public"."Rubric"("orgId", "name", "version");

-- CreateIndex
CREATE INDEX "Criterion_rubricId_order_idx" ON "public"."Criterion"("rubricId", "order");

-- CreateIndex
CREATE INDEX "Scorecard_sessionId_idx" ON "public"."Scorecard"("sessionId");

-- CreateIndex
CREATE INDEX "Scorecard_rubricId_idx" ON "public"."Scorecard"("rubricId");

-- CreateIndex
CREATE INDEX "ScoreItem_scorecardId_idx" ON "public"."ScoreItem"("scorecardId");

-- CreateIndex
CREATE INDEX "ScoreItem_criterionId_idx" ON "public"."ScoreItem"("criterionId");

-- CreateIndex
CREATE INDEX "CoachTip_scorecardId_idx" ON "public"."CoachTip"("scorecardId");

-- CreateIndex
CREATE INDEX "Benchmark_orgId_name_idx" ON "public"."Benchmark"("orgId", "name");

-- CreateIndex
CREATE INDEX "Benchmark_orgId_metric_idx" ON "public"."Benchmark"("orgId", "metric");

-- CreateIndex
CREATE INDEX "ReportRequest_sessionId_format_status_idx" ON "public"."ReportRequest"("sessionId", "format", "status");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "public"."Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Turn" ADD CONSTRAINT "Turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "public"."Turn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ToolCall" ADD CONSTRAINT "ToolCall_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ToolCall" ADD CONSTRAINT "ToolCall_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "public"."Turn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Metric" ADD CONSTRAINT "Metric_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DraftEmail" ADD CONSTRAINT "DraftEmail_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallSession" ADD CONSTRAINT "CallSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_callId_fkey" FOREIGN KEY ("callId") REFERENCES "public"."CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_ownerSessionId_fkey" FOREIGN KEY ("ownerSessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngestionJob" ADD CONSTRAINT "IngestionJob_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transcript" ADD CONSTRAINT "Transcript_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transcript" ADD CONSTRAINT "Transcript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RedactionSpan" ADD CONSTRAINT "RedactionSpan_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvalArtifact" ADD CONSTRAINT "EvalArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvalArtifact" ADD CONSTRAINT "EvalArtifact_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "public"."Turn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Criterion" ADD CONSTRAINT "Criterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "public"."Rubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scorecard" ADD CONSTRAINT "Scorecard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scorecard" ADD CONSTRAINT "Scorecard_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "public"."Rubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScoreItem" ADD CONSTRAINT "ScoreItem_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "public"."Scorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScoreItem" ADD CONSTRAINT "ScoreItem_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "public"."Criterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoachTip" ADD CONSTRAINT "CoachTip_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "public"."Scorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportRequest" ADD CONSTRAINT "ReportRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
