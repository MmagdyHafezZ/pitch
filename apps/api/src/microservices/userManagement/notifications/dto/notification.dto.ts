import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ArrayMinSize,
  IsMongoId,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  NotificationSeverity,
  NotificationSourceType,
} from '../../mongo/schemas/notification.schema';

export class NotificationDto {
  @ApiProperty({ example: '66c8f0f88c2a0f6a6f0a1234' })
  id: string;

  @ApiProperty({ example: 'user_123' })
  recipientUserId: string;

  @ApiProperty({ example: 'New session invitation' })
  title: string;

  @ApiProperty({ example: 'You have been invited to a session.' })
  message: string;

  @ApiProperty({ example: 'SESSION' })
  type: string;

  @ApiProperty({
    enum: NotificationSeverity,
    example: NotificationSeverity.INFO,
  })
  severity: NotificationSeverity;

  @ApiProperty({
    enum: NotificationSourceType,
    example: NotificationSourceType.SYSTEM,
  })
  sourceType: NotificationSourceType;

  @ApiPropertyOptional({ example: 'user_456' })
  sourceUserId?: string;

  @ApiPropertyOptional({
    example: { sessionId: 'sess_789', teamId: 'team_001' },
    type: 'object',
    additionalProperties: true,
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-01-31T00:00:00.000Z' })
  readAt?: Date | null;

  @ApiProperty({ example: '2026-01-31T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-31T00:00:00.000Z' })
  updatedAt: Date;
}

export class CreateNotificationDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  recipientUserId: string;

  @ApiProperty({ example: 'New session invitation' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'You have been invited to a session.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: 'SESSION' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ enum: NotificationSeverity })
  @IsEnum(NotificationSeverity)
  @IsOptional()
  severity?: NotificationSeverity;

  @ApiProperty({ enum: NotificationSourceType })
  @IsEnum(NotificationSourceType)
  sourceType: NotificationSourceType;

  @ApiPropertyOptional({ example: 'user_456' })
  @ValidateIf(
    (dto: CreateNotificationDto) =>
      dto.sourceType === NotificationSourceType.USER,
  )
  @IsString()
  @IsNotEmpty()
  sourceUserId?: string;

  @ApiPropertyOptional({
    type: 'object',
    example: { sessionId: 'sess_789' },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateNotificationBatchDto {
  @ApiProperty({ example: ['user_123', 'user_456'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  recipientUserIds: string[];

  @ApiProperty({ example: 'System maintenance' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Planned maintenance starts at 02:00 UTC.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: 'SYSTEM' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ enum: NotificationSeverity })
  @IsEnum(NotificationSeverity)
  @IsOptional()
  severity?: NotificationSeverity;

  @ApiProperty({ enum: NotificationSourceType })
  @IsEnum(NotificationSourceType)
  sourceType: NotificationSourceType;

  @ApiPropertyOptional({ example: 'user_789' })
  @ValidateIf(
    (dto: CreateNotificationBatchDto) =>
      dto.sourceType === NotificationSourceType.USER,
  )
  @IsString()
  @IsNotEmpty()
  sourceUserId?: string;

  @ApiPropertyOptional({
    type: 'object',
    example: { window: '02:00-02:30 UTC' },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ example: 'user_123' })
  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ example: 'SESSION' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class MarkReadDto {
  @ApiProperty({ example: ['66c8f0f88c2a0f6a6f0a1234'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  notificationIds: string[];

  @ApiPropertyOptional({ example: 'user_123' })
  @IsOptional()
  @IsString()
  recipientUserId?: string;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  count: number;
}

export class ListNotificationsResponseDto {
  @ApiProperty({ type: [NotificationDto] })
  data: NotificationDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 0 })
  skip: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class BatchCreateResponseDto {
  @ApiProperty({ example: 2 })
  insertedCount: number;

  @ApiProperty({ type: [NotificationDto] })
  notifications: NotificationDto[];
}

export class MarkReadResponseDto {
  @ApiProperty({ example: 2 })
  matched: number;

  @ApiProperty({ example: 2 })
  modified: number;
}
