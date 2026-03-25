CREATE TYPE "public"."ScenarioVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');

ALTER TABLE "public"."Scenario"
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "visibility" "public"."ScenarioVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE INDEX "Scenario_createdByUserId_idx" ON "public"."Scenario"("createdByUserId");
CREATE INDEX "Scenario_visibility_idx" ON "public"."Scenario"("visibility");
CREATE INDEX "Scenario_orgId_visibility_idx" ON "public"."Scenario"("orgId", "visibility");
