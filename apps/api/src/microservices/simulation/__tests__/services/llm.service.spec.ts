import { Observable } from 'rxjs';
import { LLMService } from '../../services/llm/llm.service';
import { LLMProviderRegistry } from '../../providers/llm/llm-provider.registry';
import { UsageCalculatorService } from '../../services/llm/usage-calculator.service';
import { ModelCapabilitiesRegistry } from '../../services/llm/model-capabilities.registry';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';
import {
  ILLMProvider,
  ModelCapabilities,
} from '../../providers/llm/llm-provider.interface';
import { LLMRequestDto } from '../../dto/llm.dto';

const capabilities: ModelCapabilities = {
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
};

const request: LLMRequestDto = {
  sessionId: 'session-1',
  turnId: 'turn-1',
  messages: [{ role: 'user', content: 'Hello' }],
  config: { model: 'stub-model', provider: 'stub', stream: true },
};

describe('LLMService', () => {
  it('completes and persists metrics', async () => {
    const provider: ILLMProvider = {
      name: 'stub',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn().mockResolvedValue({
        content: 'Hi',
        usage: {
          promptTokens: 4,
          completionTokens: 2,
          totalTokens: 6,
          costUsd: 0.001,
        },
      }),
      stream: jest.fn() as any,
      getModelCapabilities: () => capabilities,
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const usageCalculator = new UsageCalculatorService(
      new ModelCapabilitiesRegistry(providerRegistry),
    );

    const prisma = {
      metric: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as SimulationPrismaService;

    const mongo = {
      isConnected: jest.fn().mockReturnValue(false),
      getModel: jest.fn(),
    } as unknown as MongoConnectionService;

    const service = new LLMService(
      providerRegistry,
      usageCalculator,
      prisma,
      mongo,
    );

    const response = await service.complete(request, {
      requestId: 'req-1',
      purpose: 'chat',
    });

    expect(response.content).toBe('Hi');
    expect(prisma.metric.create).toHaveBeenCalled();
    expect(provider.complete).toHaveBeenCalled();
  });

  it('streams, normalizes usage, and allows cancellation', async () => {
    const provider: ILLMProvider = {
      name: 'stub',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn() as any,
      stream: jest.fn(
        () =>
          new Observable((subscriber) => {
            subscriber.next({ delta: 'Hi', done: false });
            subscriber.next({
              done: true,
              usage: {
                promptTokens: 4,
                completionTokens: 2,
                totalTokens: 6,
                costUsd: 0.001,
              },
              finishReason: 'stop',
            });
            subscriber.complete();
          }),
      ),
      getModelCapabilities: () => capabilities,
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const usageCalculator = new UsageCalculatorService(
      new ModelCapabilitiesRegistry(providerRegistry),
    );

    const prisma = {
      metric: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as SimulationPrismaService;

    const mongo = {
      isConnected: jest.fn().mockReturnValue(false),
      getModel: jest.fn(),
    } as unknown as MongoConnectionService;

    const service = new LLMService(
      providerRegistry,
      usageCalculator,
      prisma,
      mongo,
    );

    const chunks: any[] = [];
    await new Promise<void>((resolve, reject) => {
      service.stream(request, { requestId: 'req-2' }).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    expect(chunks.some((chunk) => chunk.delta)).toBe(true);
    expect(chunks.some((chunk) => chunk.done)).toBe(true);
    expect(service.cancel('req-2')).toBe(false);
  });

  it('cancels active stream subscriptions', () => {
    const provider: ILLMProvider = {
      name: 'stub',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn() as any,
      stream: jest.fn(() => new Observable(() => undefined)),
      getModelCapabilities: () => capabilities,
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const usageCalculator = new UsageCalculatorService(
      new ModelCapabilitiesRegistry(providerRegistry),
    );

    const prisma = {
      metric: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as SimulationPrismaService;

    const mongo = {
      isConnected: jest.fn().mockReturnValue(false),
      getModel: jest.fn(),
    } as unknown as MongoConnectionService;

    const service = new LLMService(
      providerRegistry,
      usageCalculator,
      prisma,
      mongo,
    );

    const subscription = service
      .stream(request, { requestId: 'req-3' })
      .subscribe();

    expect(service.cancel('req-3')).toBe(true);

    subscription.unsubscribe();
  });

  it('propagates stream errors and records traces', async () => {
    const provider: ILLMProvider = {
      name: 'stub',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn() as any,
      stream: jest.fn(
        () =>
          new Observable((subscriber) =>
            subscriber.error(new Error('stream fail')),
          ),
      ),
      getModelCapabilities: () => capabilities,
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const usageCalculator = new UsageCalculatorService(
      new ModelCapabilitiesRegistry(providerRegistry),
    );

    const prisma = {
      metric: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as SimulationPrismaService;

    const save = jest.fn().mockResolvedValue(undefined);
    const modelCtor = jest.fn().mockImplementation((doc: any) => ({
      ...doc,
      save,
    }));

    const mongo = {
      isConnected: jest.fn().mockReturnValue(true),
      getModel: jest.fn().mockReturnValue(modelCtor),
    } as unknown as MongoConnectionService;

    const service = new LLMService(
      providerRegistry,
      usageCalculator,
      prisma,
      mongo,
    );

    await new Promise<void>((resolve) => {
      service.stream(request).subscribe({
        error: (error) => {
          expect((error as Error).message).toBe('stream fail');
          resolve();
        },
      });
    });

    expect(save).toHaveBeenCalled();
  });

  it('persists traces when Mongo is connected', async () => {
    const provider: ILLMProvider = {
      name: 'stub',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn().mockResolvedValue({
        content: 'Trace me',
        usage: {
          promptTokens: 4,
          completionTokens: 2,
          totalTokens: 6,
          costUsd: 0.001,
        },
        providerMeta: { requestId: 'req-trace' },
      }),
      stream: jest.fn() as any,
      getModelCapabilities: () => capabilities,
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const usageCalculator = new UsageCalculatorService(
      new ModelCapabilitiesRegistry(providerRegistry),
    );

    const prisma = {
      metric: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as SimulationPrismaService;

    const save = jest.fn().mockResolvedValue(undefined);
    const modelCtor = jest.fn().mockImplementation((doc: any) => ({
      ...doc,
      save,
    }));

    const mongo = {
      isConnected: jest.fn().mockReturnValue(true),
      getModel: jest.fn().mockReturnValue(modelCtor),
    } as unknown as MongoConnectionService;

    const service = new LLMService(
      providerRegistry,
      usageCalculator,
      prisma,
      mongo,
    );

    await service.complete(request);

    expect(mongo.getModel).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });

  it('persists error traces on failure', async () => {
    const provider: ILLMProvider = {
      name: 'stub',
      supportsModel: () => true,
      validateConfig: jest.fn(),
      complete: jest.fn().mockRejectedValue(new Error('provider down')),
      stream: jest.fn() as any,
      getModelCapabilities: () => capabilities,
    };

    const providerRegistry = new LLMProviderRegistry();
    providerRegistry.register(provider);

    const usageCalculator = new UsageCalculatorService(
      new ModelCapabilitiesRegistry(providerRegistry),
    );

    const prisma = {
      metric: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as SimulationPrismaService;

    const save = jest.fn().mockResolvedValue(undefined);
    const modelCtor = jest.fn().mockImplementation((doc: any) => ({
      ...doc,
      save,
    }));

    const mongo = {
      isConnected: jest.fn().mockReturnValue(true),
      getModel: jest.fn().mockReturnValue(modelCtor),
    } as unknown as MongoConnectionService;

    const service = new LLMService(
      providerRegistry,
      usageCalculator,
      prisma,
      mongo,
    );

    await expect(service.complete(request)).rejects.toThrow('provider down');
    expect(save).toHaveBeenCalled();
  });
});
