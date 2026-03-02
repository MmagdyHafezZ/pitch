import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SentenceDetector } from '../utils/sentence-detector';
import { LLMRouterService } from './llm/llm-router.service';
import { TtsService } from '../tts/tts.service';
import { SimulationRedisService } from './redis/redis.service';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import {
  StreamEvent,
  StreamEventType,
  TextStreamChunk,
} from '../dto/text-stream.dto';
import { LLMConfigDto, LLMMessageDto } from '../dto/llm.dto';
import type { Prisma } from '@prisma/simulation-client';
import type { TtsResult } from '../tts/providers/tts.provider';
import { buildConversationSystemPrompt } from '../prompts/conversation.prompt';

interface StreamingSession {
  sessionId: string;
  userId: string;
  turnId?: string;
  requestId: string;
  sentenceDetector: SentenceDetector;
  userSentences: string[];
  llmSentences: string[];
  llmFullText: string;
  audioQueue: Map<number, Promise<void>>;
}

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const toRecord = (value: Prisma.JsonValue | null | undefined): JsonRecord =>
  isRecord(value) ? value : {};

interface LlmConfigOverride {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface SessionConfig extends JsonRecord {
  llm?: LlmConfigOverride;
  llmConfig?: LlmConfigOverride;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseLength?: string;
  systemPrompt?: string;
  customPrompt?: string;
  aiRole?: string;
  userRole?: string;
  ttsProvider?: string;
  ttsVoice?: string;
  ttsModel?: string;
  voice?: {
    provider?: string;
    voice?: string;
    voiceName?: string;
    language?: string;
    model?: string;
  };
}

type SessionWithRelations = Prisma.SessionGetPayload<{
  include: { scenario: true; persona: true };
}>;

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/**
 * Streaming Conversation Service
 *
 * Orchestrates the full streaming pipeline:
 * 1. Receive streaming text from Web Speech API
 * 2. Detect sentence boundaries in real-time
 * 3. Start LLM generation per sentence
 * 4. Detect sentences in LLM output
 * 5. Synthesize TTS incrementally
 * 6. Stream audio chunks as ready
 */
@Injectable()
export class StreamingConversationService {
  private readonly logger = new Logger(StreamingConversationService.name);
  private readonly activeSessions = new Map<string, StreamingSession>();

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly ttsService: TtsService,
    private readonly redis: SimulationRedisService,
    private readonly prisma: SimulationPrismaService,
  ) {}

  /**
   * Process streaming text input from Web Speech API
   */
  processTextStream(
    sessionId: string,
    userId: string,
    requestId: string,
    textChunks: Observable<TextStreamChunk>,
  ): Observable<StreamEvent> {
    const subject = new Subject<StreamEvent>();

    this.handleTextStream(
      sessionId,
      userId,
      requestId,
      textChunks,
      subject,
    ).catch((error) => {
      this.logger.error('Text stream processing failed', error);
      subject.error(error);
    });

    return subject.asObservable();
  }

