import { DashboardService } from '../services/dashboard.service';

describe('DashboardService', () => {
  const repository = {
    createDashboard: jest.fn(),
    getDashboard: jest.fn(),
    listDashboards: jest.fn(),
    updateDashboard: jest.fn(),
    deleteDashboard: jest.fn(),
  };

  const service = new DashboardService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDashboard()', () => {
    it('creates a dashboard via repository', async () => {
      const data = {
        orgId: 'org-1',
        name: 'Sales Dashboard',
        type: 'overview',
        config: { widgets: ['chart', 'table'] },
      };
      const created = { id: 'dash-1', ...data };
      repository.createDashboard.mockResolvedValue(created);

      const result = await service.createDashboard(data);

      expect(repository.createDashboard).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });

    it('passes optional userId and layout', async () => {
      const data = {
        orgId: 'org-1',
        userId: 'user-1',
        name: 'Custom Dashboard',
        type: 'custom',
        config: { theme: 'dark' },
        layout: { columns: 3, rows: 2 },
      };
      repository.createDashboard.mockResolvedValue({ id: 'dash-2', ...data });

      const result = await service.createDashboard(data);

      expect(repository.createDashboard).toHaveBeenCalledWith(data);
      expect(result.layout).toEqual({ columns: 3, rows: 2 });
    });

    it('propagates repository errors', async () => {
      repository.createDashboard.mockRejectedValue(new Error('Duplicate name'));

      await expect(
        service.createDashboard({
          orgId: 'org-1',
          name: 'Dup',
          type: 'overview',
          config: {},
        }),
      ).rejects.toThrow('Duplicate name');
    });
  });

  describe('getDashboard()', () => {
    it('fetches a dashboard by id', async () => {
      const dashboard = {
        id: 'dash-1',
        name: 'Sales',
        widgets: [{ id: 'w-1' }],
        reports: [],
      };
      repository.getDashboard.mockResolvedValue(dashboard);

      const result = await service.getDashboard('dash-1');

      expect(repository.getDashboard).toHaveBeenCalledWith('dash-1');
      expect(result).toEqual(dashboard);
    });

    it('returns null when dashboard does not exist', async () => {
      repository.getDashboard.mockResolvedValue(null);

      const result = await service.getDashboard('nonexistent');

      expect(result).toBeNull();
    });

    it('propagates repository errors', async () => {
      repository.getDashboard.mockRejectedValue(new Error('Connection error'));

      await expect(service.getDashboard('dash-1')).rejects.toThrow(
        'Connection error',
      );
    });
  });

  describe('listDashboards()', () => {
    it('lists dashboards for an org', async () => {
      const dashboards = [
        { id: 'dash-1', orgId: 'org-1', widgets: [] },
        { id: 'dash-2', orgId: 'org-1', widgets: [] },
      ];
      repository.listDashboards.mockResolvedValue(dashboards);

      const result = await service.listDashboards({ orgId: 'org-1' });

      expect(repository.listDashboards).toHaveBeenCalledWith({
        orgId: 'org-1',
      });
      expect(result).toHaveLength(2);
    });

    it('filters by userId when provided', async () => {
      repository.listDashboards.mockResolvedValue([]);

      await service.listDashboards({ orgId: 'org-1', userId: 'user-1' });

      expect(repository.listDashboards).toHaveBeenCalledWith({
        orgId: 'org-1',
        userId: 'user-1',
      });
    });

    it('returns empty array when no dashboards match', async () => {
      repository.listDashboards.mockResolvedValue([]);

      const result = await service.listDashboards({ orgId: 'org-empty' });

      expect(result).toEqual([]);
    });
  });

  describe('updateDashboard()', () => {
    it('updates dashboard name', async () => {
      const updated = { id: 'dash-1', name: 'Updated' };
      repository.updateDashboard.mockResolvedValue(updated);

      const result = await service.updateDashboard('dash-1', {
        name: 'Updated',
      });

      expect(repository.updateDashboard).toHaveBeenCalledWith('dash-1', {
        name: 'Updated',
      });
      expect(result).toEqual(updated);
    });

    it('updates dashboard config and layout', async () => {
      const data = {
        config: { theme: 'light' },
        layout: { columns: 4 },
      };
      repository.updateDashboard.mockResolvedValue({ id: 'dash-1', ...data });

      const result = await service.updateDashboard('dash-1', data);

      expect(repository.updateDashboard).toHaveBeenCalledWith('dash-1', data);
      expect(result.config).toEqual({ theme: 'light' });
    });

    it('propagates repository errors', async () => {
      repository.updateDashboard.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.updateDashboard('bad-id', { name: 'x' }),
      ).rejects.toThrow('Record not found');
    });
  });

  describe('deleteDashboard()', () => {
    it('deletes a dashboard', async () => {
      repository.deleteDashboard.mockResolvedValue({ id: 'dash-1' });

      const result = await service.deleteDashboard('dash-1');

      expect(repository.deleteDashboard).toHaveBeenCalledWith('dash-1');
      expect(result).toEqual({ id: 'dash-1' });
    });

    it('propagates repository errors', async () => {
      repository.deleteDashboard.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(service.deleteDashboard('bad-id')).rejects.toThrow(
        'Record not found',
      );
    });
  });
});
