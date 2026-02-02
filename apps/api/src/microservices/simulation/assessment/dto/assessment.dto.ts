import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  ValidateIf,
  IsArray,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssessmentModeDto {
  live = 'live',
  final = 'final',
}

export enum AssessmentRunStatusDto {
  queued = 'queued',
  running = 'running',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled',
}

export class AssessmentRunRequestDto {
  @ApiPropertyOptional({
    example: 'session_123',
    description: 'Session id to assess (optional if sessionMemberId provided).',
  })
  @ValidateIf((value: AssessmentRunRequestDto) => !value.sessionMemberId)
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    example: 'session_member_123',
    description:
      'Session member id to assess (optional if sessionId provided).',
  })
  @ValidateIf((value: AssessmentRunRequestDto) => !value.sessionId)
  @IsString()
  sessionMemberId?: string;

  @ApiProperty({ enum: AssessmentModeDto, example: AssessmentModeDto.final })
  @IsEnum(AssessmentModeDto)
  mode: AssessmentModeDto;

  @ApiPropertyOptional({
    example: 'v1',
    description: 'Assessment config version to use.',
  })
  @IsString()
  @IsOptional()
  configVersion?: string;

  @ApiPropertyOptional({
    example: 'user_123',
    description: 'User who requested the assessment.',
  })
  @IsString()
  @IsOptional()
  requestedBy?: string;
}

export class AssessmentRunResponseDto {
  @ApiProperty({ example: 'run_123' })
  @IsString()
  runId: string;

  @ApiProperty({ enum: AssessmentRunStatusDto })
  @IsEnum(AssessmentRunStatusDto)
  status: AssessmentRunStatusDto;

  @ApiProperty({ enum: AssessmentModeDto })
  @IsEnum(AssessmentModeDto)
  mode: AssessmentModeDto;

  @ApiPropertyOptional({ example: 12.5 })
  @IsNumber()
  @IsOptional()
  totalScore?: number;

  @ApiPropertyOptional({ example: 'v1' })
  @IsString()
  @IsOptional()
  configVersion?: string;

  @ApiPropertyOptional({ example: 'langgraph-v1.0' })
  @IsString()
  @IsOptional()
  engineVersion?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  @IsString()
  @IsOptional()
  createdAt?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:30.000Z' })
  @IsString()
  @IsOptional()
  completedAt?: string | null;
}

export class AssessmentSummaryDto {
  @ApiProperty({ example: 12.5 })
  @IsNumber()
  totalScore: number;

  @ApiPropertyOptional({
    example: { PositiveExample: 4, NegativeExample: 2 },
  })
  @IsOptional()
  @IsObject()
  scoreBreakdown?: Record<string, number>;

  @ApiPropertyOptional({ example: 'User met the objective with minor misses.' })
  @IsString()
  @IsOptional()
  narrativeSummary?: string;

  @ApiPropertyOptional({
    example: [{ text: 'Ask more clarifying questions.' }],
  })
  @IsOptional()
  @IsArray()
  coachTips?: Array<{ text: string; link?: string }>;
}

export class AssessmentProgressDto {
  @ApiPropertyOptional({ example: 'judging' })
  @IsString()
  @IsOptional()
  stage?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsNumber()
  @IsOptional()
  percent?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  completedChunks?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  totalChunks?: number;
}

export class AssessmentRunStatusResponseDto extends AssessmentRunResponseDto {
  @ApiPropertyOptional({ type: AssessmentSummaryDto })
  @IsOptional()
  summary?: AssessmentSummaryDto;

  @ApiPropertyOptional({ type: AssessmentProgressDto })
  @IsOptional()
  progress?: AssessmentProgressDto;
}

export class AssessmentReportResponseDto {
  @ApiProperty({ example: 'run_123' })
  @IsString()
  runId: string;

  @ApiProperty({ description: 'Full report payload stored in Mongo.' })
  @IsObject()
  report: Record<string, any>;
}

export class AssessmentLatestResponseDto extends AssessmentRunStatusResponseDto {
  @ApiPropertyOptional({ example: 'session_member_123' })
  @IsString()
  @IsOptional()
  sessionMemberId?: string;
}
