import { PassThrough } from 'stream';
import { WatsonxProvider } from '../../providers/llm/watsonx.provider';
import {
  ProviderAuthError,
  ProviderInvalidRequestError,
} from '../../providers/llm/llm-provider.interface';
import { LLMMessageDto } from '../../dto/llm.dto';

jest.mock(
  'axios',
  () => {
    const mockAxios = {
      create: jest.fn(),
      post: jest.fn(),
      isAxiosError: jest.fn(),
    };
    return { __esModule: true, default: mockAxios, ...mockAxios };
  },
  { virtual: true },
);

const axios = require('axios');

const messages: LLMMessageDto[] = [{ role: 'user', content: 'Hello' }];

describe('WatsonxProvider', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'WATSONX_API_KEY') return 'watson-key';
      if (key === 'WATSONX_PROJECT_ID') return 'project-id';
      if (key === 'WATSONX_URL') return 'https://example.com';
      return undefined;
    }),
  } as any;

  beforeEach(() => {
    (axios.create as jest.Mock).mockReturnValue({ post: jest.fn() });
    (axios.post as jest.Mock).mockResolvedValue({
      data: { access_token: 'token', expires_in: 3600 },
    });
    axios.isAxiosError.mockReturnValue(false);
  });

  it('supports WatsonX model names', () => {
    const provider = new WatsonxProvider(configService);
    expect(provider.supportsModel('granite-13b-chat')).toBe(true);
    expect(provider.supportsModel('llama-3-8b')).toBe(true);
    expect(provider.supportsModel('mixtral-8x7b')).toBe(true);
    expect(provider.supportsModel('flan-t5')).toBe(true);
    expect(provider.supportsModel('gpt-4')).toBe(false);
  });

  it('validates missing API key', () => {
    const badConfig = { get: jest.fn(() => '') } as any;
    const provider = new WatsonxProvider(badConfig);

    expect(() =>
      provider.validateConfig({ model: 'granite-13b' } as any),
    ).toThrow(ProviderAuthError);
  });

  it('validates unsupported model', () => {
    const provider = new WatsonxProvider(configService);

    expect(() => provider.validateConfig({ model: 'gpt-4' } as any)).toThrow(
      ProviderInvalidRequestError,
    );
  });

  it('validates missing project id', () => {
    const badConfig = {
      get: jest.fn((key: string) => (key === 'WATSONX_API_KEY' ? 'key' : '')),
    } as any;
    const provider = new WatsonxProvider(badConfig);

    expect(() =>
      provider.validateConfig({ model: 'granite-13b' } as any),
    ).toThrow(ProviderInvalidRequestError);
  });

  it('returns model capabilities by model family', () => {
    const provider = new WatsonxProvider(configService);

    expect(
      provider.getModelCapabilities('granite-13b').pricing
        .inputTokensPerMillion,
    ).toBe(2.0);
    expect(
      provider.getModelCapabilities('granite-34b').pricing
        .outputTokensPerMillion,
    ).toBe(12.0);
    expect(
      provider.getModelCapabilities('llama-3-70b').pricing
        .outputTokensPerMillion,
    ).toBe(15.0);
    expect(
      provider.getModelCapabilities('llama-3-8b').pricing.inputTokensPerMillion,
    ).toBe(1.0);
    expect(
      provider.getModelCapabilities('mixtral-8x7b').pricing
        .inputTokensPerMillion,
    ).toBe(3.0);
  });

  it('converts messages to prompt strings', () => {
    const provider = new WatsonxProvider(configService);
    const prompt = (provider as any).convertMessagesToPrompt([
      { role: 'user', content: 'Hello' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Ignored' }] as any,
      },
    ]);

    expect(prompt).toContain('USER: Hello');
    expect(prompt).toContain('ASSISTANT: ');
  });

  it('estimates tokens and calculates cost', () => {
    const provider = new WatsonxProvider(configService);
    const tokens = (provider as any).estimateTokens('12345678');
    const cost = (provider as any).calculateCost(10, 5, {
      pricing: { inputTokensPerMillion: 2, outputTokensPerMillion: 4 },
    });

    expect(tokens).toBe(2);
    expect(cost).toBeGreaterThan(0);
  });

  it('skips auth when token is still valid', async () => {
    const provider = new WatsonxProvider(configService) as any;
    provider.accessToken = 'cached';
    provider.tokenExpiry = Date.now() + 10 * 60 * 1000;

    await provider.ensureAuthenticated();

    expect(axios.post).not.toHaveBeenCalled();
  });

  it('throws when IAM token cannot be fetched', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('IAM down'));

    const provider = new WatsonxProvider(configService);

    await expect((provider as any).ensureAuthenticated()).rejects.toThrow(
      ProviderAuthError,
    );
  });

  it('completes responses with estimated usage', async () => {
    const provider = new WatsonxProvider(configService);
    const client = (provider as any).client;

    client.post.mockResolvedValue({
      data: {
        model_version: 'v1',
        results: [{ generated_text: 'Hi', stop_reason: 'stop' }],
      },
    });

    const response = await provider.complete(messages, {
      model: 'granite-13b',
    } as any);

    expect(response.content).toBe('Hi');
    expect(response.usage.estimated).toBe(true);
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it('streams deltas and emits final usage', async () => {
    const provider = new WatsonxProvider(configService);
    const client = (provider as any).client;

    const stream = new PassThrough();
    client.post.mockResolvedValue({ data: stream });

    const chunks: any[] = [];

    const streamPromise = new Promise<void>((resolve, reject) => {
      provider.stream(messages, { model: 'granite-13b' } as any).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    setImmediate(() => {
      stream.emit(
        'data',
        Buffer.from('data: {"results":[{"generated_text":"Hello"}]}\n'),
      );
      stream.emit('data', Buffer.from('data: [DONE]\n'));
      stream.emit('end');
    });

    await streamPromise;

    expect(chunks.some((chunk) => chunk.delta)).toBe(true);
    expect(chunks.some((chunk) => chunk.done)).toBe(true);
  });

  it('finalizes stream on end without DONE', async () => {
    const provider = new WatsonxProvider(configService);
    const client = (provider as any).client;

    const stream = new PassThrough();
    client.post.mockResolvedValue({ data: stream });

    const chunks: any[] = [];

    const streamPromise = new Promise<void>((resolve, reject) => {
      provider.stream(messages, { model: 'granite-13b' } as any).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    setImmediate(() => {
      stream.emit(
        'data',
        Buffer.from('data: {\"results\":[{\"generated_text\":\"Hi\"}]}\\n'),
      );
      stream.emit('end');
    });

    await streamPromise;

    expect(chunks.some((chunk) => chunk.done)).toBe(true);
  });

  it('handles parse errors in stream chunks', async () => {
    const provider = new WatsonxProvider(configService);
    const client = (provider as any).client;

    const stream = new PassThrough();
    client.post.mockResolvedValue({ data: stream });

    const chunks: any[] = [];

    const streamPromise = new Promise<void>((resolve, reject) => {
      provider.stream(messages, { model: 'granite-13b' } as any).subscribe({
        next: (chunk) => chunks.push(chunk),
        error: reject,
        complete: () => resolve(),
      });
    });

    setImmediate(() => {
      stream.emit('data', Buffer.from('data: {not-json}\\n'));
      stream.emit('data', Buffer.from('data: [DONE]\\n'));
      stream.emit('end');
    });

    await streamPromise;

    expect(chunks.some((chunk) => chunk.done)).toBe(true);
  });

  it('propagates stream errors', async () => {
    const provider = new WatsonxProvider(configService);
    const client = (provider as any).client;

    const stream = new PassThrough();
    client.post.mockResolvedValue({ data: stream });

    const errorPromise = new Promise<void>((resolve) => {
      provider.stream(messages, { model: 'granite-13b' } as any).subscribe({
        error: (error) => {
          expect(error).toBeInstanceOf(Error);
          resolve();
        },
      });
    });

    setImmediate(() => {
      stream.emit('error', new Error('stream failed'));
    });

    await errorPromise;
  });

  it('maps WatsonX API errors', () => {
    const provider = new WatsonxProvider(configService);

    axios.isAxiosError.mockReturnValue(true);

    const rateLimitError = {
      response: { status: 429, headers: { 'retry-after': '2' }, data: {} },
      message: 'rate limit',
    };

    const timeoutError = {
      response: { status: 504, headers: {}, data: {} },
      message: 'timeout',
    };

    const invalidError = {
      response: { status: 400, headers: {}, data: { error: 'bad request' } },
      message: 'bad',
    };

    const authError = {
      response: { status: 401, headers: {}, data: {} },
      message: 'auth',
    };

    expect((provider as any).handleError(rateLimitError).name).toBe(
      'ProviderRateLimitError',
    );
    expect((provider as any).handleError(timeoutError).name).toBe(
      'ProviderTimeoutError',
    );
    expect((provider as any).handleError(invalidError).name).toBe(
      'ProviderInvalidRequestError',
    );
    expect((provider as any).handleError(authError).name).toBe(
      'ProviderAuthError',
    );
  });

  it('maps unknown errors to ProviderError', () => {
    const provider = new WatsonxProvider(configService);
    axios.isAxiosError.mockReturnValue(false);

    const err = new Error('boom');
    const mapped = (provider as any).handleError(err);

    expect(mapped.name).toBe('ProviderError');
  });

  it('throws when model is missing', () => {
    const provider = new WatsonxProvider(configService);
    expect(() => provider.validateConfig({} as any)).toThrow(
      ProviderInvalidRequestError,
    );
  });
});
