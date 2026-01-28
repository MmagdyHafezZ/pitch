export class RecordMetricDto {
  orgId: string;
  userId?: string;
  sessionId?: string;
  metricType: string;
  category: string;
  name: string;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export class QueryMetricsDto {
  orgId: string;
  userId?: string;
  metricType?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AggregateMetricsDto {
  orgId: string;
  period: string;
  periodKey: string;
  metricType: string;
  category: string;
}

export class CreateDashboardDto {
  orgId: string;
  userId?: string;
  name: string;
  type: string;
  config: Record<string, any>;
  layout?: Record<string, any>;
}

export class GenerateReportDto {
  orgId: string;
  userId: string;
  name: string;
  type: string;
  query: Record<string, any>;
  format?: string;
}

export class ScheduleReportDto {
  reportId: string;
  schedule: string;
}

export class GetStatisticsDto {
  orgId: string;
  period: string;
  periodKey: string;
  metricType?: string;
}

export class TrackEventDto {
  orgId: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  properties?: Record<string, any>;
  context?: Record<string, any>;
}
