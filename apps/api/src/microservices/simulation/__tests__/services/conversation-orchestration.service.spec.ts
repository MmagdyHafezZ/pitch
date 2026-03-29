import { Observable, Subscriber } from 'rxjs';
import { ConversationOrchestrationService } from '../../services/conversation-orchestration.service';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import { LLMRouterService } from '../../services/llm/llm-router.service';
import { TtsService } from '../../tts/tts.service';
import { StageDetectorService } from '../../services/stage-detector.service';
import { AssessmentService } from '../../assessment/assessment.service';
import { SimulationRedisService } from '../../services/redis/redis.service';
import { RagService } from '../../rag/rag.service';
import { RagIndexerService } from '../../rag/rag-indexer.service';
import { VideoGenerationService } from '../../services/video-generation.service';
import { ConversationToolsService } from '../../services/conversation-tools.service';
import type {
  WsEnvelope,
  ConversationStartPayload,
} from '../../dto/websocket.dto';
import type { ConversationStreamEvent } from '../../dto/conversation-stream.types';

jest.mock('../../prompts/conversation.prompt', () => ({
  buildConversationSystemPrompt: jest.fn().mockReturnValue('System prompt'),
  buildConversationFallbackResponse: jest
    .fn()
    .mockReturnValue('Fallback response'),
  isDisallowedGenericFallbackReply: jest.fn().mockReturnValue(false),
}));

jest.mock('../../utils/tts-config', () => ({
  resolveTtsConfig: jest.fn().mockReturnValue({
    provider: 'elevenlabs',
    voice: 'TestVoice',
    language: 'en',
    model: 'eleven_multilingual_v2',
  }),
}));

