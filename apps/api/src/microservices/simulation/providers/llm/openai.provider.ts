import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import OpenAI from 'openai';
import {
  ILLMProvider,
  ModelCapabilities,
  ProviderAuthError,
  ProviderError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from './llm-provider.interface';
import {
  LLMMessageDto,
  LLMConfigDto,
  LLMResponseDto,
  LLMStreamChunkDto,
} from '../../dto/llm.dto';
import { LLMPricingService } from '../../services/llm/llm-pricing.service';

type OpenAIContentPart = OpenAI.Chat.ChatCompletionContentPart;

/**
 * OpenAI Provider
 * Adapter for OpenAI's API (including GPT-4, GPT-3.5, etc.)
 */
@Injectable()
export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI;
  private readonly excludedModelPatterns = [
    /audio/i,
    /realtime/i,
    /transcribe/i,
    /tts/i,
    /speech/i,
    /whisper/i,
    /embedding/i,
    /moderation/i,
  ];

  private readonly contentPartGuard = (
    part: OpenAIContentPart | null,
  ): part is OpenAIContentPart => part !== null;

  constructor(
    private configService: ConfigService,
    @Optional() private readonly pricingService?: LLMPricingService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured');
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'placeholder',
      timeout: 60000,
      maxRetries: 1,
    });
  }

  supportsModel(model: string): boolean {
    const modelLower = model.toLowerCase();
    if (this.isExcludedModel(modelLower)) {
      return false;
    }

    return (
      modelLower.startsWith('gpt-5') ||
      modelLower.startsWith('gpt-4.1') ||
      modelLower.startsWith('gpt-4') ||
      modelLower.startsWith('gpt-3.5') ||
      modelLower === 'o1' ||
      modelLower.startsWith('o1-') ||
      modelLower === 'o3' ||
      modelLower.startsWith('o3-') ||
      modelLower === 'o4-mini' ||
      modelLower.startsWith('o4-mini') ||
      modelLower.startsWith('gpt-4o')
    );
  }

  async complete(
    messages: LLMMessageDto[],
    config: LLMConfigDto,
  ): Promise<LLMResponseDto> {
    this.validateConfig(config);

    try {
      const startTime = Date.now();

      const tools = config.tools as
        | OpenAI.Chat.ChatCompletionTool[]
        | undefined;
      const toolChoice = config.toolChoice as
        | OpenAI.Chat.ChatCompletionToolChoiceOption
        | undefined;
      const tokenLimit = this.buildTokenLimitParam(
        config.model,
        config.maxTokens,
      );
      const samplingParams = this.buildSamplingParams(config.model, config);

      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: this.convertMessages(messages),
        ...samplingParams,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        stop: config.stop,
        tools,
        tool_choice: toolChoice,
        stream: false,
        ...tokenLimit,
        ...config.providerOptions,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      const result: LLMResponseDto = {
        content: choice.message?.content || undefined,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
          estimated: !response.usage,
        },
        providerMeta: {
          requestId: response.id,
          latencyMs,
          model: response.model,
          finishReason: choice.finish_reason || undefined,
        },
      };

      if (result.usage) {
        const capabilities = this.getModelCapabilities(config.model);
        const costUsd = this.calculateCost(
          result.usage.promptTokens,
          result.usage.completionTokens,
          capabilities,
        );
        if (costUsd !== undefined) {
          result.usage.costUsd = costUsd;
        }
      }

      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        result.toolCalls = choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }));
      }

      return result;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  stream(
    messages: LLMMessageDto[],
    config: LLMConfigDto,
  ): Observable<LLMStreamChunkDto> {
    this.validateConfig(config);

    return new Observable((subscriber) => {
      let accumulatedTokens = 0;

      void (async () => {
        try {
          const tools = config.tools as
            | OpenAI.Chat.ChatCompletionTool[]
            | undefined;
          const toolChoice = config.toolChoice as
            | OpenAI.Chat.ChatCompletionToolChoiceOption
            | undefined;
          const tokenLimit = this.buildTokenLimitParam(
            config.model,
            config.maxTokens,
          );
          const samplingParams = this.buildSamplingParams(config.model, config);

          const stream = await this.client.chat.completions.create({
            model: config.model,
            messages: this.convertMessages(messages),
            ...samplingParams,
            frequency_penalty: config.frequencyPenalty,
            presence_penalty: config.presencePenalty,
            stop: config.stop,
            tools,
            tool_choice: toolChoice,
            stream: true,
            stream_options: { include_usage: true },
            ...tokenLimit,
            ...config.providerOptions,
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            const finishReason = chunk.choices[0]?.finish_reason;

            if (delta?.content) {
              accumulatedTokens++;

              subscriber.next({
                delta: delta.content,
                done: false,
              });
            }

            if (finishReason || chunk.usage) {
              const capabilities = this.getModelCapabilities(config.model);

              const costUsd = chunk.usage
                ? this.calculateCost(
                    chunk.usage.prompt_tokens,
                    chunk.usage.completion_tokens,
                    capabilities,
                  )
                : undefined;
              const usage = chunk.usage
                ? {
                    promptTokens: chunk.usage.prompt_tokens,
                    completionTokens: chunk.usage.completion_tokens,
                    totalTokens: chunk.usage.total_tokens,
                    ...(costUsd !== undefined ? { costUsd } : {}),
                    estimated: false,
                  }
                : {
                    promptTokens: this.estimateTokens(messages),
                    completionTokens: accumulatedTokens,
                    totalTokens:
                      this.estimateTokens(messages) + accumulatedTokens,
                    estimated: true,
                  };

              subscriber.next({
                done: true,
                usage,
                finishReason: finishReason || 'stop',
              });

              subscriber.complete();
              return;
            }
          }

          subscriber.complete();
        } catch (error) {
          subscriber.error(this.handleError(error));
        }
      })();
    });
  }

  validateConfig(config: LLMConfigDto): void {
    if (!config.model) {
      throw new ProviderInvalidRequestError(this.name, 'Model is required');
    }

    if (!this.supportsModel(config.model)) {
      throw new ProviderInvalidRequestError(
        this.name,
        `Model ${config.model} is not supported by OpenAI provider`,
      );
    }

    if (
      config.temperature !== undefined &&
      (config.temperature < 0 || config.temperature > 2)
    ) {
      throw new ProviderInvalidRequestError(
        this.name,
        'Temperature must be between 0 and 2',
      );
    }

    if (config.maxTokens !== undefined && config.maxTokens < 1) {
      throw new ProviderInvalidRequestError(
        this.name,
        'maxTokens must be at least 1',
      );
    }
  }

  getModelCapabilities(model: string): ModelCapabilities {
    const modelLower = model.toLowerCase();

    if (
      modelLower.includes('gpt-5.2-pro') ||
      modelLower.includes('gpt-5-pro')
    ) {
      return {
        maxTokens: 400000,
        maxOutputTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.startsWith('gpt-5.2') || modelLower.startsWith('gpt-5')) {
      return {
        maxTokens: 400000,
        maxOutputTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.includes('gpt-4.1-nano')) {
      return {
        maxTokens: 1047576,
        maxOutputTokens: 32768,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.includes('gpt-4.1-mini')) {
      return {
        maxTokens: 1047576,
        maxOutputTokens: 32768,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.includes('gpt-4.1')) {
      return {
        maxTokens: 1047576,
        maxOutputTokens: 32768,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.includes('gpt-4o-mini')) {
      return {
        maxTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model, 765),
      };
    }

    if (modelLower.includes('gpt-4o')) {
      return {
        maxTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsAudio: false,
        supportedModalities: ['text', 'image'],
        pricing: this.buildPricing(model, 765),
      };
    }

    if (modelLower.includes('gpt-4-turbo')) {
      const supportsVision = modelLower.includes('vision');
      return {
        maxTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision,
        supportsAudio: false,
        supportedModalities: supportsVision ? ['text', 'image'] : ['text'],
        pricing: this.buildPricing(model, supportsVision ? 765 : undefined),
      };
    }

    if (modelLower.startsWith('gpt-4')) {
      return {
        maxTokens: 8192,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.startsWith('gpt-3.5-turbo')) {
      return {
        maxTokens: 16384,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: this.buildPricing(model),
      };
    }

    if (
      modelLower === 'o1' ||
      modelLower.startsWith('o1-') ||
      modelLower === 'o3' ||
      modelLower.startsWith('o3-') ||
      modelLower === 'o4-mini' ||
      modelLower.startsWith('o4-mini')
    ) {
      return {
        maxTokens: 128000,
        maxOutputTokens: 32768,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: modelLower !== 'o1' && !modelLower.startsWith('o1-'),
        supportsAudio: false,
        supportedModalities:
          modelLower !== 'o1' && !modelLower.startsWith('o1-')
            ? ['text', 'image']
            : ['text'],
        pricing: this.buildPricing(model),
      };
    }

    return {
      maxTokens: 8192,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
      supportsAudio: false,
      supportedModalities: ['text'],
      pricing: this.buildPricing(model),
    };
  }

  private isExcludedModel(modelLower: string): boolean {
    return this.excludedModelPatterns.some((pattern) =>
      pattern.test(modelLower),
    );
  }

  private buildTokenLimitParam(
    model: string,
    maxTokens?: number,
  ): Record<string, number> {
    if (maxTokens === undefined) {
      return {};
    }

    return this.requiresMaxCompletionTokens(model)
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };
  }

  private buildSamplingParams(
    model: string,
    config: LLMConfigDto,
  ): Record<string, number> {
    if (!this.supportsSamplingParams(model, config.providerOptions)) {
      return {};
    }

    const params: Record<string, number> = {};
    if (config.temperature !== undefined) {
      params.temperature = config.temperature;
    }
    if (config.topP !== undefined) {
      params.top_p = config.topP;
    }

    return params;
  }

  private requiresMaxCompletionTokens(model: string): boolean {
    const modelLower = model.toLowerCase();

    return (
      modelLower.startsWith('gpt-5') ||
      modelLower === 'o1' ||
      modelLower.startsWith('o1-') ||
      modelLower === 'o3' ||
      modelLower.startsWith('o3-') ||
      modelLower === 'o4-mini' ||
      modelLower.startsWith('o4-mini')
    );
  }

  private supportsSamplingParams(
    model: string,
    providerOptions?: Record<string, unknown>,
  ): boolean {
    const modelLower = model.toLowerCase();

    if (
      modelLower === 'gpt-5' ||
      modelLower.startsWith('gpt-5-') ||
      modelLower.startsWith('gpt-5-mini') ||
      modelLower.startsWith('gpt-5-nano')
    ) {
      return false;
    }

    if (modelLower.startsWith('gpt-5.1') || modelLower.startsWith('gpt-5.2')) {
      const reasoningEffort = this.getReasoningEffort(providerOptions);
      return reasoningEffort === 'none';
    }

    if (
      modelLower === 'o1' ||
      modelLower.startsWith('o1-') ||
      modelLower === 'o3' ||
      modelLower.startsWith('o3-') ||
      modelLower === 'o4-mini' ||
      modelLower.startsWith('o4-mini')
    ) {
      return false;
    }

    return true;
  }

  private getReasoningEffort(
    providerOptions?: Record<string, unknown>,
  ): string | undefined {
    if (!providerOptions) {
      return undefined;
    }

    const direct = providerOptions.reasoning_effort;
    if (typeof direct === 'string') {
      return direct.trim().toLowerCase();
    }

    const nested = providerOptions.reasoning;
    if (
      nested &&
      typeof nested === 'object' &&
      typeof (nested as Record<string, unknown>).effort === 'string'
    ) {
      return String((nested as Record<string, unknown>).effort)
        .trim()
        .toLowerCase();
    }

    return undefined;
  }

  private buildPricing(
    model: string,
    imageTokens?: number,
  ): ModelCapabilities['pricing'] {
    const pricing = this.pricingService?.getPricing(this.name, model);

    return {
      inputTokensPerMillion: pricing?.inputTokensPerMillion ?? 0,
      outputTokensPerMillion: pricing?.outputTokensPerMillion ?? 0,
      imageTokens: pricing?.imageTokens ?? imageTokens,
      audioSecondsToTokens: pricing?.audioSecondsToTokens,
    };
  }

  private hasPricing(pricing: ModelCapabilities['pricing']): boolean {
    return (
      (pricing.inputTokensPerMillion ?? 0) > 0 ||
      (pricing.outputTokensPerMillion ?? 0) > 0
    );
  }

  /**
   * Convert LLM messages to OpenAI format
   */
  private convertMessages(
    messages: LLMMessageDto[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      const role: 'system' | 'user' | 'assistant' | 'tool' = msg.role;

      const stringContent =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content
                .map((part) => (part.type === 'text' ? part.text : ''))
                .join(' ')
                .trim()
            : '';

      if (role === 'tool') {
        return {
          role: 'tool',
          content: stringContent,
          tool_call_id: msg.toolCallId ?? 'tool',
        };
      }

      if (role === 'system') {
        return msg.name
          ? { role: 'system', content: stringContent, name: msg.name }
          : { role: 'system', content: stringContent };
      }

      if (role === 'assistant') {
        return msg.name
          ? { role: 'assistant', content: stringContent, name: msg.name }
          : { role: 'assistant', content: stringContent };
      }

      let content: string | OpenAIContentPart[] = stringContent;

      if (Array.isArray(msg.content)) {
        const contentParts = msg.content
          .map((part): OpenAIContentPart | null => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            }
            if (part.type === 'image') {
              return {
                type: 'image_url',
                image_url: {
                  url: part.url,
                  detail: part.detail || 'auto',
                },
              };
            }
            return null;
          })
          .filter(this.contentPartGuard);

        if (contentParts.length > 0) {
          content = contentParts;
        }
      }

      return msg.name
        ? { role: 'user', content, name: msg.name }
        : { role: 'user', content };
    });
  }

  /**
   * Calculate cost in USD
   */
  private calculateCost(
    promptTokens: number,
    completionTokens: number,
    capabilities: ModelCapabilities,
  ): number | undefined {
    if (!this.hasPricing(capabilities.pricing)) {
      return undefined;
    }
    const inputCost =
      (promptTokens / 1000000) * capabilities.pricing.inputTokensPerMillion;
    const outputCost =
      (completionTokens / 1000000) *
      capabilities.pricing.outputTokensPerMillion;
    return inputCost + outputCost;
  }

  /**
   * Estimate tokens (rough approximation)
   * In production, use a proper tokenizer like tiktoken
   */
  private estimateTokens(messages: LLMMessageDto[]): number {
    let total = 0;
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        total += Math.ceil(msg.content.length / 4);
      }
    }
    return total;
  }

  /**
   * Handle OpenAI errors and convert to standard provider errors
   */
  private handleError(error: unknown): Error {
    this.logger.error('OpenAI API error:', error);

    if (error instanceof OpenAI.APIError) {
      const status =
        typeof error.status === 'number' ? error.status : undefined;

      if (status === 401 || status === 403) {
        return new ProviderAuthError(this.name, {
          status,
          message: error.message,
        });
      }

      if (status === 429) {
        const headers =
          error.headers && typeof error.headers === 'object'
            ? (error.headers as Record<string, unknown>)
            : undefined;
        const retryAfterHeader = headers?.['retry-after'];
        const retryAfter =
          typeof retryAfterHeader === 'string' ? retryAfterHeader : undefined;
        return new ProviderRateLimitError(
          this.name,
          retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
          { message: error.message },
        );
      }

      if (status === 400) {
        return new ProviderInvalidRequestError(this.name, error.message, {
          status,
        });
      }

      if (status === 504 || status === 408) {
        return new ProviderTimeoutError(this.name, {
          status,
          message: error.message,
        });
      }

      return new ProviderError(this.name, 'API_ERROR', error.message, {
        status,
      });
    }

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return new ProviderError(this.name, 'UNKNOWN_ERROR', message, error);
  }
}
