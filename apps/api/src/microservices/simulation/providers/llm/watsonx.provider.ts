import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@pitch/shared-backend/redis/index';
import { Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
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
import { RedisKeys } from '../../services/redis/redis-key-patterns';

interface WatsonxGenerationResult {
  generated_text: string;
  stop_reason?: string;
}

interface WatsonxGenerationResponse {
  results?: WatsonxGenerationResult[];
  model_version?: string;
}

interface WatsonxStreamResponse {
  results?: Array<{ generated_text?: string }>;
}

interface WatsonxAuthResponse {
  access_token?: string;
  expires_in?: number;
}

/**
 * IBM WatsonX Provider
 * Adapter for IBM WatsonX AI models (Granite, Llama, etc.)
 */
@Injectable()
export class WatsonxProvider implements ILLMProvider {
  readonly name = 'watsonx';
  private readonly logger = new Logger(WatsonxProvider.name);
  private client: AxiosInstance;
  private apiKey: string;
  private projectId: string;
  private baseUrl: string;
  private apiVersion: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private configService: ConfigService,
    @Optional() private readonly pricingService?: LLMPricingService,
    @Optional() private readonly redisService?: RedisService,
  ) {
    this.apiKey = this.configService.get<string>('WATSONX_API_KEY') || '';
    this.projectId = this.configService.get<string>('WATSONX_PROJECT_ID') || '';
    this.baseUrl =
      this.configService.get<string>('WATSONX_URL') ||
      'https://us-south.ml.cloud.ibm.com';
    this.apiVersion =
      this.configService.get<string>('WATSONX_API_VERSION') || '2024-10-01';

    if (!this.apiKey) {
      this.logger.warn('WATSONX_API_KEY not configured');
    }

    if (!this.projectId) {
      this.logger.warn('WATSONX_PROJECT_ID not configured');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  supportsModel(model: string): boolean {
    const modelLower = model.toLowerCase();
    return (
      modelLower.includes('granite') ||
      modelLower.includes('llama') ||
      modelLower.startsWith('ibm/') ||
      modelLower.includes('mixtral') ||
      modelLower.includes('flan')
    );
  }

  async complete(
    messages: LLMMessageDto[],
    config: LLMConfigDto,
  ): Promise<LLMResponseDto> {
    this.validateConfig(config);

    try {
      await this.ensureAuthenticated();

      const startTime = Date.now();
      const prompt = this.convertMessagesToPrompt(messages);

      const response = await this.client.post<WatsonxGenerationResponse>(
        `/ml/v1/text/generation?version=${this.apiVersion}`,
        {
          model_id: config.model,
          input: prompt,
          parameters: {
            max_new_tokens: config.maxTokens || 1024,
            temperature: config.temperature ?? 0.7,
            top_p: config.topP ?? 1.0,
            repetition_penalty: 1.0,
            stop_sequences: config.stop || [],
            ...config.providerOptions,
          },
          project_id: this.projectId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      const latencyMs = Date.now() - startTime;
      const result = response.data.results?.[0];
      const generatedText = result?.generated_text ?? '';

      const capabilities = this.getModelCapabilities(config.model);
      const promptTokens = this.estimateTokens(prompt);
      const completionTokens = this.estimateTokens(generatedText);
      const totalTokens = promptTokens + completionTokens;
      const costUsd = this.calculateCost(
        promptTokens,
        completionTokens,
        capabilities,
      );

      return {
        content: generatedText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          ...(costUsd !== undefined ? { costUsd } : {}),
          estimated: true,
        },
        providerMeta: {
          requestId:
            typeof response.data.model_version === 'string'
              ? response.data.model_version
              : undefined,
          latencyMs,
          model: config.model,
          finishReason: result?.stop_reason || 'stop',
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  stream(
    messages: LLMMessageDto[],
    config: LLMConfigDto,
    signal?: AbortSignal,
  ): Observable<LLMStreamChunkDto> {
    this.validateConfig(config);

    return new Observable((subscriber) => {
      let accumulatedTokens = 0;
      let streamRef: NodeJS.ReadableStream | ReadableStream<Uint8Array> | null =
        null;
      const abortStream = () => {
        const nodeStream = streamRef as
          | (NodeJS.ReadableStream & { destroy?: () => void })
          | null;
        if (nodeStream && typeof nodeStream.destroy === 'function') {
          nodeStream.destroy();
          return;
        }
        const webStream = streamRef as ReadableStream<Uint8Array> | null;
        if (webStream && typeof webStream.cancel === 'function') {
          void webStream.cancel().catch(() => {});
        }
      };
      const linkedAbort = () => {
        abortStream();
        if (!subscriber.closed) {
          subscriber.complete();
        }
      };

      signal?.addEventListener('abort', linkedAbort, { once: true });

      void (async () => {
        try {
          await this.ensureAuthenticated();

          const prompt = this.convertMessagesToPrompt(messages);

          const response = await this.client.post<NodeJS.ReadableStream>(
            `/ml/v1/text/generation_stream?version=${this.apiVersion}`,
            {
              model_id: config.model,
              input: prompt,
              parameters: {
                max_new_tokens: config.maxTokens || 1024,
                temperature: config.temperature ?? 0.7,
                top_p: config.topP ?? 1.0,
                repetition_penalty: 1.0,
                stop_sequences: config.stop || [],
                ...config.providerOptions,
              },
              project_id: this.projectId,
            },
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
              responseType: 'stream',
            },
          );

          const stream = response.data;
          streamRef = stream;

          stream.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();

                if (data === '[DONE]') {
                  const capabilities = this.getModelCapabilities(config.model);
                  const promptTokens = this.estimateTokens(prompt);
                  const costUsd = this.calculateCost(
                    promptTokens,
                    accumulatedTokens,
                    capabilities,
                  );

                  subscriber.next({
                    done: true,
                    usage: {
                      promptTokens,
                      completionTokens: accumulatedTokens,
                      totalTokens: promptTokens + accumulatedTokens,
                      ...(costUsd !== undefined ? { costUsd } : {}),
                      estimated: true,
                    },
                    finishReason: 'stop',
                  });

                  subscriber.complete();
                  return;
                }

                try {
                  const parsed = JSON.parse(data) as WatsonxStreamResponse;
                  const token = parsed.results?.[0]?.generated_text;

                  if (token) {
                    accumulatedTokens++;

                    subscriber.next({
                      delta: token,
                      done: false,
                    });
                  }
                } catch {
                  this.logger.warn('Failed to parse stream chunk:', data);
                }
              }
            }
          });

          stream.on('end', () => {
            if (!subscriber.closed) {
              const capabilities = this.getModelCapabilities(config.model);
              const promptTokens = this.estimateTokens(prompt);
              const costUsd = this.calculateCost(
                promptTokens,
                accumulatedTokens,
                capabilities,
              );

              subscriber.next({
                done: true,
                usage: {
                  promptTokens,
                  completionTokens: accumulatedTokens,
                  totalTokens: promptTokens + accumulatedTokens,
                  ...(costUsd !== undefined ? { costUsd } : {}),
                  estimated: true,
                },
                finishReason: 'stop',
              });

              subscriber.complete();
            }
          });

          stream.on('error', (streamError: unknown) => {
            if (signal?.aborted) {
              subscriber.complete();
              return;
            }
            subscriber.error(this.handleError(streamError));
          });
        } catch (error) {
          if (signal?.aborted) {
            subscriber.complete();
            return;
          }
          subscriber.error(this.handleError(error));
        }
      })();

      return () => {
        signal?.removeEventListener('abort', linkedAbort);
        abortStream();
      };
    });
  }

  validateConfig(config: LLMConfigDto): void {
    if (!config.model) {
      throw new ProviderInvalidRequestError(this.name, 'Model is required');
    }

    if (!this.supportsModel(config.model)) {
      throw new ProviderInvalidRequestError(
        this.name,
        `Model ${config.model} is not supported by WatsonX provider`,
      );
    }

    if (!this.apiKey) {
      throw new ProviderAuthError(this.name, {
        message: 'WATSONX_API_KEY is not configured',
      });
    }

    if (!this.projectId) {
      throw new ProviderInvalidRequestError(
        this.name,
        'WATSONX_PROJECT_ID is not configured',
      );
    }
  }

  getModelCapabilities(model: string): ModelCapabilities {
    const modelLower = model.toLowerCase();

    if (modelLower.includes('granite-13b')) {
      return {
        maxTokens: 8192,
        maxOutputTokens: 2048,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: this.buildPricing(model),
      };
    }

    if (
      modelLower.includes('granite-20b') ||
      modelLower.includes('granite-34b')
    ) {
      return {
        maxTokens: 8192,
        maxOutputTokens: 2048,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.includes('llama-3-70b')) {
      return {
        maxTokens: 8192,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: this.buildPricing(model),
      };
    }

    if (modelLower.includes('llama-3-8b')) {
      return {
        maxTokens: 8192,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: this.buildPricing(model),
      };
    }

    return {
      maxTokens: 8192,
      maxOutputTokens: 2048,
      supportsStreaming: true,
      supportsTools: false,
      supportsVision: false,
      supportsAudio: false,
      supportedModalities: ['text'],
      pricing: this.buildPricing(model),
    };
  }

  private buildPricing(model: string): ModelCapabilities['pricing'] {
    const pricing = this.pricingService?.getPricing(this.name, model);

    return {
      inputTokensPerMillion: pricing?.inputTokensPerMillion ?? 0,
      outputTokensPerMillion: pricing?.outputTokensPerMillion ?? 0,
      imageTokens: pricing?.imageTokens,
      audioSecondsToTokens: pricing?.audioSecondsToTokens,
    };
  }

  private hasPricing(pricing: ModelCapabilities['pricing']): boolean {
    return (
      (pricing.inputTokensPerMillion ?? 0) > 0 ||
      (pricing.outputTokensPerMillion ?? 0) > 0
    );
  }

  private tokenCacheKey(): string {
    return RedisKeys.llmAuthToken(this.name);
  }

  private async readCachedToken(): Promise<string | null> {
    if (!this.redisService) {
      return null;
    }
    return this.redisService.get<string>(this.tokenCacheKey());
  }

  private async cacheToken(
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (!this.redisService) {
      return;
    }
    const ttlSeconds = Math.max(expiresInSeconds - 300, 60);
    await this.redisService.set(this.tokenCacheKey(), token, {
      ttl: ttlSeconds,
    });
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000;

    if (this.accessToken && this.tokenExpiry > now + bufferMs) {
      return;
    }

    try {
      const cachedToken = await this.readCachedToken();
      if (cachedToken) {
        this.accessToken = cachedToken;
        this.tokenExpiry = now + bufferMs;
        return;
      }

      const response = await axios.post<WatsonxAuthResponse>(
        'https://iam.cloud.ibm.com/identity/token',
        new URLSearchParams({
          grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
          apikey: this.apiKey,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const accessToken =
        typeof response.data.access_token === 'string'
          ? response.data.access_token
          : null;
      const expiresIn =
        typeof response.data.expires_in === 'number'
          ? response.data.expires_in
          : 3600;

      this.accessToken = accessToken;
      this.tokenExpiry = now + expiresIn * 1000;
      if (this.accessToken) {
        await this.cacheToken(this.accessToken, expiresIn);
      }

      this.logger.log('Successfully authenticated with WatsonX');
    } catch (error: unknown) {
      this.logger.error('Failed to authenticate with WatsonX:', error);
      throw new ProviderAuthError(this.name, {
        message: 'Failed to obtain access token',
        error,
      });
    }
  }

  /**
   * Convert messages to a single prompt string
   * WatsonX doesn't use the OpenAI message format
   */
  private convertMessagesToPrompt(messages: LLMMessageDto[]): string {
    return messages
      .map((msg) => {
        const role = msg.role.toUpperCase();
        const content = typeof msg.content === 'string' ? msg.content : '';
        return `${role}: ${content}`;
      })
      .join('\n\n');
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
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Handle WatsonX errors
   */
  private handleError(error: unknown): Error {
    this.logger.error('WatsonX API error:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseData: unknown = error.response?.data;
      const responseDataRecord =
        responseData && typeof responseData === 'object'
          ? (responseData as Record<string, unknown>)
          : undefined;
      const message =
        responseDataRecord && typeof responseDataRecord.error === 'string'
          ? responseDataRecord.error
          : error.message;

      if (status === 401 || status === 403) {
        return new ProviderAuthError(this.name, {
          status,
          message,
        });
      }

      if (status === 429) {
        const headers = error.response?.headers as
          | Record<string, string | string[] | undefined>
          | undefined;
        const retryAfterHeader = headers?.['retry-after'];
        const retryAfter =
          typeof retryAfterHeader === 'string' ? retryAfterHeader : undefined;
        return new ProviderRateLimitError(
          this.name,
          retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
          { message },
        );
      }

      if (status === 400) {
        return new ProviderInvalidRequestError(this.name, message, { status });
      }

      if (status === 504 || status === 408) {
        return new ProviderTimeoutError(this.name, { status, message });
      }

      return new ProviderError(this.name, 'API_ERROR', message, { status });
    }

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return new ProviderError(this.name, 'UNKNOWN_ERROR', message, error);
  }
}
