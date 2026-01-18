import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';

export enum GoalPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum GoalMetric {
  REVENUE = 'revenue',
  DEALS = 'deals',
  CALLS = 'calls',
  MEETINGS = 'meetings',
}

export class CreateSalesGoalDto {
  @ApiProperty({ example: 'Q1 2024 Revenue Target', description: 'Goal name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'User ID (null for org-wide goal)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ example: 100000, description: 'Target amount' })
  @IsNumber()
  @Min(0)
  targetAmount: number;

  @ApiProperty({ enum: GoalPeriod, description: 'Goal period' })
  @IsEnum(GoalPeriod)
  period: GoalPeriod;

  @ApiProperty({ example: '2024-01-01', description: 'Goal start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-03-31', description: 'Goal end date' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency code',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    enum: GoalMetric,
    description: 'Metric type',
    default: GoalMetric.REVENUE,
  })
  @IsEnum(GoalMetric)
  @IsOptional()
  metric?: GoalMetric;
}

export class UpdateSalesGoalDto extends PartialType(CreateSalesGoalDto) {
  @ApiPropertyOptional({ example: 45000, description: 'Current actual amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualAmount?: number;
}

export class SalesGoalResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty({ example: 'Q1 2024 Revenue Target' })
  name: string;

  @ApiProperty({ example: 100000 })
  targetAmount: number;

  @ApiProperty({ example: 45000 })
  actualAmount: number;

  @ApiProperty({ enum: GoalPeriod })
  period: GoalPeriod;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ enum: GoalMetric })
  metric: GoalMetric;

  @ApiProperty({ example: 45, description: 'Progress percentage' })
  progressPercentage: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SalesGoalListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Show org-wide goals only',
    default: false,
  })
  @IsOptional()
  orgWideOnly?: boolean;

  @ApiPropertyOptional({ enum: GoalPeriod })
  @IsEnum(GoalPeriod)
  @IsOptional()
  period?: GoalPeriod;

  @ApiPropertyOptional({ enum: GoalMetric })
  @IsEnum(GoalMetric)
  @IsOptional()
  metric?: GoalMetric;

  @ApiPropertyOptional({
    description: 'Show active goals (current date within range)',
    default: false,
  })
  @IsOptional()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Sort field', default: 'startDate' })
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
