import { Controller, Post, Body, Logger, HttpCode, Get } from '@nestjs/common';
import { LLMService } from '../services/llm/llm.service';
import { ModelCapabilitiesRegistry } from '../services/llm/model-capabilities.registry';
import {
  SimpleLLMRequestDto,
  ModelLLMRequestDto,
  LLMTestResponseDto,
} from '../dto/llm-test.dto';
import { LLMRequestDto } from '../dto/llm.dto';

/**
 * LLM Test Controller
 *
 * Provides simple HTTP endpoints for testing LLM functionality.
 * This is separate from the production RabbitMQ-based chat controller.
 *
 * Base path: /simulation/llm
 */
@Controller('simulation/llm')
export class LLMTestController {
  private readonly logger = new Logger(LLMTestController.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly capabilitiesRegistry: ModelCapabilitiesRegistry,
  ) {}

  /**
   * Health check endpoint
   *
   * GET /simulation/llm/health
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'simulation-llm',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simple text completion endpoint
   *
   * POST /simulation/llm/test
   *
   * Takes just text input and returns a response using the default model (GPT-4).
   * Perfect for quick testing without worrying about configuration.
   *
   * Example:
   * ```json
   * {
   *   "text": "What is the capital of France?"
   * }
   * ```
   */
  @Post('test')
  @HttpCode(200)
  async simpleTest(
    @Body() dto: SimpleLLMRequestDto,
  ): Promise<LLMTestResponseDto> {
    this.logger.log(`Simple test request: "${dto.text.substring(0, 50)}..."`);

    const startTime = Date.now();

    const llmRequest: LLMRequestDto = {
      sessionId: 'test-session',
      turnId: 'test-turn',
      messages: [
        {
          role: 'user',
          content: dto.text,
        },
      ],
      config: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000,
      },
    };

    try {
      const response = await this.llmService.complete(llmRequest);
      const latencyMs = Date.now() - startTime;

      this.logger.log(
        `Simple test completed in ${latencyMs}ms, cost: $${response.usage?.costUsd || 0}`,
      );

      return {
        response: response.content || '',
        provider: response.providerMeta?.provider || 'openai',
        model: response.providerMeta?.model || 'gpt-4o',
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
          totalTokens: response.usage?.totalTokens || 0,
          costUsd: response.usage?.costUsd || 0,
        },
        performance: {
          latencyMs,
        },
      };
    } catch (error) {
      this.logger.error('Simple test failed', error);
      throw error;
    }
  }

  /**
   * Model-specific completion endpoint
   *
   * POST /simulation/llm/complete
   *
   * Allows you to specify which model and provider to use.
   * Supports the enabled providers (OpenAI and WatsonX).
   *
   * Example with specific model:
   * ```json
   * {
   *   "text": "Explain quantum computing",
   *   "model": "claude-3-5-sonnet-20241022",
   *   "temperature": 0.5,
   *   "maxTokens": 500
   * }
   * ```
   *
   * Example with provider and model:
   * ```json
   * {
   *   "text": "Write a haiku about coding",
   *   "provider": "google",
   *   "model": "gemini-2.0-flash-exp"
   * }
   * ```
   */
  @Post('complete')
  @HttpCode(200)
  async modelSpecificTest(
    @Body() dto: ModelLLMRequestDto,
  ): Promise<LLMTestResponseDto> {
    this.logger.log(
      `Model-specific test: model=${dto.model || 'default'}, text="${dto.text.substring(0, 50)}..."`,
    );

    const startTime = Date.now();

    const llmRequest: LLMRequestDto = {
      sessionId: 'test-session',
      turnId: 'test-turn',
      messages: [
        {
          role: 'user',
          content: dto.text,
        },
      ],
      config: {
        provider: dto.provider,
        model: dto.model || 'gpt-4o',
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1000,
      },
    };

    try {
      const response = await this.llmService.complete(llmRequest);
      const latencyMs = Date.now() - startTime;

      this.logger.log(
        `Model-specific test completed: ${response.providerMeta?.provider}/${response.providerMeta?.model} in ${latencyMs}ms, cost: $${response.usage?.costUsd || 0}`,
      );

      return {
        response: response.content || '',
        provider: response.providerMeta?.provider || dto.provider || 'openai',
        model: response.providerMeta?.model || dto.model || 'gpt-4o',
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
          totalTokens: response.usage?.totalTokens || 0,
          costUsd: response.usage?.costUsd || 0,
        },
        performance: {
          latencyMs,
        },
      };
    } catch (error) {
      this.logger.error('Model-specific test failed', error);
      throw error;
    }
  }

  /**
   * List available providers and models
   *
   * GET /simulation/llm/providers
   *
   * Returns information about which LLM providers and models are available,
   * including pricing and capability metadata.
   */
  @Get('providers')
  async listProviders() {
    const openaiModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini',
    ];
    const watsonxModels = [
      'ibm/granite-13b-chat-v2',
      'ibm/granite-20b-chat-v2',
      'ibm/granite-34b-chat-v2',
      'meta-llama/llama-3-8b-instruct',
      'meta-llama/llama-3-70b-instruct',
    ];

    return {
      providers: [
        {
          name: 'openai',
          enabled: !!process.env.OPENAI_API_KEY,
          models: openaiModels,
          modelDetails: this.buildModelDetails(openaiModels, 'openai'),
        },
        {
          name: 'watsonx',
          enabled: !!(
            process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID
          ),
          models: watsonxModels,
          modelDetails: this.buildModelDetails(watsonxModels, 'watsonx'),
        },
      ],
    };
  }

  private buildModelDetails(models: string[], providerName: string) {
    return models.map((model) => {
      const capabilities = this.capabilitiesRegistry.getCapabilities(
        model,
        providerName,
      );

      return {
        name: model,
        pricing: capabilities.pricing,
        maxTokens: capabilities.maxTokens,
        maxOutputTokens: capabilities.maxOutputTokens,
        supportsStreaming: capabilities.supportsStreaming,
        supportsTools: capabilities.supportsTools,
        supportsVision: capabilities.supportsVision,
        supportsAudio: capabilities.supportsAudio,
        supportedModalities: capabilities.supportedModalities,
      };
    });
  }
}