  private async handleTextStream(
    sessionId: string,
    userId: string,
    requestId: string,
    textChunks: Observable<TextStreamChunk>,
    subject: Subject<StreamEvent>,
  ): Promise<void> {
    try {
      // Load session data with caching
      const session = await this.getSessionCached(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const language = session.language ?? 'en';

      // Initialize streaming session
      const streamSession: StreamingSession = {
        sessionId,
        userId,
        requestId,
        sentenceDetector: new SentenceDetector({
          minWords: 3,
          language,
          aggressiveness: 'balanced',
        }),
        userSentences: [],
        llmSentences: [],
        llmFullText: '',
        audioQueue: new Map(),
      };

      this.activeSessions.set(requestId, streamSession);

      // Subscribe to text chunks
      textChunks.subscribe({
        next: (chunk) => {
          void (async () => {
            if (!chunk.isFinal) {
              // Emit partial transcript
              subject.next({
                type: StreamEventType.TEXT_PARTIAL,
                data: {
                  text: chunk.text,
                  timestamp: chunk.timestamp,
                },
              });
              return;
            }

            // Add text to sentence detector
            const sentences = streamSession.sentenceDetector.addText(
              chunk.text,
            );

            // Process complete sentences
            for (const sentenceChunk of sentences) {
              streamSession.userSentences.push(sentenceChunk.sentence);

              // Emit sentence detected
              subject.next({
                type: StreamEventType.TEXT_SENTENCE,
                data: {
                  sentence: sentenceChunk.sentence,
                  confidence: sentenceChunk.confidence,
                  timestamp: Date.now(),
                },
              });

              // Start LLM generation for this sentence
              await this.processUserSentence(
                streamSession,
                sentenceChunk.sentence,
                session,
                subject,
              );
            }
          })().catch((error: unknown) => {
            this.logger.error('Error processing text chunk', error);
          });
        },
        error: (error) => {
          this.logger.error('Text chunk stream error', error);
          subject.error(error);
          this.activeSessions.delete(requestId);
        },
        complete: () => {
          void (async () => {
            // Flush any remaining text from sentence detector
            const remaining = streamSession.sentenceDetector.flush();
            if (remaining) {
              streamSession.userSentences.push(remaining.sentence);

              subject.next({
                type: StreamEventType.TEXT_SENTENCE,
                data: {
                  sentence: remaining.sentence,
                  confidence: remaining.confidence,
                  timestamp: Date.now(),
                },
              });

              // Process final sentence
              await this.processUserSentence(
                streamSession,
                remaining.sentence,
                session,
                subject,
              );
            }

            // Wait for all audio synthesis to complete
            await Promise.all(streamSession.audioQueue.values());

            // Save conversation turn to database
            this.saveTurn(streamSession);

            // Emit complete
            subject.next({
              type: StreamEventType.COMPLETE,
              data: {
                fullText: streamSession.llmFullText,
                totalSentences: streamSession.llmSentences.length,
                timestamp: Date.now(),
              },
            });

            // Clean up
            this.activeSessions.delete(requestId);
            subject.complete();
          })().catch((error: unknown) => {
            this.logger.error('Error completing text stream', error);
            subject.error(error);
            this.activeSessions.delete(requestId);
          });
        },
      });
    } catch (error) {
      this.logger.error('Failed to initialize text stream', error);
      subject.error(error);
      this.activeSessions.delete(requestId);
    }
  }

  private async processUserSentence(
    streamSession: StreamingSession,
    userSentence: string,
    session: SessionWithRelations,
    subject: Subject<StreamEvent>,
  ): Promise<void> {
    try {
      // Get conversation history from cache
      const history = await this.getConversationHistory(
        streamSession.sessionId,
        streamSession.userId,
      );

      // Build LLM messages
      const messages: LLMMessageDto[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(session),
        },
        ...history,
        {
          role: 'user',
          content: userSentence,
        },
      ];

      // Emit LLM start
      subject.next({
        type: StreamEventType.LLM_START,
        data: {
          timestamp: Date.now(),
        },
      });

      // Start LLM streaming
      const llmStream$ = this.llmRouter.stream(
        {
          sessionId: streamSession.sessionId,
          userId: streamSession.userId,
          messages,
          config: this.resolveLLMConfig(session),
        },
        {
          userId: streamSession.userId,
          orgId: session.orgId,
          requestId: streamSession.requestId,
          purpose: 'conversation_stream',
        },
      );

      // Track LLM sentence detection
      const llmSentenceDetector = new SentenceDetector({
        minWords: 3,
        aggressiveness: 'balanced',
      });

      let sentenceIndex = streamSession.llmSentences.length;

      // Subscribe to LLM chunks
      llmStream$.subscribe({
        next: (chunk) => {
          if (chunk.delta) {
            streamSession.llmFullText += chunk.delta;

            // Emit LLM delta
            subject.next({
              type: StreamEventType.LLM_DELTA,
              data: {
                delta: chunk.delta,
                timestamp: Date.now(),
              },
            });

            // Detect sentences in LLM output
            const sentences = llmSentenceDetector.addText(chunk.delta);

            for (const sentenceChunk of sentences) {
              streamSession.llmSentences.push(sentenceChunk.sentence);

              // Emit LLM sentence
              subject.next({
                type: StreamEventType.LLM_SENTENCE,
                data: {
                  sentence: sentenceChunk.sentence,
                  sentenceIndex,
                  timestamp: Date.now(),
                },
              });

              // Start TTS synthesis for this sentence
              const audioPromise = this.synthesizeAndStreamAudio(
                streamSession,
                sentenceChunk.sentence,
                sentenceIndex,
                session,
                subject,
              );

              streamSession.audioQueue.set(sentenceIndex, audioPromise);
              sentenceIndex++;
            }
          }
        },
        error: (error) => {
          this.logger.error('LLM stream error', error);
          subject.next({
            type: StreamEventType.ERROR,
            data: {
              error: getErrorMessage(error, 'LLM streaming failed'),
              stage: 'llm',
              timestamp: Date.now(),
            },
          });
        },
        complete: () => {
          // Flush remaining LLM text
          const remaining = llmSentenceDetector.flush();
          if (remaining) {
            streamSession.llmSentences.push(remaining.sentence);

            subject.next({
              type: StreamEventType.LLM_SENTENCE,
              data: {
                sentence: remaining.sentence,
                sentenceIndex,
                timestamp: Date.now(),
              },
            });

            // Synthesize final sentence
            const audioPromise = this.synthesizeAndStreamAudio(
              streamSession,
              remaining.sentence,
              sentenceIndex,
              session,
              subject,
            );

            streamSession.audioQueue.set(sentenceIndex, audioPromise);
          }
        },
      });
    } catch (error) {
      this.logger.error('Error processing user sentence', error);
      subject.next({
        type: StreamEventType.ERROR,
        data: {
          error: getErrorMessage(error, 'Sentence processing failed'),
          stage: 'text',
          timestamp: Date.now(),
        },
      });
    }
  }

