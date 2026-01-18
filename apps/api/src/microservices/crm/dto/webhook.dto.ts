import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum WebhookDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum WebhookStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

export enum WebhookEventType {
  // Contact events
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  CONTACT_DELETED = 'contact.deleted',
  // Account events
  ACCOUNT_CREATED = 'account.created',
  ACCOUNT_UPDATED = 'account.updated',
  ACCOUNT_DELETED = 'account.deleted',
  // Opportunity events
  OPPORTUNITY_CREATED = 'opportunity.created',
  OPPORTUNITY_UPDATED = 'opportunity.updated',
  OPPORTUNITY_DELETED = 'opportunity.deleted',
  OPPORTUNITY_STAGE_CHANGED = 'opportunity.stage_changed',
  OPPORTUNITY_WON = 'opportunity.won',
  OPPORTUNITY_LOST = 'opportunity.lost',
  // Activity events
  ACTIVITY_CREATED = 'activity.created',
  ACTIVITY_COMPLETED = 'activity.completed',
  // Task events
  TASK_CREATED = 'task.created',
  TASK_COMPLETED = 'task.completed',
}

export class WebhookEventResponseDto {
  @ApiProperty({ example: 'clx123abc456' })
  id: string;

  @ApiProperty({ example: 'org_123' })
  orgId: string;

  @ApiProperty({ enum: WebhookDirection })
  direction: WebhookDirection;

  @ApiPropertyOptional({ example: 'https://external-system.com/webhook' })
  url?: string;

  @ApiProperty({ example: 'POST' })
  method: string;

  @ApiPropertyOptional()
  headers?: Record<string, string>;

  @ApiProperty({ description: 'Webhook payload' })
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: 'HMAC signature' })
  signature?: string;

  @ApiProperty({ enum: WebhookEventType, example: 'contact.created' })
  eventType: string;

  @ApiPropertyOptional({ example: 'contact' })
  entityType?: string;

  @ApiPropertyOptional({ example: 'clx789def012' })
  entityId?: string;

  @ApiProperty({ enum: WebhookStatus })
  status: WebhookStatus;

  @ApiPropertyOptional({ example: 200 })
  statusCode?: number;

  @ApiPropertyOptional()
  response?: Record<string, any>;

  @ApiPropertyOptional({ example: 'Connection timeout' })
  error?: string;

  @ApiProperty({ example: 0 })
  retryCount: number;

  @ApiPropertyOptional()
  nextRetryAt?: Date;

  @ApiPropertyOptional()
  processedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WebhookEventListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: WebhookDirection })
  @IsEnum(WebhookDirection)
  @IsOptional()
  direction?: WebhookDirection;

  @ApiPropertyOptional({ enum: WebhookEventType })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type' })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ enum: WebhookStatus })
  @IsEnum(WebhookStatus)
  @IsOptional()
  status?: WebhookStatus;

  @ApiPropertyOptional({ description: 'Created after date' })
  @IsDateString()
  @IsOptional()
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'Created before date' })
  @IsDateString()
  @IsOptional()
  createdBefore?: string;

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

export class RetryWebhookDto {
  @ApiPropertyOptional({
    description: 'Force retry even if max retries exceeded',
    default: false,
  })
  @IsOptional()
  force?: boolean;
}
