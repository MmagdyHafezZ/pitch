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
  ChatDeltaPayload,
  ChatErrorPayload,
  ChatStartPayload,
  ConversationStartPayload,
  ConversationAudioReadyPayload,
  ConversationErrorPayload,
  ConversationStreamDeltaPayload,
  ConversationStreamCompletedPayload,
  ConversationStageTransitionPayload,
  WsEnvelope,
  WsEnvelopeFactory,
  WsMessageType,
} from '@microservices/simulation/dto/websocket.dto';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { LLMStreamChunkDto } from '@microservices/simulation/dto/llm.dto';
import { Subscription } from 'rxjs';
import { JwtTokenPayload, SocketUser } from '../../../types/socket';

interface SimulationSocketData {
  user?: SocketUser;
}

type SimulationSocket = Socket<any, any, any, SimulationSocketData>;

type ConversationStreamEvent =
  | {
      type: 'delta';
      data: {
        delta: string;
        isFirstChunk?: boolean;
      };
    }
  | {
      type: 'completed';
      data: {
        fullText: string;
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
          costUsd?: number;
        };
        stageInfo?: {
          currentStage: string;
          stageIndex: number;
          stageTransition: boolean;
          confidence: number;
        };
        progress?: number;
      };
    }
  | {
      type: 'stage_transition';
      data: {
        previousStage: string;
        currentStage: string;
        previousStageIndex?: number;
        currentStageIndex?: number;
        confidence?: number;
        reasoning?: string;
      };
    }
  | {
      type: 'audio';
      data: {
        audioBase64: string;
        contentType: string;
        text?: string;
      };
    };

interface StreamHandle {
  socketId: string;
  subscription: Subscription;
  timeoutId?: NodeJS.Timeout;
}

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

  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
    private readonly jwtService: JwtService,
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
        if (handle.timeoutId) {
          clearTimeout(handle.timeoutId);
        }
        this.activeStreams.delete(requestId);
        this.logger.debug(
          `Cleaned up stream ${requestId} for disconnected client`,
        );
      }
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

    let content = '';
    const stream$ = this.simulationService.send<
      LLMStreamChunkDto,
      WsEnvelope<ChatStartPayload>
    >(SIMULATION_SERVICE_PATTERNS.CHAT_STREAM, envelope);

    const subscription = stream$.subscribe({
      next: (chunk) => {
        if (chunk.delta) {
          content += chunk.delta;

          const deltaPayload: ChatDeltaPayload = {
            delta: chunk.delta,
          };

          client.emit(
            WsMessageType.CHAT_DELTA,
            WsEnvelopeFactory.chatDelta(
              requestId,
              sessionId,
              deltaPayload,
              envelope.turnId,
            ),
          );
        }

        if (chunk.done) {
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

    this.activeStreams.set(requestId, {
      socketId: client.id,
      subscription,
    });
  }

  @SubscribeMessage(WsMessageType.CHAT_CANCEL)
  handleChatCancel(@MessageBody() payload: { requestId: string }) {
    const requestId = payload.requestId;
    const active = this.activeStreams.get(requestId);

    if (active) {
      active.subscription.unsubscribe();
      this.activeStreams.delete(requestId);
    }

    this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CHAT_CANCEL, { requestId })
      .subscribe({
        error: (error) => {
          this.logger.warn(
            `Failed to forward chat cancel: ${String((error as Error)?.message || error)}`,
          );
        },
      });
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

    // Use streaming conversation handler for real-time text
    const stream$ = this.simulationService.send<
      ConversationStreamEvent,
      WsEnvelope<ConversationStartPayload>
    >(SIMULATION_SERVICE_PATTERNS.CONVERSATION_STREAM, envelope);

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
          // Emit stream completed with full text and stage info
          const completedPayload: ConversationStreamCompletedPayload = {
            fullText: event.data.fullText,
            usage: event.data.usage,
            stageInfo: event.data.stageInfo,
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
        } else if (event.type === 'audio') {
          // Emit audio ready
          const audioPayload: ConversationAudioReadyPayload = {
            audioBase64: event.data.audioBase64,
            contentType: event.data.contentType,
            text: event.data.text,
          };

          client.emit(
            WsMessageType.CONVERSATION_AUDIO_READY,
            WsEnvelopeFactory.conversationAudioReady(
              requestId,
              sessionId,
              audioPayload,
              envelope.turnId,
            ),
          );

          // Emit conversation end after audio
          client.emit(WsMessageType.CONVERSATION_END, {
            requestId,
            sessionId,
            timestamp: new Date().toISOString(),
          });

          clearTimeout(timeoutId);
          this.activeStreams.delete(requestId);
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
  handleConversationCancel(
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

    // Acknowledge cancellation to client
    client.emit(WsMessageType.CONVERSATION_CANCEL, {
      requestId,
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Conversation cancelled: ${requestId}`);
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
