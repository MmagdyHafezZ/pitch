import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { LLMRouterService } from './llm/llm-router.service';
import { TtsService } from '../tts/tts.service';
import { StageDetectorService } from './stage-detector.service';
import { AssessmentService } from '../assessment/assessment.service';
import { SimulationRedisService } from './redis/redis.service';
import { buildConversationSystemPrompt } from '../prompts/conversation.prompt';
import type { LLMConfigDto, LLMMessageDto } from '../dto/llm.dto';
import type {
  WsEnvelope,
  ConversationStartPayload,
} from '../dto/websocket.dto';
import type { ConversationStreamEvent } from '../dto/conversation-stream.types';
import { Prisma } from '@prisma/simulation-client';
import { SentenceDetector } from '../utils/sentence-detector';
import { RagService } from '../rag/rag.service';
import { RagIndexerService } from '../rag/rag-indexer.service';

type JsonRecord = Record<string, unknown>;

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
  durationMinutes?: number;
  duration?: number;
  aiRole?: string;
  userRole?: string;
  systemPrompt?: string;
  customPrompt?: string;
  userSnapshot?: Prisma.InputJsonValue;
  stages?: unknown;
}

interface ScenarioConfig extends JsonRecord {
  stages?: unknown;
  phases?: unknown;
  plan?: unknown;
  durationMinutes?: number;
  duration?: number;
}

interface StageConfig {
  label?: string;
  name?: string;
  title?: string;
  description?: string;
  keywords?: string[];
}

type SessionWithRelations = Prisma.SessionGetPayload<{
  include: { scenario: true; persona: true };
}>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecord = (value: Prisma.JsonValue | null | undefined): JsonRecord =>
  isRecord(value) ? value : {};

const isStageConfig = (value: unknown): value is StageConfig => isRecord(value);

/**
 * Simple async semaphore for capping concurrent TTS jobs.
 * Prevents provider throttling when many sentences are generated in parallel.
 */
class Semaphore {
  private queue: Array<() => void> = [];

  constructor(private permits: number) {}

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the permit directly to the waiter — do NOT increment
      next();
    } else {
      this.permits++;
    }
  }
}

/**
 * ConversationOrchestrationService
 *
 * Handles the full CONVERSATION_STREAM path with aggressive caching to minimize
 * time-to-first-token (TTFT). Warm-turn critical path:
 *
 * Redis getSessionFull  (~1ms)
 * Redis getSessionMemberIteration (~1ms) → sessionMemberId + iterationId + lastTurnOrder
 * Redis getIterationHistory (~1ms)
 * Fire-and-forget user turn writes
 * ──────────────────────────────────
 * LLM stream starts (TTFT target: <10ms after request reaches service)
 *
 * Audio delivery path:
 * Sentences detected during LLM stream → TTS fires per-sentence (concurrent, capped at 2)
 * → audio_sentence events arrive as each sentence synthesises (~300ms per sentence)
 * → 'completed' emitted after all TTS done (not gated on stage detection)
 * → stage_transition emitted separately (fire-and-forget, 3s timeout)
 */
@Injectable()
export class ConversationOrchestrationService {
  private readonly logger = new Logger(ConversationOrchestrationService.name);

  constructor(
    private readonly prisma: SimulationPrismaService,
    private readonly llmRouter: LLMRouterService,
    private readonly ttsService: TtsService,
    private readonly stageDetector: StageDetectorService,
    private readonly assessmentService: AssessmentService,
    private readonly redis: SimulationRedisService,
    private readonly ragService: RagService,
    private readonly ragIndexer: RagIndexerService,
  ) {}

  stream(
    envelope: WsEnvelope<ConversationStartPayload>,
  ): Observable<ConversationStreamEvent> {
    const subject = new Subject<ConversationStreamEvent>();

    this.process(envelope, subject).catch((error) => {
      this.logger.error('ConversationOrchestration failed', error);
      subject.error(error);
    });

    return subject.asObservable();
  }

