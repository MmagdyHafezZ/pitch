import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { LLMRouterService } from './llm/llm-router.service';
import { TtsService } from '../tts/tts.service';
import { StageDetectorService } from './stage-detector.service';
import { AssessmentService } from '../assessment/assessment.service';
import { SimulationRedisService } from './redis/redis.service';
import {
  buildConversationFallbackResponse,
  buildConversationSystemPrompt,
  isDisallowedGenericFallbackReply,
} from '../prompts/conversation.prompt';
import {
  ConversationToolsService,
  type IMoodState,
  type IPersuasionState,
} from './conversation-tools.service';
import type {
  LLMConfigDto,
  LLMMessageDto,
  LLMToolCallDto,
} from '../dto/llm.dto';
import type {
  WsEnvelope,
  ConversationStartPayload,
} from '../dto/websocket.dto';
import type { ConversationStreamEvent } from '../dto/conversation-stream.types';
import { Prisma } from '@prisma/simulation-client';
import { SentenceDetector } from '../utils/sentence-detector';
import { RagService } from '../rag/rag.service';
import { RagIndexerService } from '../rag/rag-indexer.service';
import { resolveTtsConfig } from '../utils/tts-config';
import { VideoGenerationService } from './video-generation.service';

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
  responseLength?: string;
  durationMinutes?: number;
  duration?: number;
  aiRole?: string;
  userRole?: string;
  systemPrompt?: string;
  customPrompt?: string;
  userSnapshot?: Prisma.InputJsonValue;
  stages?: unknown;
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

interface ActiveConversationRequest {
  requestId: string;
  sessionId: string;
  userId: string;
  abortController: AbortController;
  cancelled: boolean;
  finished: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  fullText: string;
  iterationId?: string;
  sessionMemberId?: string;
  assistantOrder?: number;
  language?: string;
  assistantPersisted: boolean;
  finalizePromise?: Promise<void>;
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
      next();
    } else {
      this.permits++;
    }
  }
}

class ConversationCancelledError extends Error {
  constructor(message = 'Conversation cancelled') {
    super(message);
    this.name = 'ConversationCancelledError';
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
  private readonly activeRequests = new Map<
    string,
    ActiveConversationRequest
  >();

  constructor(
    private readonly prisma: SimulationPrismaService,
    private readonly llmRouter: LLMRouterService,
    private readonly ttsService: TtsService,
    private readonly stageDetector: StageDetectorService,
    private readonly assessmentService: AssessmentService,
    private readonly redis: SimulationRedisService,
    private readonly ragService: RagService,
    private readonly ragIndexer: RagIndexerService,
    private readonly videoGeneration: VideoGenerationService,
    private readonly conversationTools: ConversationToolsService,
  ) {}

  stream(
    envelope: WsEnvelope<ConversationStartPayload>,
  ): Observable<ConversationStreamEvent> {
    return new Observable<ConversationStreamEvent>((subscriber) => {
      const requestState: ActiveConversationRequest = {
        requestId: envelope.requestId,
        sessionId: envelope.sessionId,
        userId: envelope.userId ?? '',
        abortController: new AbortController(),
        cancelled: false,
        finished: false,
        fullText: '',
        assistantPersisted: false,
      };

      this.activeRequests.set(envelope.requestId, requestState);

      void this.process(envelope, subscriber, requestState).catch((error) => {
        if (error instanceof ConversationCancelledError) {
          this.markRequestFinished(requestState);
          if (!subscriber.closed) {
            subscriber.complete();
          }
          return;
        }

        this.logger.error('ConversationOrchestration failed', error);
        this.markRequestFinished(requestState);
        if (!subscriber.closed) {
          subscriber.error(error);
        }
      });

      return () => {
        if (!requestState.finished) {
          void this.cancel(envelope.requestId, 'subscription_closed');
        }
        this.activeRequests.delete(envelope.requestId);
      };
    });
  }

  async cancel(requestId: string, reason = 'cancelled'): Promise<boolean> {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      return false;
    }

    if (!request.cancelled) {
      request.cancelled = true;
      request.cancellationReason = reason;
      request.cancelledAt = new Date().toISOString();
      request.abortController.abort(reason);
    }

    await this.finalizeInterruptedRequest(request);
    return true;
  }

