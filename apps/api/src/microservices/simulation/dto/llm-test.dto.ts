import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Simple LLM Test Request DTO
 *
 * Basic request that just needs text input.
 * Uses default model (gpt-4) unless specified.
 */
export class SimpleLLMRequestDto {
  @ApiProperty({
    example: 'What is the capital of France?',
    description: 'User prompt to send to the LLM.',
  })
  @IsString()
  text: string;
}

/**
 * Model-Specific LLM Request DTO
 *
 * Allows specifying which model and provider to use.
 */
export class ModelLLMRequestDto {
  @ApiProperty({
    example: 'Explain quantum computing in simple terms.',
    description: 'User prompt to send to the LLM.',
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    example: 'gpt-4o',
    description: 'Target model ID.',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({
    example: 'openai',
    description: 'Target provider name.',
  })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({
    example: 0.7,
    description: 'Sampling temperature between 0 and 2.',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Maximum tokens to generate.',
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxTokens?: number;
}

export class LLMUsageSummaryDto {
  @ApiProperty({ example: 42 })
  promptTokens: number;

  @ApiProperty({ example: 128 })
  completionTokens: number;

  @ApiProperty({ example: 170 })
  totalTokens: number;

  @ApiProperty({ example: 0.0034 })
  costUsd: number;
}

export class LLMPerformanceSummaryDto {
  @ApiProperty({ example: 842 })
  latencyMs: number;
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
  @ApiProperty({
    example: 'Paris is the capital of France.',
  })
  response: string;

  /**
   * Which provider was used (e.g., 'openai', 'anthropic')
   */
  @ApiProperty({
    example: 'openai',
  })
  provider: string;

  /**
   * Which model was used (e.g., 'gpt-4', 'claude-3-5-sonnet')
   */
  @ApiProperty({
    example: 'gpt-4o',
  })
  model: string;

  /**
   * Token usage information
   */
  @ApiProperty({ type: LLMUsageSummaryDto })
  usage: LLMUsageSummaryDto;

  /**
   * Performance metrics
   */
  @ApiProperty({ type: LLMPerformanceSummaryDto })
  performance: LLMPerformanceSummaryDto;
}
