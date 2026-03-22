import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import {
  ChatCompletedPayload,
  ChatErrorPayload,
  ChatStartPayload,
  ConversationStartPayload,
  ConversationErrorPayload,
  ConversationHangupRequestedPayload,
  ConversationToolExecutedPayload,
  ConversationStreamDeltaPayload,
  ConversationStreamCompletedPayload,
  ConversationStageTransitionPayload,
  VisualStatePayload,
  WsEnvelope,
  WsEnvelopeFactory,
  WsMessageType,
} from '@microservices/simulation/dto/websocket.dto';
import { LLMService } from '@microservices/simulation/services/llm/llm.service';
import { ConversationOrchestrationService } from '@microservices/simulation/services/conversation-orchestration.service';
import { Subscription } from 'rxjs';
import { JwtTokenPayload, SocketUser } from '../../../types/socket';

interface SimulationSocketData {
  user?: SocketUser;
}

type SimulationSocket = Socket<any, any, any, SimulationSocketData>;

interface StreamHandle {
  socketId: string;
  subscription: Subscription;
  timeoutId?: NodeJS.Timeout;
  /** Token micro-buffer for batched Socket.IO emission */
  tokenBatch?: string[];
  /** Pending flush timer for token batch */
  flushTimer?: NodeJS.Timeout;
}

/** Flush accumulated tokens as a single Socket.IO delta event (~15ms batching window) */
const TOKEN_BATCH_MS = 15;

