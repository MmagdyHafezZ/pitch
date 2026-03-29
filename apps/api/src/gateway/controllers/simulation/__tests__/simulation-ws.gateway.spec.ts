import { JwtService } from '@nestjs/jwt';
import type { ClientProxy } from '@nestjs/microservices';
import { Subject } from 'rxjs';
import { SimulationWsGateway } from '../simulation-ws.gateway';
import { LLMService } from '@microservices/simulation/services/llm/llm.service';
import { ConversationOrchestrationService } from '@microservices/simulation/services/conversation-orchestration.service';
import { WsMessageType } from '@microservices/simulation/dto/websocket.dto';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const makeJwtService = (
  payload: object = { sub: 'uid', email: 'u@x.com', name: 'User' },
): jest.Mocked<JwtService> =>
  ({
    verify: jest.fn().mockReturnValue(payload),
  }) as unknown as jest.Mocked<JwtService>;

const makeLlmService = (): jest.Mocked<LLMService> =>
  ({
    stream: jest.fn(),
  }) as unknown as jest.Mocked<LLMService>;

const makeOrchestration = (): jest.Mocked<ConversationOrchestrationService> =>
  ({
    stream: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<ConversationOrchestrationService>;

/** Create a fake Socket.IO socket */
const makeSocket = (
  handshakeOverrides: Partial<{
    auth: Record<string, unknown>;
    headers: Record<string, string>;
  }> = {},
) => ({
  id: 'socket-id-1',
  data: {} as Record<string, unknown>,
  emit: jest.fn(),
  disconnect: jest.fn(),
  handshake: {
    auth: handshakeOverrides.auth ?? {},
    headers: handshakeOverrides.headers ?? {},
  },
});

const buildGateway = (
  jwtService?: jest.Mocked<JwtService>,
  llmService?: jest.Mocked<LLMService>,
  orchestration?: jest.Mocked<ConversationOrchestrationService>,
) => {
  const client = makeClient();
  const jwt = jwtService ?? makeJwtService();
  const llm = llmService ?? makeLlmService();
  const conv = orchestration ?? makeOrchestration();
  const gateway = new SimulationWsGateway(client, jwt, llm, conv);
  return { gateway, client, jwt, llm, conv };
};

// ── Base envelope factory ────────────────────────────────────────────────────

const makeChatEnvelope = (
  overrides: Partial<{
    requestId: string;
    sessionId: string;
    userId: string;
    turnId: string;
    iterationId: string;
    sessionMemberId: string;
    payload: Record<string, unknown>;
  }> = {},
) => ({
  requestId: overrides.requestId ?? 'req-1',
  sessionId: overrides.sessionId ?? 'sess-1',
  userId: overrides.userId,
  turnId: overrides.turnId ?? 'turn-1',
  iterationId: overrides.iterationId ?? 'iter-1',
  sessionMemberId: overrides.sessionMemberId ?? 'member-1',
  payload: overrides.payload ?? {
    messages: [{ role: 'user', content: 'Hi' }],
    config: {},
  },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SimulationWsGateway', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── handleConnection ──────────────────────────────────────────────────────

  describe('handleConnection()', () => {
    it('verifies the JWT from handshake.auth.token and attaches user to socket data', () => {
      const jwt = makeJwtService({
        sub: 'uid-1',
        email: 'a@b.com',
        name: 'Alice',
      });
      const { gateway } = buildGateway(jwt);

      const socket = makeSocket({ auth: { token: 'valid-token' } });
      gateway.handleConnection(socket as any);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token');
      expect(socket.data.user).toEqual({
        id: 'uid-1',
        email: 'a@b.com',
        name: 'Alice',
      });
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('verifies the JWT from the Authorization header when auth.token is absent', () => {
      const jwt = makeJwtService({
        sub: 'uid-2',
        email: 'b@b.com',
        name: 'Bob',
      });
      const { gateway } = buildGateway(jwt);

      const socket = makeSocket({
        headers: { authorization: 'Bearer header-token' },
      });
      gateway.handleConnection(socket as any);

      expect(jwt.verify).toHaveBeenCalledWith('header-token');
    });

    it('disconnects the socket when no token is provided', () => {
      const { gateway } = buildGateway();
      const socket = makeSocket();

      gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects the socket when JWT verification fails', () => {
      const jwt = makeJwtService();
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      const { gateway } = buildGateway(jwt);

      const socket = makeSocket({ auth: { token: 'bad-token' } });
      gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalled();
    });
  });

  // ── handleDisconnect ──────────────────────────────────────────────────────

  describe('handleDisconnect()', () => {
    it('cancels and cleans up any active stream for the disconnecting socket', async () => {
      const llm = makeLlmService();
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, llm, conv);

      // Set up a fake active stream via handleChatStart
      const subject = new Subject<any>();
      llm.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket({ auth: { token: 't' } });
      socket.id = 'socket-id-1';
      (gateway as any).jwtService.verify.mockReturnValue({
        sub: 'u',
        email: 'e@e.com',
        name: 'N',
      });

      // Simulate a chat start to register an active stream
      const envelope = makeChatEnvelope({ requestId: 'req-disconnect' });
      gateway.handleChatStart(socket as any, envelope as any);

      // Now disconnect — should cancel and clean up
      gateway.handleDisconnect(socket as any);

      expect(conv.cancel).toHaveBeenCalledWith(
        'req-disconnect',
        'client_disconnected',
      );
    });
  });

  // ── handlePing ────────────────────────────────────────────────────────────

  describe('handlePing()', () => {
    it('emits a PONG event back to the client with a timestamp', () => {
      const { gateway } = buildGateway();
      const socket = makeSocket();

      gateway.handlePing(socket as any);

      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.PONG,
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });
  });

  // ── handleChatCancel ──────────────────────────────────────────────────────

  describe('handleChatCancel()', () => {
    it('unsubscribes and removes the active stream for the given requestId', () => {
      const llm = makeLlmService();
      const { gateway } = buildGateway(undefined, llm);

      const subject = new Subject<any>();
      llm.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket({ auth: { token: 't' } });
      const envelope = makeChatEnvelope({ requestId: 'req-cancel' });
      (gateway as any).jwtService.verify.mockReturnValue({
        sub: 'u',
        email: 'e@e.com',
        name: 'N',
      });
      gateway.handleChatStart(socket as any, envelope as any);

      gateway.handleChatCancel({ requestId: 'req-cancel' });

      // Stream should be gone from activeStreams
      expect((gateway as any).activeStreams.has('req-cancel')).toBe(false);
    });

    it('does nothing when the requestId is not found in active streams', () => {
      const { gateway } = buildGateway();
      // Should not throw
      expect(() =>
        gateway.handleChatCancel({ requestId: 'unknown-req' }),
      ).not.toThrow();
    });
  });

  // ── handleChatStart ───────────────────────────────────────────────────────

  describe('handleChatStart()', () => {
    it('does not start a new stream when requestId already has an active stream', () => {
      const llm = makeLlmService();
      const { gateway } = buildGateway(undefined, llm);

      const subject = new Subject<any>();
      llm.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket({ auth: { token: 't' } });
      const envelope = makeChatEnvelope({ requestId: 'req-dedup' });
      (gateway as any).jwtService.verify.mockReturnValue({
        sub: 'u',
        email: 'e@e.com',
        name: 'N',
      });

      gateway.handleChatStart(socket as any, envelope as any);
      gateway.handleChatStart(socket as any, envelope as any); // second call — should be a no-op

      expect(llm.stream).toHaveBeenCalledTimes(1);
    });

    it('injects userId from socket.data.user when envelope.userId is missing', () => {
      const llm = makeLlmService();
      const { gateway } = buildGateway(undefined, llm);

      const subject = new Subject<any>();
      llm.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket({ auth: { token: 't' } });
      socket.data = {
        user: { id: 'inferred-uid', email: 'x@x.com', name: 'X' },
      };

      const envelope = makeChatEnvelope({ requestId: 'req-uid' });
      delete (envelope as any).userId;

      gateway.handleChatStart(socket as any, envelope as any);

      expect((envelope as any).userId).toBe('inferred-uid');
    });

    it('emits CHAT_COMPLETED when the LLM stream completes with done=true', () => {
      const llm = makeLlmService();
      const { gateway } = buildGateway(undefined, llm);

      const subject = new Subject<any>();
      llm.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket({ auth: { token: 't' } });
      const envelope = makeChatEnvelope({ requestId: 'req-complete' });

      gateway.handleChatStart(socket as any, envelope as any);

      subject.next({ delta: 'Hello ', done: false });
      subject.next({
        delta: 'World!',
        done: true,
        usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
        finishReason: 'stop',
      });

      jest.runAllTimers();

      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.CHAT_COMPLETED,
        expect.objectContaining({
          payload: expect.objectContaining({
            content: 'Hello World!',
          }),
        }),
      );
    });

    it('emits CHAT_ERROR when the LLM stream throws', () => {
      const llm = makeLlmService();
      const { gateway } = buildGateway(undefined, llm);

      const subject = new Subject<any>();
      llm.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket({ auth: { token: 't' } });
      const envelope = makeChatEnvelope({ requestId: 'req-err' });

      gateway.handleChatStart(socket as any, envelope as any);
      subject.error(new Error('LLM exploded'));

      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.CHAT_ERROR,
        expect.objectContaining({
          payload: expect.objectContaining({ error: 'LLM exploded' }),
        }),
      );
    });
  });

  // ── handleConversationCancel ───────────────────────────────────────────────

  describe('handleConversationCancel()', () => {
    it('cancels the orchestration and emits CONVERSATION_CANCEL to the client', async () => {
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, undefined, conv);
      const socket = makeSocket();

      await gateway.handleConversationCancel(socket as any, {
        requestId: 'req-conv-cancel',
        sessionId: 'sess-cancel',
      });

      expect(conv.cancel).toHaveBeenCalledWith(
        'req-conv-cancel',
        'user_interrupt',
      );
      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.CONVERSATION_CANCEL,
        expect.objectContaining({
          requestId: 'req-conv-cancel',
          sessionId: 'sess-cancel',
        }),
      );
    });
  });

  // ── handleVisualState ──────────────────────────────────────────────────────

  describe('handleVisualState()', () => {
    it('stores the serialised visual state without throwing', () => {
      const { gateway } = buildGateway();

      const data = {
        sessionId: 'sess-visual',
        state: {
          present: true,
          posture: 'upright',
          gaze: 'camera',
          movement: 'low',
        },
      };

      expect(() => gateway.handleVisualState(data as any)).not.toThrow();
      expect((gateway as any).visualContexts.has('sess-visual')).toBe(true);
    });

    it('does nothing when sessionId or state is missing', () => {
      const { gateway } = buildGateway();

      expect(() =>
        gateway.handleVisualState({ sessionId: '', state: null } as any),
      ).not.toThrow();
      expect(() =>
        gateway.handleVisualState({ sessionId: 'x', state: undefined } as any),
      ).not.toThrow();
    });
  });

  // ── handleConversationStart ────────────────────────────────────────────────

  describe('handleConversationStart()', () => {
    it('does not start a new stream when requestId already active', () => {
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, undefined, conv);

      const subject = new Subject<any>();
      conv.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket();
      const envelope = {
        requestId: 'conv-req-dedup',
        sessionId: 'sess-1',
        turnId: 't1',
        payload: { audioEnabled: false },
      };

      gateway.handleConversationStart(socket as any, envelope as any);
      gateway.handleConversationStart(socket as any, envelope as any);

      expect(conv.stream).toHaveBeenCalledTimes(1);

      jest.runAllTimers();
    });

    it('emits CONVERSATION_END on stream complete', () => {
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, undefined, conv);

      const subject = new Subject<any>();
      conv.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket();
      const envelope = {
        requestId: 'conv-req-end',
        sessionId: 'sess-end',
        turnId: 't1',
        payload: {},
      };

      gateway.handleConversationStart(socket as any, envelope as any);
      subject.complete();

      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.CONVERSATION_END,
        expect.objectContaining({ requestId: 'conv-req-end' }),
      );

      jest.runAllTimers();
    });

    it('emits CONVERSATION_ERROR on stream error', () => {
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, undefined, conv);

      const subject = new Subject<any>();
      conv.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket();
      const envelope = {
        requestId: 'conv-req-err',
        sessionId: 'sess-err',
        turnId: 't1',
        payload: {},
      };

      gateway.handleConversationStart(socket as any, envelope as any);
      subject.error(new Error('conversation failed'));

      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.CONVERSATION_ERROR,
        expect.objectContaining({
          payload: expect.objectContaining({ error: 'conversation failed' }),
        }),
      );

      jest.runAllTimers();
    });

    it('emits CONVERSATION_STREAM_DELTA on delta events', () => {
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, undefined, conv);

      const subject = new Subject<any>();
      conv.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket();
      const envelope = {
        requestId: 'conv-req-delta',
        sessionId: 'sess-delta',
        turnId: 't1',
        payload: {},
      };

      gateway.handleConversationStart(socket as any, envelope as any);
      subject.next({
        type: 'delta',
        data: { delta: 'Hi', isFirstChunk: true },
      });

      expect(socket.emit).toHaveBeenCalledWith(
        WsMessageType.CONVERSATION_STREAM_DELTA,
        expect.objectContaining({
          payload: expect.objectContaining({ delta: 'Hi', isFirstChunk: true }),
        }),
      );

      jest.runAllTimers();
    });

    it('injects stored visual context into the envelope payload', () => {
      const conv = makeOrchestration();
      const { gateway } = buildGateway(undefined, undefined, conv);

      // Pre-store a visual context
      (gateway as any).visualContexts.set(
        'sess-visual-inject',
        'Engagement: HIGH. Camera observation: person is visible, sitting upright, looking directly at the camera, still and composed.',
      );

      const subject = new Subject<any>();
      conv.stream.mockReturnValue(subject.asObservable());

      const socket = makeSocket();
      const envelope = {
        requestId: 'conv-req-visual',
        sessionId: 'sess-visual-inject',
        turnId: 't1',
        payload: {},
      };

      gateway.handleConversationStart(socket as any, envelope as any);

      expect((envelope as any).payload.visualContext).toContain(
        'Engagement: HIGH',
      );

      jest.runAllTimers();
    });
  });
});
