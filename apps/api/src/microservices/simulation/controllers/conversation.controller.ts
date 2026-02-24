import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { WsEnvelope, ConversationStartPayload } from '../dto/websocket.dto';
import { LLMRouterService } from '../services/llm/llm-router.service';
import { TtsService } from '../tts/tts.service';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { StageDetectorService } from '../services/stage-detector.service';
import { StreamingConversationService } from '../services/streaming-conversation.service';
import { AssessmentService } from '../assessment/assessment.service';
import type { LLMConfigDto, LLMMessageDto } from '../dto/llm.dto';
import { Prisma } from '@prisma/simulation-client';
import type { TtsResult } from '../tts/providers/tts.provider';
import { Observable, Subject } from 'rxjs';
import { StreamEvent, TextStreamChunk } from '../dto/text-stream.dto';
import { buildConversationSystemPrompt } from '../prompts/conversation.prompt';

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
  multiTurnEnabled?: boolean;
  durationMinutes?: number;
  duration?: number;
  aiRole?: string;
  userRole?: string;
  tone?: string;
  accent?: string;
  speechRate?: number;
  difficulty?: string;
  userSnapshot?: Prisma.InputJsonValue;
  stages?: unknown;
  systemPrompt?: string;
  customPrompt?: string;
}

interface ScenarioRole {
  name?: string;
  persona?: string;
}

interface ScenarioConfig extends JsonRecord {
  roles?: ScenarioRole[] | { user?: string; client?: string };
  durationMinutes?: number;
  duration?: number;
  stages?: unknown;
  phases?: unknown;
  plan?: unknown;
  objective?: string;
  sessionConfig?: Record<string, unknown>;
}

interface PersonaData {
  id: string;
  name: string;
  traits: Prisma.JsonValue | null;
}

interface IterationData {
  id: string;
  iterationNumber: number;
  status: string;
}

