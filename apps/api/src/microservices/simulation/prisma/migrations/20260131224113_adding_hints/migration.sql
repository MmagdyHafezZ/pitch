-- CreateTable
CREATE TABLE "public"."HintConfig" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "orgId" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "strategy" TEXT NOT NULL DEFAULT 'reactive',
    "maxHintsPerRequest" INTEGER NOT NULL DEFAULT 3,
    "inactivityThresholdSeconds" INTEGER NOT NULL DEFAULT 30,
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "maxTokens" INTEGER DEFAULT 500,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HintConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HintConfig_scope_orgId_userId_sessionId_isActive_idx" ON "public"."HintConfig"("scope", "orgId", "userId", "sessionId", "isActive");

-- CreateIndex
CREATE INDEX "HintConfig_name_idx" ON "public"."HintConfig"("name");

-- CreateIndex
CREATE INDEX "HintConfig_sessionId_idx" ON "public"."HintConfig"("sessionId");
