import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBadGatewayResponse,
  ApiGatewayTimeoutResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { LLMService } from '../services/llm/llm.service';
import { ModelCapabilitiesRegistry } from '../services/llm/model-capabilities.registry';
import { LLMModelCatalogService } from '../services/llm/llm-model-catalog.service';
import { LLMPricingService } from '../services/llm/llm-pricing.service';
import { LLMProviderRegistry } from '../providers/llm/llm-provider.registry';
import {
  SimpleLLMRequestDto,
  ModelLLMRequestDto,
  LLMTestResponseDto,
} from '../dto/llm-test.dto';
import { LLMRequestDto } from '../dto/llm.dto';
import { HttpErrorResponseDto } from '../dto/http-error.dto';
import { LLMProvidersResponseDto } from '../dto/llm-providers.dto';
import { ProviderError } from '../providers/llm/llm-provider.interface';
import { SystemAdminOnly } from '../../../gateway/decorators/system-admin.decorator';

/**
 * LLM Test Controller
 *
 * Provides simple HTTP endpoints for testing LLM functionality.
 * This is separate from the production RabbitMQ-based chat controller.
 *
 * Base path: /simulation/llm
 */
@ApiTags('Simulation LLM')
@Controller('simulation/llm')
export class LLMTestController {
  private readonly logger = new Logger(LLMTestController.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly capabilitiesRegistry: ModelCapabilitiesRegistry,
    private readonly modelCatalog: LLMModelCatalogService,
    private readonly pricingService: LLMPricingService,
    private readonly providerRegistry: LLMProviderRegistry,
  ) {}

  /**
   * Health check endpoint
   *
   * GET /simulation/llm/health
   */
  @Get('health')
  @SystemAdminOnly()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'simulation-llm',
        timestamp: '2024-01-01T12:00:00.000Z',
      },
    },
  })
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
  @SystemAdminOnly()
  @ApiOperation({ summary: 'Simple LLM completion test' })
  @ApiOkResponse({ type: LLMTestResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request or unsupported model/provider.',
  })
  @ApiUnauthorizedResponse({
    type: HttpErrorResponseDto,
    description: 'Missing or invalid provider credentials.',
  })
  @ApiTooManyRequestsResponse({
    type: HttpErrorResponseDto,
    description: 'Provider rate limit exceeded.',
  })
  @ApiBadGatewayResponse({
    type: HttpErrorResponseDto,
    description: 'Upstream provider error.',
  })
  @ApiGatewayTimeoutResponse({
    type: HttpErrorResponseDto,
    description: 'Provider request timed out.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
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
      this.throwHttpError(error);
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
  @SystemAdminOnly()
  @ApiOperation({ summary: 'Model-specific LLM completion test' })
  @ApiOkResponse({ type: LLMTestResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request or unsupported model/provider.',
  })
  @ApiUnauthorizedResponse({
    type: HttpErrorResponseDto,
    description: 'Missing or invalid provider credentials.',
  })
  @ApiTooManyRequestsResponse({
    type: HttpErrorResponseDto,
    description: 'Provider rate limit exceeded.',
  })
  @ApiBadGatewayResponse({
    type: HttpErrorResponseDto,
    description: 'Upstream provider error.',
  })
  @ApiGatewayTimeoutResponse({
    type: HttpErrorResponseDto,
    description: 'Provider request timed out.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
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
      this.throwHttpError(error);
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
  @ApiOperation({ summary: 'List available providers and models' })
  @ApiOkResponse({ type: LLMProvidersResponseDto })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  async listProviders() {
    await Promise.all([
      this.pricingService.refreshIfNeeded(),
      this.modelCatalog.refreshIfNeeded(),
    ]);

    const openaiFallback = [
      'gpt-5',
      'gpt-5-chat-latest',
      'gpt-5-mini',
      'gpt-5-nano',
      'o3-pro',
      'o3',
      'o4-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1',
      'o1-mini',
      'gpt-4',
      'gpt-3.5-turbo',
    ];
    const watsonxFallback = [
      'ibm/granite-20b-chat-v2',
      'ibm/granite-34b-chat-v2',
      'meta-llama/llama-3-8b-instruct',
      'meta-llama/llama-3-70b-instruct',
    ];

    const openaiModels = await this.loadProviderModels(
      'openai',
      openaiFallback,
    );
    const watsonxModels = await this.loadProviderModels(
      'watsonx',
      watsonxFallback,
    );

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

  private async loadProviderModels(
    providerName: string,
    fallback: string[],
  ): Promise<string[]> {
    const providerNameLower = providerName.toLowerCase();
    const models = await this.modelCatalog.listModels(providerNameLower);
    const effectiveModels = models.length > 0 ? models : fallback;

    try {
      const provider = this.providerRegistry.getProvider(providerNameLower);
      const filtered = effectiveModels.filter((model) =>
        provider.supportsModel(model),
      );
      return this.sortProviderModels(providerNameLower, filtered);
    } catch {
      return this.sortProviderModels(providerNameLower, effectiveModels);
    }
  }

  private sortProviderModels(providerName: string, models: string[]): string[] {
    if (providerName !== 'openai') {
      return [...new Set(models)];
    }

    const preferredOrder = [
      'gpt-5.2-pro',
      'gpt-5.2',
      'gpt-5.2-chat-latest',
      'gpt-5.2-mini',
      'gpt-5.2-nano',
      'gpt-5',
      'gpt-5-chat-latest',
      'gpt-5-mini',
      'gpt-5-nano',
      'o3-pro',
      'o3',
      'o4-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o1-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ];

    const uniqueModels = [...new Set(models)];
    return uniqueModels.sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left);
      const rightIndex = preferredOrder.indexOf(right);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }

      return left.localeCompare(right);
    });
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

  private throwHttpError(error: unknown): never {
    if (error instanceof ProviderError) {
      throw this.toHttpException(error);
    }
    throw error;
  }

  private toHttpException(error: ProviderError): HttpException {
    const status = this.mapProviderErrorStatus(error.code);
    const message = `LLM provider error [${error.provider}/${error.code}]: ${error.message}`;
    return new HttpException(message, status);
  }

  private mapProviderErrorStatus(code: string): HttpStatus {
    switch (code) {
      case 'INVALID_REQUEST':
      case 'MODEL_NOT_SUPPORTED':
      case 'PROVIDER_NOT_FOUND':
        return HttpStatus.BAD_REQUEST;
      case 'AUTH_ERROR':
        return HttpStatus.UNAUTHORIZED;
      case 'RATE_LIMIT':
        return HttpStatus.TOO_MANY_REQUESTS;
      case 'TIMEOUT':
        return HttpStatus.GATEWAY_TIMEOUT;
      case 'API_ERROR':
        return HttpStatus.BAD_GATEWAY;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
