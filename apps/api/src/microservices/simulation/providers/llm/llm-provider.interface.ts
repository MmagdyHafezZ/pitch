import { Observable } from 'rxjs';
import {
  LLMMessageDto,
  LLMConfigDto,
  LLMResponseDto,
  LLMStreamChunkDto,
} from '../../dto/llm.dto';

/**
 * LLM Provider Interface
 * All LLM provider adapters must implement this interface
 */
export interface ILLMProvider {
  /**
   * Provider name (e.g., 'openai', 'watsonx', 'anthropic')
   */
  readonly name: string;

  /**
   * Check if this provider supports a given model
   */
  supportsModel(model: string): boolean;

  /**
   * Complete (non-streaming) LLM request
   * Returns the complete response in one go
   */
  complete(
    messages: LLMMessageDto[],
    config: LLMConfigDto,
  ): Promise<LLMResponseDto>;

  /**
   * Streaming LLM request
   * Returns an Observable that emits chunks as they arrive
   */
  stream(
    messages: LLMMessageDto[],
    config: LLMConfigDto,
  ): Observable<LLMStreamChunkDto>;

  /**
   * Validate configuration for this provider
   * Throws an error if configuration is invalid
   */
  validateConfig(config: LLMConfigDto): void;

  /**
   * Get model capabilities
   * Returns metadata about what the model supports
   */
  getModelCapabilities(model: string): ModelCapabilities;
}

/**
 * Model Capabilities
 * Describes what a model supports
 */
export interface ModelCapabilities {
  maxTokens: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportedModalities: Array<'text' | 'image' | 'audio'>;
  pricing: {
    inputTokensPerMillion: number;
    outputTokensPerMillion: number;
    imageTokens?: number;
    audioSecondsToTokens?: number;
  };
}

/**
 * Provider Error
 * Standardized error format across all providers
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Provider Rate Limit Error
 */
export class ProviderRateLimitError extends ProviderError {
  constructor(
    provider: string,
    public readonly retryAfterMs?: number,
    details?: any,
  ) {
    super(provider, 'RATE_LIMIT', 'Rate limit exceeded', details);
    this.name = 'ProviderRateLimitError';
  }
}

/**
 * Provider Authentication Error
 */
export class ProviderAuthError extends ProviderError {
  constructor(provider: string, details?: any) {
    super(provider, 'AUTH_ERROR', 'Authentication failed', details);
    this.name = 'ProviderAuthError';
  }
}

/**
 * Provider Invalid Request Error
 */
export class ProviderInvalidRequestError extends ProviderError {
  constructor(provider: string, message: string, details?: any) {
    super(provider, 'INVALID_REQUEST', message, details);
    this.name = 'ProviderInvalidRequestError';
  }
}

/**
 * Provider Timeout Error
 */
export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, details?: any) {
    super(provider, 'TIMEOUT', 'Request timed out', details);
    this.name = 'ProviderTimeoutError';
  }
}
