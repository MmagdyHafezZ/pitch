import { ApiProperty } from '@nestjs/swagger';
import type { ModelPricing } from '../services/llm/llm-pricing.service';

export class LLMModelPricingDto implements ModelPricing {
  @ApiProperty({ example: 5.0 })
  inputTokensPerMillion: number;

  @ApiProperty({ example: 15.0 })
  outputTokensPerMillion: number;

  @ApiProperty({ example: 765, required: false })
  imageTokens?: number;

  @ApiProperty({ example: 0, required: false })
  audioSecondsToTokens?: number;
}

export class LLMProviderModelDetailDto {
  @ApiProperty({ example: 'gpt-4o' })
  name: string;

  @ApiProperty({ type: LLMModelPricingDto })
  pricing: LLMModelPricingDto;

  @ApiProperty({ example: 128000 })
  maxTokens: number;

  @ApiProperty({ example: 4096, required: false })
  maxOutputTokens?: number;

  @ApiProperty({ example: true })
  supportsStreaming: boolean;

  @ApiProperty({ example: true })
  supportsTools: boolean;

  @ApiProperty({ example: true })
  supportsVision: boolean;

  @ApiProperty({ example: false })
  supportsAudio: boolean;

  @ApiProperty({ example: ['text', 'image'] })
  supportedModalities: Array<'text' | 'image' | 'audio'>;
}

export class LLMProviderInfoDto {
  @ApiProperty({ example: 'openai' })
  name: string;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: ['gpt-4o', 'gpt-4o-mini'] })
  models: string[];

  @ApiProperty({ type: [LLMProviderModelDetailDto] })
  modelDetails: LLMProviderModelDetailDto[];
}

export class LLMProvidersResponseDto {
  @ApiProperty({
    type: [LLMProviderInfoDto],
    example: [
      {
        name: 'openai',
        enabled: true,
        models: ['gpt-4o', 'gpt-4o-mini'],
        modelDetails: [
          {
            name: 'gpt-4o',
            pricing: {
              inputTokensPerMillion: 5.0,
              outputTokensPerMillion: 15.0,
              imageTokens: 765,
            },
            maxTokens: 128000,
            maxOutputTokens: 4096,
            supportsStreaming: true,
            supportsTools: true,
            supportsVision: true,
            supportsAudio: false,
            supportedModalities: ['text', 'image'],
          },
        ],
      },
    ],
  })
  providers: LLMProviderInfoDto[];
}
