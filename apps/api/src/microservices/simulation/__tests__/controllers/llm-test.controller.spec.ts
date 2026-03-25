import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LLMTestController } from '../../controllers/llm-test.controller';
import { LLMService } from '../../services/llm/llm.service';
import { ModelCapabilitiesRegistry } from '../../services/llm/model-capabilities.registry';
import { LLMModelCatalogService } from '../../services/llm/llm-model-catalog.service';
import { LLMPricingService } from '../../services/llm/llm-pricing.service';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import {
  ProviderError,
  ProviderRateLimitError,
  ProviderAuthError,
  ProviderTimeoutError,
  ProviderInvalidRequestError,
} from '../../providers/llm/llm-provider.interface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_LLM_RESPONSE = {
  content: 'Paris is the capital of France.',
  providerMeta: { provider: 'openai', model: 'gpt-4o' },
  usage: {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    costUsd: 0.001,
  },
};

const MOCK_CAPABILITIES = {
  maxTokens: 128000,
  maxOutputTokens: 4096,
  supportsStreaming: true,
  supportsTools: true,
  supportsVision: true,
  supportsAudio: false,
  supportedModalities: ['text', 'image'],
  pricing: { inputTokensPerMillion: 2.5, outputTokensPerMillion: 10.0 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LLMTestController', () => {
  let controller: LLMTestController;
  let llmService: jest.Mocked<LLMService>;
  let capabilitiesRegistry: jest.Mocked<ModelCapabilitiesRegistry>;
  let modelCatalog: jest.Mocked<LLMModelCatalogService>;
  let pricingService: jest.Mocked<LLMPricingService>;
  let providerRegistry: jest.Mocked<LLMProviderRegistry>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LLMTestController],
      providers: [
        {
          provide: LLMService,
          useValue: { complete: jest.fn() },
        },
        {
          provide: ModelCapabilitiesRegistry,
          useValue: { getCapabilities: jest.fn() },
        },
        {
          provide: LLMModelCatalogService,
          useValue: { listModels: jest.fn(), refreshIfNeeded: jest.fn() },
        },
        {
          provide: LLMPricingService,
          useValue: { refreshIfNeeded: jest.fn() },
        },
        {
          provide: LLMProviderRegistry,
          useValue: { getProvider: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<LLMTestController>(LLMTestController);
    llmService = module.get<jest.Mocked<LLMService>>(LLMService);
    capabilitiesRegistry = module.get<jest.Mocked<ModelCapabilitiesRegistry>>(
      ModelCapabilitiesRegistry,
    );
    modelCatalog = module.get<jest.Mocked<LLMModelCatalogService>>(
      LLMModelCatalogService,
    );
    pricingService =
      module.get<jest.Mocked<LLMPricingService>>(LLMPricingService);
    providerRegistry =
      module.get<jest.Mocked<LLMProviderRegistry>>(LLMProviderRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // health
  // -------------------------------------------------------------------------
  describe('health', () => {
    it('should return ok status and service name with an ISO timestamp', () => {
      const result = controller.health();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('simulation-llm');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  // -------------------------------------------------------------------------
  // simpleTest
  // -------------------------------------------------------------------------
  describe('simpleTest', () => {
    const dto = { text: 'What is the capital of France?' };

    it('should call llmService.complete and return formatted response', async () => {
      llmService.complete.mockResolvedValue(MOCK_LLM_RESPONSE as any);

      const result = await controller.simpleTest(dto);

      expect(llmService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          turnId: 'test-turn',
          messages: [{ role: 'user', content: dto.text }],
          config: expect.objectContaining({
            model: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 1000,
          }),
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          response: 'Paris is the capital of France.',
          provider: 'openai',
          model: 'gpt-4o',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
            costUsd: 0.001,
          },
          performance: expect.objectContaining({
            latencyMs: expect.any(Number),
          }),
        }),
      );
    });

    it('should handle missing providerMeta gracefully with fallback values', async () => {
      llmService.complete.mockResolvedValue({
        content: 'Hello',
        usage: null,
      } as any);

      const result = await controller.simpleTest(dto);

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage.costUsd).toBe(0);
    });

    it('should handle missing content gracefully (empty string)', async () => {
      llmService.complete.mockResolvedValue({
        ...MOCK_LLM_RESPONSE,
        content: null,
      } as any);

      const result = await controller.simpleTest(dto);

      expect(result.response).toBe('');
    });

    it('should throw HttpException for ProviderError (rate limit)', async () => {
      const providerError = new ProviderRateLimitError('openai');
      llmService.complete.mockRejectedValue(providerError);

      await expect(controller.simpleTest(dto)).rejects.toBeInstanceOf(
        HttpException,
      );
    });

    it('should throw HttpException for ProviderError (auth error) with 401 status', async () => {
      const providerError = new ProviderAuthError('openai');
      llmService.complete.mockRejectedValue(providerError);

      try {
        await controller.simpleTest(dto);
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.UNAUTHORIZED,
        );
      }
    });

    it('should re-throw non-ProviderError as-is', async () => {
      const genericError = new Error('Unexpected failure');
      llmService.complete.mockRejectedValue(genericError);

      await expect(controller.simpleTest(dto)).rejects.toThrow(
        'Unexpected failure',
      );
      await expect(controller.simpleTest(dto)).rejects.not.toBeInstanceOf(
        HttpException,
      );
    });

    it('should record latencyMs in the response', async () => {
      llmService.complete.mockResolvedValue(MOCK_LLM_RESPONSE as any);

      const result = await controller.simpleTest(dto);

      expect(result.performance.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // modelSpecificTest
  // -------------------------------------------------------------------------
  describe('modelSpecificTest', () => {
    const dto = {
      text: 'Explain quantum computing',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 500,
    };

    it('should call llmService.complete with the specified model and return formatted response', async () => {
      llmService.complete.mockResolvedValue(MOCK_LLM_RESPONSE as any);

      const result = await controller.modelSpecificTest(dto as any);

      expect(llmService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            model: 'gpt-4o',
            temperature: 0.5,
            maxTokens: 500,
          }),
        }),
      );
      expect(result.response).toBe('Paris is the capital of France.');
    });

    it('should default to gpt-4o when model is absent', async () => {
      const noModelDto = { text: 'Hello' };
      llmService.complete.mockResolvedValue(MOCK_LLM_RESPONSE as any);

      await controller.modelSpecificTest(noModelDto as any);

      expect(llmService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ model: 'gpt-4o' }),
        }),
      );
    });

    it('should default temperature to 0.7 and maxTokens to 1000 when absent', async () => {
      const minimalDto = { text: 'Hello' };
      llmService.complete.mockResolvedValue(MOCK_LLM_RESPONSE as any);

      await controller.modelSpecificTest(minimalDto as any);

      expect(llmService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            temperature: 0.7,
            maxTokens: 1000,
          }),
        }),
      );
    });

    it('should use dto.provider and dto.model as fallback in response when providerMeta is absent', async () => {
      llmService.complete.mockResolvedValue({
        content: 'Hi',
        usage: null,
      } as any);
      const specificDto = {
        text: 'Hello',
        provider: 'watsonx',
        model: 'ibm/granite-13b-chat-v2',
      };

      const result = await controller.modelSpecificTest(specificDto as any);

      expect(result.provider).toBe('watsonx');
      expect(result.model).toBe('ibm/granite-13b-chat-v2');
    });

    it('should throw HttpException for ProviderError (invalid request) with 400 status', async () => {
      const providerError = new ProviderInvalidRequestError(
        'openai',
        'Bad model',
      );
      llmService.complete.mockRejectedValue(providerError);

      try {
        await controller.modelSpecificTest(dto as any);
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw HttpException for ProviderError (timeout) with 504 status', async () => {
      const providerError = new ProviderTimeoutError('openai');
      llmService.complete.mockRejectedValue(providerError);

      try {
        await controller.modelSpecificTest(dto as any);
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
    });

    it('should throw HttpException for ProviderError (API_ERROR) with 502 status', async () => {
      const providerError = new ProviderError(
        'openai',
        'API_ERROR',
        'Upstream failure',
      );
      llmService.complete.mockRejectedValue(providerError);

      try {
        await controller.modelSpecificTest(dto as any);
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      }
    });

    it('should throw HttpException with 500 for unknown ProviderError code', async () => {
      const providerError = new ProviderError(
        'openai',
        'SOME_UNKNOWN_CODE',
        'Mystery',
      );
      llmService.complete.mockRejectedValue(providerError);

      try {
        await controller.modelSpecificTest(dto as any);
        fail('Expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });

    it('should re-throw non-ProviderError as-is', async () => {
      const genericError = new TypeError('Unexpected');
      llmService.complete.mockRejectedValue(genericError);

      await expect(
        controller.modelSpecificTest(dto as any),
      ).rejects.toBeInstanceOf(TypeError);
    });
  });

  // -------------------------------------------------------------------------
  // listProviders
  // -------------------------------------------------------------------------
  describe('listProviders', () => {
    beforeEach(() => {
      pricingService.refreshIfNeeded.mockResolvedValue(undefined);
      modelCatalog.refreshIfNeeded.mockResolvedValue(undefined);
      capabilitiesRegistry.getCapabilities.mockReturnValue(
        MOCK_CAPABILITIES as any,
      );
    });

    it('should return providers list with openai and watsonx', async () => {
      modelCatalog.listModels.mockResolvedValue([]);
      providerRegistry.getProvider.mockImplementation(() => {
        throw new Error('Provider not found');
      });

      const result = await controller.listProviders();

      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].name).toBe('openai');
      expect(result.providers[1].name).toBe('watsonx');
    });

    it('should refresh pricing and model catalog before returning', async () => {
      modelCatalog.listModels.mockResolvedValue([]);
      providerRegistry.getProvider.mockImplementation(() => {
        throw new Error('Not found');
      });

      await controller.listProviders();

      expect(pricingService.refreshIfNeeded).toHaveBeenCalled();
      expect(modelCatalog.refreshIfNeeded).toHaveBeenCalled();
    });

    it('should use catalog models when available', async () => {
      const catalogModels = ['gpt-4o', 'gpt-4o-mini'];
      modelCatalog.listModels.mockResolvedValue(catalogModels);
      const mockProvider = {
        supportsModel: jest.fn((m) => catalogModels.includes(m)),
      };
      providerRegistry.getProvider.mockReturnValue(mockProvider as any);

      const result = await controller.listProviders();

      const openai = result.providers.find((p: any) => p.name === 'openai');
      expect(openai?.models).toEqual(
        expect.arrayContaining(['gpt-4o', 'gpt-4o-mini']),
      );
    });

    it('should fall back to hardcoded models when catalog returns empty', async () => {
      modelCatalog.listModels.mockResolvedValue([]);
      providerRegistry.getProvider.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = await controller.listProviders();

      const openai = result.providers.find((p: any) => p.name === 'openai');
      expect(openai?.models.length).toBeGreaterThan(0);
    });

    it('should build modelDetails with capability information', async () => {
      modelCatalog.listModels.mockResolvedValue(['gpt-4o']);
      const mockProvider = { supportsModel: jest.fn(() => true) };
      providerRegistry.getProvider.mockReturnValue(mockProvider as any);

      const result = await controller.listProviders();

      const openai = result.providers.find((p: any) => p.name === 'openai');
      const detail = openai?.modelDetails?.[0];
      expect(detail?.name).toBe('gpt-4o');
      expect(detail?.supportsStreaming).toBe(true);
      expect(detail?.pricing).toEqual(MOCK_CAPABILITIES.pricing);
    });

    it('should filter models using provider.supportsModel', async () => {
      modelCatalog.listModels.mockResolvedValue([
        'gpt-4o',
        'gpt-4o-mini',
        'unsupported-model',
      ]);
      const mockProvider = {
        supportsModel: jest.fn((m: string) => m !== 'unsupported-model'),
      };
      providerRegistry.getProvider.mockReturnValue(mockProvider as any);

      const result = await controller.listProviders();

      const openai = result.providers.find((p: any) => p.name === 'openai');
      expect(openai?.models).not.toContain('unsupported-model');
    });

    it('should sort openai models in preferred order', async () => {
      modelCatalog.listModels.mockResolvedValue([
        'gpt-3.5-turbo',
        'gpt-4o',
        'gpt-4o-mini',
      ]);
      const mockProvider = { supportsModel: jest.fn(() => true) };
      providerRegistry.getProvider.mockReturnValue(mockProvider as any);

      const result = await controller.listProviders();

      const openai = result.providers.find((p: any) => p.name === 'openai');
      const models = openai?.models ?? [];
      const gpt4oIdx = models.indexOf('gpt-4o');
      const gpt4oMiniIdx = models.indexOf('gpt-4o-mini');
      const gpt35Idx = models.indexOf('gpt-3.5-turbo');
      expect(gpt4oIdx).toBeLessThan(gpt4oMiniIdx);
      expect(gpt4oMiniIdx).toBeLessThan(gpt35Idx);
    });
  });

  // -------------------------------------------------------------------------
  // HTTP error mapping (via throwHttpError path)
  // -------------------------------------------------------------------------
  describe('HTTP error code mapping', () => {
    const dto = { text: 'Test' };

    it.each([
      ['INVALID_REQUEST', HttpStatus.BAD_REQUEST],
      ['MODEL_NOT_SUPPORTED', HttpStatus.BAD_REQUEST],
      ['PROVIDER_NOT_FOUND', HttpStatus.BAD_REQUEST],
      ['AUTH_ERROR', HttpStatus.UNAUTHORIZED],
      ['RATE_LIMIT', HttpStatus.TOO_MANY_REQUESTS],
      ['TIMEOUT', HttpStatus.GATEWAY_TIMEOUT],
      ['API_ERROR', HttpStatus.BAD_GATEWAY],
      ['UNKNOWN_CODE', HttpStatus.INTERNAL_SERVER_ERROR],
    ])('ProviderError code %s → HTTP %s', async (code, expectedStatus) => {
      const error = new ProviderError('openai', code, `Error: ${code}`);
      llmService.complete.mockRejectedValue(error);

      try {
        await controller.simpleTest(dto);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(expectedStatus);
      }
    });
  });
});
