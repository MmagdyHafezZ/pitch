import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';

export enum ActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
}

export enum ActivityStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ActivityPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

export enum ActivityOutcome {
  SUCCESSFUL = 'successful',
  UNSUCCESSFUL = 'unsuccessful',
  NO_ANSWER = 'no_answer',
  LEFT_MESSAGE = 'left_message',
}

export class CreateActivityDto {
  @ApiProperty({ enum: ActivityType, description: 'Type of activity' })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({
    example: 'Discovery call with John',
    description: 'Activity subject',
  })
  @IsString()
  subject: string;

  @ApiPropertyOptional({
    example: 'Discussed pricing and timeline...',
    description: 'Activity description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ActivityStatus,
    default: ActivityStatus.SCHEDULED,
  })
  @IsEnum(ActivityStatus)
  @IsOptional()
  status?: ActivityStatus;

  @ApiPropertyOptional({
    enum: ActivityPriority,
    default: ActivityPriority.NORMAL,
  })
  @IsEnum(ActivityPriority)
  @IsOptional()
  priority?: ActivityPriority;

  @ApiPropertyOptional({
    example: '2024-03-20T14:00:00Z',
    description: 'Due date and time',
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ example: 30, description: 'Duration in minutes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ description: 'Associated contact ID' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Associated account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Associated opportunity ID' })
  @IsString()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Custom fields' })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @ApiPropertyOptional({
    enum: ActivityOutcome,
    description: 'Activity outcome',
  })
  @IsEnum(ActivityOutcome)
  @IsOptional()
  outcome?: ActivityOutcome;

  @ApiPropertyOptional({
    example: '2024-03-20T15:30:00Z',
    description: 'Completion date',
  })
  @IsDateString()
  @IsOptional()
  completedAt?: string;
}

export class CompleteActivityDto {
  @ApiProperty({ enum: ActivityOutcome, description: 'Activity outcome' })
  @IsEnum(ActivityOutcome)
  outcome: ActivityOutcome;

  @ApiPropertyOptional({ description: 'Additional notes on completion' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'Actual duration in minutes',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  actualDuration?: number;
}

export class ActivityResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ enum: ActivityType })
  type: ActivityType;

  @ApiProperty({ example: 'Discovery call with John' })
  subject: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ActivityStatus })
  status: ActivityStatus;

  @ApiProperty({ enum: ActivityPriority })
  priority: ActivityPriority;

  @ApiPropertyOptional()
  dueDate?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional({ example: 30 })
  duration?: number;

  @ApiPropertyOptional()
  contactId?: string;

  @ApiPropertyOptional()
  accountId?: string;

  @ApiPropertyOptional()
  opportunityId?: string;

  @ApiPropertyOptional()
  assignedToId?: string;

  @ApiPropertyOptional()
  createdById?: string;

  @ApiPropertyOptional({ enum: ActivityOutcome })
  outcome?: ActivityOutcome;

  @ApiPropertyOptional()
  customFields?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ActivityListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: ActivityType })
  @IsEnum(ActivityType)
  @IsOptional()
  type?: ActivityType;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsEnum(ActivityStatus)
  @IsOptional()
  status?: ActivityStatus;

  @ApiPropertyOptional({ enum: ActivityPriority })
  @IsEnum(ActivityPriority)
  @IsOptional()
  priority?: ActivityPriority;

  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by opportunity ID' })
  @IsString()
  @IsOptional()
  opportunityId?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Due date from' })
  @IsDateString()
  @IsOptional()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Due date to' })
  @IsDateString()
  @IsOptional()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'dueDate' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
