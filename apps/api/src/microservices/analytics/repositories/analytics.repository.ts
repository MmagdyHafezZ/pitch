import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/analytics-client';
import { PrismaService } from '../services/prisma.service';

interface MetricData {
  orgId: string;
  userId?: string;
  sessionId?: string;
  metricType: string;
  category: string;
  name: string;
  value: number;
  unit?: string;
  metadata?: Prisma.InputJsonValue;
}

interface MetricFilters {
  orgId: string;
  userId?: string;
  metricType?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

interface AggregateData {
  orgId: string;
  period: string;
  periodKey: string;
  metricType: string;
  category: string;
  aggregates?: Prisma.InputJsonValue;
}

interface StatisticFilters {
  orgId: string;
  period: string;
  periodKey: string;
  metricType?: string;
}

interface EventData {
  orgId: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  properties?: Prisma.InputJsonValue;
  context?: Prisma.InputJsonValue;
}

interface EventFilters {
  orgId: string;
  userId?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
}

interface DashboardData {
  orgId: string;
  userId?: string;
  name: string;
  type: string;
  config: Prisma.InputJsonValue;
  layout?: Prisma.InputJsonValue;
}

interface ReportData {
  orgId: string;
  userId: string;
  name: string;
  type: string;
  query: Prisma.InputJsonValue;
  format?: string;
}

interface ReportExecutionData {
  reportId: string;
  status: string;
  result?: Prisma.InputJsonValue;
  error?: string;
}

interface PerformanceLogData {
  service: string;
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  userId?: string;
  orgId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMetric(data: MetricData) {
    return this.prisma.metric.create({ data });
  }

  async queryMetrics(filters: MetricFilters) {
    return this.prisma.metric.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.metricType && { metricType: filters.metricType }),
        ...(filters.category && { category: filters.category }),
        ...(filters.startDate &&
          filters.endDate && {
            timestamp: {
              gte: filters.startDate,
              lte: filters.endDate,
            },
          }),
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async aggregateMetrics(data: AggregateData) {
    return this.prisma.statistic.upsert({
      where: {
        orgId_period_periodKey_metricType_category: {
          orgId: data.orgId,
          period: data.period,
          periodKey: data.periodKey,
          metricType: data.metricType,
          category: data.category,
        },
      },
      create: {
        orgId: data.orgId,
        period: data.period,
        periodKey: data.periodKey,
        metricType: data.metricType,
        category: data.category,
        aggregates: data.aggregates || {},
      },
      update: {
        aggregates: data.aggregates || {},
      },
    });
  }

  async getStatistics(filters: StatisticFilters) {
    return this.prisma.statistic.findMany({
      where: {
        orgId: filters.orgId,
        period: filters.period,
        periodKey: filters.periodKey,
        ...(filters.metricType && { metricType: filters.metricType }),
      },
    });
  }

  async trackEvent(data: EventData) {
    return this.prisma.event.create({ data });
  }

  async getEvents(filters: EventFilters) {
    return this.prisma.event.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.eventType && { eventType: filters.eventType }),
        ...(filters.startDate &&
          filters.endDate && {
            timestamp: {
              gte: filters.startDate,
              lte: filters.endDate,
            },
          }),
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async createDashboard(data: DashboardData) {
    return this.prisma.dashboard.create({ data });
  }

  async getDashboard(dashboardId: string) {
    return this.prisma.dashboard.findUnique({
      where: { id: dashboardId },
      include: { widgets: true, reports: true },
    });
  }

  async listDashboards(filters: { orgId: string; userId?: string }) {
    return this.prisma.dashboard.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.userId && { userId: filters.userId }),
      },
      include: { widgets: true },
    });
  }

  async updateDashboard(
    dashboardId: string,
    data: Partial<Omit<DashboardData, 'orgId'>>,
  ) {
    return this.prisma.dashboard.update({
      where: { id: dashboardId },
      data,
    });
  }

  async deleteDashboard(dashboardId: string) {
    return this.prisma.dashboard.delete({
      where: { id: dashboardId },
    });
  }

  async createReport(data: ReportData) {
    return this.prisma.report.create({ data });
  }

  async getReport(reportId: string) {
    return this.prisma.report.findUnique({
      where: { id: reportId },
      include: { executions: { orderBy: { startedAt: 'desc' }, take: 10 } },
    });
  }

  async listReports(filters: { orgId: string; userId?: string }) {
    return this.prisma.report.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.userId && { userId: filters.userId }),
      },
    });
  }

  async updateReport(reportId: string, data: Partial<ReportData>) {
    return this.prisma.report.update({
      where: { id: reportId },
      data,
    });
  }

  async createReportExecution(data: ReportExecutionData) {
    return this.prisma.reportExecution.create({ data });
  }

  async createPerformanceLog(data: PerformanceLogData) {
    return this.prisma.performanceLog.create({ data });
  }
}