  private async process(
    envelope: WsEnvelope<ConversationStartPayload>,
    subscriber: Subscriber<ConversationStreamEvent>,
    requestState: ActiveConversationRequest,
  ): Promise<void> {
    const { sessionId, userId } = envelope;
    const payload = envelope.payload;
    const startAsAssistant = payload.startAsAssistant === true;
    const starterPrompt = payload.starterPrompt?.trim();
    const skipTts = payload.skipTts === true;

    if (!sessionId || !userId) {
      throw new Error('sessionId and userId are required');
    }

    requestState.userId = userId;

    const session = await this.getSessionCached(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    this.throwIfCancelled(requestState, subscriber);

    const forceNewIteration = session.status === 'ended';
    const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
    const scenarioConfig = toRecord(session.scenario?.config) as ScenarioConfig;

    let personaData = session.persona;
    const resolvedPersonaId = payload.personaId ?? session.personaId;
    if (resolvedPersonaId && resolvedPersonaId !== session.personaId) {
      personaData = await this.prisma.client.persona.findUnique({
        where: { id: resolvedPersonaId },
      });
      this.throwIfCancelled(requestState, subscriber);
    }

    const resolvedTts = resolveTtsConfig({
      sessionConfig,
      personaTraits: personaData?.traits ? toRecord(personaData.traits) : null,
      override: payload.ttsConfig,
    });
    const videoConfig =
      session.type === 'video'
        ? this.videoGeneration.resolveVideoConfig(
            sessionConfig,
            personaData?.traits ? toRecord(personaData.traits) : null,
          )
        : null;

    const smCache = forceNewIteration
      ? null
      : await this.redis.getSessionMemberIteration(sessionId, userId);
    this.throwIfCancelled(requestState, subscriber);

    let sessionMemberId: string;
    let iterationId: string;
    let lastTurnOrder: number;

    if (smCache && !forceNewIteration) {
      sessionMemberId = smCache.sessionMemberId;
      iterationId = smCache.iterationId;
      lastTurnOrder = smCache.lastTurnOrder;
    } else {
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

      void this.redis
        .setSessionMemberIteration(sessionId, userId, {
          sessionMemberId,
          iterationId,
          lastTurnOrder,
        })
        .catch(() => {});

      if (forceNewIteration) {
        void this.redis.deleteSessionFull(sessionId).catch(() => {});
      }
    }

    const historyMessages = await this.getHistoryCached(iterationId);
    this.throwIfCancelled(requestState, subscriber);

    const nextOrder = lastTurnOrder + 1;
    const assistantOrder = startAsAssistant ? nextOrder : nextOrder + 1;
    const isFirstTurn = lastTurnOrder === 0;

    requestState.iterationId = iterationId;
    requestState.sessionMemberId = sessionMemberId;
    requestState.assistantOrder = assistantOrder;
    requestState.language = session.language ?? undefined;

    if (!startAsAssistant) {
      void this.persistUserTurn({
        iterationId,
        text: payload.text ?? '',
        order: nextOrder,
        language: session.language ?? undefined,
      })
        .then(({ userTurnId }) => {
          void this.redis
            .appendIterationMessage(iterationId, {
              role: 'user',
              content: payload.text ?? '',
            })
            .catch(() => {});
          void this.updateSessionMemberIterationCache({
            sessionId,
            userId,
            sessionMemberId,
            iterationId,
            lastTurnOrder: nextOrder,
          }).catch(() => {});
          return userTurnId;
        })
        .catch((err) => {
          this.logger.warn('Failed to persist user turn', err);
        });
    }

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
    this.throwIfCancelled(requestState, subscriber);

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

    const moodState = await this.redis
      .getMoodState(sessionId)
      .catch(() => null);
    this.throwIfCancelled(requestState, subscriber);

    const moodContext = moodState
      ? `Your current mood is ${moodState.mood} (intensity ${moodState.intensity}/10). ` +
        `This was triggered by: ${moodState.trigger}. ` +
        `Mood set at: ${moodState.setAt}.`
      : undefined;

    const systemPrompt = buildConversationSystemPrompt({
      persona: personaData,
      session,
      sessionConfig,
      scenarioConfig,
      ragContext,
      visualContext: payload.visualContext,
      moodContext,
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
          starterPrompt && starterPrompt.length > 0
            ? starterPrompt
            : 'Start the conversation by greeting the user and setting the scene.',
      });
    }

    const llmConfig = this.resolveLlmConfig(
      payload.config,
      sessionConfig,
      session.type,
    );
    llmConfig.tools = this.conversationTools.getToolDefinitions();
    llmConfig.toolChoice = 'auto';

    let fullText = '';
    let isFirstChunk = true;
    const pendingToolCalls: LLMToolCallDto[] = [];

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
        abortSignal: requestState.abortController.signal,
      },
    );

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const resolveOnce = () => {
        if (settled) {
          return;
        }
        settled = true;
        requestState.abortController.signal.removeEventListener(
          'abort',
          abortHandler,
        );
        streamSubscription?.unsubscribe();
        resolve();
      };

      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        requestState.abortController.signal.removeEventListener(
          'abort',
          abortHandler,
        );
        streamSubscription?.unsubscribe();
        reject(error);
      };

      const abortHandler = () => {
        resolveOnce();
      };

      requestState.abortController.signal.addEventListener(
        'abort',
        abortHandler,
        { once: true },
      );

      const streamSubscription = stream$.subscribe({
        next: (chunk) => {
          if (this.isCancelled(requestState, subscriber)) {
            resolveOnce();
            return;
          }

          if (chunk.delta) {
            fullText += chunk.delta;
            requestState.fullText = fullText;

            if (!subscriber.closed) {
              subscriber.next({
                type: 'delta',
                data: { delta: chunk.delta, isFirstChunk },
              });
            }
            isFirstChunk = false;

            if (!skipTts) {
              const detected = sentenceDetector.addText(chunk.delta);
              for (const sentenceChunk of detected) {
                const idx = sentenceIndex++;
                sentenceTtsJobs.push(
                  this.processSentenceTts(
                    idx,
                    sentenceChunk.sentence,
                    resolvedTts.provider,
                    resolvedTts.voice,
                    resolvedTts.language,
                    resolvedTts.model,
                    undefined,
                    undefined,
                    ttsSemaphore,
                    subscriber,
                    requestState,
                  ),
                );
              }
            }
          }

          if (chunk.done) {
            if (chunk.toolCalls && chunk.toolCalls.length > 0) {
              pendingToolCalls.push(...chunk.toolCalls);
            }
            resolveOnce();
          }
        },
        error: (err) => {
          if (this.isCancelled(requestState, subscriber)) {
            resolveOnce();
            return;
          }
          rejectOnce(err instanceof Error ? err : new Error(String(err)));
        },
        complete: () => {
          resolveOnce();
        },
      });
    });

    this.throwIfCancelled(requestState, subscriber);

    if (!fullText.trim()) {
      const toolTexts = pendingToolCalls
        .flatMap((tc) => {
          try {
            const args = JSON.parse(tc.arguments) as Record<string, unknown>;
            if (tc.name === 'raise_objection' && typeof args.text === 'string')
              return [args.text];
            if (
              tc.name === 'request_clarification' &&
              typeof args.question === 'string'
            ) {
              return [args.question];
            }
          } catch {
            return [];
          }
          return [];
        })
        .join(' ');

      fullText =
        toolTexts ||
        buildConversationFallbackResponse({
          startAsAssistant,
          persona: personaData,
          sessionConfig,
          scenarioConfig,
        });
    } else if (isDisallowedGenericFallbackReply(fullText)) {
      fullText = buildConversationFallbackResponse({
        startAsAssistant,
        persona: personaData,
        sessionConfig,
        scenarioConfig,
      });
    }

    requestState.fullText = fullText;

    if (!skipTts) {
      const remaining = sentenceDetector.flush();
      if (remaining?.sentence) {
        const idx = sentenceIndex++;
        sentenceTtsJobs.push(
          this.processSentenceTts(
            idx,
            remaining.sentence,
            resolvedTts.provider,
            resolvedTts.voice,
            resolvedTts.language,
            resolvedTts.model,
            undefined,
            undefined,
            ttsSemaphore,
            subscriber,
            requestState,
          ),
        );
      }
    }

    const totalSentences = sentenceIndex;
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

    this.throwIfCancelled(requestState, subscriber);

    const assistantTurnId = await this.persistAssistantTurn({
      iterationId,
      text: fullText,
      order: assistantOrder,
      language: session.language ?? undefined,
    });
    requestState.assistantPersisted = true;

    await Promise.all([
      this.redis
        .appendIterationMessage(iterationId, {
          role: 'assistant',
          content: fullText,
        })
        .catch(() => {}),
      this.updateSessionMemberIterationCache({
        sessionId,
        userId,
        sessionMemberId,
        iterationId,
        lastTurnOrder: assistantOrder,
      }).catch(() => {}),
    ]);

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

    void this.assessmentService
      .enqueueLiveForTurn({ iterationId, sessionId, configVersion: undefined })
      .catch((err) => {
        this.logger.warn(
          `Failed to enqueue live assessment: ${(err as Error)?.message ?? err}`,
        );
      });

    if (!skipTts) {
      await Promise.all(sentenceTtsJobs);
    }
    this.throwIfCancelled(requestState, subscriber);

    const progress = this.calculateProgress(
      assistantOrder,
      sessionConfig,
      scenarioConfig,
    );

    if (!subscriber.closed) {
      subscriber.next({
        type: 'completed',
        data: {
          fullText,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          totalSentences,
          progress,
        },
      });
    }

    this.throwIfCancelled(requestState, subscriber);

    if (pendingToolCalls.length > 0) {
      const toolContext = {
        sessionId,
        iterationId,
        turnId: assistantTurnId,
        userId,
      };
      const effects = await this.conversationTools
        .execute(pendingToolCalls, toolContext)
        .catch((err) => {
          this.logger.warn(
            `Tool execution failed: ${(err as Error)?.message ?? err}`,
          );
          return [];
        });

      for (const effect of effects) {
        if (this.isCancelled(requestState, subscriber)) {
          break;
        }

        if (effect.streamEventOverride === 'hangup_requested') {
          const rawReason = effect.args.reason;
          const reason =
            typeof rawReason === 'string'
              ? rawReason
              : typeof rawReason === 'number' || typeof rawReason === 'boolean'
                ? String(rawReason)
                : 'Call ended';
          this.logger.log(
            `AI requested hang-up via end_call for session ${sessionId}: ${reason}`,
          );
          if (!subscriber.closed) {
            subscriber.next({
              type: 'hangup_requested',
              data: { reason },
            });
          }
        } else if (!subscriber.closed) {
          subscriber.next({
            type: 'tool_executed',
            data: { tool: effect.tool, args: effect.args },
          });
        }
      }
    }

    // System-level analysis: automatically assess AI emotion and persuasion
    // after every turn using a dedicated lightweight LLM call. This is
    // guaranteed to run every turn, unlike tool calls which the LLM may skip.
    if (!this.isCancelled(requestState, subscriber)) {
      const previousPersuasionState = await this.redis
        .getPersuasionScore(sessionId)
        .catch(() => null);

      const analysisResult = await this.analyzeConversationState({
        sessionId,
        userId,
        fullText,
        userText: !startAsAssistant ? (payload.text ?? undefined) : undefined,
        historyMessages,
        personaTraits: personaData?.traits
          ? (toRecord(personaData.traits) as Record<string, unknown>)
          : undefined,
        difficulty: sessionConfig.difficulty as string | undefined,
        previousScore: previousPersuasionState?.score,
      });

      if (
        analysisResult &&
        !subscriber.closed &&
        !this.isCancelled(requestState, subscriber)
      ) {
        subscriber.next({
          type: 'tool_executed',
          data: {
            tool: 'update_mood',
            args: {
              mood: analysisResult.moodState.mood,
              emotion: analysisResult.moodState.emotion,
              intensity: analysisResult.moodState.intensity,
              trigger: analysisResult.moodState.trigger,
            },
          },
        });
        subscriber.next({
          type: 'tool_executed',
          data: {
            tool: 'update_persuasion_score',
            args: {
              score: analysisResult.persuasionState.score,
              reasoning: analysisResult.persuasionState.reasoning,
            },
          },
        });

        // If the persona is fully unpersuaded, they want to end the call
        if (analysisResult.persuasionState.score === 0 && !subscriber.closed) {
          this.logger.log(
            `Persuasion score hit 0 for session ${sessionId} — emitting hangup_requested`,
          );
          subscriber.next({
            type: 'hangup_requested',
            data: { reason: 'The persona has decided to end the call.' },
          });
        }
      }
    }

    if (
      videoConfig?.mode === 'rendered' &&
      !this.isCancelled(requestState, subscriber)
    ) {
      void this.videoGeneration
        .queueAssistantVideo({
          sessionId,
          requestId: envelope.requestId,
          text: fullText,
          language: resolvedTts.language ?? session.language ?? undefined,
          ttsProvider: resolvedTts.provider,
          ttsVoice: resolvedTts.voice,
          ttsModel: resolvedTts.model,
        })
        .catch((error) => {
          this.logger.warn(
            `Video generation enqueue failed for session ${sessionId}: ${
              (error as Error)?.message ?? error
            }`,
          );
        });
    }

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

    if (!this.isCancelled(requestState, subscriber)) {
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
          if (!subscriber.closed) {
            subscriber.next({
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

            const tip = this.getCoachingTipForStage(
              stageDetection.currentStage.label,
              stageDetection.currentStageIndex,
            );
            if (tip) {
              subscriber.next({
                type: 'coaching_tip',
                data: {
                  tip,
                  stage: stageDetection.currentStage.label,
                  stageIndex: stageDetection.currentStageIndex,
                },
              });
            }
          }

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
    }

    this.markRequestFinished(requestState);
    if (!subscriber.closed) {
      subscriber.complete();
    }
  }

  /**
   * Runs a lightweight, non-streaming LLM call after every AI response to
   * determine the AI persona's current emotion and persuasion level. Results
   * are stored in Redis and emitted as tool_executed events to the frontend.
   *
   * This replaces the old approach of asking the main LLM to call update_mood
   * and update_persuasion_score as tool calls, which was unreliable with
   * toolChoice: 'auto'.
   */
  private async analyzeConversationState(params: {
    sessionId: string;
    userId: string;
    fullText: string;
    userText?: string;
    historyMessages: Array<{ role: string; content: string }>;
    personaTraits?: Record<string, unknown>;
    difficulty?: string;
    previousScore?: number;
  }): Promise<{
    moodState: IMoodState;
    persuasionState: IPersuasionState;
  } | null> {
    const recentHistory = params.historyMessages.slice(-6);
    const contextLines = [
      ...recentHistory.map(
        (m) =>
          `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content.slice(0, 300)}`,
      ),
      ...(params.userText ? [`User: ${params.userText.slice(0, 300)}`] : []),
      `AI: ${params.fullText.slice(0, 400)}`,
    ];

    // Build persona context from traits (mirrors conversation.prompt.ts trait extraction)
    const traits = params.personaTraits ?? {};
    const pickStr = (v: unknown) => (typeof v === 'string' ? v : null);
    const personaLines: string[] = [];
    const personality = pickStr(
      traits.personality ?? traits.character ?? traits.archetype,
    );
    const temperament = pickStr(traits.temperament ?? traits.patience);
    const negotiationStyle = pickStr(
      traits.negotiationStyle ?? traits.style ?? traits.approach,
    );
    const resistanceLevel = pickStr(
      traits.resistanceLevel ?? traits.resistance ?? traits.skepticism,
    );
    if (personality) personaLines.push(`Personality: ${personality}`);
    if (temperament) personaLines.push(`Temperament: ${temperament}`);
    if (negotiationStyle)
      personaLines.push(`Negotiation style: ${negotiationStyle}`);
    if (resistanceLevel)
      personaLines.push(`Resistance level: ${resistanceLevel}`);

    // Map difficulty to delta sensitivity guidance
    const difficultyNorm = (params.difficulty ?? 'medium').toLowerCase();
    const difficultyGuide =
      difficultyNorm === 'easy'
        ? 'Easy difficulty: the persona is open-minded. Good arguments gain +5 to +15 pts. Poor arguments lose 3 to 8 pts. Offensive/rude remarks lose 10 to 20 pts.'
        : difficultyNorm === 'hard'
          ? 'Hard difficulty: the persona is very resistant. Good arguments gain +3 to +8 pts. Poor arguments lose 8 to 18 pts. Offensive/rude remarks lose 20 to 35 pts.'
          : 'Medium difficulty: Good arguments gain +5 to +12 pts. Poor arguments lose 5 to 12 pts. Offensive/rude remarks lose 15 to 25 pts.';

    const previousScore = params.previousScore ?? 50;

    const systemContent = [
      'You are an emotion and persuasion analyzer for a sales roleplay simulation.',
      "Analyze the AI persona's emotional state and persuasion level and return JSON.",
      '',
      'Persona profile:',
      personaLines.length > 0
        ? personaLines.join('\n')
        : 'No specific persona traits provided.',
      '',
      `Session difficulty: ${difficultyNorm}`,
      difficultyGuide,
      '',
      `Current persuasion score: ${previousScore}/100`,
      'Compute the new persuasion score by applying a delta to the current score.',
      'The delta reflects what the USER said in the most recent turn (not the AI):',
      '  - A compelling, relevant argument → positive delta',
      '  - A weak, off-topic, or irrelevant argument → small negative delta',
      '  - Offensive, rude, or manipulative language → large negative delta (the persona is put off)',
      '  - If only the AI spoke (no user turn), keep the score unchanged (delta = 0)',
      "Apply the persona's resistance: a highly resistant or impatient persona reacts more sharply to poor arguments.",
      'The score must stay within 0–100. Never let it go below 0.',
      '',
      'Return JSON with these fields:',
      '- emotion: one of [neutral, happy, excited, curious, surprised, confused, skeptical, nervous, bored, frustrated, angry, sad, impressed]',
      '- mood: one of [neutral, interested, skeptical, impatient, frustrated, satisfied]',
      '- intensity: integer 1-10',
      '- trigger: one sentence describing what caused the current emotional state',
      '- persuasionScore: integer 0-100 (new score after applying the delta)',
      '- reasoning: one sentence explaining what the user said and why the score changed',
    ].join('\n');

    try {
      const { response } = await this.llmRouter.complete(
        {
          sessionId: params.sessionId,
          userId: params.userId,
          messages: [
            {
              role: 'system',
              content: systemContent,
            },
            {
              role: 'user',
              content: `Conversation:\n${contextLines.join('\n')}\n\nAnalyze the AI persona's current emotional state and persuasion level.`,
            },
          ],
          config: {
            model: 'gpt-4o-mini',
            temperature: 0,
            maxTokens: 200,
            providerOptions: { response_format: { type: 'json_object' } },
          },
        },
        { userId: params.userId, purpose: 'other' },
      );

      if (!response.content) return null;

      const parsed = JSON.parse(response.content) as {
        emotion?: string;
        mood?: string;
        intensity?: number;
        trigger?: string;
        persuasionScore?: number;
        reasoning?: string;
      };

      const now = new Date().toISOString();

      const moodState: IMoodState = {
        mood: (parsed.mood as IMoodState['mood']) ?? 'neutral',
        emotion: (parsed.emotion as IMoodState['emotion']) ?? 'neutral',
        intensity: Math.min(
          10,
          Math.max(1, Math.round(Number(parsed.intensity ?? 5))),
        ),
        trigger: String(parsed.trigger ?? 'Response analyzed'),
        setAt: now,
      };

      const persuasionState: IPersuasionState = {
        score: Math.min(
          100,
          Math.max(0, Math.round(Number(parsed.persuasionScore ?? 0))),
        ),
        reasoning: String(parsed.reasoning ?? 'Analysis complete'),
        setAt: now,
      };

      await Promise.all([
        this.redis.setMoodState(params.sessionId, moodState).catch(() => {}),
        this.redis
          .setPersuasionScore(params.sessionId, persuasionState)
          .catch(() => {}),
      ]);

      this.logger.debug(
        `analyzeConversationState [${params.sessionId}]: emotion=${moodState.emotion} mood=${moodState.mood} intensity=${moodState.intensity} persuasion=${persuasionState.score}`,
      );

      return { moodState, persuasionState };
    } catch (err) {
      this.logger.warn(
        `analyzeConversationState failed: ${(err as Error)?.message ?? err}`,
      );
      return null;
    }
  }

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
    model: string | undefined,
    format: 'mp3' | 'wav' | 'ogg' | 'pcm' | undefined,
    sampleRate: number | undefined,
    semaphore: Semaphore,
    subscriber: Subscriber<ConversationStreamEvent>,
    requestState: ActiveConversationRequest,
  ): Promise<void> {
    if (this.isCancelled(requestState, subscriber)) {
      return;
    }

    await semaphore.acquire();
    try {
      if (this.isCancelled(requestState, subscriber)) {
        return;
      }

      const options = {
        ...(voice ? { voice } : {}),
        ...(language ? { language } : {}),
        ...(model ? { model } : {}),
        ...(format ? { format } : {}),
        ...(sampleRate ? { sampleRate } : {}),
      };
      let audioBuffer: Buffer;
      let contentType: string;

      try {
        const streamResult = await this.ttsService.synthesizeStream(
          text,
          provider,
          options,
        );
        const chunks: Uint8Array[] = [];
        const iterator = streamResult.audioStream[Symbol.asyncIterator]();
        while (!this.isCancelled(requestState, subscriber)) {
          const chunk = await iterator.next();
          if (chunk.done) {
            break;
          }
          chunks.push(chunk.value);
        }
        if (this.isCancelled(requestState, subscriber)) {
          await iterator.return?.();
          return;
        }
        audioBuffer = Buffer.concat(chunks);
        contentType = streamResult.contentType;
      } catch (streamErr) {
        const msg = (streamErr as Error)?.message ?? '';
        if (msg.includes('does not support streaming')) {
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

      if (format === 'pcm' && !contentType.startsWith('audio/pcm')) {
        const pcmFallback = await this.ttsService.synthesize(
          text,
          'elevenlabs',
          {
            ...(voice ? { voice } : {}),
            ...(language ? { language } : {}),
            ...(model ? { model } : {}),
            format: 'pcm',
            sampleRate: sampleRate ?? 24000,
          },
        );
        audioBuffer = pcmFallback.audioBuffer;
        contentType = pcmFallback.contentType;
      }

      if (!this.isCancelled(requestState, subscriber) && !subscriber.closed) {
        subscriber.next({
          type: 'audio_sentence',
          data: { sentenceIndex: idx, audio: audioBuffer, contentType },
        });
      }
    } catch (err) {
      if (this.isCancelled(requestState, subscriber)) {
        return;
      }

      if (provider !== 'melotts') {
        try {
          const fallback = await this.ttsService.synthesize(text, 'melotts', {
            language,
          });
          if (
            !this.isCancelled(requestState, subscriber) &&
            !subscriber.closed
          ) {
            subscriber.next({
              type: 'audio_sentence',
              data: {
                sentenceIndex: idx,
                audio: fallback.audioBuffer,
                contentType: fallback.contentType,
              },
            });
          }
          return;
        } catch {
          // If the fallback also fails, we'll log the original error below and skip audio for this sentence.
          this.logger.warn(
            `TTS failed for sentence ${idx}: ${(err as Error)?.message ?? err}`,
          );
        }
      }
      this.logger.warn(
        `TTS failed for sentence ${idx}: ${(err as Error)?.message ?? err}`,
      );
    } finally {
      semaphore.release();
    }
  }

  private isCancelled(
    request: ActiveConversationRequest,
    subscriber?: Pick<Subscriber<ConversationStreamEvent>, 'closed'>,
  ): boolean {
    return request.cancelled || subscriber?.closed === true;
  }

  /**
   * Returns a concise, stage-specific coaching tip to push to the user
   * the moment a stage transition is detected. Tips are pre-defined to
   * avoid any additional LLM latency mid-conversation.
   */
  private getCoachingTipForStage(
    stageLabel: string,
    stageIndex: number,
  ): string | null {
    const normalized = stageLabel.toLowerCase();

    if (normalized.includes('introduc') || stageIndex === 0) {
      return 'Opening strong sets the tone. Introduce yourself clearly and state the purpose of your call early.';
    }
    if (normalized.includes('discover') || normalized.includes('needs')) {
      return 'Ask open-ended questions and listen actively. Let the prospect reveal their real pain points before you pitch.';
    }
    if (
      normalized.includes('present') ||
      normalized.includes('solution') ||
      normalized.includes('demo')
    ) {
      return 'Connect every feature to a specific need the prospect mentioned. "You said X — our solution handles that by…"';
    }
    if (normalized.includes('object') || normalized.includes('concern')) {
      return 'Acknowledge before you answer. "That\'s a fair concern" builds trust before you address it.';
    }
    if (
      normalized.includes('clos') ||
      normalized.includes('next step') ||
      normalized.includes('commit')
    ) {
      return 'Summarise the value you discussed and ask a direct closing question. Silence after the ask is okay.';
    }

    return null;
  }

  private throwIfCancelled(
    request: ActiveConversationRequest,
    subscriber?: Pick<Subscriber<ConversationStreamEvent>, 'closed'>,
  ): void {
    if (this.isCancelled(request, subscriber)) {
      throw new ConversationCancelledError(
        request.cancellationReason ?? 'Conversation cancelled',
      );
    }
  }

  private markRequestFinished(request: ActiveConversationRequest): void {
    request.finished = true;
  }

  private async finalizeInterruptedRequest(
    request: ActiveConversationRequest,
  ): Promise<void> {
    if (request.assistantPersisted) {
      return;
    }

    if (request.finalizePromise) {
      await request.finalizePromise;
      return;
    }

    request.finalizePromise = (async () => {
      const text = request.fullText.trim();
      if (
        !text ||
        !request.iterationId ||
        !request.sessionMemberId ||
        request.assistantOrder === undefined
      ) {
        return;
      }

      const assistantTurnId = await this.persistAssistantTurn({
        iterationId: request.iterationId,
        text: request.fullText,
        order: request.assistantOrder,
        language: request.language,
        metadata: {
          interrupted: true,
          reason: request.cancellationReason ?? 'cancelled',
          requestId: request.requestId,
          cancelledAt: request.cancelledAt ?? new Date().toISOString(),
        },
      });

      request.assistantPersisted = true;

      await Promise.all([
        this.redis
          .appendIterationMessage(request.iterationId, {
            role: 'assistant',
            content: request.fullText,
          })
          .catch(() => {}),
        this.updateSessionMemberIterationCache({
          sessionId: request.sessionId,
          userId: request.userId,
          sessionMemberId: request.sessionMemberId,
          iterationId: request.iterationId,
          lastTurnOrder: request.assistantOrder,
        }).catch(() => {}),
      ]);

      void this.prisma.client.event
        .create({
          data: {
            iterationId: request.iterationId,
            type: 'turn_completed',
            payload: {
              assistantTurnId,
              order: request.assistantOrder,
              interrupted: true,
              reason: request.cancellationReason ?? 'cancelled',
            },
          },
        })
        .catch(() => {});
    })();

    await request.finalizePromise;
  }

  private async updateSessionMemberIterationCache(params: {
    sessionId: string;
    userId: string;
    sessionMemberId: string;
    iterationId: string;
    lastTurnOrder: number;
  }): Promise<void> {
    const cached = await this.redis
      .getSessionMemberIteration(params.sessionId, params.userId)
      .catch(() => null);

    await this.redis.setSessionMemberIteration(
      params.sessionId,
      params.userId,
      {
        sessionMemberId: params.sessionMemberId,
        iterationId: params.iterationId,
        lastTurnOrder: Math.max(
          cached?.lastTurnOrder ?? 0,
          params.lastTurnOrder,
        ),
      },
    );
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
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<string> {
    const turn = await this.prisma.client.turn.create({
      data: {
        iterationId: params.iterationId,
        role: 'assistant',
        text: params.text,
        order: params.order,
        metadata: params.metadata ?? undefined,
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

    const isVoiceLike =
      sessionType === 'voice' ||
      sessionType === 'video' ||
      sessionType === 'phone';
    const normalizedResponseLength = sessionConfig.responseLength
      ?.toLowerCase()
      .trim();
    const defaultMaxTokens = normalizedResponseLength?.includes('concise')
      ? isVoiceLike
        ? 90
        : 220
      : normalizedResponseLength?.includes('detailed')
        ? isVoiceLike
          ? 220
          : 700
        : isVoiceLike
          ? 140
          : 420;

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
