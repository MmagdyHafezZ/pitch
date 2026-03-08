import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AnalyticsService } from '../services/analytics.service';
import { MetricsService } from '../services/metrics.service';
import { DashboardService } from '../services/dashboard.service';
import { ReportService } from '../services/report.service';
import {
  AggregateMetricsDto,
  CreateDashboardDto,
  UpdateDashboardDto,
  GenerateReportDto,
  GetStatisticsDto,
  ListEventsDto,
  ListReportsDto,
  PerformanceLogDto,
  QueryMetricsDto,
  RecordMetricDto,
  ScheduleReportDto,
  TrackEventDto,
} from '../dto/analytics.dto';

/**
 * Analytics Service Message Patterns
 * These match the patterns defined in @pitch/shared-backend
 * Using local definition due to TypeScript module resolution issues with dist builds
 */
const ANALYTICS_SERVICE_PATTERNS = {
  METRICS_RECORD: 'analytics.metrics.record',
  METRICS_QUERY: 'analytics.metrics.query',
  METRICS_AGGREGATE: 'analytics.metrics.aggregate',
  DASHBOARD_CREATE: 'analytics.dashboard.create',
  DASHBOARD_GET: 'analytics.dashboard.get',
  DASHBOARD_LIST: 'analytics.dashboard.list',
  DASHBOARD_UPDATE: 'analytics.dashboard.update',
  DASHBOARD_DELETE: 'analytics.dashboard.delete',
  REPORT_GENERATE: 'analytics.report.generate',
  REPORT_SCHEDULE: 'analytics.report.schedule',
  REPORT_GET: 'analytics.report.get',
  REPORT_LIST: 'analytics.report.list',
  STATS_GET: 'analytics.stats.get',
  EVENT_TRACK: 'analytics.event.track',
  EVENT_LIST: 'analytics.events.list',
  PERFORMANCE_LOG: 'analytics.performance.log',
} as const;

@Controller()
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsService: MetricsService,
    private readonly dashboardService: DashboardService,
    private readonly reportService: ReportService,
  ) {}

  // ===== Metrics =====

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.METRICS_RECORD)
  async recordMetric(@Payload() data: RecordMetricDto) {
    this.logger.log(`Recording metric: ${data.metricType}/${data.name}`);
    return this.metricsService.recordMetric(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.METRICS_QUERY)
  async queryMetrics(@Payload() data: QueryMetricsDto) {
    this.logger.log(`Querying metrics for org: ${data.orgId}`);
    return this.metricsService.queryMetrics(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.METRICS_AGGREGATE)
  async aggregateMetrics(@Payload() data: AggregateMetricsDto) {
    this.logger.log(`Aggregating metrics: ${data.metricType}/${data.category}`);
    return this.metricsService.aggregateMetrics(data);
  }

  // ===== Dashboards =====

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_CREATE)
  async createDashboard(@Payload() data: CreateDashboardDto) {
    this.logger.log(`Creating dashboard: ${data.name}`);
    return this.dashboardService.createDashboard(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_GET)
  async getDashboard(@Payload() data: { dashboardId: string }) {
    return this.dashboardService.getDashboard(data.dashboardId);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_LIST)
  async listDashboards(@Payload() data: { orgId: string; userId?: string }) {
    return this.dashboardService.listDashboards(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_UPDATE)
  async updateDashboard(
    @Payload() data: { dashboardId: string } & UpdateDashboardDto,
  ) {
    this.logger.log(`Updating dashboard: ${data.dashboardId}`);
    const { dashboardId, ...updateData } = data;
    return this.dashboardService.updateDashboard(dashboardId, updateData);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_DELETE)
  async deleteDashboard(@Payload() data: { dashboardId: string }) {
    this.logger.log(`Deleting dashboard: ${data.dashboardId}`);
    return this.dashboardService.deleteDashboard(data.dashboardId);
  }

  // ===== Reports =====

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.REPORT_GENERATE)
  async generateReport(@Payload() data: GenerateReportDto) {
    this.logger.log(`Generating report: ${data.name}`);
    return this.reportService.generateReport(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.REPORT_SCHEDULE)
  async scheduleReport(@Payload() data: ScheduleReportDto) {
    this.logger.log(`Scheduling report: ${data.reportId}`);
    return this.reportService.scheduleReport(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.REPORT_GET)
  async getReport(@Payload() data: { reportId: string }) {
    return this.reportService.getReport(data.reportId);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.REPORT_LIST)
  async listReports(@Payload() data: ListReportsDto) {
    return this.reportService.listReports(data);
  }

  // ===== Statistics =====

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.STATS_GET)
  async getStatistics(@Payload() data: GetStatisticsDto) {
    return this.analyticsService.getStatistics(data);
  }

  // ===== Events =====

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.EVENT_TRACK)
  async trackEvent(@Payload() data: TrackEventDto) {
    this.logger.log(`Tracking event: ${data.eventType}/${data.eventName}`);
    return this.analyticsService.trackEvent(data);
  }

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.EVENT_LIST)
  async listEvents(@Payload() data: ListEventsDto) {
    return this.analyticsService.getEvents(data);
  }

  // ===== Performance =====

  @MessagePattern(ANALYTICS_SERVICE_PATTERNS.PERFORMANCE_LOG)
  async logPerformance(@Payload() data: PerformanceLogDto) {
    return this.analyticsService.logPerformance(data);
  }
}
