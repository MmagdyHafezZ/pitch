import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class ReportService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async generateReport(data: {
    orgId: string;
    userId: string;
    name: string;
    type: string;
    query: Record<string, any>;
    format?: string;
  }) {
    const report = await this.repository.createReport(data);
    // Execute report logic here
    await this.repository.createReportExecution({
      reportId: report.id,
      status: 'completed',
      resultData: {}, // Add actual report data
    });
    return report;
  }

  async scheduleReport(data: { reportId: string; schedule: string }) {
    return this.repository.updateReport(data.reportId, {
      schedule: data.schedule,
      status: 'active',
    });
  }

  async getReport(reportId: string) {
    return this.repository.getReport(reportId);
  }

  async listReports(data: { orgId: string; userId?: string }) {
    return this.repository.listReports(data);
  }
}