@WebSocketGateway({
  namespace: '/simulation',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class SimulationWsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SimulationWsGateway.name);
  private readonly activeStreams = new Map<string, StreamHandle>();
  /**
   * Latest serialised visual context per sessionId.
   * Updated by CONVERSATION_VISUAL_STATE events and read just-in-time
   * when a CONVERSATION_START arrives — zero latency on the hot path.
   */
  private readonly visualContexts = new Map<string, string>();

  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    private readonly jwtService: JwtService,
    private readonly llmService: LLMService,
    private readonly conversationOrchestration: ConversationOrchestrationService,
  ) {}

  handleConnection(client: SimulationSocket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn('WS connection rejected: missing token');
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtTokenPayload>(token);
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: SimulationSocket) {
    for (const [requestId, handle] of this.activeStreams.entries()) {
      if (handle.socketId === client.id) {
        handle.subscription.unsubscribe();
        void this.conversationOrchestration.cancel(
          requestId,
          'client_disconnected',
        );
        if (handle.timeoutId) {
          clearTimeout(handle.timeoutId);
        }
        if (handle.flushTimer) {
          clearTimeout(handle.flushTimer);
        }
        this.activeStreams.delete(requestId);
        this.logger.debug(
          `Cleaned up stream ${requestId} for disconnected client`,
        );
      }
    }

    // Clean up visual context for this session on disconnect
    const sessionId = (client.data as { sessionId?: string }).sessionId;
    if (sessionId) {
      this.visualContexts.delete(sessionId);
    }
  }

  @SubscribeMessage(WsMessageType.CHAT_START)
  handleChatStart(
    @ConnectedSocket() client: SimulationSocket,
    @MessageBody() envelope: WsEnvelope<ChatStartPayload>,
  ) {
    const requestId = envelope.requestId;
    const sessionId = envelope.sessionId;

    if (!envelope.userId && client.data.user?.id) {
      envelope.userId = client.data.user.id;
    }

    if (this.activeStreams.has(requestId)) {
      return;
    }

    // Pre-create handle so flushTimer is accessible from handleDisconnect
    const streamHandle: StreamHandle = {
      socketId: client.id,
      subscription: null!,
    };
    this.activeStreams.set(requestId, streamHandle);

    let content = '';
    const tokenBatch: string[] = [];

    const flushBatch = () => {
      if (tokenBatch.length === 0) return;
      const delta = tokenBatch.splice(0).join('');
      client.emit(
        WsMessageType.CHAT_DELTA,
        WsEnvelopeFactory.chatDelta(
          requestId,
          sessionId,
          { delta },
          envelope.turnId,
        ),
      );
      streamHandle.flushTimer = undefined;
    };

    // Bypass RabbitMQ — call LLMService directly (same process)
    const subscription = this.llmService
      .stream(
        {
          sessionId: envelope.sessionId,
          iterationId: envelope.iterationId,
          sessionMemberId: envelope.sessionMemberId,
          userId: envelope.userId,
          turnId: envelope.turnId,
          messages: envelope.payload.messages,
          config: { ...envelope.payload.config, stream: true },
        },
        { requestId, purpose: 'chat' },
      )
      .subscribe({
        next: (chunk) => {
          if (chunk.delta) {
            content += chunk.delta;
            tokenBatch.push(chunk.delta);
            if (!streamHandle.flushTimer) {
              streamHandle.flushTimer = setTimeout(flushBatch, TOKEN_BATCH_MS);
            }
          }

          if (chunk.done) {
            if (streamHandle.flushTimer) {
              clearTimeout(streamHandle.flushTimer);
              streamHandle.flushTimer = undefined;
            }
            flushBatch();

            const usage = chunk.usage
              ? {
                  promptTokens: chunk.usage.promptTokens ?? 0,
                  completionTokens: chunk.usage.completionTokens ?? 0,
                  totalTokens: chunk.usage.totalTokens ?? 0,
                  costUsd: chunk.usage.costUsd,
                }
              : undefined;

            const completedPayload: ChatCompletedPayload = {
              content,
              usage,
              finishReason: chunk.finishReason,
            };

            client.emit(
              WsMessageType.CHAT_COMPLETED,
              WsEnvelopeFactory.chatCompleted(
                requestId,
                sessionId,
                completedPayload,
                envelope.turnId,
              ),
            );

            this.activeStreams.delete(requestId);
          }
        },
        error: (error) => {
          if (streamHandle.flushTimer) {
            clearTimeout(streamHandle.flushTimer);
            streamHandle.flushTimer = undefined;
          }

          const errorPayload: ChatErrorPayload = {
            error: (error as Error)?.message || 'Streaming error',
          };

          client.emit(
            WsMessageType.CHAT_ERROR,
            WsEnvelopeFactory.chatError(
              requestId,
              sessionId,
              errorPayload,
              envelope.turnId,
            ),
          );

          this.activeStreams.delete(requestId);
        },
        complete: () => {
          this.activeStreams.delete(requestId);
        },
      });

    streamHandle.subscription = subscription;
  }

  @SubscribeMessage(WsMessageType.CHAT_CANCEL)
  handleChatCancel(@MessageBody() payload: { requestId: string }) {
    const requestId = payload.requestId;
    const active = this.activeStreams.get(requestId);

    if (active) {
      if (active.flushTimer) {
        clearTimeout(active.flushTimer);
      }
      active.subscription.unsubscribe();
      this.activeStreams.delete(requestId);
    }
  }

  @SubscribeMessage(WsMessageType.CONVERSATION_START)
  handleConversationStart(
    @ConnectedSocket() client: SimulationSocket,
    @MessageBody() envelope: WsEnvelope<ConversationStartPayload>,
  ) {
    const requestId = envelope.requestId;
    const sessionId = envelope.sessionId;

    if (!envelope.userId && client.data.user?.id) {
      envelope.userId = client.data.user.id;
    }

    if (this.activeStreams.has(requestId)) {
      return;
    }

    // Add timeout to prevent hanging streams (60 seconds)
    const timeoutId = setTimeout(() => {
      this.logger.warn(`Stream timeout for request ${requestId}`);
      const active = this.activeStreams.get(requestId);
      if (active) {
        active.subscription.unsubscribe();
        void this.conversationOrchestration.cancel(requestId, 'timeout');
        this.activeStreams.delete(requestId);

        const errorPayload: ConversationErrorPayload = {
          error: 'Request timeout (60s)',
          stage: 'gateway',
        };

        client.emit(
          WsMessageType.CONVERSATION_ERROR,
          WsEnvelopeFactory.conversationError(
            requestId,
            sessionId,
            errorPayload,
            envelope.turnId,
          ),
        );
      }
    }, 60000);

    // Inject latest visual context (side-channel, does not block the hot path)
    const storedVisualContext = this.visualContexts.get(sessionId);
    if (storedVisualContext) {
      envelope.payload = {
        ...envelope.payload,
        visualContext: storedVisualContext,
      };
      this.logger.debug(
        `[visual] injected into turn for session ${sessionId}: ${storedVisualContext}`,
      );
    }

    // Bypass RabbitMQ — call ConversationOrchestrationService directly (same process)
    const stream$ = this.conversationOrchestration.stream(envelope);

    const subscription = stream$.subscribe({
      next: (event) => {
        if (event.type === 'delta') {
          // Emit streaming text delta
          const deltaPayload: ConversationStreamDeltaPayload = {
            delta: event.data.delta,
            isFirstChunk: event.data.isFirstChunk,
          };

          client.emit(
            WsMessageType.CONVERSATION_STREAM_DELTA,
            WsEnvelopeFactory.create(
              WsMessageType.CONVERSATION_STREAM_DELTA,
              requestId,
              sessionId,
              deltaPayload,
              envelope.turnId,
            ),
          );
        } else if (event.type === 'completed') {
          // Emit stream completed with full text (stage info arrives separately via stage_transition)
          const completedPayload: ConversationStreamCompletedPayload = {
            fullText: event.data.fullText,
            usage: event.data.usage,
            totalSentences: event.data.totalSentences,
            progress: event.data.progress,
          };

          client.emit(
            WsMessageType.CONVERSATION_STREAM_COMPLETED,
            WsEnvelopeFactory.create(
              WsMessageType.CONVERSATION_STREAM_COMPLETED,
              requestId,
              sessionId,
              completedPayload,
              envelope.turnId,
            ),
          );
        } else if (event.type === 'stage_transition') {
          // Emit stage transition event
          const transitionPayload: ConversationStageTransitionPayload = {
            previousStage: event.data.previousStage,
            currentStage: event.data.currentStage,
            previousStageIndex: event.data.previousStageIndex,
            currentStageIndex: event.data.currentStageIndex ?? 0,
            confidence: event.data.confidence,
            reasoning: event.data.reasoning,
          };

          client.emit(
            WsMessageType.CONVERSATION_STAGE_TRANSITION,
            WsEnvelopeFactory.create(
              WsMessageType.CONVERSATION_STAGE_TRANSITION,
              requestId,
              sessionId,
              transitionPayload,
              envelope.turnId,
            ),
          );
        } else if (event.type === 'hangup_requested') {
          // AI persona has signalled it wants to end the conversation
          const hangupPayload: ConversationHangupRequestedPayload = {
            reason: event.data.reason,
          };
          client.emit(
            WsMessageType.CONVERSATION_HANGUP_REQUESTED,
            WsEnvelopeFactory.create(
              WsMessageType.CONVERSATION_HANGUP_REQUESTED,
              requestId,
              sessionId,
              hangupPayload,
              envelope.turnId,
            ),
          );
        } else if (event.type === 'tool_executed') {
          const toolPayload: ConversationToolExecutedPayload = {
            tool: event.data.tool,
            args: event.data.args,
            ...(event.data.effect ? { effect: event.data.effect } : {}),
          };
          client.emit(
            WsMessageType.CONVERSATION_TOOL_EXECUTED,
            WsEnvelopeFactory.create(
              WsMessageType.CONVERSATION_TOOL_EXECUTED,
              requestId,
              sessionId,
              toolPayload,
              envelope.turnId,
            ),
          );
        } else if (event.type === 'coaching_tip') {
          client.emit(
            WsMessageType.CONVERSATION_COACHING_TIP,
            WsEnvelopeFactory.create(
              WsMessageType.CONVERSATION_COACHING_TIP,
              requestId,
              sessionId,
              {
                tip: event.data.tip,
                stage: event.data.stage,
                stageIndex: event.data.stageIndex,
              },
              envelope.turnId,
            ),
          );
        } else if (event.type === 'audio_sentence') {
          // Emit binary audio chunk — Socket.IO transmits Buffer as a binary frame
          client.emit(WsMessageType.CONVERSATION_AUDIO_CHUNK, {
            type: WsMessageType.CONVERSATION_AUDIO_CHUNK,
            requestId,
            sessionId,
            timestamp: new Date().toISOString(),
            payload: {
              sentenceIndex: event.data.sentenceIndex,
              audio: event.data.audio,
              contentType: event.data.contentType,
            },
          });
        }
      },
      error: (error) => {
        this.logger.error('Streaming conversation failed', error);

        const errorPayload: ConversationErrorPayload = {
          error: (error as Error)?.message || 'Conversation streaming error',
          stage: 'llm',
        };

        client.emit(
          WsMessageType.CONVERSATION_ERROR,
          WsEnvelopeFactory.conversationError(
            requestId,
            sessionId,
            errorPayload,
            envelope.turnId,
          ),
        );

        clearTimeout(timeoutId);
        this.activeStreams.delete(requestId);
      },
      complete: () => {
        clearTimeout(timeoutId);
        const wasActive = this.activeStreams.delete(requestId);
        if (wasActive) {
          client.emit(WsMessageType.CONVERSATION_END, {
            requestId,
            sessionId,
            timestamp: new Date().toISOString(),
          });
        }
      },
    });

    this.activeStreams.set(requestId, {
      socketId: client.id,
      subscription,
      timeoutId,
    });
  }

  @SubscribeMessage(WsMessageType.CONVERSATION_CANCEL)
  async handleConversationCancel(
    @ConnectedSocket() client: SimulationSocket,
    @MessageBody() payload: { requestId: string; sessionId: string },
  ) {
    const requestId = payload.requestId;

    // If there's an active stream for this request, cancel it
    const active = this.activeStreams.get(requestId);
    if (active) {
      active.subscription.unsubscribe();
      this.activeStreams.delete(requestId);
    }
    await this.conversationOrchestration.cancel(requestId, 'user_interrupt');

    // Acknowledge cancellation to client
    client.emit(WsMessageType.CONVERSATION_CANCEL, {
      requestId,
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Conversation cancelled: ${requestId}`);
  }

  /**
   * Receives a lightweight semantic VisualState from the client (computed by
   * MediaPipe Pose Landmarker in the browser) and stores it in memory so the
   * next CONVERSATION_START can inject it into the LLM prompt with zero RTT.
   *
   * Expected payload: { sessionId, state: VisualStatePayload }
   */
  @SubscribeMessage(WsMessageType.CONVERSATION_VISUAL_STATE)
  handleVisualState(
    @MessageBody()
    data: {
      sessionId: string;
      state: VisualStatePayload;
    },
  ) {
    if (!data?.sessionId || !data?.state) return;
    const serialized = serializeVisualState(data.state);
    this.visualContexts.set(data.sessionId, serialized);
    // Debug-level so it's silenced in production by default.
    // Set LOG_LEVEL=debug in dev to trace visual state updates.
    this.logger.debug(`[visual] ${data.sessionId} → ${serialized}`);
  }

  @SubscribeMessage(WsMessageType.PING)
  handlePing(@ConnectedSocket() client: SimulationSocket) {
    client.emit(WsMessageType.PONG, { timestamp: new Date().toISOString() });
  }

  private extractToken(client: SimulationSocket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken && typeof authToken === 'string') return authToken;

    const header = client.handshake.headers.authorization;
    if (!header) return null;

    const [type, token] = header.split(' ');
    if (type?.toLowerCase() === 'bearer' && token) {
      return token;
    }

    return null;
  }
}

type EngagementLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Derives a three-tier engagement level from a VisualState snapshot.
 *
 * Rules (order matters — first match wins):
 *  HIGH   → leaning in AND looking at camera
 *  LOW    → leaning back AND low movement AND not looking at camera
 *  LOW    → person not present (away from camera)
 *  MEDIUM → everything else
 *
 * Adjust the conditions here as you calibrate with real session data.
 */
function deriveEngagement(state: VisualStatePayload): EngagementLevel {
  if (!state.present) return 'LOW';

  const attention = state.attention ?? -1;
  const hasAttentionData = attention >= 0;

  // HIGH: physically leaning in or upright, holding eye contact, attention strong
  if (
    (state.posture === 'leaning_in' || state.posture === 'upright') &&
    state.gaze === 'camera' &&
    (!hasAttentionData || attention >= 55)
  )
    return 'HIGH';

  // LOW: pulled back, low movement, not looking at camera, AND (if we have data) low attention
  if (
    state.posture === 'leaning_back' &&
    state.movement === 'low' &&
    state.gaze !== 'camera' &&
    (!hasAttentionData || attention < 40)
  )
    return 'LOW';

  // LOW via attention alone: attention data available and consistently low
  if (hasAttentionData && attention < 30) return 'LOW';

  return 'MEDIUM';
}

/**
 * Converts a VisualState into a rich natural-language string for the LLM system prompt.
 *
 * Format: "Engagement: X. Camera observation: ... Attention: ...%."
 * The engagement label is parsed by the prompt builder to inject behavior rules.
 */
function serializeVisualState(state: VisualStatePayload): string {
  const engagement = deriveEngagement(state);

  if (!state.present) {
    return `Engagement: LOW. Camera observation: the user is not visible on camera.`;
  }

  const posturePhrases: Record<string, string> = {
    leaning_in: 'leaning forward toward the camera',
    upright: 'sitting upright',
    leaning_back: 'leaning back',
    unknown: 'posture unclear',
  };
  const gazePhrases: Record<string, string> = {
    camera: 'looking directly at the camera',
    left: 'glancing to their left',
    right: 'glancing to their right',
    down: 'looking downward (phone or keyboard)',
    unknown: 'gaze unclear',
  };
  const movementPhrases: Record<string, string> = {
    low: 'still and composed',
    medium: 'some body movement',
    high: 'fidgeting or moving significantly',
  };
  const movementTypePhrases: Record<string, string> = {
    still: '',
    head_only: 'moving only their head',
    gesturing: 'gesturing with their hands',
    body_shift: 'shifting their body position',
    restless: 'showing restless whole-body movement',
  };
  const headMotionPhrases: Record<string, string> = {
    nodding: 'nodding their head',
    shaking: 'shaking their head',
    still: '',
  };
  const emotionPhrases: Record<string, string> = {
    happy: 'appears happy or pleased',
    sad: 'appears sad or disappointed',
    angry: 'appears angry',
    frustrated: 'appears frustrated',
    surprised: 'appears surprised',
    neutral: '',
    unknown: '',
  };

  const parts: string[] = [
    posturePhrases[state.posture] ?? posturePhrases.unknown,
    gazePhrases[state.gaze] ?? gazePhrases.unknown,
    movementPhrases[state.movement] ?? movementPhrases.low,
  ];

  const movementTypePhrase =
    movementTypePhrases[state.movementType ?? 'still'] ?? '';
  if (movementTypePhrase) parts.push(movementTypePhrase);

  const headMotionPhrase = headMotionPhrases[state.headMotion ?? 'still'] ?? '';
  if (headMotionPhrase) parts.push(headMotionPhrase);

  const emotionPhrase = emotionPhrases[state.emotion ?? 'unknown'] ?? '';
  if (emotionPhrase) parts.push(emotionPhrase);

  const attention = state.attention ?? -1;
  const attentionSuffix =
    attention < 0
      ? ''
      : attention >= 75
        ? ` Attention: high (${attention}% looking at camera in last 10 s).`
        : attention >= 45
          ? ` Attention: moderate (${attention}% looking at camera in last 10 s).`
          : ` Attention: low — frequently looking away (${attention}% camera focus in last 10 s).`;

  return `Engagement: ${engagement}. Camera observation: person is visible, ${parts.join(', ')}.${attentionSuffix}`;
}
