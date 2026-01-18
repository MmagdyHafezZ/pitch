import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsArray,
} from 'class-validator';

export enum ReportType {
  PIPELINE = 'PIPELINE',
  ACTIVITY = 'ACTIVITY',
  SALES = 'SALES',
  CUSTOM = 'CUSTOM',
}

export enum ReportStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  GENERATED = 'GENERATED',
  FAILED = 'FAILED',
}

export class ReportColumnDto {
  @ApiProperty({ example: 'name' })
  @IsString()
  field: string;

  @ApiPropertyOptional({ example: 'Opportunity Name' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  width?: number;
}

export class ReportFilterDto {
  @ApiProperty({ example: 'stage' })
  @IsString()
  field: string;

  @ApiProperty({
    example: 'equals',
    enum: [
      'equals',
      'not_equals',
      'contains',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'between',
    ],
  })
  @IsString()
  operator: string;

  @ApiProperty({ example: 'CLOSED_WON' })
  value: any;
}

export class ReportGroupByDto {
  @ApiProperty({ example: 'ownerId' })
  @IsString()
  field: string;

  @ApiPropertyOptional({
    example: 'month',
    enum: ['day', 'week', 'month', 'quarter', 'year'],
  })
  @IsString()
  @IsOptional()
  dateInterval?: string;
}

export class ReportSortDto {
  @ApiProperty({ example: 'amount' })
  @IsString()
  field: string;

  @ApiProperty({ example: 'desc', enum: ['asc', 'desc'] })
  @IsString()
  direction: 'asc' | 'desc';
}

export class CreateReportDto {
  @ApiProperty({ example: 'Monthly Sales Report', description: 'Report name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Sales performance by rep for the month',
    description: 'Report description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ReportType, description: 'Report type' })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiPropertyOptional({ description: 'Report configuration/query parameters' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({
    type: [ReportColumnDto],
    description: 'Columns to include',
  })
  @IsArray()
  @IsOptional()
  columns?: ReportColumnDto[];

  @ApiPropertyOptional({
    type: [ReportFilterDto],
    description: 'Filters to apply',
  })
  @IsArray()
  @IsOptional()
  filters?: ReportFilterDto[];

  @ApiPropertyOptional({
    type: [ReportGroupByDto],
    description: 'Group by configuration',
  })
  @IsArray()
  @IsOptional()
  groupBy?: ReportGroupByDto[];

  @ApiPropertyOptional({
    type: [ReportSortDto],
    description: 'Sort configuration',
  })
  @IsArray()
  @IsOptional()
  sortBy?: ReportSortDto[];

  @ApiPropertyOptional({ description: 'Enable scheduling', default: false })
  @IsBoolean()
  @IsOptional()
  isScheduled?: boolean;

  @ApiPropertyOptional({
    example: '0 9 * * 1',
    description: 'Cron expression for scheduling',
  })
  @IsString()
  @IsOptional()
  scheduleExpr?: string;

  @ApiPropertyOptional({
    description: 'Make report public to organization',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class UpdateReportDto extends PartialType(CreateReportDto) {}

export class ReportResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ example: 'Monthly Sales Report' })
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ReportType })
  type: ReportType;

  @ApiPropertyOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ type: [ReportColumnDto] })
  columns?: ReportColumnDto[];

  @ApiPropertyOptional({ type: [ReportFilterDto] })
  filters?: ReportFilterDto[];

  @ApiPropertyOptional({ type: [ReportGroupByDto] })
  groupBy?: ReportGroupByDto[];

  @ApiPropertyOptional({ type: [ReportSortDto] })
  sortBy?: ReportSortDto[];

  @ApiProperty({ example: false })
  isScheduled: boolean;

  @ApiPropertyOptional({ example: '0 9 * * 1' })
  scheduleExpr?: string;

  @ApiPropertyOptional()
  lastRunAt?: Date;

  @ApiPropertyOptional()
  nextRunAt?: Date;

  @ApiProperty({ enum: ReportStatus })
  status: ReportStatus;

  @ApiPropertyOptional()
  lastResult?: Record<string, any>;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  createdById?: string;

  @ApiProperty({ example: false })
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ReportListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ReportType })
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @ApiPropertyOptional({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiPropertyOptional({ description: 'Filter by scheduled reports' })
  @IsBoolean()
  @IsOptional()
  isScheduled?: boolean;

  @ApiPropertyOptional({ description: 'Include public reports', default: true })
  @IsBoolean()
  @IsOptional()
  includePublic?: boolean;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class RunReportDto {
  @ApiPropertyOptional({ description: 'Override filters for this run' })
  @IsArray()
  @IsOptional()
  filters?: ReportFilterDto[];

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ['json', 'csv', 'xlsx'],
  })
  @IsString()
  @IsOptional()
  format?: 'json' | 'csv' | 'xlsx';
}

export class ReportResultDto {
  @ApiProperty({ description: 'Report data rows' })
  data: any[];

  @ApiProperty({ example: 150, description: 'Total row count' })
  totalCount: number;

  @ApiPropertyOptional({ description: 'Summary/aggregations' })
  summary?: Record<string, any>;

  @ApiProperty({ description: 'When the report was generated' })
  generatedAt: Date;
}
