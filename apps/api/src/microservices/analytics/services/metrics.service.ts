import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class MetricsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async recordMetric(data: {
    orgId: string;
    userId?: string;
    sessionId?: string;
    metricType: string;
    category: string;
    name: string;
    value: number;
    unit?: string;
    metadata?: Record<string, any>;
  }) {
    return this.repository.createMetric(data);
  }

  async queryMetrics(data: {
    orgId: string;
    userId?: string;
    metricType?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.repository.queryMetrics(data);
  }

  async aggregateMetrics(data: {
    orgId: string;
    period: string;
    periodKey: string;
    metricType: string;
    category: string;
  }) {
    return this.repository.aggregateMetrics(data);
  }
}
