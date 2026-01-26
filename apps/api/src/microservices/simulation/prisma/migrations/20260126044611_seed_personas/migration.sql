-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked');

-- CreateTable
CREATE TABLE "public"."SessionInvitation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviterSnapshot" JSONB,
    "inviteeId" TEXT NOT NULL,
    "inviteeSnapshot" JSONB,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionInvitation_sessionId_status_idx" ON "public"."SessionInvitation"("sessionId", "status");

-- CreateIndex
CREATE INDEX "SessionInvitation_inviteeId_status_idx" ON "public"."SessionInvitation"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "SessionInvitation_inviterId_idx" ON "public"."SessionInvitation"("inviterId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionInvitation_sessionId_inviteeId_key" ON "public"."SessionInvitation"("sessionId", "inviteeId");

-- AddForeignKey
ALTER TABLE "public"."SessionInvitation" ADD CONSTRAINT "SessionInvitation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed Personas
-- Insert 4 global AI personas for simulation sessions
INSERT INTO "public"."Persona" ("id", "orgId", "name", "traits", "createdAt", "updatedAt")
VALUES
  (
    'persona_1',
    'global',
    'Sarah - Sales Expert',
    '{"role": "Technical Sales", "level": "Expert", "personality": "Professional and persuasive", "expertise": ["B2B sales", "Product demos", "Objection handling"], "tone": "Confident and consultative", "background": "10+ years in enterprise software sales"}',
    NOW(),
    NOW()
  ),
  (
    'persona_2',
    'global',
    'John - Product Manager',
    '{"role": "Product Strategy", "level": "Senior", "personality": "Strategic and analytical", "expertise": ["Product roadmaps", "User research", "Stakeholder management"], "tone": "Thoughtful and data-driven", "background": "Led multiple successful product launches"}',
    NOW(),
    NOW()
  ),
  (
    'persona_3',
    'global',
    'Maria - Customer Success',
    '{"role": "Support & Onboarding", "level": "Expert", "personality": "Empathetic and patient", "expertise": ["Customer onboarding", "Technical support", "Relationship building"], "tone": "Warm and helpful", "background": "Specialist in customer retention and satisfaction"}',
    NOW(),
    NOW()
  ),
  (
    'persona_4',
    'global',
    'Alex - Technical Lead',
    '{"role": "Engineering", "level": "Principal", "personality": "Detail-oriented and logical", "expertise": ["System architecture", "Code reviews", "Technical mentoring"], "tone": "Precise and methodical", "background": "Led engineering teams at major tech companies"}',
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;
