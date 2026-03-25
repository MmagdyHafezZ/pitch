import { AnalyticsService } from '../services/analytics.service';

describe('AnalyticsService', () => {
  const repository = {
    getStatistics: jest.fn(),
    trackEvent: jest.fn(),
    getEvents: jest.fn(),
  };

  const service = new AnalyticsService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatistics()', () => {
    it('delegates to repository with all parameters', async () => {
      const data = {
        orgId: 'org-1',
        period: 'daily',
        periodKey: '2026-01-15',
        metricType: 'performance',
      };
      const stats = [{ id: 'stat-1', aggregates: { count: 10 } }];
      repository.getStatistics.mockResolvedValue(stats);

      const result = await service.getStatistics(data);

      expect(repository.getStatistics).toHaveBeenCalledWith(data);
      expect(result).toEqual(stats);
    });

    it('works without optional metricType', async () => {
      const data = {
        orgId: 'org-1',
        period: 'weekly',
        periodKey: '2026-W03',
      };
      repository.getStatistics.mockResolvedValue([]);

      const result = await service.getStatistics(data);

      expect(repository.getStatistics).toHaveBeenCalledWith(data);
      expect(result).toEqual([]);
    });

    it('propagates repository errors', async () => {
      repository.getStatistics.mockRejectedValue(new Error('DB error'));

      await expect(
        service.getStatistics({
          orgId: 'org-1',
          period: 'daily',
          periodKey: '2026-01-15',
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('trackEvent()', () => {
    it('delegates to repository with required fields', async () => {
      const data = {
        orgId: 'org-1',
        eventType: 'user_action',
        eventName: 'button_click',
      };
      const created = { id: 'event-1', ...data };
      repository.trackEvent.mockResolvedValue(created);

      const result = await service.trackEvent(data);

      expect(repository.trackEvent).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });

    it('passes all optional fields through', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'system',
        eventName: 'error_occurred',
        properties: { errorCode: 500 },
        context: { browser: 'Chrome' },
      };
      repository.trackEvent.mockResolvedValue({ id: 'event-2', ...data });

      const result = await service.trackEvent(data);

      expect(repository.trackEvent).toHaveBeenCalledWith(data);
      expect(result.properties).toEqual({ errorCode: 500 });
    });

    it('propagates repository errors', async () => {
      repository.trackEvent.mockRejectedValue(new Error('Connection lost'));

      await expect(
        service.trackEvent({
          orgId: 'org-1',
          eventType: 'test',
          eventName: 'test',
        }),
      ).rejects.toThrow('Connection lost');
    });
  });

  describe('getEvents()', () => {
    it('delegates to repository with required fields', async () => {
      const data = { orgId: 'org-1' };
      const events = [{ id: 'event-1' }, { id: 'event-2' }];
      repository.getEvents.mockResolvedValue(events);

      const result = await service.getEvents(data);

      expect(repository.getEvents).toHaveBeenCalledWith(data);
      expect(result).toHaveLength(2);
    });

    it('passes all optional filters through', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        eventType: 'user_action',
        startDate,
        endDate,
      };
      repository.getEvents.mockResolvedValue([]);

      await service.getEvents(data);

      expect(repository.getEvents).toHaveBeenCalledWith(data);
    });

    it('returns empty array when no events match', async () => {
      repository.getEvents.mockResolvedValue([]);

      const result = await service.getEvents({ orgId: 'org-empty' });

      expect(result).toEqual([]);
    });

    it('propagates repository errors', async () => {
      repository.getEvents.mockRejectedValue(new Error('Timeout'));

      await expect(service.getEvents({ orgId: 'org-1' })).rejects.toThrow(
        'Timeout',
      );
    });
  });
});
