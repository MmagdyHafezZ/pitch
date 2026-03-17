import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConversationOrchestrationService } from './conversation-orchestration.service';
import type { ConversationStreamEvent } from '../dto/conversation-stream.types';
import { WsMessageType } from '../dto/websocket.dto';

export interface PhoneConversationRequest {
  sessionId: string;
  userId: string;
  text: string;
  startAsAssistant?: boolean;
  requestId?: string;
}

export interface PhoneConversationToolEvent {
  tool: string;
  args: Record<string, unknown>;
}

export interface PhoneConversationResult {
  text: string;
  hangupRequested: boolean;
  hangupReason?: string;
  toolEvents: PhoneConversationToolEvent[];
  progress?: number;
}

@Injectable()
export class PhoneConversationEngineService {
  private readonly logger = new Logger(PhoneConversationEngineService.name);

  constructor(
    private readonly conversationOrchestration: ConversationOrchestrationService,
  ) {}

  async generateTurn(
    input: PhoneConversationRequest,
  ): Promise<PhoneConversationResult> {
    const requestId = input.requestId ?? randomUUID();

    this.logger.log(
      `phone_engine.request session=${input.sessionId} user=${input.userId} request=${requestId} startAsAssistant=${input.startAsAssistant === true}`,
    );

    return new Promise<PhoneConversationResult>((resolve, reject) => {
      const result: PhoneConversationResult = {
        text: '',
        hangupRequested: false,
        toolEvents: [],
      };

      this.conversationOrchestration
        .stream({
          type: WsMessageType.CONVERSATION_START,
          requestId,
          sessionId: input.sessionId,
          userId: input.userId,
          payload: {
            text: input.text,
            startAsAssistant: input.startAsAssistant === true,
          },
          timestamp: new Date().toISOString(),
        })
        .subscribe({
          next: (event: ConversationStreamEvent) => {
            if (event.type === 'delta') {
              result.text += event.data.delta;
              return;
            }

            if (event.type === 'completed') {
              result.text = event.data.fullText;
              result.progress = event.data.progress;
              return;
            }

            if (event.type === 'hangup_requested') {
              result.hangupRequested = true;
              result.hangupReason = event.data.reason;
              return;
            }

            if (event.type === 'tool_executed') {
              result.toolEvents.push({
                tool: event.data.tool,
                args: event.data.args,
              });
            }
          },
          error: (error) => {
            this.logger.error(
              `phone_engine.error session=${input.sessionId} user=${input.userId} request=${requestId}`,
              error,
            );
            reject(error);
          },
          complete: () => {
            this.logger.log(
              `phone_engine.completed session=${input.sessionId} user=${input.userId} request=${requestId} hangup=${result.hangupRequested}`,
            );
            resolve(result);
          },
        });
    });
  }
}
