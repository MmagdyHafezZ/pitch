import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * LLM Content Part Types
 * Supports text, image, and audio content in messages
 */
export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; detail?: 'low' | 'high' }
  | { type: 'audio'; url: string; format?: string };

/**
 * LLM Message DTO
 * Represents a single message in the conversation
 */
export class LLMMessageDto {
  @IsEnum(['system', 'user', 'assistant', 'tool'])
  role: 'system' | 'user' | 'assistant' | 'tool';

  @IsOptional()
  content?: string | LLMContentPart[];

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  toolCallId?: string;
}

/**
 * LLM Tool Definition DTO
 */
export class LLMToolDto {
  @IsString()
  type: string;

  @IsObject()
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
}

export class LLMRouteTargetDto {
  @IsString()
  provider: string;

  @IsString()
  model: string;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class LLMRoutingHintsDto {
  @IsEnum(['manual', 'auto'])
  @IsOptional()
  mode?: 'manual' | 'auto';

  @IsEnum(['balanced', 'cost', 'latency', 'quality'])
  @IsOptional()
  strategy?: 'balanced' | 'cost' | 'latency' | 'quality';

  @IsArray()
  @IsEnum(['streaming', 'tools', 'vision', 'audio'], { each: true })
  @IsOptional()
  require?: Array<'streaming' | 'tools' | 'vision' | 'audio'>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMRouteTargetDto)
  @IsOptional()
  candidates?: LLMRouteTargetDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMRouteTargetDto)
  @IsOptional()
  fallbacks?: LLMRouteTargetDto[];
}

/**
 * LLM Configuration DTO
 * Configures how the LLM should behave
 */
export class LLMConfigDto {
  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  model: string;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  topP?: number;

  @IsNumber()
  @Min(-2)
  @Max(2)
  @IsOptional()
  frequencyPenalty?: number;

  @IsNumber()
  @Min(-2)
  @Max(2)
  @IsOptional()
  presencePenalty?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stop?: string[];

  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMToolDto)
  @IsOptional()
  tools?: LLMToolDto[];

  @IsOptional()
  toolChoice?: string | { type: string; function: string };

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modalities?: Array<'text' | 'image' | 'audio'>;

  @IsObject()
  @IsOptional()
  providerOptions?: Record<string, unknown>;

  @ValidateNested()
  @Type(() => LLMRoutingHintsDto)
  @IsOptional()
  routing?: LLMRoutingHintsDto;
}

/**
 * LLM Request DTO
 * Complete request to the LLM service
 */
export class LLMRequestDto {
  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  sessionMemberId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  turnId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMMessageDto)
  messages: LLMMessageDto[];

  @ValidateNested()
  @Type(() => LLMConfigDto)
  config: LLMConfigDto;
}

/**
 * LLM Usage DTO
 * Token usage and cost information
 */
export class LLMUsageDto {
  @IsNumber()
  @Min(0)
  promptTokens: number;

  @IsNumber()
  @Min(0)
  completionTokens: number;

  @IsNumber()
  @Min(0)
  totalTokens: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costUsd?: number;

  @IsBoolean()
  @IsOptional()
  estimated?: boolean;
}

/**
 * LLM Tool Call DTO
 * Represents a tool call made by the LLM
 */
export class LLMToolCallDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  arguments: string;
}

/**
 * LLM Response DTO
 * Response from the LLM service
 */
export class LLMResponseDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LLMToolCallDto)
  @IsOptional()
  toolCalls?: LLMToolCallDto[];

  @ValidateNested()
  @Type(() => LLMUsageDto)
  usage: LLMUsageDto;

  @IsObject()
  @IsOptional()
  providerMeta?: {
    provider?: string;
    requestId?: string;
    latencyMs?: number;
    model?: string;
    finishReason?: string;
  };
}

/**
 * LLM Stream Chunk DTO
 * Individual chunk in a streaming response
 */
export class LLMStreamChunkDto {
  @IsString()
  @IsOptional()
  delta?: string;

  @IsBoolean()
  @IsOptional()
  done?: boolean;

  @IsObject()
  @IsOptional()
  usage?: Partial<LLMUsageDto>;

  @IsString()
  @IsOptional()
  finishReason?: string;
}
