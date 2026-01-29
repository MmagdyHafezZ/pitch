import { OpenAIProvider } from '../../providers/llm/openai.provider';
import {
  ProviderAuthError,
  ProviderInvalidRequestError,
} from '../../providers/llm/llm-provider.interface';
import { LLMMessageDto } from '../../dto/llm.dto';
import OpenAI from 'openai';

jest.mock(
  'openai',
  () => {
    class APIError extends Error {
      status: number;
      headers: Record<string, string> | undefined;
      error: object | undefined;
      constructor(
        status: number,
        error: object | undefined,
        message: string | undefined,
        headers: Record<string, string> | undefined,
      ) {
        super(message);
        this.status = status;
        this.headers = headers;
        this.error = error;
      }
    }

    class OpenAI {
      static APIError = APIError;
      chat = {
        completions: {
          create: jest.fn(),
        },
      };
    }

    return { __esModule: true, default: OpenAI };
  },
  { virtual: true },
);

const messages: LLMMessageDto[] = [{ role: 'user', content: 'Hello' }];

describe('OpenAIProvider', () => {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'OPENAI_API_KEY' ? 'test-key' : undefined,
    ),
  } as any;
  const pricingService = {
    getPricing: jest.fn(() => ({
      inputTokensPerMillion: 1,
      outputTokensPerMillion: 2,
    })),
  } as any;
  const createProvider = (config = configService) =>
    new OpenAIProvider(config, pricingService);

  it('supports common OpenAI model names', () => {
    const provider = createProvider();
    expect(provider.supportsModel('gpt-4o')).toBe(true);
    expect(provider.supportsModel('gpt-3.5-turbo')).toBe(true);
    expect(provider.supportsModel('claude-3')).toBe(false);
  });

  it('initializes even when API key is missing', () => {
    const provider = createProvider({
      get: jest.fn(() => undefined),
    } as any);
    expect(provider.supportsModel('gpt-4')).toBe(true);
  });

  it('validates temperature and maxTokens constraints', () => {
    const provider = createProvider();
    expect(() =>
      provider.validateConfig({ model: 'gpt-4o', temperature: -1 } as any),
    ).toThrow(ProviderInvalidRequestError);
    expect(() =>
      provider.validateConfig({ model: 'gpt-4o', maxTokens: 0 } as any),
    ).toThrow(ProviderInvalidRequestError);
    expect(() => provider.validateConfig({ model: 'claude-3' } as any)).toThrow(
      ProviderInvalidRequestError,
    );
  });

  it('returns model capabilities by model family', () => {
    const provider = createProvider();
    expect(provider.getModelCapabilities('gpt-4o').supportsVision).toBe(true);
    expect(provider.getModelCapabilities('gpt-4').maxTokens).toBe(8192);
    expect(provider.getModelCapabilities('gpt-3.5-turbo').maxTokens).toBe(
      16384,
    );
    expect(provider.getModelCapabilities('o1-mini').supportsStreaming).toBe(
      false,
    );
    expect(
      provider.getModelCapabilities('custom-model').pricing
        .inputTokensPerMillion,
    ).toBe(1);
  });

  it('converts multimodal messages to OpenAI payloads', () => {
    const provider = createProvider();
    const converted = (provider as any).convertMessages([
      { role: 'user', content: 'Hello' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Look' },
          { type: 'image', url: 'https://example.com/img.png', detail: 'low' },
          { type: 'audio', url: 's3://audio' },
        ],
      },
    ]);

    expect(converted[0].content).toBe('Hello');
    expect((converted[1].content as any[])[1].image_url.url).toBe(
      'https://example.com/img.png',
    );
    expect((converted[1].content as any[])[2].type).toBe('audio');
  });

  it('estimates tokens for string messages', () => {
    const provider = createProvider();
    const tokens = (provider as any).estimateTokens([
      { role: 'user', content: '12345678' },
      { role: 'assistant', content: '1234' },
    ]);

    expect(tokens).toBe(3);
  });

  it('maps rate limit and timeout errors', () => {
    const provider = createProvider();

    const rateLimitError = new OpenAI.APIError(
      429,
      { error: 'rate limited' },
      'rate limited',
      { 'retry-after': '2' } as any,
    );
    const timeoutError = new OpenAI.APIError(
      504,
      { error: 'timeout' },
      'timeout',
      undefined,
    );

    const rateLimitMapped = (provider as any).handleError(rateLimitError);
    const timeoutMapped = (provider as any).handleError(timeoutError);

    expect(rateLimitMapped.name).toBe('ProviderRateLimitError');
    expect(timeoutMapped.name).toBe('ProviderTimeoutError');
  });

  it('maps invalid request and unknown errors', () => {
    const provider = createProvider();

    const invalidError = new OpenAI.APIError(
      400,
      { error: 'bad request' },
      'bad request',
      undefined,
    );
    const apiError = new OpenAI.APIError(
      500,
      { error: 'server error' },
      'server error',
      undefined,
    );
    const unknown = new Error('boom');

    expect((provider as any).handleError(invalidError).name).toBe(
      'ProviderInvalidRequestError',
    );
    expect((provider as any).handleError(apiError).name).toBe('ProviderError');
    expect((provider as any).handleError(unknown).name).toBe('ProviderError');
  });

  it('validates missing model', () => {
    const provider = createProvider();
    expect(() => provider.validateConfig({} as any)).toThrow(
      ProviderInvalidRequestError,
    );
  });

  it('completes responses and maps tool calls', async () => {
    const provider = createProvider();
    const client = (provider as any).client;

    client.chat.completions.create.mockResolvedValue({
      id: 'req-1',
      model: 'gpt-4o',
      choices: [
        {
          message: {
            content: 'Hi there',
            tool_calls: [
              {
                id: 'tool-1',
                function: { name: 'draft_email', arguments: '{"foo":"bar"}' },
              },
            ],
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const response = await provider.complete(messages, {
      model: 'gpt-4o',
    } as any);

    expect(response.content).toBe('Hi there');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.usage.totalTokens).toBe(15);
    expect(response.usage.costUsd).toBeGreaterThan(0);
  });

  it('streams deltas and emits final usage', async () => {
    const provider = createProvider();
    const client = (provider as any).client;

    async function* streamGenerator() {
      await Promise.resolve();
      yield {
        choices: [{ delta: { content: 'Hel' }, finish_reason: null }],
      };
      yield {
        choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      };
    }

    client.chat.completions.create.mockResolvedValue(streamGenerator());

    const chunks: any[] = [];
    await new Promise<void>((resolve, reject) => {
      provider.stream(messages, { model: 'gpt-4o' } as any).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    expect(chunks.some((chunk) => chunk.delta)).toBe(true);
    expect(chunks.some((chunk) => chunk.done)).toBe(true);
    const final = chunks.find((chunk) => chunk.done);
    expect(final?.usage?.totalTokens).toBe(6);
  });

  it('estimates usage when stream usage is missing', async () => {
    const provider = createProvider();
    const client = (provider as any).client;

    async function* streamGenerator() {
      await Promise.resolve();
      yield {
        choices: [{ delta: { content: 'Hel' }, finish_reason: null }],
      };
      yield {
        choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }],
      };
    }

    client.chat.completions.create.mockResolvedValue(streamGenerator());

    const chunks: any[] = [];
    await new Promise<void>((resolve, reject) => {
      provider.stream(messages, { model: 'gpt-4o' } as any).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    const final = chunks.find((chunk) => chunk.done);
    expect(final?.usage?.estimated).toBe(true);
  });

  it('completes streams without final usage when finish reason is missing', async () => {
    const provider = createProvider();
    const client = (provider as any).client;

    async function* streamGenerator() {
      await Promise.resolve();
      yield {
        choices: [{ delta: { content: 'Hi' }, finish_reason: null }],
      };
    }

    client.chat.completions.create.mockResolvedValue(streamGenerator());

    const chunks: any[] = [];
    await new Promise<void>((resolve, reject) => {
      provider.stream(messages, { model: 'gpt-4o' } as any).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    expect(chunks.some((chunk) => chunk.done)).toBe(false);
  });

  it('maps OpenAI auth errors', async () => {
    const provider = createProvider();
    const client = (provider as any).client;

    client.chat.completions.create.mockRejectedValue(
      new OpenAI.APIError(
        401,
        { error: 'unauthorized' },
        'unauthorized',
        undefined,
      ),
    );

    await expect(
      provider.complete(messages, { model: 'gpt-4o' } as any),
    ).rejects.toThrow(ProviderAuthError);
  });
});
