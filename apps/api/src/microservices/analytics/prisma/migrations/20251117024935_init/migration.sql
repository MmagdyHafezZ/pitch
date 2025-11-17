-- CreateTable
CREATE TABLE "public"."dashboards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "layout" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."widgets" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "position" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metrics" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "metricType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."statistics" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "aggregates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "schedule" TEXT,
    "format" TEXT NOT NULL DEFAULT 'json',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_executions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultData" JSONB,
    "error" TEXT,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "properties" JSONB,
    "context" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."performance_logs" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboards_orgId_idx" ON "public"."dashboards"("orgId");

-- CreateIndex
CREATE INDEX "dashboards_userId_idx" ON "public"."dashboards"("userId");

-- CreateIndex
CREATE INDEX "widgets_dashboardId_idx" ON "public"."widgets"("dashboardId");

-- CreateIndex
CREATE INDEX "metrics_orgId_metricType_timestamp_idx" ON "public"."metrics"("orgId", "metricType", "timestamp");

-- CreateIndex
CREATE INDEX "metrics_userId_timestamp_idx" ON "public"."metrics"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "metrics_sessionId_idx" ON "public"."metrics"("sessionId");

-- CreateIndex
CREATE INDEX "statistics_orgId_period_periodKey_idx" ON "public"."statistics"("orgId", "period", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "statistics_orgId_period_periodKey_metricType_category_key" ON "public"."statistics"("orgId", "period", "periodKey", "metricType", "category");

-- CreateIndex
CREATE INDEX "reports_orgId_idx" ON "public"."reports"("orgId");

-- CreateIndex
CREATE INDEX "reports_userId_idx" ON "public"."reports"("userId");

-- CreateIndex
CREATE INDEX "reports_status_schedule_idx" ON "public"."reports"("status", "schedule");

-- CreateIndex
CREATE INDEX "report_executions_reportId_startedAt_idx" ON "public"."report_executions"("reportId", "startedAt");

-- CreateIndex
CREATE INDEX "events_orgId_eventType_timestamp_idx" ON "public"."events"("orgId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "events_userId_timestamp_idx" ON "public"."events"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "events_sessionId_idx" ON "public"."events"("sessionId");

-- CreateIndex
CREATE INDEX "performance_logs_service_endpoint_timestamp_idx" ON "public"."performance_logs"("service", "endpoint", "timestamp");

-- CreateIndex
CREATE INDEX "performance_logs_orgId_timestamp_idx" ON "public"."performance_logs"("orgId", "timestamp");

-- AddForeignKey
ALTER TABLE "public"."widgets" ADD CONSTRAINT "widgets_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "public"."dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "public"."dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_executions" ADD CONSTRAINT "report_executions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
