import { UsageCalculatorService } from '../../services/llm/usage-calculator.service';
import { ModelCapabilitiesRegistry } from '../../services/llm/model-capabilities.registry';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import {
  ILLMProvider,
  ModelCapabilities,
} from '../../providers/llm/llm-provider.interface';
import { LLMMessageDto } from '../../dto/llm.dto';

const capabilities: ModelCapabilities = {
  maxTokens: 8192,
  maxOutputTokens: 2048,
  supportsStreaming: true,
  supportsTools: false,
  supportsVision: true,
  supportsAudio: false,
  supportedModalities: ['text', 'image'],
  pricing: {
    inputTokensPerMillion: 2,
    outputTokensPerMillion: 4,
    imageTokens: 500,
  },
};

const stubProvider: ILLMProvider = {
  name: 'stub',
  supportsModel: () => true,
  complete: jest.fn(),
  stream: jest.fn() as any,
  validateConfig: jest.fn(),
  getModelCapabilities: () => capabilities,
};

describe('UsageCalculatorService', () => {
  let service: UsageCalculatorService;

  beforeEach(() => {
    const registry = new LLMProviderRegistry();
    registry.register(stubProvider);
    const capabilitiesRegistry = new ModelCapabilitiesRegistry(registry);
    service = new UsageCalculatorService(capabilitiesRegistry);
  });

  it('uses provider usage when available', () => {
    const result = service.normalizeUsage({
      messages: [{ role: 'user', content: 'Hello' }],
      responseText: 'World',
      model: 'stub-model',
      providerName: 'stub',
      providerUsage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        costUsd: 0.01,
        estimated: false,
      },
    });

    expect(result.promptTokens).toBe(10);
    expect(result.completionTokens).toBe(5);
    expect(result.totalTokens).toBe(15);
    expect(result.costUsd).toBeCloseTo(0.01);
    expect(result.estimated).toBe(false);
  });

  it('estimates tokens for text and image parts', () => {
    const messages: LLMMessageDto[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: '12345678' },
          { type: 'image', url: 'https://example.com/image.png' },
        ],
      },
    ];

    const result = service.normalizeUsage({
      messages,
      responseText: 'abcd',
      model: 'stub-model',
      providerName: 'stub',
    });

    expect(result.promptTokens).toBe(502);
    expect(result.completionTokens).toBe(1);
    expect(result.totalTokens).toBe(503);
    expect(result.costUsd).toBeGreaterThan(0);
  });
});
