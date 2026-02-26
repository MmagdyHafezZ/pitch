import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { LLMService } from '../services/llm/llm.service';
import { LLMRequestDto } from '../dto/llm.dto';
import {
  ChatStartPayload,
  WsEnvelope,
  WsMessageType,
} from '../dto/websocket.dto';

interface ChatStreamRequest {
  requestId?: string;
  sessionId: string;
  iterationId?: string;
  sessionMemberId?: string;
  userId?: string;
  turnId?: string;
  messages: ChatStartPayload['messages'];
  config: ChatStartPayload['config'];
}

@Controller()
export class ChatController {
  constructor(private readonly llmService: LLMService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHAT_COMPLETE)
  async complete(
    @Payload() payload: WsEnvelope<ChatStartPayload> | LLMRequestDto,
  ) {
    const request = this.normalizeRequest(payload);
    return this.llmService.complete({
      sessionId: request.sessionId,
      iterationId: request.iterationId,
      sessionMemberId: request.sessionMemberId,
      userId: request.userId,
      turnId: request.turnId,
      messages: request.messages,
      config: request.config,
    });
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHAT_STREAM)
  stream(@Payload() payload: WsEnvelope<ChatStartPayload>) {
    const request = this.normalizeRequest(payload);

    return this.llmService.stream(
      {
        sessionId: request.sessionId,
        iterationId: request.iterationId,
        sessionMemberId: request.sessionMemberId,
        userId: request.userId,
        turnId: request.turnId,
        messages: request.messages,
        config: {
          ...request.config,
          stream: true,
        },
      },
      {
        requestId: request.requestId,
        purpose: 'chat',
      },
    );
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHAT_CANCEL)
  cancel(@Payload() payload: { requestId: string }) {
    return {
      cancelled: this.llmService.cancel(payload.requestId),
    };
  }

  private normalizeRequest(
    payload: WsEnvelope<ChatStartPayload> | LLMRequestDto,
  ): ChatStreamRequest {
    if (
      (payload as WsEnvelope<ChatStartPayload>).type ===
      WsMessageType.CHAT_START
    ) {
      const envelope = payload as WsEnvelope<ChatStartPayload>;
      return {
        requestId: envelope.requestId,
        sessionId: envelope.sessionId,
        iterationId: envelope.iterationId,
        sessionMemberId: envelope.sessionMemberId,
        userId: envelope.userId,
        turnId: envelope.turnId,
        messages: envelope.payload.messages,
        config: envelope.payload.config,
      };
    }

    const request = payload as LLMRequestDto;
    return {
      sessionId: request.sessionId,
      iterationId: request.iterationId,
      sessionMemberId: request.sessionMemberId,
      userId: request.userId,
      turnId: request.turnId,
      messages: request.messages,
      config: request.config,
    };
  }
}
