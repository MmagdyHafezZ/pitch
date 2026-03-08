import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CurrentUser } from '../../../microservices/userManagement/decorators/current-user.decorator';
import type { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';

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

@ApiTags('Analytics')
@ApiBearerAuth('bearer')
@Controller('analytics')
export class AnalyticsGatewayController {
  private readonly logger = new Logger(AnalyticsGatewayController.name);

  constructor(
    @Inject('ANALYTICS_SERVICE') private analyticsService: ClientProxy,
  ) {}

  // ── Metrics ─────────────────────────────────────────────────────────────

  @Post('metrics')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a metric data point' })
  @ApiResponse({ status: 201, description: 'Metric recorded' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orgId', 'metricType', 'category', 'name', 'value'],
      properties: {
        orgId: { type: 'string' },
        userId: { type: 'string' },
        sessionId: { type: 'string' },
        metricType: { type: 'string' },
        category: { type: 'string' },
        name: { type: 'string' },
        value: { type: 'number' },
        unit: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  })
  recordMetric(@Body() body: Record<string, any>) {
    this.logger.log(`Recording metric: ${body.metricType}/${body.name}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.METRICS_RECORD, body)
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Record metric failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to record metric',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Query metrics with filters' })
  @ApiResponse({ status: 200, description: 'Metrics returned' })
  @ApiQuery({ name: 'orgId', required: true })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'metricType', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  queryMetrics(
    @Query('orgId') orgId: string,
    @Query('userId') userId?: string,
    @Query('metricType') metricType?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.METRICS_QUERY, {
        orgId,
        ...(userId && { userId }),
        ...(metricType && { metricType }),
        ...(category && { category }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Query metrics failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to query metrics',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post('metrics/aggregate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aggregate metrics into a statistic' })
  @ApiResponse({ status: 200, description: 'Aggregation complete' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orgId', 'period', 'periodKey', 'metricType', 'category'],
      properties: {
        orgId: { type: 'string' },
        period: {
          type: 'string',
          description: 'e.g. "daily", "weekly", "monthly"',
        },
        periodKey: { type: 'string', description: 'e.g. "2026-03-08"' },
        metricType: { type: 'string' },
        category: { type: 'string' },
      },
    },
  })
  aggregateMetrics(@Body() body: Record<string, any>) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.METRICS_AGGREGATE, body)
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Aggregate metrics failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to aggregate metrics',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  // ── Statistics ──────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get pre-aggregated statistics' })
  @ApiResponse({ status: 200, description: 'Statistics returned' })
  @ApiQuery({ name: 'orgId', required: true })
  @ApiQuery({
    name: 'period',
    required: true,
    description: 'e.g. "daily", "weekly", "monthly"',
  })
  @ApiQuery({
    name: 'periodKey',
    required: true,
    description: 'e.g. "2026-03"',
  })
  @ApiQuery({ name: 'metricType', required: false })
  getStatistics(
    @Query('orgId') orgId: string,
    @Query('period') period: string,
    @Query('periodKey') periodKey: string,
    @Query('metricType') metricType?: string,
  ) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.STATS_GET, {
        orgId,
        period,
        periodKey,
        ...(metricType && { metricType }),
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Get statistics failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get statistics',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  // ── Events ──────────────────────────────────────────────────────────────

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Track an analytics event' })
  @ApiResponse({ status: 201, description: 'Event tracked' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orgId', 'eventType', 'eventName'],
      properties: {
        orgId: { type: 'string' },
        userId: { type: 'string' },
        sessionId: { type: 'string' },
        eventType: { type: 'string' },
        eventName: { type: 'string' },
        properties: { type: 'object' },
        context: { type: 'object' },
      },
    },
  })
  trackEvent(@Body() body: Record<string, any>) {
    this.logger.log(`Tracking event: ${body.eventType}/${body.eventName}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.EVENT_TRACK, body)
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Track event failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to track event',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('events')
  @ApiOperation({ summary: 'List analytics events with filters' })
  @ApiResponse({ status: 200, description: 'Events returned' })
  @ApiQuery({ name: 'orgId', required: true })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  listEvents(
    @Query('orgId') orgId: string,
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.EVENT_LIST, {
        orgId,
        ...(userId && { userId }),
        ...(eventType && { eventType }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('List events failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list events',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  // ── Dashboards ──────────────────────────────────────────────────────────

  @Post('dashboards')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new dashboard' })
  @ApiResponse({ status: 201, description: 'Dashboard created' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orgId', 'name', 'type', 'config'],
      properties: {
        orgId: { type: 'string' },
        userId: { type: 'string' },
        name: { type: 'string' },
        type: {
          type: 'string',
          description: '"org", "user", "team", "custom"',
        },
        config: { type: 'object' },
        layout: { type: 'object' },
      },
    },
  })
  createDashboard(@Body() body: Record<string, any>) {
    this.logger.log(`Creating dashboard: ${body.name}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_CREATE, body)
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Create dashboard failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to create dashboard',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('dashboards')
  @ApiOperation({ summary: 'List dashboards for an organization' })
  @ApiResponse({ status: 200, description: 'Dashboards returned' })
  @ApiQuery({ name: 'orgId', required: true })
  @ApiQuery({ name: 'userId', required: false })
  listDashboards(
    @Query('orgId') orgId: string,
    @Query('userId') userId?: string,
  ) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_LIST, {
        orgId,
        ...(userId && { userId }),
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('List dashboards failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list dashboards',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('dashboards/:id')
  @ApiOperation({ summary: 'Get a dashboard by ID' })
  @ApiResponse({ status: 200, description: 'Dashboard returned' })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  getDashboard(@Param('id') id: string) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_GET, { dashboardId: id })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(`Get dashboard failed: ${id}`, error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get dashboard',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Patch('dashboards/:id')
  @ApiOperation({ summary: 'Update a dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard updated' })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        config: { type: 'object' },
        layout: { type: 'object' },
      },
    },
  })
  updateDashboard(@Param('id') id: string, @Body() body: Record<string, any>) {
    this.logger.log(`Updating dashboard: ${id}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_UPDATE, {
        dashboardId: id,
        ...body,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(`Update dashboard failed: ${id}`, error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to update dashboard',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Delete('dashboards/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard deleted' })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  deleteDashboard(@Param('id') id: string) {
    this.logger.log(`Deleting dashboard: ${id}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.DASHBOARD_DELETE, { dashboardId: id })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(`Delete dashboard failed: ${id}`, error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to delete dashboard',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  // ── Reports ─────────────────────────────────────────────────────────────

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a new report' })
  @ApiResponse({ status: 201, description: 'Report generated' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orgId', 'userId', 'name', 'type', 'query'],
      properties: {
        orgId: { type: 'string' },
        userId: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string' },
        query: { type: 'object' },
        format: { type: 'string', description: '"json", "csv", "pdf"' },
      },
    },
  })
  generateReport(
    @CurrentUser('id') currentUserId: string,
    @Body() body: Record<string, any>,
  ) {
    this.logger.log(`Generating report: ${body.name}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.REPORT_GENERATE, {
        ...body,
        userId: body.userId ?? currentUserId,
      })
      .pipe(
        timeout(15000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Generate report failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to generate report',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('reports')
  @ApiOperation({ summary: 'List reports for an organization' })
  @ApiResponse({ status: 200, description: 'Reports returned' })
  @ApiQuery({ name: 'orgId', required: true })
  @ApiQuery({ name: 'userId', required: false })
  listReports(@Query('orgId') orgId: string, @Query('userId') userId?: string) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.REPORT_LIST, {
        orgId,
        ...(userId && { userId }),
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('List reports failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to list reports',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a report by ID' })
  @ApiResponse({ status: 200, description: 'Report returned' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  getReport(@Param('id') id: string) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.REPORT_GET, { reportId: id })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(`Get report failed: ${id}`, error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to get report',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  @Post('reports/:id/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule a report for recurring execution' })
  @ApiResponse({ status: 200, description: 'Report scheduled' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['schedule'],
      properties: {
        schedule: {
          type: 'string',
          description: 'Cron expression, e.g. "0 9 * * 1"',
        },
      },
    },
  })
  scheduleReport(@Param('id') id: string, @Body('schedule') schedule: string) {
    this.logger.log(`Scheduling report: ${id}`);
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.REPORT_SCHEDULE, {
        reportId: id,
        schedule,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error(`Schedule report failed: ${id}`, error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to schedule report',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }

  // ── Performance ─────────────────────────────────────────────────────────

  @Post('performance')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log API performance data' })
  @ApiResponse({ status: 201, description: 'Performance data logged' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['service', 'endpoint', 'method', 'statusCode', 'duration'],
      properties: {
        service: { type: 'string' },
        endpoint: { type: 'string' },
        method: { type: 'string' },
        statusCode: { type: 'number' },
        duration: { type: 'number', description: 'Duration in ms' },
        userId: { type: 'string' },
        orgId: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  })
  logPerformance(@Body() body: Record<string, any>) {
    return this.analyticsService
      .send(ANALYTICS_SERVICE_PATTERNS.PERFORMANCE_LOG, body)
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = err as ServiceError;
          this.logger.error('Log performance failed', error.stack);
          return throwError(
            () =>
              new HttpException(
                error.message ?? 'Failed to log performance data',
                error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
              ),
          );
        }),
      );
  }
}
