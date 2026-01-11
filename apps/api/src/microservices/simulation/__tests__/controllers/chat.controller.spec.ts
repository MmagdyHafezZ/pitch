import { Test, TestingModule } from '@nestjs/testing';
import { Observable, lastValueFrom, toArray } from 'rxjs';
import { ChatController } from '../../controllers/chat.controller';
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
import { WsEnvelope, WsMessageType } from '../../dto/websocket.dto';

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

describe('ChatController', () => {
  let controller: ChatController;
  let providerRegistry: LLMProviderRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        LLMService,
        LLMProviderRegistry,
        UsageCalculatorService,
        ModelCapabilitiesRegistry,
        {
          provide: SimulationPrismaService,
          useValue: { metric: { create: jest.fn().mockResolvedValue({}) } },
        },
        {
          provide: MongoConnectionService,
          useValue: {
            isConnected: jest.fn().mockReturnValue(false),
            getModel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ChatController);
    providerRegistry = module.get(LLMProviderRegistry);

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
      stream: jest.fn().mockImplementation(() => {
        return new Observable((subscriber) => {
          subscriber.next({ delta: 'Hi', done: false });
          subscriber.next({
            done: true,
            usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
          });
          subscriber.complete();
        });
      }),
      getModelCapabilities: () => capabilities,
    };

    providerRegistry.register(provider);
  });

  it('completes chat requests from ws envelopes', async () => {
    const envelope: WsEnvelope<any> = {
      type: WsMessageType.CHAT_START,
      requestId: 'req-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      payload: {
        sessionId: 'session-1',
        turnId: 'turn-1',
        messages: [{ role: 'user', content: 'Hello' }],
        config: { model: 'stub-model', provider: 'stub' },
      },
    };

    const response = await controller.complete(envelope as any);

    expect(response.content).toBe('Hi');
    expect(response.usage.totalTokens).toBe(6);
  });

  it('streams chat requests from ws envelopes', async () => {
    const envelope: WsEnvelope<any> = {
      type: WsMessageType.CHAT_START,
      requestId: 'req-2',
      sessionId: 'session-1',
      turnId: 'turn-1',
      payload: {
        sessionId: 'session-1',
        turnId: 'turn-1',
        messages: [{ role: 'user', content: 'Hello' }],
        config: { model: 'stub-model', provider: 'stub', stream: true },
      },
    };

    const stream$ = controller.stream(envelope as any);
    const chunks = await lastValueFrom(stream$.pipe(toArray()));

    expect(chunks.length).toBe(2);
    expect(chunks[0].delta).toBe('Hi');
    expect(chunks[1].done).toBe(true);
  });

  it('cancels chat requests', () => {
    const result = controller.cancel({ requestId: 'missing' });
    expect(result.cancelled).toBe(false);
  });
});