  private async synthesizeAndStreamAudio(
    streamSession: StreamingSession,
    text: string,
    sentenceIndex: number,
    session: SessionWithRelations,
    subject: Subject<StreamEvent>,
  ): Promise<void> {
    try {
      // Emit TTS start
      subject.next({
        type: StreamEventType.TTS_START,
        data: {
          sentenceIndex,
          text,
          timestamp: Date.now(),
        },
      });

      // Get TTS configuration
      const ttsConfig = this.getTTSConfig(session);

      let ttsResult: TtsResult | null = null;
      let ttsError: unknown;
      try {
        ttsResult = await this.ttsService.synthesize(text, ttsConfig.provider, {
          voice: ttsConfig.voice,
          language: ttsConfig.language,
          model: ttsConfig.model,
        });
      } catch (error) {
        ttsError = error;
        if (ttsConfig.provider !== 'melotts') {
          this.logger.warn(
            `TTS failed for provider=${ttsConfig.provider}. Falling back to melotts.`,
            error,
          );
          try {
            ttsResult = await this.ttsService.synthesize(text, 'melotts', {
              language: ttsConfig.language,
            });
          } catch (fallbackError) {
            ttsError = fallbackError;
            this.logger.warn(
              'TTS fallback failed, returning text only',
              fallbackError,
            );
          }
        } else {
          this.logger.warn('TTS generation failed, returning text only', error);
        }
      }

      if (!ttsResult) {
        subject.next({
          type: StreamEventType.ERROR,
          data: {
            error:
              ttsError instanceof Error
                ? ttsError.message
                : 'TTS synthesis failed',
            stage: 'tts',
            timestamp: Date.now(),
          },
        });
        return;
      }

      // Emit audio chunk
      subject.next({
        type: StreamEventType.AUDIO_CHUNK,
        data: {
          sentenceIndex,
          audioBase64: ttsResult.audioBuffer.toString('base64'),
          contentType: ttsResult.contentType,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      this.logger.error('TTS synthesis error', error);
      subject.next({
        type: StreamEventType.ERROR,
        data: {
          error: getErrorMessage(error, 'TTS synthesis failed'),
          stage: 'tts',
          timestamp: Date.now(),
        },
      });
    }
  }

  private async getSessionCached(
    sessionId: string,
  ): Promise<SessionWithRelations | null> {
    const cached =
      await this.redis.getSessionFull<SessionWithRelations>(sessionId);
    if (cached) {
      this.logger.debug(`Session full cache hit: ${sessionId}`);
      return cached;
    }

    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      include: { scenario: true, persona: true },
    });

    if (session) {
      void this.redis.setSessionFull(sessionId, session).catch(() => {});
    }

    return session;
  }

  private async getConversationHistory(
    sessionId: string,
    userId: string,
  ): Promise<LLMMessageDto[]> {
    const sessionMember = await this.prisma.client.sessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    if (!sessionMember) {
      return [];
    }

    const iteration = await this.prisma.client.iteration.findFirst({
      where: { sessionMemberId: sessionMember.id },
      orderBy: { iterationNumber: 'desc' },
      select: { id: true },
    });

    if (!iteration) {
      return [];
    }

    // Try Redis cache first
    const cached = await this.redis.getIterationHistory(iteration.id);
    if (cached) {
      this.logger.debug(`History cache hit: ${iteration.id}`);
      return cached.map((m) => ({
        role: m.role as LLMMessageDto['role'],
        content: m.content,
      }));
    }

    const messages = await this.prisma.client.message.findMany({
      where: { iterationId: iteration.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    const history = messages
      .filter((msg) => msg.content)
      .map((msg) => ({
        role: msg.role as LLMMessageDto['role'],
        content: msg.content!,
      }));

    void this.redis.setIterationHistory(iteration.id, history).catch(() => {});

    return history;
  }

  private buildSystemPrompt(session: SessionWithRelations): string {
    const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
    const scenarioConfig = session.scenario?.config
      ? toRecord(session.scenario.config)
      : {};

    return buildConversationSystemPrompt({
      persona: session.persona ?? null,
      session: {
        name: session.name ?? null,
        language: session.language ?? null,
        scenario: session.scenario
          ? {
              id: session.scenario.id,
              name: session.scenario.name,
              description: session.scenario.description,
            }
          : null,
      },
      sessionConfig,
      scenarioConfig: scenarioConfig as Record<string, unknown>,
    });
  }

  private resolveLLMConfig(session: SessionWithRelations): LLMConfigDto {
    const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
    const llmConfig: LlmConfigOverride =
      sessionConfig.llm ?? sessionConfig.llmConfig ?? {};
    const normalizedResponseLength = sessionConfig.responseLength
      ?.toLowerCase()
      .trim();
    const defaultMaxTokens = normalizedResponseLength?.includes('concise')
      ? 220
      : normalizedResponseLength?.includes('detailed')
        ? 700
        : 420;
    return {
      provider: llmConfig.provider ?? undefined,
      model: llmConfig.model ?? sessionConfig.model ?? 'gpt-4o-mini',
      temperature: llmConfig.temperature ?? sessionConfig.temperature ?? 0.7,
      maxTokens:
        llmConfig.maxTokens ?? sessionConfig.maxTokens ?? defaultMaxTokens,
    };
  }

  private getTTSConfig(session: SessionWithRelations): {
    provider: string;
    voice?: string;
    language?: string;
    model?: string;
  } {
    const sessionConfig = toRecord(session.sessionConfig);
    const persona = session.persona;
    const traits = persona?.traits ? toRecord(persona.traits) : {};
    const voice = traits.voice ? toRecord(traits.voice) : {};
    const sessionVoice = sessionConfig.voice
      ? toRecord(sessionConfig.voice as Prisma.JsonValue)
      : {};

    return {
      provider:
        this.pickFirstString(
          voice.provider,
          sessionVoice.provider,
          sessionConfig.ttsProvider,
        ) || 'elevenlabs',
      voice: this.pickFirstString(
        voice.voiceName,
        voice.voice,
        sessionVoice.voiceName,
        sessionVoice.voice,
        sessionConfig.ttsVoice,
      ),
      language:
        this.pickFirstString(
          voice.language,
          sessionVoice.language,
          session.language,
        ) || 'en',
      model: this.pickFirstString(
        voice.model,
        sessionVoice.model,
        sessionConfig.ttsModel,
      ),
    };
  }

  private pickFirstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  private saveTurn(streamSession: StreamingSession): void {
    // Implementation for saving turn to database
    // TODO: Save user sentences and LLM response to database
    this.logger.log(`Saving turn for session ${streamSession.sessionId}`);
  }

  /**
   * Cancel an active streaming session
   */
  cancelStream(requestId: string): void {
    const session = this.activeSessions.get(requestId);
    if (session) {
      this.activeSessions.delete(requestId);
      this.logger.log(`Cancelled stream ${requestId}`);
    }
  }
}
