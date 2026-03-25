import { ChatController } from '../../chat/chat.controller';
import { ChatService } from '../../chat/chat.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { RpcException } from '@nestjs/microservices';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn(
    (error: unknown) =>
      new RpcException(error instanceof Error ? error.message : 'rpc-error'),
  ),
}));

describe('ChatController', () => {
  type ChatServiceMock = {
    chat: jest.MockedFunction<ChatService['chat']>;
  };

  const createChatServiceMock = (): ChatServiceMock => ({
    chat: jest.fn(),
  });

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
    toRpcExceptionMock.mockReset();
  });

  it('returns the reply from chat service', async () => {
    const chatService = createChatServiceMock();
    chatService.chat.mockResolvedValue('Hello there!');
    const controller = new ChatController(
      chatService as unknown as ChatService,
    );

    const result = await controller.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result).toEqual({ reply: 'Hello there!' });
  });

  it('delegates messages and context to the chat service', async () => {
    const chatService = createChatServiceMock();
    chatService.chat.mockResolvedValue('Context-aware reply');
    const controller = new ChatController(
      chatService as unknown as ChatService,
    );

    const payload = {
      messages: [{ role: 'user' as const, content: 'Where am I?' }],
      context: {
        page: '/studio/sessions',
        sessionId: 'sess-1',
        recentTurns: [{ role: 'user', text: 'Hello' }],
      },
    };

    await controller.chat(payload);

    expect(chatService.chat).toHaveBeenCalledWith(
      payload.messages,
      payload.context,
    );
  });

  it('handles an empty messages array gracefully', async () => {
    const chatService = createChatServiceMock();
    chatService.chat.mockResolvedValue('Default response');
    const controller = new ChatController(
      chatService as unknown as ChatService,
    );

    const result = await controller.chat({ messages: [] });

    expect(result).toEqual({ reply: 'Default response' });
    expect(chatService.chat).toHaveBeenCalledWith([], undefined);
  });

  it('uses empty array when payload.messages is undefined', async () => {
    const chatService = createChatServiceMock();
    chatService.chat.mockResolvedValue('Default response');
    const controller = new ChatController(
      chatService as unknown as ChatService,
    );

    // Simulate a payload where messages is missing
    const result = await controller.chat({} as any);

    expect(chatService.chat).toHaveBeenCalledWith([], undefined);
    expect(result).toEqual({ reply: 'Default response' });
  });

  it('wraps chat service errors with toRpcException and rethrows', async () => {
    const chatService = createChatServiceMock();
    const error = new Error('OpenAI failure');
    const rpcError = new RpcException('OpenAI failure');
    chatService.chat.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(rpcError as any);

    const controller = new ChatController(
      chatService as unknown as ChatService,
    );

    await expect(
      controller.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow(rpcError);

    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });
});