  private async process(
    envelope: WsEnvelope<ConversationStartPayload>,
    subject: Subject<ConversationStreamEvent>,
  ): Promise<void> {
    const { sessionId, userId } = envelope;
    const payload = envelope.payload;
    const startAsAssistant = payload.startAsAssistant === true;

    if (!sessionId || !userId) {
      throw new Error('sessionId and userId are required');
    }

    // ── 1. Load session (cached) ──────────────────────────────────────────────
    const session = await this.getSessionCached(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const forceNewIteration = session.status === 'ended';
    const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
    const scenarioConfig = toRecord(session.scenario?.config) as ScenarioConfig;

    // ── 2. Resolve TTS config ─────────────────────────────────────────────────
    let personaData = session.persona;
    let ttsProvider = 'elevenlabs';
    let ttsVoice: string | undefined;
    let ttsLanguage: string | undefined;

    const resolvedPersonaId = payload.personaId ?? session.personaId;
    if (resolvedPersonaId && resolvedPersonaId !== session.personaId) {
      personaData = await this.prisma.client.persona.findUnique({
        where: { id: resolvedPersonaId },
      });
    }

    if (personaData?.traits) {
      const traits = toRecord(personaData.traits);
      const voice = traits.voice;
      if (isRecord(voice)) {
        ttsProvider = (voice.provider as string) ?? ttsProvider;
        ttsVoice = voice.voiceName as string;
        ttsLanguage = voice.language as string;
      }
    }

    if (payload.ttsConfig?.provider) ttsProvider = payload.ttsConfig.provider;
    if (payload.ttsConfig?.voice) ttsVoice = payload.ttsConfig.voice;

    // ── 3. Resolve session member + iteration (cached) ────────────────────────
    const smCache = forceNewIteration
      ? null
      : await this.redis.getSessionMemberIteration(sessionId, userId);

    let sessionMemberId: string;
    let iterationId: string;
    let lastTurnOrder: number;

    if (smCache && !forceNewIteration) {
      sessionMemberId = smCache.sessionMemberId;
      iterationId = smCache.iterationId;
      lastTurnOrder = smCache.lastTurnOrder;
    } else {
      // Cache miss — hit DB
      const resolved = await this.resolveSessionMemberAndIteration({
        sessionId,
        userId,
        sessionConfig,
        forceNewIteration,
        endedReason: session.endedReason ?? 'session_ended',
      });
      sessionMemberId = resolved.sessionMemberId;
      iterationId = resolved.iterationId;
      lastTurnOrder = resolved.lastTurnOrder;

      // Cache for next turn
      void this.redis
        .setSessionMemberIteration(sessionId, userId, {
          sessionMemberId,
          iterationId,
          lastTurnOrder,
        })
        .catch(() => {});

      // When a new iteration was forced, the session full cache still holds
      // status: 'ended'. Evict it so the next request re-reads the now-active session.
      if (forceNewIteration) {
        void this.redis.deleteSessionFull(sessionId).catch(() => {});
      }
    }

    // ── 4. Load history (cached) ──────────────────────────────────────────────
    const historyMessages = await this.getHistoryCached(iterationId);

    const nextOrder = lastTurnOrder + 1;
    const isFirstTurn = lastTurnOrder === 0;

    // ── 5. Persist user turn (fire-and-forget — does not block LLM) ───────────
    if (!startAsAssistant) {
      void this.persistUserTurn({
        iterationId,
        text: payload.text ?? '',
        order: nextOrder,
        language: session.language ?? undefined,
      })
        .then(({ userTurnId }) => {
          // Append to history cache after write
          void this.redis
            .appendIterationMessage(iterationId, {
              role: 'user',
              content: payload.text ?? '',
            })
            .catch(() => {});
          // Update lastTurnOrder in cache (user turn is nextOrder)
          void this.redis
            .setSessionMemberIteration(sessionId, userId, {
              sessionMemberId,
              iterationId,
              lastTurnOrder: nextOrder,
            })
            .catch(() => {});
          return userTurnId;
        })
        .catch((err) => {
          this.logger.warn('Failed to persist user turn', err);
        });
    }

    // ── 5.5. RAG retrieval ────────────────────────────────────────────────────
    const isVoiceLike =
      session.type === 'voice' ||
      session.type === 'video' ||
      session.type === 'phone';

    const ragChunks =
      !startAsAssistant && (payload.text ?? '').trim()
        ? await this.ragService
            .retrieve({
              query: payload.text ?? '',
              namespaces: ['kb', 'history', 'persona', 'scenario'],
              topK: isVoiceLike ? 2 : 4,
              minScore: 0.75,
            })
            .catch(() => [])
        : [];

    // Auto-index persona + scenario (idempotent, fire-and-forget)
    if (personaData) {
      void this.ragIndexer
        .maybeIndexPersona(
          {
            id: personaData.id,
            name: personaData.name,
            traits: personaData.traits,
          },
          session.orgId,
        )
        .catch(() => {});
    }
    if (session.scenario) {
      void this.ragIndexer
        .maybeIndexScenario(
          {
            id: session.scenario.id,
            name: session.scenario.name,
            description: session.scenario.description,
            config: session.scenario.config,
          },
          session.orgId,
        )
        .catch(() => {});
    }

    const ragContext =
      ragChunks.length > 0
        ? ragChunks
            .map(
              (c, i) =>
                `[${i + 1}] ${c.source ?? c.refType}: ${c.text.slice(0, 200)}`,
            )
            .join('\n')
        : undefined;

    // ── 6. Build LLM messages ─────────────────────────────────────────────────
    const systemPrompt = buildConversationSystemPrompt({
      persona: personaData,
      session,
      sessionConfig,
      scenarioConfig,
      ragContext,
      visualContext: payload.visualContext,
    });

    const historyForPrompt = startAsAssistant
      ? historyMessages.filter((m) => m.role === 'user')
      : historyMessages;
    const addStarterPrompt = startAsAssistant && historyForPrompt.length === 0;

    const messages: LLMMessageDto[] = [
      { role: 'system', content: systemPrompt },
      ...historyForPrompt
        .filter((m) => !!m.content)
        .map((m) => ({
          role: m.role as LLMMessageDto['role'],
          content: m.content,
        })),
    ];

    const incomingText = payload.text?.trim();

    // Point 2 — proximal context injection right before the user turn
    if (ragContext) {
      messages.push({
        role: 'system',
        content: `[BACKGROUND CONTEXT — use where relevant]\n${ragContext}`,
      });
    }

    if (!startAsAssistant && incomingText) {
      const last = messages[messages.length - 1];
      if (!(last?.role === 'user' && last.content === incomingText)) {
        messages.push({ role: 'user', content: incomingText });
      }
    }

    if (addStarterPrompt) {
      messages.push({
        role: 'user',
        content:
          'Start the conversation by greeting the user and setting the scene.',
      });
    }

    const llmConfig = this.resolveLlmConfig(
      payload.config,
      sessionConfig,
      session.type,
    );

    // ── 7. LLM stream + per-sentence TTS ──────────────────────────────────────
    let fullText = '';
    let isFirstChunk = true;

    const sentenceDetector = new SentenceDetector({
      minWords: 3,
      aggressiveness: 'balanced',
    });
    const ttsSemaphore = new Semaphore(2);
    const sentenceTtsJobs: Promise<void>[] = [];
    let sentenceIndex = 0;

    const stream$ = this.llmRouter.stream(
      { sessionId, userId, messages, config: llmConfig },
      {
        userId,
        orgId: session.orgId,
        requestId: envelope.requestId,
        purpose: 'conversation_stream',
      },
    );

    await new Promise<void>((resolve, reject) => {
      stream$.subscribe({
        next: (chunk) => {
          if (chunk.delta) {
            fullText += chunk.delta;
            subject.next({
              type: 'delta',
              data: { delta: chunk.delta, isFirstChunk },
            });
            isFirstChunk = false;

            // Detect sentence boundaries and fire TTS for each complete sentence
            const detected = sentenceDetector.addText(chunk.delta);
            for (const sentenceChunk of detected) {
              const idx = sentenceIndex++;
              sentenceTtsJobs.push(
                this.processSentenceTts(
                  idx,
                  sentenceChunk.sentence,
                  ttsProvider,
                  ttsVoice,
                  ttsLanguage,
                  ttsSemaphore,
                  subject,
                ),
              );
            }
          }
          if (chunk.done) resolve();
        },
        error: (err) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        complete: () => resolve(),
      });
    });

    if (!fullText.trim()) {
      fullText = startAsAssistant
        ? "Hello! Thanks for joining. Let's dive into today's scenario whenever you're ready."
        : 'Got it. Could you say a bit more so I can respond properly?';
    }

    // Flush remaining text in the sentence detector buffer
    const remaining = sentenceDetector.flush();
    if (remaining) {
      const idx = sentenceIndex++;
      sentenceTtsJobs.push(
        this.processSentenceTts(
          idx,
          remaining.sentence,
          ttsProvider,
          ttsVoice,
          ttsLanguage,
          ttsSemaphore,
          subject,
        ),
      );
    }

    const totalSentences = sentenceIndex;

    // Start stage detection now (runs in parallel with remaining TTS jobs).
    // Include the current user turn and generated assistant response so the
    // classifier sees the full up-to-date conversation, not stale history.
    const plannedStages = this.getPlannedStages(sessionConfig, scenarioConfig);
    const historyForStage: Array<{ role: string; content: string }> = [
      ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
      ...(!startAsAssistant && (payload.text ?? '').trim()
        ? [{ role: 'user', content: payload.text ?? '' }]
        : []),
      { role: 'assistant', content: fullText },
    ];
    const stageDetectionPromise = this.stageDetector.detectStage(
      historyForStage,
      plannedStages,
      sessionId,
      userId,
    );

    // ── 8. Persist assistant turn (async — after stream completes) ────────────
    const assistantOrder = startAsAssistant ? nextOrder : nextOrder + 1;

    const assistantTurnId = await this.persistAssistantTurn({
      iterationId,
      text: fullText,
      order: assistantOrder,
      language: session.language ?? undefined,
    });

    // Update history cache + iteration mapping
    void this.redis
      .appendIterationMessage(iterationId, {
        role: 'assistant',
        content: fullText,
      })
      .catch(() => {});
    void this.redis
      .setSessionMemberIteration(sessionId, userId, {
        sessionMemberId,
        iterationId,
        lastTurnOrder: assistantOrder,
      })
      .catch(() => {});

    // ── 8.5. Auto-index turns for future RAG retrieval (fire-and-forget) ─────
    if (!startAsAssistant && (payload.text ?? '').trim()) {
      void this.ragIndexer
        .indexTurn({
          turnId: `${iterationId}_user_${nextOrder}`,
          text: payload.text ?? '',
          role: 'user',
          sessionId,
          orgId: session.orgId,
        })
        .catch(() => {});
    }
    void this.ragIndexer
      .indexTurn({
        turnId: assistantTurnId,
        text: fullText,
        role: 'assistant',
        sessionId,
        orgId: session.orgId,
      })
      .catch(() => {});

    // ── 9. Assessment (fire-and-forget) ───────────────────────────────────────
    void this.assessmentService
      .enqueueLiveForTurn({ iterationId, sessionId, configVersion: undefined })
      .catch((err) => {
        this.logger.warn(
          `Failed to enqueue live assessment: ${(err as Error)?.message ?? err}`,
        );
      });

    // ── 10. Wait for all TTS jobs to complete ─────────────────────────────────
    await Promise.all(sentenceTtsJobs);

    const progress = this.calculateProgress(
      assistantOrder,
      sessionConfig,
      scenarioConfig,
    );

    // Emit completed — stage detection is NOT on this critical path
    subject.next({
      type: 'completed',
      data: {
        fullText,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalSentences,
        progress,
      },
    });

    // Log simulation start event (first turn only)
    if (isFirstTurn) {
      void this.prisma.client.event
        .create({
          data: {
            iterationId,
            type: 'simulation_started',
            payload: { sessionId, startedAt: new Date().toISOString() },
          },
        })
        .catch(() => {});
    }

    // ── 11. Stage detection — fire-and-forget with 3s hard timeout ────────────
    // Emit stage_transition if detected, then close the stream.
    const stageDetection = await Promise.race([
      stageDetectionPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]).catch(() => null);

    if (
      stageDetection?.stageTransition &&
      stageDetection.previousStageIndex !== undefined
    ) {
      const prevStage = plannedStages[stageDetection.previousStageIndex];
      if (prevStage) {
        subject.next({
          type: 'stage_transition',
          data: {
            previousStage: prevStage.label,
            currentStage: stageDetection.currentStage.label,
            previousStageIndex: stageDetection.previousStageIndex,
            currentStageIndex: stageDetection.currentStageIndex,
            confidence: stageDetection.confidence,
            reasoning: stageDetection.reasoning,
          },
        });

        void this.prisma.client.event
          .create({
            data: {
              iterationId,
              type: 'turn_completed',
              payload: {
                assistantTurnId,
                order: assistantOrder,
                progress,
                stageTransition: true,
                previousStage: prevStage.label,
                currentStage: stageDetection.currentStage.label,
              },
            },
          })
          .catch(() => {});
      }
    }

    subject.complete();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Synthesise audio for a single sentence and emit an audio_sentence event.
   * Errors are caught per-sentence so one failed synthesis doesn't abort the stream.
   */
  private async processSentenceTts(
    idx: number,
    text: string,
    provider: string,
    voice: string | undefined,
    language: string | undefined,
    semaphore: Semaphore,
    subject: Subject<ConversationStreamEvent>,
  ): Promise<void> {
    await semaphore.acquire();
    try {
      const options = voice ? { voice, language } : { language };
      let audioBuffer: Buffer;
      let contentType: string;

      try {
        // Try streaming synthesis first — collect chunks into a single Buffer
        const streamResult = await this.ttsService.synthesizeStream(
          text,
          provider,
          options,
        );
        const chunks: Uint8Array[] = [];
        for await (const chunk of streamResult.audioStream) {
          chunks.push(chunk);
        }
        audioBuffer = Buffer.concat(chunks);
        contentType = streamResult.contentType;
      } catch (streamErr) {
        const msg = (streamErr as Error)?.message ?? '';
        if (msg.includes('does not support streaming')) {
          // Provider doesn't support streaming — fall back to blocking synthesis
          const result = await this.ttsService.synthesize(
            text,
            provider,
            options,
          );
          audioBuffer = result.audioBuffer;
          contentType = result.contentType;
        } else {
          throw streamErr;
        }
      }

      subject.next({
        type: 'audio_sentence',
        data: { sentenceIndex: idx, audio: audioBuffer, contentType },
      });
    } catch (err) {
      // Try melotts fallback
      if (provider !== 'melotts') {
        try {
          const fallback = await this.ttsService.synthesize(text, 'melotts', {
            language,
          });
          subject.next({
            type: 'audio_sentence',
            data: {
              sentenceIndex: idx,
              audio: fallback.audioBuffer,
              contentType: fallback.contentType,
            },
          });
          return;
        } catch {
          // fall through — skip audio for this sentence
        }
      }
      this.logger.warn(
        `TTS failed for sentence ${idx}: ${(err as Error)?.message ?? err}`,
      );
      // Do not throw — a failed sentence must not abort the stream
    } finally {
      semaphore.release();
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

  private async getHistoryCached(
    iterationId: string,
  ): Promise<{ role: string; content: string }[]> {
    const cached = await this.redis.getIterationHistory(iterationId);
    if (cached) {
      this.logger.debug(`History cache hit: ${iterationId}`);
      return cached;
    }

    const messages = await this.prisma.client.message.findMany({
      where: { iterationId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { role: true, content: true },
    });

    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content! }));

    void this.redis.setIterationHistory(iterationId, history).catch(() => {});
    return history;
  }

  private async resolveSessionMemberAndIteration(params: {
    sessionId: string;
    userId: string;
    sessionConfig: SessionConfig;
    forceNewIteration: boolean;
    endedReason: string;
  }): Promise<{
    sessionMemberId: string;
    iterationId: string;
    lastTurnOrder: number;
  }> {
    const [existingMember] = await Promise.all([
      this.prisma.client.sessionMember.findUnique({
        where: {
          sessionId_userId: {
            sessionId: params.sessionId,
            userId: params.userId,
          },
        },
      }),
    ]);

    const member =
      existingMember ??
      (await this.prisma.client.sessionMember.create({
        data: {
          sessionId: params.sessionId,
          userId: params.userId,
          role: 'viewer',
          userSnapshot:
            (params.sessionConfig.userSnapshot as Prisma.InputJsonValue) ??
            null,
        },
      }));

    const iteration = await this.getOrCreateIteration({
      sessionId: params.sessionId,
      sessionMemberId: member.id,
      userSnapshot:
        (params.sessionConfig.userSnapshot as Prisma.InputJsonValue) ?? null,
      forceNewIteration: params.forceNewIteration,
      endedReason: params.endedReason,
    });

    const lastTurn = await this.prisma.client.turn.findFirst({
      where: { iterationId: iteration.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return {
      sessionMemberId: member.id,
      iterationId: iteration.id,
      lastTurnOrder: lastTurn?.order ?? 0,
    };
  }

  private async getOrCreateIteration(params: {
    sessionId: string;
    sessionMemberId: string;
    userSnapshot?: Prisma.InputJsonValue | null;
    forceNewIteration?: boolean;
    endedReason?: string;
  }): Promise<{ id: string; iterationNumber: number; status: string }> {
    const latest = await this.prisma.client.iteration.findFirst({
      where: { sessionMemberId: params.sessionMemberId },
      orderBy: { iterationNumber: 'desc' },
      select: { id: true, iterationNumber: true, status: true },
    });

    if (latest?.status === 'active' && !params.forceNewIteration) {
      return latest;
    }

    if (latest?.status === 'active' && params.forceNewIteration) {
      await this.prisma.client.iteration.update({
        where: { id: latest.id },
        data: {
          status: 'completed',
          endedReason: params.endedReason ?? 'restarted',
          endedAt: new Date(),
        },
      });
    }

    if (params.forceNewIteration) {
      await this.prisma.client.session.update({
        where: { id: params.sessionId },
        data: { status: 'active', endedReason: null, endedAt: null },
      });
    }

    const nextNumber = (latest?.iterationNumber ?? 0) + 1;
    return this.prisma.client.iteration.create({
      data: {
        sessionId: params.sessionId,
        sessionMemberId: params.sessionMemberId,
        iterationNumber: nextNumber,
        status: 'active',
        userSnapshot: params.userSnapshot ?? Prisma.JsonNull,
      },
      select: { id: true, iterationNumber: true, status: true },
    });
  }

  private async persistUserTurn(params: {
    iterationId: string;
    text: string;
    order: number;
    language?: string;
  }): Promise<{ userTurnId: string }> {
    const turn = await this.prisma.client.turn.create({
      data: {
        iterationId: params.iterationId,
        role: 'user',
        text: params.text,
        order: params.order,
      },
    });
    await this.prisma.client.message.create({
      data: {
        iterationId: params.iterationId,
        turnId: turn.id,
        role: 'user',
        content: params.text,
        language: params.language,
      },
    });
    return { userTurnId: turn.id };
  }

  private async persistAssistantTurn(params: {
    iterationId: string;
    text: string;
    order: number;
    language?: string;
  }): Promise<string> {
    const turn = await this.prisma.client.turn.create({
      data: {
        iterationId: params.iterationId,
        role: 'assistant',
        text: params.text,
        order: params.order,
      },
    });
    await this.prisma.client.message.create({
      data: {
        iterationId: params.iterationId,
        turnId: turn.id,
        role: 'assistant',
        content: params.text,
        language: params.language,
      },
    });
    return turn.id;
  }

  private resolveLlmConfig(
    override: LLMConfigDto | undefined,
    sessionConfig: SessionConfig,
    sessionType?: string | null,
  ): LLMConfigDto {
    if (override) return override;
    const cfg: LlmConfigOverride =
      sessionConfig.llm ?? sessionConfig.llmConfig ?? {};

    // Cap token length for voice-like sessions to reduce generation + TTS time
    const isVoiceLike =
      sessionType === 'voice' ||
      sessionType === 'video' ||
      sessionType === 'phone';
    const defaultMaxTokens = isVoiceLike ? 120 : 500;

    return {
      provider: cfg.provider,
      model: cfg.model ?? sessionConfig.model ?? 'gpt-4o-mini',
      temperature: cfg.temperature ?? sessionConfig.temperature ?? 0.7,
      maxTokens: cfg.maxTokens ?? sessionConfig.maxTokens ?? defaultMaxTokens,
    };
  }

  private getPlannedStages(
    sessionConfig: SessionConfig,
    scenarioConfig: ScenarioConfig,
  ): Array<{
    order: number;
    label: string;
    description?: string;
    keywords?: string[];
  }> {
    const candidate =
      scenarioConfig.stages ??
      scenarioConfig.phases ??
      scenarioConfig.plan ??
      sessionConfig.stages ??
      [];
    const stages = Array.isArray(candidate) ? candidate : [];

    if (stages.length > 0) {
      return stages.map((stage, i) => {
        const label =
          typeof stage === 'string'
            ? stage
            : isStageConfig(stage)
              ? (stage.label ?? stage.name ?? stage.title ?? `Stage ${i + 1}`)
              : `Stage ${i + 1}`;
        const description = isStageConfig(stage)
          ? stage.description
          : undefined;
        const keywords =
          isStageConfig(stage) && Array.isArray(stage.keywords)
            ? stage.keywords.filter((k): k is string => typeof k === 'string')
            : undefined;
        return { order: i + 1, label, description, keywords };
      });
    }

    return [
      {
        order: 1,
        label: 'Introduction',
        description: 'Opening and building rapport',
      },
      {
        order: 2,
        label: 'Discovery',
        description: 'Understanding needs and challenges',
      },
      {
        order: 3,
        label: 'Presentation',
        description: 'Presenting solution and value',
      },
      {
        order: 4,
        label: 'Objection Handling',
        description: 'Addressing concerns',
      },
      { order: 5, label: 'Closing', description: 'Next steps and commitment' },
    ];
  }

  private calculateProgress(
    order: number,
    sessionConfig: SessionConfig,
    scenarioConfig: ScenarioConfig,
  ): number {
    const duration = Number(
      sessionConfig.durationMinutes ??
        sessionConfig.duration ??
        scenarioConfig.durationMinutes ??
        scenarioConfig.duration,
    );
    const targetTurns =
      Number.isFinite(duration) && duration > 0
        ? Math.max(3, Math.round(duration))
        : 10;
    return Math.min(100, Math.max(1, Math.round((order / targetTurns) * 100)));
  }
}
