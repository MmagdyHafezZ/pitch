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
  ConversationTextPayload,
  ConversationAudioReadyPayload,
  ConversationErrorPayload,
  WsEnvelope,
  WsEnvelopeFactory,
  WsMessageType,
} from '@microservices/simulation/dto/websocket.dto';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { LLMStreamChunkDto } from '@microservices/simulation/dto/llm.dto';
import { Subscription, firstValueFrom } from 'rxjs';
import { JwtTokenPayload, SocketUser } from '../../../types/socket';

interface SimulationSocketData {
  user?: SocketUser;
}

type SimulationSocket = Socket<any, any, any, SimulationSocketData>;

interface ConversationProcessResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
  };
  audioBase64: string;
  contentType: string;
}

interface StreamHandle {
  socketId: string;
  subscription: Subscription;
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
        this.activeStreams.delete(requestId);
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
  async handleConversationStart(
    @ConnectedSocket() client: SimulationSocket,
    @MessageBody() envelope: WsEnvelope<ConversationStartPayload>,
  ) {
    const requestId = envelope.requestId;
    const sessionId = envelope.sessionId;

    if (this.activeStreams.has(requestId)) {
      return;
    }

    try {
      const result = await firstValueFrom(
        this.simulationService.send<ConversationProcessResult>(
          SIMULATION_SERVICE_PATTERNS.CONVERSATION_PROCESS,
          envelope,
        ),
      );

      const textPayload: ConversationTextPayload = {
        text: result.text,
        usage: result.usage,
      };

      client.emit(
        WsMessageType.CONVERSATION_TEXT,
        WsEnvelopeFactory.conversationText(
          requestId,
          sessionId,
          textPayload,
          envelope.turnId,
        ),
      );

      const audioPayload: ConversationAudioReadyPayload = {
        audioBase64: result.audioBase64,
        contentType: result.contentType,
        text: result.text,
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

      client.emit(WsMessageType.CONVERSATION_END, {
        requestId,
        sessionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Conversation processing failed', error);

      const errorPayload: ConversationErrorPayload = {
        error: (error as Error)?.message || 'Conversation processing error',
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
    }
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