interface StageConfig {
  label?: string;
  name?: string;
  title?: string;
  description?: string;
  keywords?: string[];
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecord = (value: Prisma.JsonValue | null | undefined): JsonRecord =>
  isRecord(value) ? value : {};

const isStageConfig = (value: unknown): value is StageConfig => isRecord(value);

@Controller()
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly ttsService: TtsService,
    private readonly prisma: SimulationPrismaService,
    private readonly stageDetector: StageDetectorService,
    private readonly streamingConversation: StreamingConversationService,
    private readonly assessmentService: AssessmentService,
  ) {}

  /**
   * Streaming conversation handler with real-time text, stage detection, and audio
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CONVERSATION_STREAM)
  streamConversation(
    @Payload() envelope: WsEnvelope<ConversationStartPayload>,
  ): Observable<any> {
    const subject = new Subject<any>();

    this.processStreamingConversation(envelope, subject).catch((error) => {
      this.logger.error('Streaming conversation failed', error);
      subject.error(toRpcException(error));
    });

    return subject.asObservable();
  }

  private async processStreamingConversation(
    envelope: WsEnvelope<ConversationStartPayload>,
    subject: Subject<any>,
  ): Promise<void> {
    try {
      const payload = envelope.payload;
      const sessionId = envelope.sessionId;
      const userId = envelope.userId;
      const startAsAssistant = payload.startAsAssistant === true;

      if (!sessionId || !userId) {
        throw new Error('sessionId and userId are required');
      }

      // Batch parallel database queries to reduce latency
      const [session, existingSessionMember] = await Promise.all([
        this.prisma.client.session.findUnique({
          where: { id: sessionId },
          include: { scenario: true, persona: true },
        }),
        this.prisma.client.sessionMember.findUnique({
          where: { sessionId_userId: { sessionId, userId } },
        }),
      ]);

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      const forceNewIteration = session.status === 'ended';
      if (forceNewIteration) {
        this.logger.warn(
          `Session ${sessionId} marked ended; starting new iteration.`,
        );
      }

      const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
      const scenarioConfig = toRecord(
        session.scenario?.config,
      ) as ScenarioConfig;

      // Get TTS configuration
      let personaData: PersonaData | null = session.persona;
      let ttsProvider = 'elevenlabs';
      let ttsVoice: string | undefined;
      let ttsLanguage: string | undefined;

      const resolvedPersonaId = payload.personaId ?? session.personaId;
      if (resolvedPersonaId && resolvedPersonaId !== session.personaId) {
        // Only fetch if different from session persona
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

      // Create session member if doesn't exist
      const sessionMember =
        existingSessionMember ??
        (await this.prisma.client.sessionMember.create({
          data: {
            sessionId,
            userId,
            role: 'viewer',
            userSnapshot:
              (sessionConfig.userSnapshot as Prisma.InputJsonValue) ?? null,
          },
        }));

      const iteration = await this.getOrCreateIteration({
        sessionId,
        sessionMemberId: sessionMember.id,
        userSnapshot:
          (sessionConfig.userSnapshot as Prisma.InputJsonValue) ?? null,
        forceNewIteration,
        endedReason: session.endedReason ?? 'session_ended',
      });

      // Fetch last turn and history in parallel
      const [lastTurn, historyMessages] = await Promise.all([
        this.prisma.client.turn.findFirst({
          where: { iterationId: iteration.id },
          orderBy: { order: 'desc' },
          select: { order: true },
        }),
        this.prisma.client.message.findMany({
          where: { iterationId: iteration.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { role: true, content: true, createdAt: true },
        }),
      ]);

      // Reverse to chronological order
      historyMessages.reverse();

      const nextOrder = (lastTurn?.order ?? 0) + 1;

      if (!startAsAssistant) {
        const userTurn = await this.prisma.client.turn.create({
          data: {
            iterationId: iteration.id,
            role: 'user',
            text: payload.text,
            order: nextOrder,
          },
        });

        await this.prisma.client.message.create({
          data: {
            iterationId: iteration.id,
            turnId: userTurn.id,
            role: 'user',
            content: payload.text,
            language: session.language ?? undefined,
          },
        });
      }

      // Build system message
      const systemMessage: LLMMessageDto = {
        role: 'system',
        content: await buildConversationSystemPrompt({
          persona: personaData,
          session,
          sessionConfig,
          scenarioConfig,
        }),
      };
      const systemPromptForLog =
        typeof systemMessage.content === 'string'
          ? systemMessage.content
          : JSON.stringify(systemMessage.content ?? []);
      this.logger.debug(`System prompt: ${systemPromptForLog}`);

      const historyForPrompt = startAsAssistant
        ? historyMessages.filter((msg) => msg.role === 'user')
        : historyMessages;
      const addStarterPrompt =
        startAsAssistant && historyForPrompt.length === 0;

      const messages: LLMMessageDto[] = [
        systemMessage,
        ...historyForPrompt
          .filter((msg) => !!msg.content)
          .map((msg) => ({
            role: msg.role as LLMMessageDto['role'],
            content: msg.content ?? '',
          })),
      ];

      const incomingUserText = payload.text?.trim();
      if (!startAsAssistant && incomingUserText) {
        const lastMessage = messages[messages.length - 1];
        const hasCurrentUserMessage =
          lastMessage?.role === 'user' &&
          lastMessage.content === incomingUserText;
        if (!hasCurrentUserMessage) {
          messages.push({
            role: 'user',
            content: incomingUserText,
          });
        }
      }

      if (addStarterPrompt) {
        messages.push({
          role: 'user',
          content:
            'Start the conversation by greeting the user and setting the scene.',
        });
      }

      const llmConfig = this.resolveLlmConfig(payload.config, sessionConfig);

      // Stream LLM response
      let fullText = '';
      let isFirstChunk = true;

      this.logger.debug(
        `data passed to LLM Router: ${JSON.stringify({
          sessionId,
          userId,
          messages,
          config: llmConfig,
        })}`,
      );

      const stream$ = this.llmRouter.stream(
        {
          sessionId,
          userId,
          messages,
          config: llmConfig,
        },
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

              // Emit streaming delta
              subject.next({
                type: 'delta',
                data: {
                  delta: chunk.delta,
                  isFirstChunk,
                },
              });
              isFirstChunk = false;
            }

            if (chunk.done) {
              resolve();
            }
          },
          error: (err) =>
            reject(err instanceof Error ? err : new Error(String(err))),
          complete: () => resolve(),
        });
      });

      // If no text was generated, use fallback
      if (!fullText.trim()) {
        fullText = startAsAssistant
          ? "Hello! Thanks for joining. Let's dive into today's scenario whenever you're ready."
          : 'Got it. Could you say a bit more so I can respond properly?';
      }

      // Save assistant turn
      const assistantOrder = startAsAssistant ? nextOrder : nextOrder + 1;
      const assistantTurn = await this.prisma.client.turn.create({
        data: {
          iterationId: iteration.id,
          role: 'assistant',
          text: fullText,
          order: assistantOrder,
        },
      });

      await this.prisma.client.message.create({
        data: {
          iterationId: iteration.id,
          turnId: assistantTurn.id,
          role: 'assistant',
          content: fullText,
          language: session.language ?? undefined,
        },
      });

      void this.assessmentService
        .enqueueLiveForTurn({
          iterationId: iteration.id,
          sessionId,
          configVersion: undefined,
        })
        .catch((error) => {
          this.logger.warn(
            `Failed to enqueue live assessment for session ${sessionId}: ${
              (error as Error)?.message ?? error
            }`,
          );
        });

      // Calculate progress
      const progress = this.calculateProgressPercent({
        order: assistantOrder,
        sessionConfig,
        scenarioConfig,
      });

      // Start TTS synthesis in parallel with stage detection to reduce end-to-end latency
      const ttsPromise = this.synthesizeWithFallback({
        text: fullText,
        provider: ttsProvider,
        voice: ttsVoice,
        language: ttsLanguage,
      });

      // Detect stage transitions
      const plannedStages = this.getPlannedStages(
        sessionConfig,
        scenarioConfig,
      );
      const stageDetection = await this.stageDetector.detectStage(
        historyMessages.map((m) => ({
          role: m.role,
          content: m.content ?? '',
        })),
        plannedStages,
        sessionId,
        userId,
      );

      // Emit stage transition if detected
      if (
        stageDetection.stageTransition &&
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
        } else {
          this.logger.warn(
            `Stage transition index out of range: ${stageDetection.previousStageIndex}`,
          );
        }

        // Log stage transition event
        if (prevStage) {
          await this.prisma.client.event.create({
            data: {
              iterationId: iteration.id,
              type: 'turn_completed',
              payload: {
                assistantTurnId: assistantTurn.id,
                order: assistantOrder,
                progress,
                stageTransition: true,
                previousStage: prevStage.label,
                currentStage: stageDetection.currentStage.label,
              },
            },
          });
        }
      }

      // Emit stream completed with stage info
      subject.next({
        type: 'completed',
        data: {
          fullText,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          stageInfo: {
            currentStage: stageDetection.currentStage.label,
            stageIndex: stageDetection.currentStageIndex,
            stageTransition: stageDetection.stageTransition,
            confidence: stageDetection.confidence,
          },
          progress,
        },
      });

      // Log simulation started event
      if (!lastTurn) {
        await this.prisma.client.event.create({
          data: {
            iterationId: iteration.id,
            type: 'simulation_started',
            payload: {
              sessionId,
              startedAt: new Date().toISOString(),
            },
          },
        });
      }

      const ttsResult = await ttsPromise;
      if (ttsResult) {
        subject.next({
          type: 'audio',
          data: {
            audioBase64: ttsResult.audioBuffer.toString('base64'),
            contentType: ttsResult.contentType,
            text: fullText,
          },
        });
      } else {
        this.logger.warn(
          `TTS unavailable for session ${sessionId}; returning text only.`,
        );
      }

      // Complete the stream
      subject.complete();
    } catch (error) {
      subject.error(error);
    }
  }

  private async getOrCreateIteration(params: {
    sessionId: string;
    sessionMemberId: string;
    userSnapshot?: Prisma.InputJsonValue | null;
    forceNewIteration?: boolean;
    endedReason?: string;
  }): Promise<IterationData> {
    const latestIteration = await this.prisma.client.iteration.findFirst({
      where: { sessionMemberId: params.sessionMemberId },
      orderBy: { iterationNumber: 'desc' },
      select: { id: true, iterationNumber: true, status: true },
    });

    if (latestIteration && latestIteration.status === 'active') {
      if (!params.forceNewIteration) {
        return latestIteration;
      }

      await this.prisma.client.iteration.update({
        where: { id: latestIteration.id },
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
        data: {
          status: 'active',
          endedReason: null,
          endedAt: null,
        },
      });
    }

    const nextIterationNumber = (latestIteration?.iterationNumber ?? 0) + 1;
    return await this.prisma.client.iteration.create({
      data: {
        sessionId: params.sessionId,
        sessionMemberId: params.sessionMemberId,
        iterationNumber: nextIterationNumber,
        status: 'active',
        userSnapshot: params.userSnapshot ?? Prisma.JsonNull,
      },
      select: { id: true, iterationNumber: true, status: true },
    });
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
    const stagesCandidate =
      scenarioConfig.stages ??
      scenarioConfig.phases ??
      scenarioConfig.plan ??
      sessionConfig.stages ??
      [];
    const stages = Array.isArray(stagesCandidate) ? stagesCandidate : [];

    if (stages.length > 0) {
      return stages.map((stage, index) => {
        const label =
          typeof stage === 'string'
            ? stage
            : isStageConfig(stage)
              ? (stage.label ??
                stage.name ??
                stage.title ??
                `Stage ${index + 1}`)
              : `Stage ${index + 1}`;
        const description = isStageConfig(stage)
          ? stage.description
          : undefined;
        const keywords =
          isStageConfig(stage) && Array.isArray(stage.keywords)
            ? stage.keywords.filter(
                (keyword): keyword is string => typeof keyword === 'string',
              )
            : undefined;
        return {
          order: index + 1,
          label,
          description,
          keywords,
        };
      });
    }

    // Default stages
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
      {
        order: 5,
        label: 'Closing',
        description: 'Next steps and commitment',
      },
    ];
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CONVERSATION_PROCESS)
  async processConversation(
    @Payload() envelope: WsEnvelope<ConversationStartPayload>,
  ) {
    try {
      this.logger.log(
        `Processing conversation for session ${envelope.sessionId}`,
      );

      const payload = envelope.payload;
      const sessionId = envelope.sessionId;
      const userId = envelope.userId;
      const startAsAssistant = payload.startAsAssistant === true;

      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      if (!userId) {
        throw new Error('userId is required');
      }

      const session = await this.prisma.client.session.findUnique({
        where: { id: sessionId },
        include: {
          scenario: true,
          persona: true,
        },
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      const forceNewIteration = session.status === 'ended';
      if (forceNewIteration) {
        this.logger.warn(
          `Session ${sessionId} marked ended; starting new iteration.`,
        );
      }

      const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
      const scenarioConfig = toRecord(
        session.scenario?.config,
      ) as ScenarioConfig;

      if (startAsAssistant && !sessionConfig.multiTurnEnabled) {
        throw new Error('Assistant-initiated turns require multi-turn mode');
      }

      let personaData: PersonaData | null = null;
      let ttsProvider = 'elevenlabs';
      let ttsVoice: string | undefined = undefined;
      let ttsLanguage: string | undefined = undefined;

      const resolvedPersonaId =
        payload.personaId ?? session.personaId ?? undefined;

      if (resolvedPersonaId) {
        const persona = await this.prisma.client.persona.findUnique({
          where: { id: resolvedPersonaId },
        });
        personaData = persona;

        if (personaData?.traits) {
          const traits = toRecord(personaData.traits);
          const voice = traits.voice;
          if (isRecord(voice)) {
            if (typeof voice.provider === 'string') {
              ttsProvider = voice.provider;
            }
            if (typeof voice.voiceName === 'string') {
              ttsVoice = voice.voiceName;
            }
            if (typeof voice.language === 'string') {
              ttsLanguage = voice.language;
            }
          }
        }
      }

      if (payload.ttsConfig?.provider) {
        ttsProvider = payload.ttsConfig.provider;
      }
      if (payload.ttsConfig?.voice) {
        ttsVoice = payload.ttsConfig.voice;
      }

      const iterationFromEnvelopeRaw = envelope.iterationId
        ? await this.prisma.client.iteration.findUnique({
            where: { id: envelope.iterationId },
          })
        : null;

      const iterationFromEnvelope =
        iterationFromEnvelopeRaw &&
        iterationFromEnvelopeRaw.status === 'active' &&
        !forceNewIteration
          ? iterationFromEnvelopeRaw
          : null;

      const sessionMember = iterationFromEnvelopeRaw
        ? await this.prisma.client.sessionMember.findUnique({
            where: { id: iterationFromEnvelopeRaw.sessionMemberId },
          })
        : envelope.sessionMemberId
          ? await this.prisma.client.sessionMember.findUnique({
              where: { id: envelope.sessionMemberId },
            })
          : await this.prisma.client.sessionMember.findUnique({
              where: {
                sessionId_userId: {
                  sessionId,
                  userId,
                },
              },
            });

      const ensuredMember =
        sessionMember ??
        (await this.prisma.client.sessionMember.create({
          data: {
            sessionId,
            userId,
            role: 'viewer',
            userSnapshot:
              (sessionConfig.userSnapshot as Prisma.InputJsonValue) ?? null,
          },
        }));

      const iteration =
        iterationFromEnvelope ??
        (await this.getOrCreateIteration({
          sessionId,
          sessionMemberId: ensuredMember.id,
          userSnapshot:
            (sessionConfig.userSnapshot as Prisma.InputJsonValue) ?? null,
          forceNewIteration,
          endedReason: session.endedReason ?? 'session_ended',
        }));

      const lastTurn = await this.prisma.client.turn.findFirst({
        where: { iterationId: iteration.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const nextOrder = (lastTurn?.order ?? 0) + 1;
      let userTurn: { id: string } | null = null;

      if (!startAsAssistant) {
        userTurn = await this.prisma.client.turn.create({
          data: {
            iterationId: iteration.id,
            role: 'user',
            text: payload.text,
            order: nextOrder,
          },
        });

        await this.prisma.client.message.create({
          data: {
            iterationId: iteration.id,
            turnId: userTurn.id,
            role: 'user',
            content: payload.text,
            language: session.language ?? undefined,
          },
        });
      }

      // Build message history (limit to last 50 messages to prevent memory issues)
      const historyMessages = await this.prisma.client.message.findMany({
        where: { iterationId: iteration.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { role: true, content: true, createdAt: true },
      });

      // Reverse to chronological order
      historyMessages.reverse();

      const systemMessage: LLMMessageDto = {
        role: 'system',
        content: await buildConversationSystemPrompt({
          persona: personaData,
          session,
          sessionConfig,
          scenarioConfig,
        }),
      };

      const historyForPrompt = startAsAssistant
        ? historyMessages.filter((msg) => msg.role === 'user')
        : historyMessages;
      const addStarterPrompt =
        startAsAssistant && historyForPrompt.length === 0;

      const messages: LLMMessageDto[] = [
        systemMessage,
        ...historyForPrompt
          .filter((msg) => !!msg.content)
          .map((msg) => ({
            role: msg.role as LLMMessageDto['role'],
            content: msg.content ?? '',
          })),
      ];

      const incomingUserText = payload.text?.trim();
      if (!startAsAssistant && incomingUserText) {
        const lastMessage = messages[messages.length - 1];
        const hasCurrentUserMessage =
          lastMessage?.role === 'user' &&
          lastMessage.content === incomingUserText;
        if (!hasCurrentUserMessage) {
          messages.push({
            role: 'user',
            content: incomingUserText,
          });
        }
      }
      if (addStarterPrompt) {
        messages.push({
          role: 'user',
          content:
            'Start the conversation by greeting the user and setting the scene.',
        });
      }

      const llmConfig = this.resolveLlmConfig(payload.config, sessionConfig);

      const llmResponse = await this.llmRouter.complete(
        {
          sessionId: envelope.sessionId,
          userId,
          messages,
          config: llmConfig,
        },
        {
          userId,
          orgId: session.orgId,
          requestId: envelope.requestId,
          purpose: 'conversation',
        },
      );

      let responseText = llmResponse.response.content || '';

      if (!responseText.trim()) {
        const retryMessages: LLMMessageDto[] = [
          ...messages,
          {
            role: 'system',
            content:
              'Your previous response was empty. Respond now with a brief, natural reply.',
          },
        ];
        const retryResponse = await this.llmRouter.complete(
          {
            sessionId: envelope.sessionId,
            userId,
            messages: retryMessages,
            config: llmConfig,
          },
          {
            userId,
            orgId: session.orgId,
            requestId: envelope.requestId,
            purpose: 'conversation',
          },
        );
        responseText = retryResponse.response.content || '';
      }

      if (!responseText.trim()) {
        responseText = startAsAssistant
          ? 'Hello! Thanks for joining. Let’s dive into today’s scenario whenever you’re ready.'
          : 'Got it. Could you say a bit more so I can respond properly?';
      }

      const assistantOrder = startAsAssistant ? nextOrder : nextOrder + 1;
      const assistantTurn = await this.prisma.client.turn.create({
        data: {
          iterationId: iteration.id,
          role: 'assistant',
          text: responseText,
          order: assistantOrder,
        },
      });

      await this.prisma.client.message.create({
        data: {
          iterationId: iteration.id,
          turnId: assistantTurn.id,
          role: 'assistant',
          content: responseText,
          language: session.language ?? undefined,
        },
      });

      const progress = this.calculateProgressPercent({
        order: assistantOrder,
        sessionConfig,
        scenarioConfig,
      });

      if (!lastTurn) {
        await this.prisma.client.event.create({
          data: {
            iterationId: iteration.id,
            type: 'simulation_started',
            payload: {
              sessionId,
              startedAt: new Date().toISOString(),
            },
          },
        });
      }

      await this.prisma.client.event.create({
        data: {
          iterationId: iteration.id,
          type: 'turn_completed',
          payload: {
            userTurnId: userTurn?.id ?? null,
            assistantTurnId: assistantTurn.id,
            order: assistantOrder,
            progress,
          },
        },
      });

      void this.assessmentService
        .enqueueLiveForTurn({
          iterationId: iteration.id,
          sessionId,
          configVersion: undefined,
        })
        .catch((error) => {
          this.logger.warn(
            `Failed to enqueue live assessment for session ${sessionId}: ${
              (error as Error)?.message ?? error
            }`,
          );
        });

      let audioBase64: string | undefined;
      let contentType: string | undefined;

      const ttsResult = await this.synthesizeWithFallback({
        text: responseText,
        provider: ttsProvider,
        voice: ttsVoice,
        language: ttsLanguage,
      });
      if (ttsResult) {
        audioBase64 = ttsResult.audioBuffer.toString('base64');
        contentType = ttsResult.contentType;
      } else {
        this.logger.warn(
          `TTS unavailable for session ${sessionId}; returning text only.`,
        );
      }

      return {
        text: responseText,
        usage: llmResponse.response.usage,
        audioBase64,
        contentType,
      };
    } catch (error) {
      this.logger.error('Conversation processing failed', error);
      throw toRpcException(error);
    }
  }

  private async synthesizeWithFallback(input: {
    text: string;
    provider?: string;
    voice?: string;
    language?: string;
  }): Promise<TtsResult | null> {
    const provider = input.provider ?? 'elevenlabs';
    const options = input.voice
      ? { voice: input.voice, language: input.language }
      : { language: input.language };

    try {
      return await this.synthesizeUsingStreamWhenAvailable({
        text: input.text,
        provider,
        options,
      });
    } catch (ttsError) {
      this.logger.warn(
        `TTS failed for provider=${provider}. Falling back to melotts.`,
        ttsError,
      );
    }

    if (provider === 'melotts') {
      return null;
    }

    try {
      const fallbackVoice = this.getMeloVoice(input.language, input.voice);
      const fallbackOptions = fallbackVoice
        ? { voice: fallbackVoice, language: input.language }
        : { language: input.language };

      return await this.synthesizeUsingStreamWhenAvailable({
        text: input.text,
        provider: 'melotts',
        options: fallbackOptions,
      });
    } catch (fallbackError) {
      this.logger.warn(
        'TTS fallback failed, returning text only',
        fallbackError,
      );
      return null;
    }
  }

  private async synthesizeUsingStreamWhenAvailable(input: {
    text: string;
    provider: string;
    options: { voice?: string; language?: string };
  }): Promise<TtsResult> {
    try {
      const streamResult = await this.withTimeout(
        this.ttsService.synthesizeStream(
          input.text,
          input.provider,
          input.options,
        ),
        15_000,
        `TTS timed out for provider=${input.provider} (stream)`,
      );

      const audioBuffer = await this.withTimeout(
        this.collectAudioChunks(streamResult.audioStream),
        15_000,
        `TTS stream collection timed out for provider=${input.provider}`,
      );

      return {
        audioBuffer,
        contentType: streamResult.contentType,
      };
    } catch (error) {
      if (!this.isStreamingUnsupportedError(error)) {
        throw error;
      }
    }

    return await this.withTimeout(
      this.ttsService.synthesize(input.text, input.provider, input.options),
      15_000,
      `TTS timed out for provider=${input.provider}`,
    );
  }

  private async collectAudioChunks(
    stream: AsyncIterable<Uint8Array>,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private isStreamingUnsupportedError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes('does not support streaming')
    );
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private getMeloVoice(
    language?: string,
    fallbackVoice?: string,
  ): string | undefined {
    const normalized = language?.toLowerCase();
    if (fallbackVoice && /^[a-z]{2}/i.test(fallbackVoice)) {
      return fallbackVoice;
    }
    if (!normalized) return undefined;
    const code = normalized.split('-')[0];
    switch (code) {
      case 'es':
        return 'es - Spanish';
      case 'fr':
        return 'fr - French';
      case 'de':
        return 'de - German';
      case 'it':
        return 'it - Italian';
      case 'ja':
        return 'ja - Japanese';
      case 'zh':
        return 'zh - Chinese';
      case 'ko':
        return 'ko - Korean';
      default:
        return 'en - English';
    }
  }

  private resolveLlmConfig(
    configOverride: LLMConfigDto | undefined,
    sessionConfig: SessionConfig,
  ): LLMConfigDto {
    if (configOverride) {
      return configOverride;
    }

    const llmConfig: LlmConfigOverride =
      sessionConfig.llm ?? sessionConfig.llmConfig ?? {};
    return {
      provider: llmConfig.provider ?? undefined,
      model: llmConfig.model ?? sessionConfig.model ?? 'gpt-4o-mini',
      temperature: llmConfig.temperature ?? sessionConfig.temperature ?? 0.7,
      maxTokens: llmConfig.maxTokens ?? sessionConfig.maxTokens ?? 500,
    };
  }

  private calculateProgressPercent(params: {
    order: number;
    sessionConfig: SessionConfig;
    scenarioConfig: ScenarioConfig;
  }): number {
    const duration = Number(
      params.sessionConfig.durationMinutes ??
        params.sessionConfig.duration ??
        params.scenarioConfig.durationMinutes ??
        params.scenarioConfig.duration,
    );
    const targetTurns =
      Number.isFinite(duration) && duration > 0
        ? Math.max(3, Math.round(duration))
        : 10;
    return Math.min(
      100,
      Math.max(1, Math.round((params.order / targetTurns) * 100)),
    );
  }

  /**
   * Streaming text conversation handler for Web Speech API
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CONVERSATION_TEXT_STREAM)
  streamTextConversation(
    @Payload()
    envelope: {
      sessionId: string;
      userId: string;
      requestId: string;
      textChunks$: Observable<TextStreamChunk>;
    },
  ): Observable<StreamEvent> {
    return this.streamingConversation.processTextStream(
      envelope.sessionId,
      envelope.userId,
      envelope.requestId,
      envelope.textChunks$,
    );
  }
}
