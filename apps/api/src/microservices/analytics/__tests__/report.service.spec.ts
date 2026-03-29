import { ReportService } from '../services/report.service';

describe('ReportService', () => {
  const repository = {
    createReport: jest.fn(),
    createReportExecution: jest.fn(),
    getReport: jest.fn(),
    listReports: jest.fn(),
  };

  const service = new ReportService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport()', () => {
    it('creates a report and its execution', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        name: 'Monthly Summary',
        type: 'summary',
        query: { period: 'monthly', metrics: ['sessions'] },
      };
      const report = { id: 'report-1', ...data };
      repository.createReport.mockResolvedValue(report);
      repository.createReportExecution.mockResolvedValue({
        id: 'exec-1',
        reportId: 'report-1',
        status: 'completed',
      });

      const result = await service.generateReport(data);

      expect(repository.createReport).toHaveBeenCalledWith(data);
      expect(repository.createReportExecution).toHaveBeenCalledWith({
        reportId: 'report-1',
        status: 'completed',
        result: {},
      });
      expect(result).toEqual(report);
    });

    it('passes optional format through', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        name: 'CSV Export',
        type: 'export',
        query: { table: 'metrics' },
        format: 'csv',
      };
      repository.createReport.mockResolvedValue({ id: 'report-2', ...data });
      repository.createReportExecution.mockResolvedValue({ id: 'exec-2' });

      const result = await service.generateReport(data);

      expect(repository.createReport).toHaveBeenCalledWith(data);
      expect(result.format).toBe('csv');
    });

    it('propagates createReport errors without creating execution', async () => {
      repository.createReport.mockRejectedValue(new Error('Insert failed'));

      await expect(
        service.generateReport({
          orgId: 'org-1',
          userId: 'user-1',
          name: 'Bad Report',
          type: 'summary',
          query: {},
        }),
      ).rejects.toThrow('Insert failed');

      expect(repository.createReportExecution).not.toHaveBeenCalled();
    });

    it('propagates createReportExecution errors after report is created', async () => {
      repository.createReport.mockResolvedValue({ id: 'report-3' });
      repository.createReportExecution.mockRejectedValue(
        new Error('Execution insert failed'),
      );

      await expect(
        service.generateReport({
          orgId: 'org-1',
          userId: 'user-1',
          name: 'Report',
          type: 'summary',
          query: {},
        }),
      ).rejects.toThrow('Execution insert failed');
    });
  });

  describe('scheduleReport()', () => {
    it('retrieves the report by id', async () => {
      const report = { id: 'report-1', name: 'Scheduled Report' };
      repository.getReport.mockResolvedValue(report);

      const result = await service.scheduleReport({
        reportId: 'report-1',
        schedule: '0 9 * * 1',
      });

      expect(repository.getReport).toHaveBeenCalledWith('report-1');
      expect(result).toEqual(report);
    });

    it('returns null when report does not exist', async () => {
      repository.getReport.mockResolvedValue(null);

      const result = await service.scheduleReport({
        reportId: 'nonexistent',
        schedule: '0 9 * * 1',
      });

      expect(result).toBeNull();
    });

    it('propagates repository errors', async () => {
      repository.getReport.mockRejectedValue(new Error('DB error'));

      await expect(
        service.scheduleReport({
          reportId: 'report-1',
          schedule: 'bad',
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('getReport()', () => {
    it('fetches a report by id', async () => {
      const report = {
        id: 'report-1',
        name: 'Monthly',
        executions: [{ id: 'exec-1', status: 'completed' }],
      };
      repository.getReport.mockResolvedValue(report);

      const result = await service.getReport('report-1');

      expect(repository.getReport).toHaveBeenCalledWith('report-1');
      expect(result).toEqual(report);
    });

    it('returns null when report not found', async () => {
      repository.getReport.mockResolvedValue(null);

      const result = await service.getReport('nonexistent');

      expect(result).toBeNull();
    });

    it('propagates repository errors', async () => {
      repository.getReport.mockRejectedValue(new Error('Connection lost'));

      await expect(service.getReport('report-1')).rejects.toThrow(
        'Connection lost',
      );
    });
  });

  describe('listReports()', () => {
    it('lists reports for an org', async () => {
      const reports = [{ id: 'report-1' }, { id: 'report-2' }];
      repository.listReports.mockResolvedValue(reports);

      const result = await service.listReports({ orgId: 'org-1' });

      expect(repository.listReports).toHaveBeenCalledWith({ orgId: 'org-1' });
      expect(result).toHaveLength(2);
    });

    it('filters by userId when provided', async () => {
      repository.listReports.mockResolvedValue([]);

      await service.listReports({ orgId: 'org-1', userId: 'user-1' });

      expect(repository.listReports).toHaveBeenCalledWith({
        orgId: 'org-1',
        userId: 'user-1',
      });
    });

    it('returns empty array when no reports exist', async () => {
      repository.listReports.mockResolvedValue([]);

      const result = await service.listReports({ orgId: 'org-empty' });

      expect(result).toEqual([]);
    });

    it('propagates repository errors', async () => {
      repository.listReports.mockRejectedValue(new Error('Query failed'));

      await expect(service.listReports({ orgId: 'org-1' })).rejects.toThrow(
        'Query failed',
      );
    });
  });
});
