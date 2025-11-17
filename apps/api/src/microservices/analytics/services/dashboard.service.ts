import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async createDashboard(data: {
    orgId: string;
    userId?: string;
    name: string;
    type: string;
    config: Record<string, any>;
    layout?: Record<string, any>;
  }) {
    return this.repository.createDashboard(data);
  }

  async getDashboard(dashboardId: string) {
    return this.repository.getDashboard(dashboardId);
  }

  async listDashboards(data: { orgId: string; userId?: string }) {
    return this.repository.listDashboards(data);
  }

  async updateDashboard(
    dashboardId: string,
    data: Partial<{
      name: string;
      config: Record<string, any>;
      layout: Record<string, any>;
    }>,
  ) {
    return this.repository.updateDashboard(dashboardId, data);
  }

  async deleteDashboard(dashboardId: string) {
    return this.repository.deleteDashboard(dashboardId);
  }
}
