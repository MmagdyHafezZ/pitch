import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Session Type Enum
 */
export enum SessionType {
  text = 'text',
  voice = 'voice',
  video = 'video',
  phone = 'phone',
}

/**
 * Create Session DTO
 *
 * Used to create a new simulation session
 * Note: userId is automatically extracted from JWT token
 */
export class CreateSessionDto {
  @ApiPropertyOptional({
    example: 'Q1 Sales Onboarding',
    description: 'Display name for the session',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'org_456',
    description: 'ID of the organization or team',
  })
  @IsString()
  orgId: string;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'user@example.com', name: 'John Doe' },
    description: 'User snapshot captured at session creation',
  })
  @IsObject()
  @IsOptional()
  userSnapshot?: Record<string, any>;

  @ApiPropertyOptional({
    example: { id: 'org_456', name: 'Acme Corp', region: 'us-east-1' },
    description: 'Organization snapshot captured at session creation',
  })
  @IsObject()
  @IsOptional()
  orgSnapshot?: Record<string, any>;

  @ApiProperty({
    enum: SessionType,
    example: SessionType.text,
    description: 'Type of session (text, voice, video, or phone)',
  })
  @IsEnum(SessionType)
  type: SessionType;

  @ApiPropertyOptional({
    example: ['sales', 'onboarding'],
    description: 'Tags to categorize the session',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    example: { difficulty: 'medium', duration: 30 },
    description: 'Session configuration',
  })
  @IsObject()
  @IsOptional()
  sessionConfig?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'scenario_789',
    description: 'ID of the scenario to use',
  })
  @IsString()
  @IsOptional()
  scenarioId?: string;

  @ApiPropertyOptional({
    example: 'persona_101',
    description: 'ID of the persona to use',
  })
  @IsString()
  @IsOptional()
  personaId?: string;

  @ApiPropertyOptional({
    example: 'en-US',
    description: 'Language for the session',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    example: 'crm_context_123',
    description: 'CRM context ID',
  })
  @IsString()
  @IsOptional()
  crmContextId?: string;
}

/**
 * Update Session DTO
 *
 * Used to update an existing session
 */
export class UpdateSessionDto {
  @ApiPropertyOptional({
    example: 'org_456',
    description: 'ID of the organization or team',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    example: { id: 'org_456', name: 'Acme Corp', region: 'us-east-1' },
    description: 'Organization snapshot captured at session creation',
  })
  @IsObject()
  @IsOptional()
  orgSnapshot?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'Updated Session Name',
    description: 'Display name for the session',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    enum: SessionType,
    example: SessionType.text,
    description: 'Type of session (text, voice, video, or phone)',
  })
  @IsEnum(SessionType)
  @IsOptional()
  type?: SessionType;

  @ApiPropertyOptional({
    example: ['sales', 'onboarding', 'advanced'],
    description: 'Tags to categorize the session',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    example: { difficulty: 'hard', duration: 45 },
    description: 'Session configuration',
  })
  @IsObject()
  @IsOptional()
  sessionConfig?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'scenario_999',
    description: 'ID of the scenario to use',
  })
  @IsString()
  @IsOptional()
  scenarioId?: string;

  @ApiPropertyOptional({
    example: 'persona_202',
    description: 'ID of the persona to use',
  })
  @IsString()
  @IsOptional()
  personaId?: string;

  @ApiPropertyOptional({
    example: 'en-GB',
    description: 'Language for the session',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    example: 'crm_context_123',
    description: 'CRM context ID',
  })
  @IsString()
  @IsOptional()
  crmContextId?: string;

  @ApiPropertyOptional({
    example: 'active',
    description: 'Session status (active or ended)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: 'user_completed',
    description: 'Reason for ending the session',
  })
  @IsString()
  @IsOptional()
  endedReason?: string;
}

/**
 * End Session DTO
 *
 * Used to end a session with an optional reason
 */
export class EndSessionDto {
  @ApiPropertyOptional({
    example: 'user_completed',
    description: 'Reason for ending the session',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * List Sessions Query DTO
 *
 * Used to filter and paginate sessions
 */
export class ListSessionsQueryDto {
  @ApiPropertyOptional({
    example: 'user_123',
    description: 'Filter by user ID',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: 'org_456',
    description: 'Filter by organization ID',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    enum: SessionType,
    example: SessionType.text,
    description: 'Filter by session type',
  })
  @IsEnum(SessionType)
  @IsOptional()
  type?: SessionType;

  @ApiPropertyOptional({
    example: 'active',
    description: 'Filter by status',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: 'scenario_789',
    description: 'Filter by scenario ID',
  })
  @IsString()
  @IsOptional()
  scenarioId?: string;

  @ApiPropertyOptional({
    example: 'persona_101',
    description: 'Filter by persona ID',
  })
  @IsString()
  @IsOptional()
  personaId?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page',
    default: 10,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of items to skip',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

/**
 * Session Response DTO
 *
 * Response format for a single session
 */
export class SessionResponseDto {
  @ApiProperty({ example: 'session_123' })
  id: string;

  @ApiPropertyOptional({ example: 'Q1 Sales Onboarding' })
  name?: string;

  @ApiProperty({ example: 'user_123' })
  userId: string;

  @ApiProperty({ example: 'org_456' })
  orgId: string;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'user@example.com', name: 'John Doe' },
  })
  userSnapshot?: Record<string, any>;

  @ApiPropertyOptional({
    example: { id: 'org_456', name: 'Acme Corp', region: 'us-east-1' },
  })
  orgSnapshot?: Record<string, any>;

  @ApiProperty({ enum: SessionType, example: SessionType.text })
  type: SessionType;

  @ApiProperty({ example: ['sales', 'onboarding'], type: [String] })
  tags: string[];

  @ApiPropertyOptional({
    example: { difficulty: 'medium', duration: 30 },
  })
  sessionConfig?: Record<string, any>;

  @ApiPropertyOptional({ example: 'scenario_789' })
  scenarioId?: string;

  @ApiPropertyOptional({ example: 'persona_101' })
  personaId?: string;

  @ApiPropertyOptional({
    example: {
      id: 'scenario_789',
      name: 'Enterprise Renewal',
      config: { difficulty: 6 },
    },
  })
  scenario?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      id: 'persona_101',
      name: 'Arden - Skeptical CTO',
      traits: {
        avatar: {
          imageUrl: 'https://files2.heygen.ai/example.webp',
          heygenAvatarId: 'Artur_sitting_office_front',
        },
      },
    },
  })
  persona?: Record<string, any>;

  @ApiPropertyOptional({ example: 'en-US' })
  language?: string;

  @ApiPropertyOptional({ example: 'crm_context_123' })
  crmContextId?: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiPropertyOptional({ example: 'user_completed' })
  endedReason?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2024-01-01T00:30:00.000Z' })
  endedAt?: Date;
}

/**
 * Session List Response DTO
 *
 * Response format for a paginated list of sessions
 */
export class SessionListResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  @ValidateNested({ each: true })
  @Type(() => SessionResponseDto)
  sessions: SessionResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;
}

/**
 * Delete Session Response DTO
 *
 * Response format after deleting a session
 */
export class DeleteSessionResponseDto {
  @ApiProperty({ example: 'Session session_123 has been deleted successfully' })
  message: string;

  @ApiProperty({ example: 'session_123' })
  id: string;
}
