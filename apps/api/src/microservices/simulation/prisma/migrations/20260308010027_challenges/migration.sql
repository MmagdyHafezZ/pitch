-- CreateEnum
CREATE TYPE "public"."ChallengePeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."ChallengeDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER');

-- CreateEnum
CREATE TYPE "public"."ChallengeStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."Challenge" (
    "id" TEXT NOT NULL,
    "period" "public"."ChallengePeriod" NOT NULL,
    "difficulty" "public"."ChallengeDifficulty" NOT NULL,
    "status" "public"."ChallengeStatus" NOT NULL DEFAULT 'UPCOMING',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scenarioPrompt" TEXT NOT NULL,
    "evaluatorPersonaPrompt" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChallengeParticipation" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "score" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Challenge_status_period_idx" ON "public"."Challenge"("status", "period");

-- CreateIndex
CREATE INDEX "Challenge_startsAt_expiresAt_idx" ON "public"."Challenge"("startsAt", "expiresAt");

-- CreateIndex
CREATE INDEX "ChallengeParticipation_userId_idx" ON "public"."ChallengeParticipation"("userId");

-- CreateIndex
CREATE INDEX "ChallengeParticipation_challengeId_score_idx" ON "public"."ChallengeParticipation"("challengeId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipation_challengeId_userId_key" ON "public"."ChallengeParticipation"("challengeId", "userId");

-- AddForeignKey
ALTER TABLE "public"."ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
