import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getStatistics(data: {
    orgId: string;
    period: string;
    periodKey: string;
    metricType?: string;
  }) {
    return this.repository.getStatistics(data);
  }

  async trackEvent(data: {
    orgId: string;
    userId?: string;
    sessionId?: string;
    eventType: string;
    eventName: string;
    properties?: Record<string, any>;
    context?: Record<string, any>;
  }) {
    return this.repository.trackEvent(data);
  }

  async getEvents(data: {
    orgId: string;
    userId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.repository.getEvents(data);
  }
}
