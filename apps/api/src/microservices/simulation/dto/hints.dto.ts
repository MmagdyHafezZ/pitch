import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMMessageDto } from './llm.dto';

/**
 * Strategy for generating hints
 */
export enum HintStrategy {
  PROACTIVE = 'proactive', // Generate hints continuously based on conversation flow
  REACTIVE = 'reactive', // Generate hints only when user is inactive
  CONTEXTUAL = 'contextual', // Generate hints based on conversation context
}

/**
 * Hint type classification
 */
export enum HintType {
  NEXT_TOPIC = 'next_topic', // Suggest next topic to discuss
  CLARIFICATION = 'clarification', // Ask for clarification
  FOLLOW_UP = 'follow_up', // Follow-up question
  TRANSITION = 'transition', // Help transition to new topic
  OBJECTIVE = 'objective', // Remind about session objectives
}

/**
 * Request to generate a hint
 */
export class GenerateHintRequestDto {
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Turn ID - if provided, generates hint based on specific turn',
  })
  @IsString()
  @IsOptional()
  turnId?: string;

  @ApiPropertyOptional({
    description: 'Recent conversation messages',
    type: [LLMMessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMMessageDto)
  @IsOptional()
  messages?: LLMMessageDto[];

  @ApiPropertyOptional({
    description: 'Hint generation strategy',
    enum: HintStrategy,
    default: HintStrategy.REACTIVE,
  })
  @IsEnum(HintStrategy)
  @IsOptional()
  strategy?: HintStrategy;

  @ApiPropertyOptional({
    description: 'Maximum number of hints to generate',
    default: 3,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxHints?: number;

  @ApiPropertyOptional({
    description: 'Include context from session objectives',
  })
  @IsBoolean()
  @IsOptional()
  includeObjectives?: boolean;

  @ApiPropertyOptional({ description: 'User ID making the request' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({ description: 'LLM configuration override' })
  @IsObject()
  @IsOptional()
  llmConfigOverride?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Individual hint response
 */
export class HintDto {
  @ApiProperty({ description: 'Hint ID' })
  id: string;

  @ApiProperty({ description: 'Hint type', enum: HintType })
  type: HintType;

  @ApiProperty({ description: 'The hint text content' })
  content: string;

  @ApiPropertyOptional({ description: 'Reasoning/rationale for this hint' })
  rationale?: string;

  @ApiPropertyOptional({ description: 'Priority/relevance score (0-1)' })
  score?: number;

  @ApiProperty({ description: 'When the hint was generated' })
  generatedAt: Date;

  @ApiPropertyOptional({ description: 'Context that triggered this hint' })
  context?: {
    conversationLength?: number;
    lastUserMessage?: string;
    inactivityDuration?: number;
    missingObjectives?: string[];
  };
}

/**
 * Response containing generated hints
 */
export class GenerateHintResponseDto {
  @ApiProperty({ description: 'Session ID' })
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Turn ID if hint was generated for specific turn',
  })
  turnId?: string;

  @ApiProperty({ description: 'Generated hints', type: [HintDto] })
  hints: HintDto[];

  @ApiProperty({ description: 'LLM provider used for generation' })
  provider: string;

  @ApiProperty({ description: 'LLM model used for generation' })
  model: string;

  @ApiPropertyOptional({ description: 'Token usage statistics' })
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  @ApiProperty({ description: 'When hints were generated' })
  generatedAt: Date;

  @ApiPropertyOptional({ description: 'MongoDB document ID for hint storage' })
  mongoId?: string;
}

/**
 * Request to get hint history
 */
export class GetHintHistoryRequestDto {
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({ description: 'Limit number of results', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by hint type', enum: HintType })
  @IsEnum(HintType)
  @IsOptional()
  type?: HintType;

  @ApiPropertyOptional({ description: 'User ID making the request' })
  @IsString()
  @IsOptional()
  userId?: string;
}

/**
 * Hint history response
 */
export class HintHistoryResponseDto {
  @ApiProperty({ description: 'Session ID' })
  sessionId: string;

  @ApiProperty({
    description: 'Hint history entries',
    type: [GenerateHintResponseDto],
  })
  history: GenerateHintResponseDto[];

  @ApiProperty({ description: 'Total count of hint generations' })
  totalCount: number;
}

/**
 * Hint configuration for a session
 */
export class HintConfigDto {
  @ApiPropertyOptional({ description: 'Enable/disable hints', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Hint generation strategy',
    enum: HintStrategy,
    default: HintStrategy.REACTIVE,
  })
  @IsEnum(HintStrategy)
  @IsOptional()
  strategy?: HintStrategy;

  @ApiPropertyOptional({ description: 'Max hints per request', default: 3 })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxHintsPerRequest?: number;

  @ApiPropertyOptional({
    description: 'Inactivity threshold in seconds before triggering hints',
    default: 30,
  })
  @IsInt()
  @Min(5)
  @Max(300)
  @IsOptional()
  inactivityThresholdSeconds?: number;

  @ApiPropertyOptional({
    description: 'LLM provider for hint generation (from Prisma config)',
  })
  @IsString()
  @IsOptional()
  llmProvider?: string;

  @ApiPropertyOptional({
    description: 'LLM model for hint generation (from Prisma config)',
  })
  @IsString()
  @IsOptional()
  llmModel?: string;

  @ApiPropertyOptional({
    description: 'Temperature for hint generation',
    default: 0.7,
  })
  @IsOptional()
  temperature?: number;
}
