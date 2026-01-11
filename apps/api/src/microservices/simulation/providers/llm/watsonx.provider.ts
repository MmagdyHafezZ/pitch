import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('WATSONX_API_KEY') || '';
    this.projectId = this.configService.get<string>('WATSONX_PROJECT_ID') || '';
    this.baseUrl =
      this.configService.get<string>('WATSONX_URL') ||
      'https://us-south.ml.cloud.ibm.com';

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

      const response = await this.client.post(
        '/ml/v1/text/generation',
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
      const result = response.data.results[0];

      const capabilities = this.getModelCapabilities(config.model);
      const promptTokens = this.estimateTokens(prompt);
      const completionTokens = this.estimateTokens(result.generated_text);
      const totalTokens = promptTokens + completionTokens;

      return {
        content: result.generated_text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          costUsd: this.calculateCost(
            promptTokens,
            completionTokens,
            capabilities,
          ),
          estimated: true,
        },
        providerMeta: {
          requestId: response.data.model_version || undefined,
          latencyMs,
          model: config.model,
          finishReason: result.stop_reason || 'stop',
        },
      };
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
      const startTime = Date.now();
      let accumulatedContent = '';
      let accumulatedTokens = 0;

      (async () => {
        try {
          await this.ensureAuthenticated();

          const prompt = this.convertMessagesToPrompt(messages);

          const response = await this.client.post(
            '/ml/v1/text/generation_stream',
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

          stream.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();

                if (data === '[DONE]') {
                  const capabilities = this.getModelCapabilities(config.model);
                  const promptTokens = this.estimateTokens(prompt);

                  subscriber.next({
                    done: true,
                    usage: {
                      promptTokens,
                      completionTokens: accumulatedTokens,
                      totalTokens: promptTokens + accumulatedTokens,
                      costUsd: this.calculateCost(
                        promptTokens,
                        accumulatedTokens,
                        capabilities,
                      ),
                      estimated: true,
                    },
                    finishReason: 'stop',
                  });

                  subscriber.complete();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const token = parsed.results?.[0]?.generated_text;

                  if (token) {
                    accumulatedContent += token;
                    accumulatedTokens++;

                    subscriber.next({
                      delta: token,
                      done: false,
                    });
                  }
                } catch (parseError) {
                  this.logger.warn('Failed to parse stream chunk:', data);
                }
              }
            }
          });

          stream.on('end', () => {
            if (!subscriber.closed) {
              const capabilities = this.getModelCapabilities(config.model);
              const promptTokens = this.estimateTokens(prompt);

              subscriber.next({
                done: true,
                usage: {
                  promptTokens,
                  completionTokens: accumulatedTokens,
                  totalTokens: promptTokens + accumulatedTokens,
                  costUsd: this.calculateCost(
                    promptTokens,
                    accumulatedTokens,
                    capabilities,
                  ),
                  estimated: true,
                },
                finishReason: 'stop',
              });

              subscriber.complete();
            }
          });

          stream.on('error', (error: any) => {
            subscriber.error(this.handleError(error));
          });
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
        pricing: {
          inputTokensPerMillion: 2.0,
          outputTokensPerMillion: 6.0,
        },
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
        pricing: {
          inputTokensPerMillion: 4.0,
          outputTokensPerMillion: 12.0,
        },
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
        pricing: {
          inputTokensPerMillion: 5.0,
          outputTokensPerMillion: 15.0,
        },
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
        pricing: {
          inputTokensPerMillion: 1.0,
          outputTokensPerMillion: 3.0,
        },
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
      pricing: {
        inputTokensPerMillion: 3.0,
        outputTokensPerMillion: 9.0,
      },
    };
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now();

    if (this.accessToken && this.tokenExpiry > now + 5 * 60 * 1000) {
      return;
    }

    try {
      const response = await axios.post(
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

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + response.data.expires_in * 1000;

      this.logger.log('Successfully authenticated with WatsonX');
    } catch (error) {
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
  ): number {
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
  private handleError(error: any): Error {
    this.logger.error('WatsonX API error:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;

      if (status === 401 || status === 403) {
        return new ProviderAuthError(this.name, {
          status,
          message,
        });
      }

      if (status === 429) {
        const retryAfter = error.response?.headers?.['retry-after'];
        return new ProviderRateLimitError(
          this.name,
          retryAfter ? parseInt(retryAfter) * 1000 : undefined,
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

    return new ProviderError(
      this.name,
      'UNKNOWN_ERROR',
      error.message || 'Unknown error occurred',
      error,
    );
  }
}
