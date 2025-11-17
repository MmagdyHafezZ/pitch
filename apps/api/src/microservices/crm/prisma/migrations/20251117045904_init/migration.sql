-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "company" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "leadStatus" TEXT,
    "customerType" TEXT,
    "accountId" TEXT,
    "ownerId" TEXT,
    "address" JSONB,
    "socialMedia" JSONB,
    "customFields" JSONB,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "type" TEXT NOT NULL DEFAULT 'prospect',
    "status" TEXT NOT NULL DEFAULT 'active',
    "industry" TEXT,
    "employeeCount" TEXT,
    "annualRevenue" DOUBLE PRECISION,
    "website" TEXT,
    "description" TEXT,
    "address" JSONB,
    "billingAddress" JSONB,
    "shippingAddress" JSONB,
    "parentAccountId" TEXT,
    "ownerId" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."opportunities" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "stage" TEXT NOT NULL,
    "probability" INTEGER DEFAULT 0,
    "expectedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "accountId" TEXT,
    "contactId" TEXT,
    "ownerId" TEXT,
    "type" TEXT,
    "source" TEXT,
    "description" TEXT,
    "nextStep" TEXT,
    "lossReason" TEXT,
    "competitorInfo" JSONB,
    "customFields" JSONB,
    "lineItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "contactId" TEXT,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "outcome" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contactId" TEXT,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "createdById" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contact_tags" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "public"."sales_goals" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metric" TEXT NOT NULL DEFAULT 'revenue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_orgId_idx" ON "public"."contacts"("orgId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "public"."contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_accountId_idx" ON "public"."contacts"("accountId");

-- CreateIndex
CREATE INDEX "contacts_ownerId_idx" ON "public"."contacts"("ownerId");

-- CreateIndex
CREATE INDEX "contacts_status_idx" ON "public"."contacts"("status");

-- CreateIndex
CREATE INDEX "contacts_leadStatus_idx" ON "public"."contacts"("leadStatus");

-- CreateIndex
CREATE INDEX "accounts_orgId_idx" ON "public"."accounts"("orgId");

-- CreateIndex
CREATE INDEX "accounts_domain_idx" ON "public"."accounts"("domain");

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "public"."accounts"("type");

-- CreateIndex
CREATE INDEX "accounts_status_idx" ON "public"."accounts"("status");

-- CreateIndex
CREATE INDEX "accounts_ownerId_idx" ON "public"."accounts"("ownerId");

-- CreateIndex
CREATE INDEX "opportunities_orgId_idx" ON "public"."opportunities"("orgId");

-- CreateIndex
CREATE INDEX "opportunities_accountId_idx" ON "public"."opportunities"("accountId");

-- CreateIndex
CREATE INDEX "opportunities_contactId_idx" ON "public"."opportunities"("contactId");

-- CreateIndex
CREATE INDEX "opportunities_ownerId_idx" ON "public"."opportunities"("ownerId");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "public"."opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_expectedCloseDate_idx" ON "public"."opportunities"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "activities_orgId_idx" ON "public"."activities"("orgId");

-- CreateIndex
CREATE INDEX "activities_contactId_idx" ON "public"."activities"("contactId");

-- CreateIndex
CREATE INDEX "activities_accountId_idx" ON "public"."activities"("accountId");

-- CreateIndex
CREATE INDEX "activities_opportunityId_idx" ON "public"."activities"("opportunityId");

-- CreateIndex
CREATE INDEX "activities_assignedToId_idx" ON "public"."activities"("assignedToId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "public"."activities"("type");

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "public"."activities"("status");

-- CreateIndex
CREATE INDEX "activities_dueDate_idx" ON "public"."activities"("dueDate");

-- CreateIndex
CREATE INDEX "notes_orgId_idx" ON "public"."notes"("orgId");

-- CreateIndex
CREATE INDEX "notes_contactId_idx" ON "public"."notes"("contactId");

-- CreateIndex
CREATE INDEX "notes_accountId_idx" ON "public"."notes"("accountId");

-- CreateIndex
CREATE INDEX "notes_opportunityId_idx" ON "public"."notes"("opportunityId");

-- CreateIndex
CREATE INDEX "notes_createdById_idx" ON "public"."notes"("createdById");

-- CreateIndex
CREATE INDEX "tags_orgId_idx" ON "public"."tags"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_orgId_name_key" ON "public"."tags"("orgId", "name");

-- CreateIndex
CREATE INDEX "contact_tags_contactId_idx" ON "public"."contact_tags"("contactId");

-- CreateIndex
CREATE INDEX "contact_tags_tagId_idx" ON "public"."contact_tags"("tagId");

-- CreateIndex
CREATE INDEX "sales_goals_orgId_idx" ON "public"."sales_goals"("orgId");

-- CreateIndex
CREATE INDEX "sales_goals_userId_idx" ON "public"."sales_goals"("userId");

-- CreateIndex
CREATE INDEX "sales_goals_startDate_endDate_idx" ON "public"."sales_goals"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "email_templates_orgId_idx" ON "public"."email_templates"("orgId");

-- CreateIndex
CREATE INDEX "email_templates_category_idx" ON "public"."email_templates"("category");

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contact_tags" ADD CONSTRAINT "contact_tags_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contact_tags" ADD CONSTRAINT "contact_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
