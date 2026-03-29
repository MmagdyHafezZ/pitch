import { ChatService } from '../../chat/chat.service';
import type { ConfigService } from '@nestjs/config';

// Mock the openai module so no real network calls are made
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

import OpenAI from 'openai';

describe('ChatService', () => {
  const createConfigServiceMock = (
    apiKey = 'test-api-key',
  ): jest.Mocked<ConfigService> =>
    ({
      get: jest.fn().mockReturnValue(apiKey),
    }) as unknown as jest.Mocked<ConfigService>;

  const getOpenAiInstance = (): {
    chat: { completions: { create: jest.MockedFunction<any> } };
  } => {
    const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
    return MockOpenAI.mock.results[MockOpenAI.mock.results.length - 1]
      .value as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is instantiatable (defined)', () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    expect(service).toBeDefined();
  });

  it('reads OPENAI_API_KEY from config on construction', () => {
    const configService = createConfigServiceMock('sk-test');
    new ChatService(configService);
    expect(configService.get).toHaveBeenCalledWith('OPENAI_API_KEY');
  });

  it('returns the assistant reply from the OpenAI response', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Hello, how can I help?' } }],
    });

    const result = await service.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Hello, how can I help?');
  });

  it('returns fallback message when response content is null', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await service.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Sorry, I could not generate a response.');
  });

  it('returns fallback message when choices array is empty', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({ choices: [] });

    const result = await service.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Sorry, I could not generate a response.');
  });

  it('passes the system prompt and user messages to OpenAI', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Reply' } }],
    });

    await service.chat([
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Response' },
    ]);

    const call = openai.chat.completions.create.mock.calls[0][0];
    expect(call.model).toBe('gpt-4o-mini');
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[1]).toEqual({
      role: 'user',
      content: 'First message',
    });
    expect(call.messages[2]).toEqual({
      role: 'assistant',
      content: 'Response',
    });
  });

  it('appends current page to the system prompt when context.page is provided', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Reply' } }],
    });

    await service.chat([{ role: 'user', content: 'Where am I?' }], {
      page: '/studio/sessions',
    });

    const call = openai.chat.completions.create.mock.calls[0][0];
    expect(call.messages[0].content).toContain(
      '[CURRENT PAGE: /studio/sessions]',
    );
  });

  it('appends session conversation to system prompt when context.sessionId and recentTurns provided', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Reply' } }],
    });

    await service.chat([{ role: 'user', content: 'How am I doing?' }], {
      sessionId: 'sess-1',
      recentTurns: [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there' },
      ],
    });

    const call = openai.chat.completions.create.mock.calls[0][0];
    expect(call.messages[0].content).toContain(
      '[CURRENT SESSION CONVERSATION]',
    );
    expect(call.messages[0].content).toContain('USER: Hello');
    expect(call.messages[0].content).toContain('ASSISTANT: Hi there');
  });

  it('does not append session conversation when recentTurns is empty', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Reply' } }],
    });

    await service.chat([{ role: 'user', content: 'Hi' }], {
      sessionId: 'sess-2',
      recentTurns: [],
    });

    const call = openai.chat.completions.create.mock.calls[0][0];
    expect(call.messages[0].content).not.toContain(
      '[CURRENT SESSION CONVERSATION]',
    );
  });

  it('rethrows errors thrown by the OpenAI client', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    const networkError = new Error('Network error');
    openai.chat.completions.create.mockRejectedValue(networkError);

    await expect(
      service.chat([{ role: 'user', content: 'Hi' }]),
    ).rejects.toThrow(networkError);
  });

  it('calls OpenAI with stream=false', async () => {
    const configService = createConfigServiceMock();
    const service = new ChatService(configService);
    const openai = getOpenAiInstance();

    openai.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'OK' } }],
    });

    await service.chat([{ role: 'user', content: 'Hi' }]);

    const call = openai.chat.completions.create.mock.calls[0][0];
    expect(call.stream).toBe(false);
  });
});