describe('ConversationOrchestrationService', () => {
  let service: ConversationOrchestrationService;
  let prisma: any;
  let llmRouter: any;
  let ttsService: any;
  let stageDetector: any;
  let assessmentService: any;
  let redis: any;
  let ragService: any;
  let ragIndexer: any;
  let videoGeneration: any;
  let conversationTools: any;

  const mockSession = {
    id: 'session-1',
    orgId: 'org-1',
    name: 'Test Session',
    type: 'text',
    status: 'active',
    language: 'en',
    personaId: 'persona-1',
    endedReason: null,
    sessionConfig: { aiRole: 'Buyer', userRole: 'Seller' },
    scenario: {
      id: 'scenario-1',
      name: 'Sales Pitch',
      description: 'Test scenario',
      config: { stages: ['Intro', 'Discovery', 'Closing'] },
    },
    persona: {
      id: 'persona-1',
      name: 'Test Persona',
      traits: { voice: { provider: 'elevenlabs', voiceName: 'TestVoice' } },
    },
  };

  const mockSmCache = {
    sessionMemberId: 'sm-1',
    iterationId: 'iter-1',
    lastTurnOrder: 2,
  };

  const buildEnvelope = (
    overrides?: Partial<WsEnvelope<ConversationStartPayload>>,
  ): WsEnvelope<ConversationStartPayload> =>
    ({
      requestId: `req-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: 'session-1',
      userId: 'user-1',
      payload: {
        text: 'Hello there',
        startAsAssistant: false,
        skipTts: true,
      },
      ...overrides,
    }) as any;

  function makeLlmStream(
    deltas: Array<{ delta: string; done?: boolean; toolCalls?: any[] }>,
  ) {
    return new Observable((sub: Subscriber<any>) => {
      queueMicrotask(() => {
        for (const d of deltas) {
          sub.next({
            delta: d.delta,
            done: d.done ?? false,
            toolCalls: d.toolCalls,
          });
        }
        sub.complete();
      });
    });
  }

  beforeEach(() => {
    prisma = {
      client: {
        persona: { findUnique: jest.fn() },
        session: {
          findUnique: jest.fn().mockResolvedValue(mockSession),
          update: jest.fn().mockResolvedValue({}),
        },
        sessionMember: {
          findUnique: jest.fn().mockResolvedValue({ id: 'sm-1' }),
          create: jest.fn().mockResolvedValue({ id: 'sm-new' }),
        },
        iteration: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'iter-1',
            iterationNumber: 1,
            status: 'active',
          }),
          create: jest.fn().mockResolvedValue({
            id: 'iter-new',
            iterationNumber: 2,
            status: 'active',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        turn: {
          findFirst: jest.fn().mockResolvedValue({ order: 2 }),
          create: jest.fn().mockResolvedValue({ id: 'turn-1' }),
        },
        message: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        },
        event: { create: jest.fn().mockResolvedValue({}) },
      },
    };

    llmRouter = {
      stream: jest
        .fn()
        .mockImplementation(() =>
          makeLlmStream([
            { delta: 'Hello ' },
            { delta: 'World.', done: true, toolCalls: [] },
          ]),
        ),
    };

    ttsService = {
      synthesizeStream: jest.fn(),
      synthesize: jest.fn(),
    };

    stageDetector = {
      detectStage: jest.fn().mockResolvedValue({
        currentStage: { label: 'Introduction', order: 1 },
        currentStageIndex: 0,
        confidence: 0.8,
        stageTransition: false,
      }),
    };

    assessmentService = {
      enqueueLiveForTurn: jest.fn().mockResolvedValue(undefined),
    };

    redis = {
      getSessionFull: jest.fn().mockResolvedValue(mockSession),
      setSessionFull: jest.fn().mockResolvedValue(undefined),
      deleteSessionFull: jest.fn().mockResolvedValue(undefined),
      getSessionMemberIteration: jest.fn().mockResolvedValue(mockSmCache),
      setSessionMemberIteration: jest.fn().mockResolvedValue(undefined),
      getIterationHistory: jest.fn().mockResolvedValue([]),
      setIterationHistory: jest.fn().mockResolvedValue(undefined),
      appendIterationMessage: jest.fn().mockResolvedValue(undefined),
      getMoodState: jest.fn().mockResolvedValue(null),
    };

    ragService = {
      retrieve: jest.fn().mockResolvedValue([]),
    };

    ragIndexer = {
      maybeIndexPersona: jest.fn().mockResolvedValue(undefined),
      maybeIndexScenario: jest.fn().mockResolvedValue(undefined),
      indexTurn: jest.fn().mockResolvedValue(undefined),
    };

    videoGeneration = {
      resolveVideoConfig: jest.fn().mockReturnValue(null),
      queueAssistantVideo: jest.fn().mockResolvedValue(undefined),
    };

    conversationTools = {
      getToolDefinitions: jest.fn().mockReturnValue([]),
      execute: jest.fn().mockResolvedValue([]),
    };

    service = new ConversationOrchestrationService(
      prisma as unknown as SimulationPrismaService,
      llmRouter as unknown as LLMRouterService,
      ttsService as unknown as TtsService,
      stageDetector as unknown as StageDetectorService,
      assessmentService as unknown as AssessmentService,
      redis as unknown as SimulationRedisService,
      ragService as unknown as RagService,
      ragIndexer as unknown as RagIndexerService,
      videoGeneration as unknown as VideoGenerationService,
      conversationTools as unknown as ConversationToolsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function collectEvents(
    obs: Observable<ConversationStreamEvent>,
  ): Promise<ConversationStreamEvent[]> {
    return new Promise((resolve, reject) => {
      const events: ConversationStreamEvent[] = [];
      obs.subscribe({
        next: (e) => events.push(e),
        error: reject,
        complete: () => resolve(events),
      });
    });
  }

  // ── stream() ──────────────────────────────────────────────────────────────

  describe('stream()', () => {
    it('should produce delta and completed events for a happy-path text turn', async () => {
      const events = await collectEvents(service.stream(buildEnvelope()));

      const deltas = events.filter((e) => e.type === 'delta');
      const completed = events.filter((e) => e.type === 'completed');

      expect(deltas.length).toBeGreaterThanOrEqual(1);
      expect(completed).toHaveLength(1);
      expect((completed[0] as any).data.fullText).toBe('Hello World.');
    });

    it('should use cached session from Redis', async () => {
      redis.getSessionFull.mockResolvedValue(mockSession);
      await collectEvents(service.stream(buildEnvelope()));
      expect(prisma.client.session.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from DB on Redis miss and cache result', async () => {
      redis.getSessionFull.mockResolvedValue(null);
      await collectEvents(service.stream(buildEnvelope()));
      expect(prisma.client.session.findUnique).toHaveBeenCalled();
    });

    it('should error when session not found', async () => {
      redis.getSessionFull.mockResolvedValue(null);
      prisma.client.session.findUnique.mockResolvedValue(null);
      await expect(
        collectEvents(service.stream(buildEnvelope())),
      ).rejects.toThrow('Session session-1 not found');
    });

    it('should error when sessionId or userId is missing', async () => {
      await expect(
        collectEvents(
          service.stream(buildEnvelope({ sessionId: '', userId: '' })),
        ),
      ).rejects.toThrow('sessionId and userId are required');
    });

    it('should use history from Redis cache', async () => {
      const history = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ];
      redis.getIterationHistory.mockResolvedValue(history);
      await collectEvents(service.stream(buildEnvelope()));
      expect(prisma.client.message.findMany).not.toHaveBeenCalled();
    });

    it('should fetch history from DB when Redis misses', async () => {
      redis.getIterationHistory.mockResolvedValue(null);
      prisma.client.message.findMany.mockResolvedValue([
        { role: 'user', content: 'Hi', createdAt: new Date() },
      ]);
      await collectEvents(service.stream(buildEnvelope()));
      expect(prisma.client.message.findMany).toHaveBeenCalled();
      expect(redis.setIterationHistory).toHaveBeenCalled();
    });

    it('should add starter prompt when startAsAssistant with empty history', async () => {
      redis.getIterationHistory.mockResolvedValue([]);
      await collectEvents(
        service.stream(
          buildEnvelope({
            payload: { startAsAssistant: true, skipTts: true },
          }),
        ),
      );

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Start the conversation'),
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should use custom starterPrompt when provided', async () => {
      redis.getIterationHistory.mockResolvedValue([]);
      await collectEvents(
        service.stream(
          buildEnvelope({
            payload: {
              startAsAssistant: true,
              skipTts: true,
              starterPrompt: 'Begin with the elevator pitch',
            },
          }),
        ),
      );

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'Begin with the elevator pitch',
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should enqueue live assessment', async () => {
      await collectEvents(service.stream(buildEnvelope()));
      await new Promise((r) => setTimeout(r, 50));
      expect(assessmentService.enqueueLiveForTurn).toHaveBeenCalled();
    });

    it('should create new iteration when session is ended', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        status: 'ended',
        endedReason: 'time_up',
      });
      redis.getSessionMemberIteration.mockResolvedValue(null);
      prisma.client.turn.findFirst.mockResolvedValue(null);

      await collectEvents(service.stream(buildEnvelope()));

      expect(prisma.client.iteration.update).toHaveBeenCalled();
      expect(prisma.client.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('should create simulation_started event on first turn', async () => {
      redis.getSessionMemberIteration.mockResolvedValue({
        ...mockSmCache,
        lastTurnOrder: 0,
      });

      await collectEvents(service.stream(buildEnvelope()));
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.client.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'simulation_started' }),
        }),
      );
    });

    it('should emit stage_transition when stage detector detects one', async () => {
      stageDetector.detectStage.mockResolvedValue({
        currentStage: { label: 'Discovery', order: 2 },
        currentStageIndex: 1,
        confidence: 0.85,
        stageTransition: true,
        previousStageIndex: 0,
        reasoning: 'Moved to discovery',
      });

      const events = await collectEvents(service.stream(buildEnvelope()));
      const stageEvent = events.find((e) => e.type === 'stage_transition');

      expect(stageEvent).toBeDefined();
      expect((stageEvent as any).data.currentStage).toBe('Discovery');
    });

    it('should handle RAG context', async () => {
      ragService.retrieve.mockResolvedValue([
        { text: 'Product info about X', source: 'kb', refType: 'knowledge' },
      ]);

      await collectEvents(service.stream(buildEnvelope()));

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('BACKGROUND CONTEXT'),
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should gracefully handle RAG failure', async () => {
      ragService.retrieve.mockRejectedValue(new Error('RAG down'));
      const events = await collectEvents(service.stream(buildEnvelope()));
      expect(events.find((e) => e.type === 'completed')).toBeDefined();
    });

    it('should use mood state when present', async () => {
      redis.getMoodState.mockResolvedValue({
        mood: 'skeptical',
        intensity: 7,
        trigger: 'Price concern',
        setAt: '2025-01-01T00:00:00Z',
      });

      await collectEvents(service.stream(buildEnvelope()));

      const {
        buildConversationSystemPrompt,
      } = require('../../prompts/conversation.prompt');
      expect(buildConversationSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          moodContext: expect.stringContaining('skeptical'),
        }),
      );
    });

    it('should gracefully handle mood fetch failure', async () => {
      redis.getMoodState.mockRejectedValue(new Error('Redis down'));
      const events = await collectEvents(service.stream(buildEnvelope()));
      expect(events.find((e) => e.type === 'completed')).toBeDefined();
    });

    it('should use fallback when LLM returns empty text', async () => {
      llmRouter.stream.mockImplementation(() =>
        makeLlmStream([{ delta: '', done: true, toolCalls: [] }]),
      );

      const events = await collectEvents(service.stream(buildEnvelope()));
      const completed = events.find((e) => e.type === 'completed') as any;
      expect(completed.data.fullText).toBe('Fallback response');
    });

    it('should extract text from tool calls when LLM returns empty delta', async () => {
      llmRouter.stream.mockImplementation(() =>
        makeLlmStream([
          {
            delta: '',
            done: true,
            toolCalls: [
              {
                name: 'raise_objection',
                arguments: JSON.stringify({ text: 'Too expensive' }),
              },
            ],
          },
        ]),
      );

      const events = await collectEvents(service.stream(buildEnvelope()));
      const completed = events.find((e) => e.type === 'completed') as any;
      expect(completed.data.fullText).toBe('Too expensive');
    });

    it('should handle hangup_requested from tool execution', async () => {
      llmRouter.stream.mockImplementation(() =>
        makeLlmStream([
          {
            delta: 'Goodbye.',
            done: true,
            toolCalls: [
              {
                name: 'end_call',
                arguments: JSON.stringify({ reason: 'Deal closed' }),
              },
            ],
          },
        ]),
      );
      conversationTools.execute.mockResolvedValue([
        {
          tool: 'end_call',
          args: { reason: 'Deal closed' },
          streamEventOverride: 'hangup_requested',
        },
      ]);

      const events = await collectEvents(service.stream(buildEnvelope()));
      const hangup = events.find((e) => e.type === 'hangup_requested');
      expect(hangup).toBeDefined();
      expect((hangup as any).data.reason).toBe('Deal closed');
    });

    it('should queue video generation for video sessions', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        type: 'video',
      });
      videoGeneration.resolveVideoConfig.mockReturnValue({ mode: 'rendered' });

      await collectEvents(service.stream(buildEnvelope()));
      await new Promise((r) => setTimeout(r, 50));

      expect(videoGeneration.queueAssistantVideo).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('should load different persona when personaId overridden', async () => {
      prisma.client.persona.findUnique.mockResolvedValue({
        id: 'persona-2',
        name: 'Other',
        traits: {},
      });

      await collectEvents(
        service.stream(
          buildEnvelope({
            payload: { text: 'Hi', skipTts: true, personaId: 'persona-2' },
          }),
        ),
      );

      expect(prisma.client.persona.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'persona-2' } }),
      );
    });

    it('should pass LLM config override from payload', async () => {
      await collectEvents(
        service.stream(
          buildEnvelope({
            payload: {
              text: 'Hi',
              skipTts: true,
              config: {
                provider: 'anthropic',
                model: 'claude-3',
                temperature: 0.5,
                maxTokens: 200,
              },
            },
          }),
        ),
      );

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-3',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should error when LLM stream fails', async () => {
      llmRouter.stream.mockImplementation(
        () =>
          new Observable((sub: Subscriber<any>) => {
            queueMicrotask(() => sub.error(new Error('LLM provider down')));
          }),
      );

      await expect(
        collectEvents(service.stream(buildEnvelope())),
      ).rejects.toThrow('LLM provider down');
    });
  });

  // ── cancel() ──────────────────────────────────────────────────────────────

  describe('cancel()', () => {
    it('should return false for unknown requestId', async () => {
      expect(await service.cancel('unknown-id')).toBe(false);
    });
  });

  // ── resolveLlmConfig ──────────────────────────────────────────────────────

  describe('resolveLlmConfig (via stream)', () => {
    it('should use voice-optimized maxTokens for voice sessions', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        type: 'voice',
        sessionConfig: {},
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ maxTokens: 140 }),
        }),
        expect.any(Object),
      );
    });

    it('should resolve concise response length', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        sessionConfig: { responseLength: 'Concise' },
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ maxTokens: 220 }),
        }),
        expect.any(Object),
      );
    });

    it('should resolve detailed response length', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        sessionConfig: { responseLength: 'Detailed' },
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ maxTokens: 700 }),
        }),
        expect.any(Object),
      );
    });

    it('should use session config llm overrides', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        sessionConfig: {
          llm: { provider: 'anthropic', model: 'claude-3.5', temperature: 0.9 },
        },
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(llmRouter.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-3.5',
            temperature: 0.9,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  // ── getPlannedStages ──────────────────────────────────────────────────────

  describe('getPlannedStages (via stage detection)', () => {
    it('should fall back to default 5 stages when none configured', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        sessionConfig: {},
        scenario: { ...mockSession.scenario, config: {} },
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(stageDetector.detectStage).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({ label: 'Introduction' }),
          expect.objectContaining({ label: 'Closing' }),
        ]),
        'session-1',
        'user-1',
      );
    });

    it('should use scenario stages as strings', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        scenario: {
          ...mockSession.scenario,
          config: { stages: ['A', 'B', 'C'] },
        },
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(stageDetector.detectStage).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({ label: 'A' }),
          expect.objectContaining({ label: 'B' }),
          expect.objectContaining({ label: 'C' }),
        ]),
        'session-1',
        'user-1',
      );
    });

    it('should use scenario stages as objects with label/name/title', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        scenario: {
          ...mockSession.scenario,
          config: {
            stages: [
              { label: 'Open', description: 'Greet' },
              { name: 'Body' },
              { title: 'End' },
            ],
          },
        },
      });

      await collectEvents(service.stream(buildEnvelope()));

      expect(stageDetector.detectStage).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({ label: 'Open' }),
          expect.objectContaining({ label: 'Body' }),
          expect.objectContaining({ label: 'End' }),
        ]),
        'session-1',
        'user-1',
      );
    });
  });

  // ── calculateProgress ─────────────────────────────────────────────────────

  describe('calculateProgress (via completed event)', () => {
    it('should calculate progress based on turn order and duration', async () => {
      redis.getSessionFull.mockResolvedValue({
        ...mockSession,
        sessionConfig: { durationMinutes: 10 },
      });

      const events = await collectEvents(service.stream(buildEnvelope()));
      const completed = events.find((e) => e.type === 'completed') as any;

      expect(completed.data.progress).toBeGreaterThan(0);
      expect(completed.data.progress).toBeLessThanOrEqual(100);
    });
  });

  // ── resolveSessionMemberAndIteration ──────────────────────────────────────

  describe('resolveSessionMemberAndIteration (no cache)', () => {
    beforeEach(() => {
      redis.getSessionMemberIteration.mockResolvedValue(null);
      prisma.client.turn.findFirst.mockResolvedValue(null);
    });

    it('should create session member if none exists', async () => {
      prisma.client.sessionMember.findUnique.mockResolvedValue(null);

      await collectEvents(service.stream(buildEnvelope()));

      expect(prisma.client.sessionMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'session-1',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('should reuse existing active iteration', async () => {
      await collectEvents(service.stream(buildEnvelope()));
      expect(prisma.client.iteration.create).not.toHaveBeenCalled();
    });
  });
});
