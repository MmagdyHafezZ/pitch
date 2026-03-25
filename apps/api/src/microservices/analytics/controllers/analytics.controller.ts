import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AnalyticsService } from '../services/analytics.service';
import { MetricsService } from '../services/metrics.service';
import { DashboardService } from '../services/dashboard.service';
import { ReportService } from '../services/report.service';
import {
  AggregateMetricsDto,
  CreateDashboardDto,
  GenerateReportDto,
  GetStatisticsDto,
  QueryMetricsDto,
  RecordMetricDto,
  ScheduleReportDto,
  TrackEventDto,
} from '../dto/analytics.dto';

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsService: MetricsService,
    private readonly dashboardService: DashboardService,
    private readonly reportService: ReportService,
  ) {}

  @MessagePattern('health')
  health() {
    return { status: 'ok', service: 'analytics' };
  }

  // ===== Metrics =====
  @MessagePattern('analytics.metrics.record')
  async recordMetric(@Payload() data: RecordMetricDto) {
    return this.metricsService.recordMetric(data);
  }

  @MessagePattern('analytics.metrics.query')
  async queryMetrics(@Payload() data: QueryMetricsDto) {
    return this.metricsService.queryMetrics(data);
  }

  @MessagePattern('analytics.metrics.aggregate')
  async aggregateMetrics(@Payload() data: AggregateMetricsDto) {
    return this.metricsService.aggregateMetrics(data);
  }

  // ===== Dashboards =====
  @MessagePattern('analytics.dashboard.create')
  async createDashboard(@Payload() data: CreateDashboardDto) {
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
  async generateReport(@Payload() data: GenerateReportDto) {
    return this.reportService.generateReport(data);
  }

  @MessagePattern('analytics.report.schedule')
  async scheduleReport(@Payload() data: ScheduleReportDto) {
    return this.reportService.scheduleReport(data);
  }

  @MessagePattern('analytics.report.get')
  async getReport(@Payload() data: { reportId: string }) {
    return this.reportService.getReport(data.reportId);
  }

  // ===== Statistics =====
  @MessagePattern('analytics.stats.get')
  async getStatistics(@Payload() data: GetStatisticsDto) {
    return this.analyticsService.getStatistics(data);
  }

  // ===== Events =====
  @MessagePattern('analytics.event.track')
  async trackEvent(@Payload() data: TrackEventDto) {
    return this.analyticsService.trackEvent(data);
  }
}
