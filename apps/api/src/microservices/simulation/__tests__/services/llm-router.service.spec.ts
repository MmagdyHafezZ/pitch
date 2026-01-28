import { LLMRouterService } from '../../services/llm/llm-router.service';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import { LLMRoutingConfigService } from '../../services/llm/llm-routing-config.service';
import {
  ProviderRateLimitError,
  type ILLMProvider,
} from '../../providers/llm/llm-provider.interface';
import { LLMRequestDto } from '../../dto/llm.dto';

const request: LLMRequestDto = {
  sessionId: 'session-1',
  turnId: 'turn-1',
  messages: [{ role: 'user', content: 'Hello' }],
  config: { model: 'granite-13b', provider: 'watsonx' },
};

const configService = {
  get: jest.fn(() => 'false'),
} as any;

describe('LLMRouterService', () => {
  it('routes to the requested provider/model', async () => {
    const provider: ILLMProvider = {
      name: 'watsonx',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn().mockResolvedValue({
        content: 'Hi',
        usage: {
          promptTokens: 4,
          completionTokens: 2,
          totalTokens: 6,
        },
      }),
      stream: jest.fn() as any,
      getModelCapabilities: () => ({
        maxTokens: 4096,
        maxOutputTokens: 1024,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: {
          inputTokensPerMillion: 1,
          outputTokensPerMillion: 2,
        },
      }),
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const routingConfig = {
      getActiveConfig: jest.fn().mockResolvedValue({
        version: 1,
        mode: 'manual',
        defaultRoute: { provider: 'openai', model: 'gpt-4o' },
      }),
    } as unknown as LLMRoutingConfigService;

    const router = new LLMRouterService(
      providerRegistry,
      routingConfig,
      configService,
    );

    const result = await router.complete(request);

    expect(result.route.provider).toBe('watsonx');
    expect(result.route.model).toBe('granite-13b');
    expect(result.response.content).toBe('Hi');
  });

  it('falls back when the primary provider errors', async () => {
    const primary: ILLMProvider = {
      name: 'openai',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest
        .fn()
        .mockRejectedValue(new ProviderRateLimitError('openai', 1000)),
      stream: jest.fn() as any,
      getModelCapabilities: () => ({
        maxTokens: 4096,
        maxOutputTokens: 1024,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: {
          inputTokensPerMillion: 1,
          outputTokensPerMillion: 2,
        },
      }),
    };

    const fallback: ILLMProvider = {
      name: 'watsonx',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn().mockResolvedValue({
        content: 'Fallback',
        usage: {
          promptTokens: 4,
          completionTokens: 2,
          totalTokens: 6,
        },
      }),
      stream: jest.fn() as any,
      getModelCapabilities: () => ({
        maxTokens: 4096,
        maxOutputTokens: 1024,
        supportsStreaming: true,
        supportsTools: false,
        supportsVision: false,
        supportsAudio: false,
        supportedModalities: ['text'],
        pricing: {
          inputTokensPerMillion: 1,
          outputTokensPerMillion: 2,
        },
      }),
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(primary);
    providerRegistry.register(fallback);

    const routingConfig = {
      getActiveConfig: jest.fn().mockResolvedValue({
        version: 1,
        mode: 'manual',
        defaultRoute: { provider: 'openai', model: 'gpt-4o' },
        fallbacks: [{ provider: 'watsonx', model: 'granite-13b' }],
        strategy: {
          retryOn: ['RATE_LIMIT'],
          maxAttempts: 2,
        },
      }),
    } as unknown as LLMRoutingConfigService;

    const router = new LLMRouterService(
      providerRegistry,
      routingConfig,
      configService,
    );

    const result = await router.complete({
      ...request,
      config: { model: 'auto' },
    });

    expect(result.response.content).toBe('Fallback');
    expect(result.route.provider).toBe('watsonx');
  });
});
