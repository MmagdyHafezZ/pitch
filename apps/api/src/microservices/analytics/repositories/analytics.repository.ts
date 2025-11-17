import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Metrics =====
  async createMetric(data: any) {
    return this.prisma.metric.create({ data });
  }

  async queryMetrics(filters: any) {
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

  async aggregateMetrics(data: any) {
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

  async getStatistics(filters: any) {
    return this.prisma.statistic.findMany({
      where: {
        orgId: filters.orgId,
        period: filters.period,
        periodKey: filters.periodKey,
        ...(filters.metricType && { metricType: filters.metricType }),
      },
    });
  }

  // ===== Events =====
  async trackEvent(data: any) {
    return this.prisma.event.create({ data });
  }

  async getEvents(filters: any) {
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

  // ===== Dashboards =====
  async createDashboard(data: any) {
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

  async updateDashboard(dashboardId: string, data: any) {
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

  // ===== Reports =====
  async createReport(data: any) {
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

  async updateReport(reportId: string, data: any) {
    return this.prisma.report.update({
      where: { id: reportId },
      data,
    });
  }

  async createReportExecution(data: any) {
    return this.prisma.reportExecution.create({ data });
  }

  // ===== Performance Logs =====
  async createPerformanceLog(data: any) {
    return this.prisma.performanceLog.create({ data });
  }
}
