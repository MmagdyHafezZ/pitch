import { AnalyticsRepository } from '../repositories/analytics.repository';

describe('AnalyticsRepository', () => {
  const prisma = {
    metric: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    statistic: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    event: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    dashboard: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    report: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    reportExecution: {
      create: jest.fn(),
    },
    performanceLog: {
      create: jest.fn(),
    },
  };

  const repository = new AnalyticsRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== Metrics =====
  describe('createMetric()', () => {
    it('creates a metric record', async () => {
      const data = {
        orgId: 'org-1',
        metricType: 'performance',
        category: 'api',
        name: 'response_time',
        value: 150,
      };
      const expected = { id: 'metric-1', ...data };
      prisma.metric.create.mockResolvedValue(expected);

      const result = await repository.createMetric(data);

      expect(prisma.metric.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });

    it('creates a metric with optional fields', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        sessionId: 'session-1',
        metricType: 'performance',
        category: 'api',
        name: 'response_time',
        value: 200,
        unit: 'ms',
        metadata: { endpoint: '/api/test' },
      };
      prisma.metric.create.mockResolvedValue({ id: 'metric-2', ...data });

      const result = await repository.createMetric(data);

      expect(prisma.metric.create).toHaveBeenCalledWith({ data });
      expect(result.userId).toBe('user-1');
    });
  });

  describe('queryMetrics()', () => {
    it('queries metrics with only orgId', async () => {
      const metrics = [{ id: 'metric-1', orgId: 'org-1' }];
      prisma.metric.findMany.mockResolvedValue(metrics);

      const result = await repository.queryMetrics({ orgId: 'org-1' });

      expect(prisma.metric.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { timestamp: 'desc' },
      });
      expect(result).toEqual(metrics);
    });

    it('queries metrics with all optional filters', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      prisma.metric.findMany.mockResolvedValue([]);

      await repository.queryMetrics({
        orgId: 'org-1',
        userId: 'user-1',
        metricType: 'performance',
        category: 'api',
        startDate,
        endDate,
      });

      expect(prisma.metric.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-1',
          userId: 'user-1',
          metricType: 'performance',
          category: 'api',
          timestamp: { gte: startDate, lte: endDate },
        },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('omits timestamp filter when only startDate is provided', async () => {
      prisma.metric.findMany.mockResolvedValue([]);

      await repository.queryMetrics({
        orgId: 'org-1',
        startDate: new Date('2026-01-01'),
      });

      expect(prisma.metric.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('omits timestamp filter when only endDate is provided', async () => {
      prisma.metric.findMany.mockResolvedValue([]);

      await repository.queryMetrics({
        orgId: 'org-1',
        endDate: new Date('2026-01-31'),
      });

      expect(prisma.metric.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('omits optional filters when they are undefined', async () => {
      prisma.metric.findMany.mockResolvedValue([]);

      await repository.queryMetrics({
        orgId: 'org-1',
        userId: undefined,
        metricType: undefined,
        category: undefined,
      });

      expect(prisma.metric.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('aggregateMetrics()', () => {
    it('upserts aggregate statistics', async () => {
      const data = {
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
        metricType: 'performance',
        category: 'api',
      };
      const expected = { id: 'stat-1', ...data, aggregates: {} };
      prisma.statistic.upsert.mockResolvedValue(expected);

      const result = await repository.aggregateMetrics(data);

      expect(prisma.statistic.upsert).toHaveBeenCalledWith({
        where: {
          orgId_period_periodKey_metricType_category: {
            orgId: 'org-1',
            period: 'daily',
            periodKey: '2026-01-15',
            metricType: 'performance',
            category: 'api',
          },
        },
        create: {
          orgId: 'org-1',
          period: 'daily',
          periodKey: '2026-01-15',
          metricType: 'performance',
          category: 'api',
          aggregates: {},
        },
        update: { aggregates: {} },
      });
      expect(result).toEqual(expected);
    });

    it('uses provided aggregates value', async () => {
      const aggregates = { count: 10, sum: 1500 };
      const data = {
        orgId: 'org-1',
        period: 'weekly',
        periodKey: '2026-W03',
        metricType: 'usage',
        category: 'sessions',
        aggregates,
      };
      prisma.statistic.upsert.mockResolvedValue({ id: 'stat-2', ...data });

      await repository.aggregateMetrics(data);

      expect(prisma.statistic.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ aggregates }),
          update: { aggregates },
        }),
      );
    });
  });

  describe('getStatistics()', () => {
    it('fetches statistics by org/period/periodKey', async () => {
      const stats = [{ id: 'stat-1' }];
      prisma.statistic.findMany.mockResolvedValue(stats);

      const result = await repository.getStatistics({
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
      });

      expect(prisma.statistic.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-1',
          period: 'daily',
          periodKey: '2026-01-15',
        },
      });
      expect(result).toEqual(stats);
    });

    it('includes metricType filter when provided', async () => {
      prisma.statistic.findMany.mockResolvedValue([]);

      await repository.getStatistics({
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
        metricType: 'performance',
      });

      expect(prisma.statistic.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-1',
          period: 'daily',
          periodKey: '2026-01-15',
          metricType: 'performance',
        },
      });
    });
  });

  // ===== Events =====
  describe('trackEvent()', () => {
    it('creates an event record', async () => {
      const data = {
        orgId: 'org-1',
        eventType: 'user_action',
        eventName: 'button_click',
      };
      const expected = { id: 'event-1', ...data };
      prisma.event.create.mockResolvedValue(expected);

      const result = await repository.trackEvent(data);

      expect(prisma.event.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });

    it('creates an event with all optional fields', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'user_action',
        eventName: 'form_submit',
        properties: { formId: 'contact' },
        context: { userAgent: 'Chrome' },
      };
      prisma.event.create.mockResolvedValue({ id: 'event-2', ...data });

      const result = await repository.trackEvent(data);

      expect(result.properties).toEqual({ formId: 'contact' });
    });
  });

  describe('getEvents()', () => {
    it('queries events with only orgId', async () => {
      const events = [{ id: 'event-1' }];
      prisma.event.findMany.mockResolvedValue(events);

      const result = await repository.getEvents({ orgId: 'org-1' });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { timestamp: 'desc' },
      });
      expect(result).toEqual(events);
    });

    it('queries events with all filters', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      prisma.event.findMany.mockResolvedValue([]);

      await repository.getEvents({
        orgId: 'org-1',
        userId: 'user-1',
        eventType: 'user_action',
        startDate,
        endDate,
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-1',
          userId: 'user-1',
          eventType: 'user_action',
          timestamp: { gte: startDate, lte: endDate },
        },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('omits timestamp filter when only startDate is provided', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await repository.getEvents({
        orgId: 'org-1',
        startDate: new Date('2026-01-01'),
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  // ===== Dashboards =====
  describe('createDashboard()', () => {
    it('creates a dashboard', async () => {
      const data = {
        orgId: 'org-1',
        name: 'Sales Dashboard',
        type: 'overview',
        config: { widgets: [] },
      };
      const expected = { id: 'dash-1', ...data };
      prisma.dashboard.create.mockResolvedValue(expected);

      const result = await repository.createDashboard(data);

      expect(prisma.dashboard.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });
  });

  describe('getDashboard()', () => {
    it('fetches a dashboard with widgets and reports', async () => {
      const dashboard = {
        id: 'dash-1',
        name: 'Sales',
        widgets: [],
        reports: [],
      };
      prisma.dashboard.findUnique.mockResolvedValue(dashboard);

      const result = await repository.getDashboard('dash-1');

      expect(prisma.dashboard.findUnique).toHaveBeenCalledWith({
        where: { id: 'dash-1' },
        include: { widgets: true, reports: true },
      });
      expect(result).toEqual(dashboard);
    });

    it('returns null when dashboard not found', async () => {
      prisma.dashboard.findUnique.mockResolvedValue(null);

      const result = await repository.getDashboard('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listDashboards()', () => {
    it('lists dashboards for org', async () => {
      const dashboards = [{ id: 'dash-1', orgId: 'org-1', widgets: [] }];
      prisma.dashboard.findMany.mockResolvedValue(dashboards);

      const result = await repository.listDashboards({ orgId: 'org-1' });

      expect(prisma.dashboard.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        include: { widgets: true },
      });
      expect(result).toEqual(dashboards);
    });

    it('filters by userId when provided', async () => {
      prisma.dashboard.findMany.mockResolvedValue([]);

      await repository.listDashboards({
        orgId: 'org-1',
        userId: 'user-1',
      });

      expect(prisma.dashboard.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', userId: 'user-1' },
        include: { widgets: true },
      });
    });
  });

  describe('updateDashboard()', () => {
    it('updates a dashboard', async () => {
      const updated = { id: 'dash-1', name: 'Updated Dashboard' };
      prisma.dashboard.update.mockResolvedValue(updated);

      const result = await repository.updateDashboard('dash-1', {
        name: 'Updated Dashboard',
      });

      expect(prisma.dashboard.update).toHaveBeenCalledWith({
        where: { id: 'dash-1' },
        data: { name: 'Updated Dashboard' },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteDashboard()', () => {
    it('deletes a dashboard', async () => {
      prisma.dashboard.delete.mockResolvedValue({ id: 'dash-1' });

      const result = await repository.deleteDashboard('dash-1');

      expect(prisma.dashboard.delete).toHaveBeenCalledWith({
        where: { id: 'dash-1' },
      });
      expect(result).toEqual({ id: 'dash-1' });
    });
  });

  // ===== Reports =====
  describe('createReport()', () => {
    it('creates a report', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        name: 'Monthly Report',
        type: 'summary',
        query: { period: 'monthly' },
      };
      const expected = { id: 'report-1', ...data };
      prisma.report.create.mockResolvedValue(expected);

      const result = await repository.createReport(data);

      expect(prisma.report.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });
  });

  describe('getReport()', () => {
    it('fetches a report with recent executions', async () => {
      const report = {
        id: 'report-1',
        executions: [{ id: 'exec-1', status: 'completed' }],
      };
      prisma.report.findUnique.mockResolvedValue(report);

      const result = await repository.getReport('report-1');

      expect(prisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        include: { executions: { orderBy: { startedAt: 'desc' }, take: 10 } },
      });
      expect(result).toEqual(report);
    });

    it('returns null when report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      const result = await repository.getReport('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listReports()', () => {
    it('lists reports for org', async () => {
      const reports = [{ id: 'report-1' }];
      prisma.report.findMany.mockResolvedValue(reports);

      const result = await repository.listReports({ orgId: 'org-1' });

      expect(prisma.report.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
      });
      expect(result).toEqual(reports);
    });

    it('filters by userId when provided', async () => {
      prisma.report.findMany.mockResolvedValue([]);

      await repository.listReports({ orgId: 'org-1', userId: 'user-1' });

      expect(prisma.report.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', userId: 'user-1' },
      });
    });
  });

  describe('updateReport()', () => {
    it('updates a report', async () => {
      const updated = { id: 'report-1', name: 'Updated Report' };
      prisma.report.update.mockResolvedValue(updated);

      const result = await repository.updateReport('report-1', {
        name: 'Updated Report',
      });

      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: { name: 'Updated Report' },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('createReportExecution()', () => {
    it('creates a report execution record', async () => {
      const data = {
        reportId: 'report-1',
        status: 'completed',
        result: { rows: 100 },
      };
      const expected = { id: 'exec-1', ...data };
      prisma.reportExecution.create.mockResolvedValue(expected);

      const result = await repository.createReportExecution(data);

      expect(prisma.reportExecution.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });

    it('creates an execution with error', async () => {
      const data = {
        reportId: 'report-1',
        status: 'failed',
        error: 'Timeout exceeded',
      };
      prisma.reportExecution.create.mockResolvedValue({
        id: 'exec-2',
        ...data,
      });

      const result = await repository.createReportExecution(data);

      expect(result.error).toBe('Timeout exceeded');
    });
  });

  describe('createPerformanceLog()', () => {
    it('creates a performance log entry', async () => {
      const data = {
        service: 'api-gateway',
        endpoint: '/api/v1/sessions',
        method: 'GET',
        statusCode: 200,
        duration: 45,
      };
      const expected = { id: 'perf-1', ...data };
      prisma.performanceLog.create.mockResolvedValue(expected);

      const result = await repository.createPerformanceLog(data);

      expect(prisma.performanceLog.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });

    it('creates a performance log with optional fields', async () => {
      const data = {
        service: 'api-gateway',
        endpoint: '/api/v1/sessions',
        method: 'POST',
        statusCode: 201,
        duration: 120,
        userId: 'user-1',
        orgId: 'org-1',
        metadata: { requestSize: 1024 },
      };
      prisma.performanceLog.create.mockResolvedValue({ id: 'perf-2', ...data });

      const result = await repository.createPerformanceLog(data);

      expect(result.userId).toBe('user-1');
    });
  });
});
