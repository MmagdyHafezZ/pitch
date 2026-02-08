-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "integrationId" TEXT,
    "externalId" TEXT,
    "provider" "public"."IntegrationProvider",
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "company" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "description" TEXT,
    "website" TEXT,
    "linkedIn" TEXT,
    "twitter" TEXT,
    "customFields" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "integrationId" TEXT,
    "externalId" TEXT,
    "provider" "public"."IntegrationProvider",
    "name" TEXT NOT NULL,
    "website" TEXT,
    "phone" TEXT,
    "industry" TEXT,
    "employees" INTEGER,
    "annualRevenue" DECIMAL(65,30),
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "description" TEXT,
    "type" TEXT,
    "customFields" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."opportunities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "integrationId" TEXT,
    "externalId" TEXT,
    "provider" "public"."IntegrationProvider",
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "stage" TEXT NOT NULL,
    "probability" INTEGER,
    "closeDate" TIMESTAMP(3),
    "accountId" TEXT,
    "contactId" TEXT,
    "description" TEXT,
    "nextStep" TEXT,
    "type" TEXT,
    "leadSource" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "customFields" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "integrationId" TEXT,
    "externalId" TEXT,
    "provider" "public"."IntegrationProvider",
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "rating" TEXT,
    "leadSource" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "description" TEXT,
    "website" TEXT,
    "isConverted" BOOLEAN NOT NULL DEFAULT false,
    "convertedDate" TIMESTAMP(3),
    "convertedContactId" TEXT,
    "convertedAccountId" TEXT,
    "convertedOpportunityId" TEXT,
    "customFields" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT DEFAULT 'synced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "priority" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "contactId" TEXT,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "leadId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "contactId" TEXT,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "leadId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_userId_idx" ON "public"."contacts"("userId");

-- CreateIndex
CREATE INDEX "contacts_orgId_idx" ON "public"."contacts"("orgId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "public"."contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_integrationId_idx" ON "public"."contacts"("integrationId");

-- CreateIndex
CREATE INDEX "contacts_accountId_idx" ON "public"."contacts"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_userId_externalId_provider_key" ON "public"."contacts"("userId", "externalId", "provider");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "public"."accounts"("userId");

-- CreateIndex
CREATE INDEX "accounts_orgId_idx" ON "public"."accounts"("orgId");

-- CreateIndex
CREATE INDEX "accounts_name_idx" ON "public"."accounts"("name");

-- CreateIndex
CREATE INDEX "accounts_integrationId_idx" ON "public"."accounts"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_externalId_provider_key" ON "public"."accounts"("userId", "externalId", "provider");

-- CreateIndex
CREATE INDEX "opportunities_userId_idx" ON "public"."opportunities"("userId");

-- CreateIndex
CREATE INDEX "opportunities_orgId_idx" ON "public"."opportunities"("orgId");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "public"."opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_closeDate_idx" ON "public"."opportunities"("closeDate");

-- CreateIndex
CREATE INDEX "opportunities_integrationId_idx" ON "public"."opportunities"("integrationId");

-- CreateIndex
CREATE INDEX "opportunities_accountId_idx" ON "public"."opportunities"("accountId");

-- CreateIndex
CREATE INDEX "opportunities_contactId_idx" ON "public"."opportunities"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_userId_externalId_provider_key" ON "public"."opportunities"("userId", "externalId", "provider");

-- CreateIndex
CREATE INDEX "leads_userId_idx" ON "public"."leads"("userId");

-- CreateIndex
CREATE INDEX "leads_orgId_idx" ON "public"."leads"("orgId");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "public"."leads"("email");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "public"."leads"("status");

-- CreateIndex
CREATE INDEX "leads_integrationId_idx" ON "public"."leads"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_userId_externalId_provider_key" ON "public"."leads"("userId", "externalId", "provider");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "public"."activities"("userId");

-- CreateIndex
CREATE INDEX "activities_orgId_idx" ON "public"."activities"("orgId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "public"."activities"("type");

-- CreateIndex
CREATE INDEX "activities_dueDate_idx" ON "public"."activities"("dueDate");

-- CreateIndex
CREATE INDEX "activities_contactId_idx" ON "public"."activities"("contactId");

-- CreateIndex
CREATE INDEX "activities_accountId_idx" ON "public"."activities"("accountId");

-- CreateIndex
CREATE INDEX "activities_opportunityId_idx" ON "public"."activities"("opportunityId");

-- CreateIndex
CREATE INDEX "activities_leadId_idx" ON "public"."activities"("leadId");

-- CreateIndex
CREATE INDEX "activities_sessionId_idx" ON "public"."activities"("sessionId");

-- CreateIndex
CREATE INDEX "notes_userId_idx" ON "public"."notes"("userId");

-- CreateIndex
CREATE INDEX "notes_orgId_idx" ON "public"."notes"("orgId");

-- CreateIndex
CREATE INDEX "notes_contactId_idx" ON "public"."notes"("contactId");

-- CreateIndex
CREATE INDEX "notes_accountId_idx" ON "public"."notes"("accountId");

-- CreateIndex
CREATE INDEX "notes_opportunityId_idx" ON "public"."notes"("opportunityId");

-- CreateIndex
CREATE INDEX "notes_leadId_idx" ON "public"."notes"("leadId");

-- CreateIndex
CREATE INDEX "notes_sessionId_idx" ON "public"."notes"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
