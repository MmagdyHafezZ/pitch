import { MetricsService } from '../services/metrics.service';

describe('MetricsService', () => {
  const repository = {
    createMetric: jest.fn(),
    queryMetrics: jest.fn(),
    aggregateMetrics: jest.fn(),
  };

  const service = new MetricsService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMetric()', () => {
    it('creates a metric via repository', async () => {
      const data = {
        orgId: 'org-1',
        metricType: 'performance',
        category: 'api',
        name: 'latency',
        value: 120,
      };
      const created = { id: 'metric-1', ...data };
      repository.createMetric.mockResolvedValue(created);

      const result = await service.recordMetric(data);

      expect(repository.createMetric).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });

    it('passes all optional fields through', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        sessionId: 'session-1',
        metricType: 'usage',
        category: 'sessions',
        name: 'duration',
        value: 3600,
        unit: 'seconds',
        metadata: { type: 'phone' },
      };
      repository.createMetric.mockResolvedValue({ id: 'metric-2', ...data });

      const result = await service.recordMetric(data);

      expect(repository.createMetric).toHaveBeenCalledWith(data);
      expect(result.unit).toBe('seconds');
      expect(result.metadata).toEqual({ type: 'phone' });
    });

    it('propagates repository errors', async () => {
      repository.createMetric.mockRejectedValue(new Error('Insert failed'));

      await expect(
        service.recordMetric({
          orgId: 'org-1',
          metricType: 'test',
          category: 'test',
          name: 'test',
          value: 0,
        }),
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('queryMetrics()', () => {
    it('queries metrics via repository with required fields', async () => {
      const metrics = [
        { id: 'metric-1', value: 100 },
        { id: 'metric-2', value: 200 },
      ];
      repository.queryMetrics.mockResolvedValue(metrics);

      const result = await service.queryMetrics({ orgId: 'org-1' });

      expect(repository.queryMetrics).toHaveBeenCalledWith({ orgId: 'org-1' });
      expect(result).toHaveLength(2);
    });

    it('passes all optional filters through', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        metricType: 'performance',
        category: 'api',
        startDate,
        endDate,
      };
      repository.queryMetrics.mockResolvedValue([]);

      await service.queryMetrics(data);

      expect(repository.queryMetrics).toHaveBeenCalledWith(data);
    });

    it('returns empty array when no metrics match', async () => {
      repository.queryMetrics.mockResolvedValue([]);

      const result = await service.queryMetrics({ orgId: 'org-empty' });

      expect(result).toEqual([]);
    });

    it('propagates repository errors', async () => {
      repository.queryMetrics.mockRejectedValue(new Error('Query timeout'));

      await expect(service.queryMetrics({ orgId: 'org-1' })).rejects.toThrow(
        'Query timeout',
      );
    });
  });

  describe('aggregateMetrics()', () => {
    it('aggregates metrics via repository', async () => {
      const data = {
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
        metricType: 'performance',
        category: 'api',
      };
      const stat = { id: 'stat-1', ...data, aggregates: { count: 5 } };
      repository.aggregateMetrics.mockResolvedValue(stat);

      const result = await service.aggregateMetrics(data);

      expect(repository.aggregateMetrics).toHaveBeenCalledWith(data);
      expect(result).toEqual(stat);
    });

    it('propagates repository errors', async () => {
      repository.aggregateMetrics.mockRejectedValue(new Error('Upsert failed'));

      await expect(
        service.aggregateMetrics({
          orgId: 'org-1',
          period: 'daily',
          periodKey: '2026-01-15',
          metricType: 'test',
          category: 'test',
        }),
      ).rejects.toThrow('Upsert failed');
    });
  });
});
