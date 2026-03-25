import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType } from './session.dto';

export enum ScenarioVisibilityDto {
  PRIVATE = 'PRIVATE',
  TEAM = 'TEAM',
  PUBLIC = 'PUBLIC',
}

export enum ScenarioListScopeDto {
  mine = 'mine',
  team = 'team',
  public = 'public',
}

export class GenerateScenarioCrmSelectionsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accounts?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  opportunities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  leads?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contacts?: string[];
}

export class GenerateScenarioRequestDto {
  @ApiProperty({
    example: 'org_456',
    description: 'Organization or workspace id.',
  })
  @IsString()
  orgId: string;

  @ApiPropertyOptional({
    example: 'Q1 sales onboarding',
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
    example: { difficulty: 6, durationMinutes: 30, aiRole: 'VP of Sales' },
    description: 'Session configuration hints.',
  })
  @IsObject()
  @IsOptional()
  sessionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'persona_101',
    description: 'Persona id to align the scenario with.',
  })
  @IsString()
  @IsOptional()
  personaId?: string;

  @ApiPropertyOptional({
    example: {
      id: 'persona_101',
      name: 'Skeptical VP',
      traits: { role: 'VP Sales', personality: 'skeptical' },
    },
    description: 'Optional persona snapshot for richer grounding.',
  })
  @IsObject()
  @IsOptional()
  personaSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'crm_context_123',
    description: 'CRM context id if relevant.',
  })
  @IsString()
  @IsOptional()
  crmContextId?: string;

  @ApiPropertyOptional({
    type: GenerateScenarioCrmSelectionsDto,
    description: 'Selected CRM records to ground the scenario.',
  })
  @ValidateNested()
  @Type(() => GenerateScenarioCrmSelectionsDto)
  @IsOptional()
  crmSelections?: GenerateScenarioCrmSelectionsDto;

  @ApiPropertyOptional({
    example: { id: 'user_123', email: 'user@example.com', name: 'John Doe' },
    description: 'Optional user snapshot for personalization.',
  })
  @IsObject()
  @IsOptional()
  userSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { id: 'org_456', name: 'Acme Corp', region: 'us-east-1' },
    description: 'Optional org snapshot for personalization.',
  })
  @IsObject()
  @IsOptional()
  orgSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'user_123',
    description:
      'User requesting the scenario (legacy input; ignored in favor of auth claims).',
  })
  @IsString()
  @IsOptional()
  requestedBy?: string;

  @ApiPropertyOptional({
    example: 'Upsell to the enterprise plan',
    description: 'Primary objective or goal for the scenario.',
  })
  @IsString()
  @IsOptional()
  objective?: string;

  @ApiPropertyOptional({
    example: 'Focus on discovery and objection handling in a renewal call.',
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

export class ScenarioPermissionsDto {
  @ApiProperty({ example: true })
  canUse: boolean;

  @ApiProperty({ example: false })
  canEdit: boolean;

  @ApiProperty({ example: false })
  canDelete: boolean;

  @ApiProperty({ example: true })
  canDuplicate: boolean;
}

export class ScenarioDraftDto {
  @ApiProperty({ example: 'draft_123' })
  @IsString()
  draftId: string;

  @ApiProperty({
    example: 'Negotiating a security review with a skeptical buyer',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example:
      'A late-stage buyer is pushing for a heavy security review while the quarter-end deadline is closing in.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ScenarioVisibilityDto,
    example: ScenarioVisibilityDto.PRIVATE,
  })
  @IsEnum(ScenarioVisibilityDto)
  visibility: ScenarioVisibilityDto;

  @ApiPropertyOptional({
    example: {
      objective: 'Protect timeline while preserving buyer confidence',
      background: '...',
      roles: { user: 'Account Executive', assistant: 'VP Security' },
      constraints: ['Limited internal security bandwidth'],
      successCriteria: ['Secure an agreed review scope'],
      stakes: ['Quarter-end deal risk'],
      stages: [
        { label: 'Opening', description: 'Set the agenda', duration: 5 },
      ],
      difficulty: 'hard',
      durationMinutes: 25,
      tags: ['security', 'enterprise'],
      language: 'en-US',
    },
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class ScenarioDraftListResponseDto {
  @ApiProperty({ type: [ScenarioDraftDto] })
  scenarios: ScenarioDraftDto[];

  @ApiProperty({ example: 3 })
  @IsNumber()
  total: number;
}

export class CreateScenarioDto {
  @ApiProperty({ example: 'team_123' })
  @IsString()
  orgId: string;

  @ApiProperty({ example: 'Renewal call with procurement blocker' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Saved from an AI-generated draft.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ScenarioVisibilityDto,
    example: ScenarioVisibilityDto.TEAM,
  })
  @IsEnum(ScenarioVisibilityDto)
  visibility: ScenarioVisibilityDto;

  @ApiPropertyOptional({
    example: {
      objective: 'Handle pricing pushback without discounting too early',
    },
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class UpdateScenarioDto {
  @ApiPropertyOptional({ example: 'Updated scenario name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated scenario description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ScenarioVisibilityDto,
    example: ScenarioVisibilityDto.PUBLIC,
  })
  @IsEnum(ScenarioVisibilityDto)
  @IsOptional()
  visibility?: ScenarioVisibilityDto;

  @ApiPropertyOptional({ example: { objective: 'New objective' } })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class ScenarioListQueryDto {
  @ApiPropertyOptional({
    example: 'team_123',
    description:
      'Workspace id used for mine/team filtering and legacy visibility.',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    enum: ScenarioListScopeDto,
    example: ScenarioListScopeDto.mine,
  })
  @IsEnum(ScenarioListScopeDto)
  @IsOptional()
  scope?: ScenarioListScopeDto;

  @ApiPropertyOptional({
    example: 'security review',
    description: 'Search by name, description, or tags.',
  })
  @IsString()
  @IsOptional()
  query?: string;
}

export class ScenarioResponseDto {
  @ApiProperty({ example: 'scenario_123' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'team_456' })
  @IsString()
  orgId: string;

  @ApiPropertyOptional({ example: 'user_123' })
  @IsString()
  @IsOptional()
  createdByUserId?: string;

  @ApiProperty({
    enum: ScenarioVisibilityDto,
    example: ScenarioVisibilityDto.PRIVATE,
  })
  @IsEnum(ScenarioVisibilityDto)
  visibility: ScenarioVisibilityDto;

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
  config?: Record<string, unknown>;

  @ApiProperty({ example: false })
  isReadonlyLegacy: boolean;

  @ApiProperty({ type: ScenarioPermissionsDto })
  permissions: ScenarioPermissionsDto;

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
