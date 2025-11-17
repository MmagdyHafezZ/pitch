import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AnalyticsService } from '../services/analytics.service';
import { MetricsService } from '../services/metrics.service';
import { DashboardService } from '../services/dashboard.service';
import { ReportService } from '../services/report.service';

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsService: MetricsService,
    private readonly dashboardService: DashboardService,
    private readonly reportService: ReportService,
  ) {}

  // ===== Metrics =====
  @MessagePattern('analytics.metrics.record')
  async recordMetric(@Payload() data: any) {
    return this.metricsService.recordMetric(data);
  }

  @MessagePattern('analytics.metrics.query')
  async queryMetrics(@Payload() data: any) {
    return this.metricsService.queryMetrics(data);
  }

  @MessagePattern('analytics.metrics.aggregate')
  async aggregateMetrics(@Payload() data: any) {
    return this.metricsService.aggregateMetrics(data);
  }

  // ===== Dashboards =====
  @MessagePattern('analytics.dashboard.create')
  async createDashboard(@Payload() data: any) {
    return this.dashboardService.createDashboard(data);
  }

  @MessagePattern('analytics.dashboard.get')
  async getDashboard(@Payload() data: { dashboardId: string }) {
    return this.dashboardService.getDashboard(data.dashboardId);
  }

  @MessagePattern('analytics.dashboard.list')
  async listDashboards(@Payload() data: { orgId: string; userId?: string }) {
    return this.dashboardService.listDashboards(data);
  }

  // ===== Reports =====
  @MessagePattern('analytics.report.generate')
  async generateReport(@Payload() data: any) {
    return this.reportService.generateReport(data);
  }

  @MessagePattern('analytics.report.schedule')
  async scheduleReport(@Payload() data: any) {
    return this.reportService.scheduleReport(data);
  }

  @MessagePattern('analytics.report.get')
  async getReport(@Payload() data: { reportId: string }) {
    return this.reportService.getReport(data.reportId);
  }

  // ===== Statistics =====
  @MessagePattern('analytics.stats.get')
  async getStatistics(@Payload() data: any) {
    return this.analyticsService.getStatistics(data);
  }

  // ===== Events =====
  @MessagePattern('analytics.event.track')
  async trackEvent(@Payload() data: any) {
    return this.analyticsService.trackEvent(data);
  }
}
