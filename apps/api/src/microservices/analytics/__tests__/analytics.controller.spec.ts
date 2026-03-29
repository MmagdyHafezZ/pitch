import { AnalyticsController } from '../controllers/analytics.controller';

describe('AnalyticsController', () => {
  const analyticsService = {
    getStatistics: jest.fn(),
    trackEvent: jest.fn(),
  };

  const metricsService = {
    recordMetric: jest.fn(),
    queryMetrics: jest.fn(),
    aggregateMetrics: jest.fn(),
  };

  const dashboardService = {
    createDashboard: jest.fn(),
    getDashboard: jest.fn(),
    listDashboards: jest.fn(),
  };

  const reportService = {
    generateReport: jest.fn(),
    scheduleReport: jest.fn(),
    getReport: jest.fn(),
  };

  const controller = new AnalyticsController(
    analyticsService as never,
    metricsService as never,
    dashboardService as never,
    reportService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('health()', () => {
    it('returns ok status with service name', () => {
      const result = controller.health();

      expect(result).toEqual({ status: 'ok', service: 'analytics' });
    });
  });

  // ===== Metrics =====
  describe('recordMetric()', () => {
    it('delegates to metricsService.recordMetric', async () => {
      const data = {
        orgId: 'org-1',
        metricType: 'performance',
        category: 'api',
        name: 'latency',
        value: 100,
      };
      const created = { id: 'metric-1', ...data };
      metricsService.recordMetric.mockResolvedValue(created);

      const result = await controller.recordMetric(data);

      expect(metricsService.recordMetric).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });
  });

  describe('queryMetrics()', () => {
    it('delegates to metricsService.queryMetrics', async () => {
      const data = { orgId: 'org-1', metricType: 'performance' };
      const metrics = [{ id: 'metric-1' }];
      metricsService.queryMetrics.mockResolvedValue(metrics);

      const result = await controller.queryMetrics(data);

      expect(metricsService.queryMetrics).toHaveBeenCalledWith(data);
      expect(result).toEqual(metrics);
    });
  });

  describe('aggregateMetrics()', () => {
    it('delegates to metricsService.aggregateMetrics', async () => {
      const data = {
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
        metricType: 'usage',
        category: 'sessions',
      };
      const stat = { id: 'stat-1', aggregates: {} };
      metricsService.aggregateMetrics.mockResolvedValue(stat);

      const result = await controller.aggregateMetrics(data);

      expect(metricsService.aggregateMetrics).toHaveBeenCalledWith(data);
      expect(result).toEqual(stat);
    });
  });

  // ===== Dashboards =====
  describe('createDashboard()', () => {
    it('delegates to dashboardService.createDashboard', async () => {
      const data = {
        orgId: 'org-1',
        name: 'Sales Dashboard',
        type: 'overview',
        config: { widgets: [] },
      };
      const created = { id: 'dash-1', ...data };
      dashboardService.createDashboard.mockResolvedValue(created);

      const result = await controller.createDashboard(data);

      expect(dashboardService.createDashboard).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });
  });

  describe('getDashboard()', () => {
    it('delegates to dashboardService.getDashboard with extracted id', async () => {
      const dashboard = { id: 'dash-1', name: 'Sales' };
      dashboardService.getDashboard.mockResolvedValue(dashboard);

      const result = await controller.getDashboard({ dashboardId: 'dash-1' });

      expect(dashboardService.getDashboard).toHaveBeenCalledWith('dash-1');
      expect(result).toEqual(dashboard);
    });
  });

  describe('listDashboards()', () => {
    it('delegates to dashboardService.listDashboards', async () => {
      const data = { orgId: 'org-1' };
      const dashboards = [{ id: 'dash-1' }];
      dashboardService.listDashboards.mockResolvedValue(dashboards);

      const result = await controller.listDashboards(data);

      expect(dashboardService.listDashboards).toHaveBeenCalledWith(data);
      expect(result).toEqual(dashboards);
    });

    it('passes optional userId filter', async () => {
      const data = { orgId: 'org-1', userId: 'user-1' };
      dashboardService.listDashboards.mockResolvedValue([]);

      await controller.listDashboards(data);

      expect(dashboardService.listDashboards).toHaveBeenCalledWith(data);
    });
  });

  // ===== Reports =====
  describe('generateReport()', () => {
    it('delegates to reportService.generateReport', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        name: 'Monthly Report',
        type: 'summary',
        query: { period: 'monthly' },
      };
      const report = { id: 'report-1', ...data };
      reportService.generateReport.mockResolvedValue(report);

      const result = await controller.generateReport(data);

      expect(reportService.generateReport).toHaveBeenCalledWith(data);
      expect(result).toEqual(report);
    });
  });

  describe('scheduleReport()', () => {
    it('delegates to reportService.scheduleReport', async () => {
      const data = { reportId: 'report-1', schedule: '0 9 * * 1' };
      const report = { id: 'report-1', name: 'Scheduled' };
      reportService.scheduleReport.mockResolvedValue(report);

      const result = await controller.scheduleReport(data);

      expect(reportService.scheduleReport).toHaveBeenCalledWith(data);
      expect(result).toEqual(report);
    });
  });

  describe('getReport()', () => {
    it('delegates to reportService.getReport with extracted id', async () => {
      const report = { id: 'report-1', name: 'Monthly' };
      reportService.getReport.mockResolvedValue(report);

      const result = await controller.getReport({ reportId: 'report-1' });

      expect(reportService.getReport).toHaveBeenCalledWith('report-1');
      expect(result).toEqual(report);
    });
  });

  // ===== Statistics =====
  describe('getStatistics()', () => {
    it('delegates to analyticsService.getStatistics', async () => {
      const data = {
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
      };
      const stats = [{ id: 'stat-1' }];
      analyticsService.getStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics(data);

      expect(analyticsService.getStatistics).toHaveBeenCalledWith(data);
      expect(result).toEqual(stats);
    });

    it('passes optional metricType filter', async () => {
      const data = {
        orgId: 'org-1',
        period: 'weekly',
        periodKey: '2026-W03',
        metricType: 'performance',
      };
      analyticsService.getStatistics.mockResolvedValue([]);

      await controller.getStatistics(data);

      expect(analyticsService.getStatistics).toHaveBeenCalledWith(data);
    });
  });

  // ===== Events =====
  describe('trackEvent()', () => {
    it('delegates to analyticsService.trackEvent', async () => {
      const data = {
        orgId: 'org-1',
        eventType: 'user_action',
        eventName: 'button_click',
      };
      const event = { id: 'event-1', ...data };
      analyticsService.trackEvent.mockResolvedValue(event);

      const result = await controller.trackEvent(data);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(data);
      expect(result).toEqual(event);
    });

    it('passes all optional fields', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'system',
        eventName: 'error_occurred',
        properties: { code: 500 },
        context: { browser: 'Firefox' },
      };
      analyticsService.trackEvent.mockResolvedValue({ id: 'event-2', ...data });

      const result = await controller.trackEvent(data);

      expect(result.properties).toEqual({ code: 500 });
    });
  });
});
