import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType } from './session.dto';

export class GenerateScenarioRequestDto {
  @ApiProperty({ example: 'org_456', description: 'Organization id.' })
  @IsString()
  orgId: string;

  @ApiPropertyOptional({
    example: 'Q1 Sales Onboarding',
    description: 'Optional scenario title seed.',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    enum: SessionType,
    example: SessionType.text,
    description: 'Preferred session type for the scenario.',
  })
  @IsEnum(SessionType)
  @IsOptional()
  type?: SessionType;

  @ApiPropertyOptional({
    example: ['sales', 'onboarding'],
    description: 'Tags to guide scenario generation.',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    example: 'en-US',
    description: 'Language for the scenario.',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    example: { difficulty: 'medium', duration: 30 },
    description: 'Session configuration hints.',
  })
  @IsObject()
  @IsOptional()
  sessionConfig?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'persona_101',
    description: 'Persona id to align the scenario with.',
  })
  @IsString()
  @IsOptional()
  personaId?: string;

  @ApiPropertyOptional({
    example: 'crm_context_123',
    description: 'CRM context id if relevant.',
  })
  @IsString()
  @IsOptional()
  crmContextId?: string;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'user@example.com', name: 'John Doe' },
    description: 'Optional user snapshot for personalization.',
  })
  @IsObject()
  @IsOptional()
  userSnapshot?: Record<string, any>;

  @ApiPropertyOptional({
    example: { id: 'org_456', name: 'Acme Corp', region: 'us-east-1' },
    description: 'Optional org snapshot for personalization.',
  })
  @IsObject()
  @IsOptional()
  orgSnapshot?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'user_123',
    description: 'User requesting the scenario (used for LLM routing).',
  })
  @IsString()
  @IsOptional()
  requestedBy?: string;

  @ApiPropertyOptional({
    example: 'Upsell to enterprise plan',
    description: 'Primary objective or goal for the scenario.',
  })
  @IsString()
  @IsOptional()
  objective?: string;

  @ApiPropertyOptional({
    example: 'Focus on discovery and objection handling',
    description: 'Additional free-form context for the LLM.',
  })
  @IsString()
  @IsOptional()
  context?: string;
}

export class GenerateScenarioBatchRequestDto extends GenerateScenarioRequestDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Number of scenarios to generate.',
  })
  @IsNumber()
  @IsOptional()
  count?: number;
}

export class ScenarioResponseDto {
  @ApiProperty({ example: 'scenario_123' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'org_456' })
  @IsString()
  orgId: string;

  @ApiProperty({ example: 'Q1 Sales Onboarding' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Practice onboarding a new SDR.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: { objective: 'Qualify the lead', difficulty: 'medium' },
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  @IsString()
  createdAt: string;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  @IsString()
  updatedAt: string;
}

export class ScenarioListResponseDto {
  @ApiProperty({ type: [ScenarioResponseDto] })
  scenarios: ScenarioResponseDto[];

  @ApiProperty({ example: 3 })
  @IsNumber()
  total: number;
}
