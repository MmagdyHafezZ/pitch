import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @MessagePattern(SUPPORT_SERVICE_PATTERNS.CHAT)
  async chat(
    @Payload()
    payload: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      context?: {
        page?: string;
        sessionId?: string;
        recentTurns?: Array<{ role: string; text: string }>;
      };
    },
  ): Promise<{ reply: string }> {
    try {
      this.logger.log(`CHAT request — turns=${payload.messages?.length ?? 0}`);
      const reply = await this.chatService.chat(
        payload.messages ?? [],
        payload.context,
      );
      return { reply };
    } catch (error) {
      this.logger.error('CHAT failed', error as Error);
      throw toRpcException(error);
    }
  }
}
