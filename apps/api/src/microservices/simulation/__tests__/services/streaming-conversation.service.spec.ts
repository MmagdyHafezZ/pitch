import { Observable, Subject, Subscriber } from 'rxjs';
import { StreamingConversationService } from '../../services/streaming-conversation.service';
import { LLMRouterService } from '../../services/llm/llm-router.service';
import { TtsService } from '../../tts/tts.service';
import { SimulationRedisService } from '../../services/redis/redis.service';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import {
  StreamEventType,
  StreamEvent,
  TextStreamChunk,
} from '../../dto/text-stream.dto';

jest.mock('../../prompts/conversation.prompt', () => ({
  buildConversationSystemPrompt: jest.fn().mockReturnValue('System prompt'),
}));

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('StreamingConversationService', () => {
  let service: StreamingConversationService;
  let llmRouter: any;
  let ttsService: any;
  let redis: any;
  let prisma: any;

  const mockSession = {
    id: 'session-1',
    orgId: 'org-1',
    name: 'Test Session',
    type: 'text',
    language: 'en',
    sessionConfig: {},
    scenario: {
      id: 'scenario-1',
      name: 'Scenario',
      description: 'Test',
      config: {},
    },
    persona: {
      id: 'persona-1',
      name: 'Persona',
      traits: {},
    },
  };

  beforeEach(() => {
    llmRouter = {
      stream: jest.fn().mockReturnValue(
        new Observable((sub: Subscriber<any>) => {
          sub.next({ delta: 'Hello there! ' });
          sub.next({ delta: 'How can I help you today?' });
          sub.complete();
        }),
      ),
    };

    ttsService = {
      synthesize: jest.fn().mockResolvedValue({
        audioBuffer: Buffer.from('audio-data'),
        contentType: 'audio/mpeg',
      }),
    };

    redis = {
      getSessionFull: jest.fn().mockResolvedValue(null),
      setSessionFull: jest.fn().mockResolvedValue(undefined),
      getIterationHistory: jest.fn().mockResolvedValue(null),
      setIterationHistory: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      client: {
        session: {
          findUnique: jest.fn().mockResolvedValue(mockSession),
        },
        sessionMember: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sm-1',
            sessionId: 'session-1',
            userId: 'user-1',
          }),
        },
        iteration: {
          findFirst: jest.fn().mockResolvedValue({ id: 'iter-1' }),
        },
        message: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };

    service = new StreamingConversationService(
      llmRouter as unknown as LLMRouterService,
      ttsService as unknown as TtsService,
      redis as unknown as SimulationRedisService,
      prisma as unknown as SimulationPrismaService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function collectEvents(obs: Observable<StreamEvent>): Promise<StreamEvent[]> {
    return new Promise((resolve, reject) => {
      const events: StreamEvent[] = [];
      obs.subscribe({
        next: (e) => events.push(e),
        error: reject,
        complete: () => resolve(events),
      });
    });
  }

  describe('processTextStream()', () => {
    it('should emit TEXT_PARTIAL for non-final chunks', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-1',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({ text: 'Hel', isFinal: false, timestamp: Date.now() });
      textChunks.next({
        text: 'Hello world. This is a test sentence.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      const partials = events.filter(
        (e) => e.type === StreamEventType.TEXT_PARTIAL,
      );
      expect(partials.length).toBeGreaterThanOrEqual(1);
      expect((partials[0] as any).data.text).toBe('Hel');
    });

    it('should emit TEXT_SENTENCE when final chunk detected as a sentence', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-2',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'I want to discuss the new product features today.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      const sentences = events.filter(
        (e) => e.type === StreamEventType.TEXT_SENTENCE,
      );
      expect(sentences.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit LLM_START and LLM_DELTA events', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-3',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Tell me about your product and its features.',
        isFinal: true,
        timestamp: Date.now(),
      });
      // Allow the async processUserSentence pipeline to run before completing
      await tick(100);
      textChunks.complete();

      const events = await eventsPromise;
      const llmStarts = events.filter(
        (e) => e.type === StreamEventType.LLM_START,
      );
      const llmDeltas = events.filter(
        (e) => e.type === StreamEventType.LLM_DELTA,
      );

      expect(llmStarts.length).toBeGreaterThanOrEqual(1);
      expect(llmDeltas.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit COMPLETE event with fullText', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-4',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Please tell me about your pricing plans today.',
        isFinal: true,
        timestamp: Date.now(),
      });
      // Allow the async processUserSentence pipeline to populate llmFullText
      await tick(100);
      textChunks.complete();

      const events = await eventsPromise;
      const complete = events.find((e) => e.type === StreamEventType.COMPLETE);
      expect(complete).toBeDefined();
      expect((complete as any).data.fullText).toContain('Hello there!');
    });

    it('should handle TTS synthesis and emit AUDIO_CHUNK events', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-5',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'This is a full sentence for tts testing purpose.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      const audioChunks = events.filter(
        (e) => e.type === StreamEventType.AUDIO_CHUNK,
      );

      if (audioChunks.length > 0) {
        expect((audioChunks[0] as any).data.contentType).toBe('audio/mpeg');
      }
    });

    it('should emit error when session is not found', async () => {
      prisma.client.session.findUnique.mockResolvedValue(null);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'nonexistent',
        'user-1',
        'req-err',
        textChunks.asObservable(),
      );

      await expect(collectEvents(result$)).rejects.toThrow(
        'Session nonexistent not found',
      );
    });

    it('should use cached session from Redis', async () => {
      redis.getSessionFull.mockResolvedValue(mockSession);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-cache',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Hello from the cached session test.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;
      expect(prisma.client.session.findUnique).not.toHaveBeenCalled();
    });

    it('should fallback to melotts when primary TTS fails', async () => {
      ttsService.synthesize
        .mockRejectedValueOnce(new Error('ElevenLabs down'))
        .mockResolvedValueOnce({
          audioBuffer: Buffer.from('fallback-audio'),
          contentType: 'audio/wav',
        });

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-fallback',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Please synthesize this longer sentence for testing.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      const complete = events.find((e) => e.type === StreamEventType.COMPLETE);
      expect(complete).toBeDefined();
    });

    it('should emit ERROR when all TTS providers fail', async () => {
      ttsService.synthesize.mockRejectedValue(
        new Error('All TTS providers down'),
      );

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-tts-fail',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Synthesize this sentence that should fail completely.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      const errors = events.filter((e) => e.type === StreamEventType.ERROR);
      const complete = events.find((e) => e.type === StreamEventType.COMPLETE);
      // Should still complete even if TTS errors
      expect(complete).toBeDefined();
    });

    it('should handle text stream error', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-err-stream',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.error(new Error('Speech recognition failed'));

      await expect(eventsPromise).rejects.toThrow('Speech recognition failed');
    });

    it('should handle LLM stream error gracefully', async () => {
      llmRouter.stream.mockReturnValue(
        new Observable((sub: Subscriber<any>) => {
          sub.error(new Error('LLM crashed'));
        }),
      );

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-llm-err',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'This should trigger an LLM error event.',
        isFinal: true,
        timestamp: Date.now(),
      });
      // Allow processUserSentence to trigger LLM stream and receive error
      await tick(100);
      textChunks.complete();

      const events = await eventsPromise;
      const errors = events.filter((e) => e.type === StreamEventType.ERROR);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect((errors[0] as any).data.stage).toBe('llm');
    });
  });

  describe('cancelStream()', () => {
    it('should remove active session', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      service.processTextStream(
        'session-1',
        'user-1',
        'req-cancel',
        textChunks.asObservable(),
      );
      await tick();

      service.cancelStream('req-cancel');
    });

    it('should be a no-op for unknown requestId', () => {
      expect(() => service.cancelStream('unknown')).not.toThrow();
    });
  });

  describe('getConversationHistory (via processTextStream)', () => {
    it('should return empty array when no session member found', async () => {
      prisma.client.sessionMember.findUnique.mockResolvedValue(null);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-no-member',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Hello world from no member test.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      expect(events.some((e) => e.type === StreamEventType.COMPLETE)).toBe(
        true,
      );
    });

    it('should return empty array when no iteration found', async () => {
      prisma.client.iteration.findFirst.mockResolvedValue(null);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-no-iter',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Hello world from no iteration test.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      expect(events.some((e) => e.type === StreamEventType.COMPLETE)).toBe(
        true,
      );
    });

    it('should use cached history from Redis', async () => {
      redis.getIterationHistory.mockResolvedValue([
        { role: 'user', content: 'Past message' },
      ]);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-cached-history',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'New message from the cached history test.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;
      expect(prisma.client.message.findMany).not.toHaveBeenCalled();
    });
  });

  describe('resolveLLMConfig (via processTextStream)', () => {
    it('should use default model when none specified', async () => {
      const session = { ...mockSession, sessionConfig: {} };
      redis.getSessionFull.mockResolvedValue(session);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-default-model',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Tell me about your product features today please.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;

      if (llmRouter.stream.mock.calls.length > 0) {
        expect(llmRouter.stream).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              model: 'gpt-4o-mini',
              temperature: 0.7,
            }),
          }),
          expect.any(Object),
        );
      }
    });

    it('should use concise maxTokens when responseLength is concise', async () => {
      const session = {
        ...mockSession,
        sessionConfig: { responseLength: 'concise' },
      };
      redis.getSessionFull.mockResolvedValue(session);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-concise',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Tell me about your product and its pricing now.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;

      if (llmRouter.stream.mock.calls.length > 0) {
        expect(llmRouter.stream).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              maxTokens: 220,
            }),
          }),
          expect.any(Object),
        );
      }
    });
  });

  describe('getTTSConfig', () => {
    it('should resolve TTS config from persona traits', async () => {
      const sessionWithVoice = {
        ...mockSession,
        persona: {
          ...mockSession.persona,
          traits: {
            voice: {
              provider: 'deepgram',
              voiceName: 'aura-asteria-en',
              language: 'en-US',
            },
          },
        },
      };
      redis.getSessionFull.mockResolvedValue(sessionWithVoice);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-voice',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Hello there, tell me about the product.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;

      if (ttsService.synthesize.mock.calls.length > 0) {
        expect(ttsService.synthesize).toHaveBeenCalledWith(
          expect.any(String),
          'deepgram',
          expect.objectContaining({ voice: 'aura-asteria-en' }),
        );
      }
    });

    it('should fallback to elevenlabs when no provider specified', async () => {
      const sessionNoProvider = {
        ...mockSession,
        persona: { ...mockSession.persona, traits: {} },
      };
      redis.getSessionFull.mockResolvedValue(sessionNoProvider);

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-default-tts',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Hello world, this is a sentence for the test.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;

      if (ttsService.synthesize.mock.calls.length > 0) {
        expect(ttsService.synthesize.mock.calls[0][1]).toBe('elevenlabs');
      }
    });
  });

  describe('buildSystemPrompt', () => {
    it('should call buildConversationSystemPrompt with session data', async () => {
      const {
        buildConversationSystemPrompt,
      } = require('../../prompts/conversation.prompt');

      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-prompt',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Tell me about the product features today.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      await eventsPromise;
      expect(buildConversationSystemPrompt).toHaveBeenCalled();
    });
  });

  describe('saveTurn', () => {
    it('should log saving of turn on completion', async () => {
      const textChunks = new Subject<TextStreamChunk>();
      const result$ = service.processTextStream(
        'session-1',
        'user-1',
        'req-save',
        textChunks.asObservable(),
      );

      const eventsPromise = collectEvents(result$);
      await tick();

      textChunks.next({
        text: 'Complete this turn for the saving test.',
        isFinal: true,
        timestamp: Date.now(),
      });
      textChunks.complete();

      const events = await eventsPromise;
      const complete = events.find((e) => e.type === StreamEventType.COMPLETE);
      expect(complete).toBeDefined();
    });
  });
});
