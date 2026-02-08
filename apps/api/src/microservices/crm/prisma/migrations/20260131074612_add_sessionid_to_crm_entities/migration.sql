-- AlterTable
ALTER TABLE "public"."accounts" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "public"."contacts" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "public"."leads" ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "public"."opportunities" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "accounts_sessionId_idx" ON "public"."accounts"("sessionId");

-- CreateIndex
CREATE INDEX "contacts_sessionId_idx" ON "public"."contacts"("sessionId");

-- CreateIndex
CREATE INDEX "leads_sessionId_idx" ON "public"."leads"("sessionId");

-- CreateIndex
CREATE INDEX "opportunities_sessionId_idx" ON "public"."opportunities"("sessionId");
