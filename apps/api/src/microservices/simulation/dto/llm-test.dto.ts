import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

/**
 * Simple LLM Test Request DTO
 *
 * Basic request that just needs text input.
 * Uses default model (gpt-4) unless specified.
 */
export class SimpleLLMRequestDto {
  @IsString()
  text: string;
}

/**
 * Model-Specific LLM Request DTO
 *
 * Allows specifying which model and provider to use.
 */
export class ModelLLMRequestDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxTokens?: number;
}

/**
 * LLM Test Response DTO
 *
 * Simplified response with just the essentials.
 */
export class LLMTestResponseDto {
  /**
   * The generated text response from the LLM
   */
  response: string;

  /**
   * Which provider was used (e.g., 'openai', 'anthropic')
   */
  provider: string;

  /**
   * Which model was used (e.g., 'gpt-4', 'claude-3-5-sonnet')
   */
  model: string;

  /**
   * Token usage information
   */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
  };

  /**
   * Performance metrics
   */
  performance: {
    latencyMs: number;
  };
}
