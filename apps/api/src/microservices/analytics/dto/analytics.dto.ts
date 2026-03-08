import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordMetricDto {
  @IsString()
  orgId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  metricType: string;

  @IsString()
  category: string;

  @IsString()
  name: string;

  @IsNumber()
  @Type(() => Number)
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class QueryMetricsDto {
  @IsString()
  orgId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  metricType?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;
}

export class AggregateMetricsDto {
  @IsString()
  orgId: string;

  @IsString()
  period: string;

  @IsString()
  periodKey: string;

  @IsString()
  metricType: string;

  @IsString()
  category: string;
}

export class CreateDashboardDto {
  @IsString()
  orgId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsObject()
  config: Record<string, any>;

  @IsOptional()
  @IsObject()
  layout?: Record<string, any>;
}

export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsObject()
  layout?: Record<string, any>;
}

export class GenerateReportDto {
  @IsString()
  orgId: string;

  @IsString()
  userId: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsObject()
  query: Record<string, any>;

  @IsOptional()
  @IsString()
  format?: string;
}

export class ScheduleReportDto {
  @IsString()
  reportId: string;

  @IsString()
  schedule: string;
}

export class GetStatisticsDto {
  @IsString()
  orgId: string;

  @IsString()
  period: string;

  @IsString()
  periodKey: string;

  @IsOptional()
  @IsString()
  metricType?: string;
}

export class TrackEventDto {
  @IsString()
  orgId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  eventType: string;

  @IsString()
  eventName: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

export class ListEventsDto {
  @IsString()
  orgId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;
}

export class ListReportsDto {
  @IsString()
  orgId: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class PerformanceLogDto {
  @IsString()
  service: string;

  @IsString()
  endpoint: string;

  @IsString()
  method: string;

  @IsNumber()
  @Type(() => Number)
  statusCode: number;

  @IsNumber()
  @Type(() => Number)
  duration: number;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
