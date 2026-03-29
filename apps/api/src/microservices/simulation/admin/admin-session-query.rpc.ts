import { Controller, HttpException, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { AdminSessionQueryService } from './admin-session-query.service';

@Controller()
export class AdminSessionQueryRpc {
  constructor(private readonly service: AdminSessionQueryService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ADMIN_GET_SESSION_EVENTS)
  async getSessionEvents(
    @Payload() payload: { iterationId: string; limit?: number; skip?: number },
  ) {
    return this.service.getSessionEvents(
      payload.iterationId,
      payload.limit ?? 100,
      payload.skip ?? 0,
    );
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ADMIN_GET_SESSION_TRANSCRIPT)
  async getSessionTranscript(@Payload() payload: { iterationId: string }) {
    const transcript = await this.service.getSessionTranscript(
      payload.iterationId,
    );
    if (!transcript) {
      throw new HttpException('Transcript not found', HttpStatus.NOT_FOUND);
    }
    return transcript;
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ADMIN_GET_SESSION_LLM_CALLS)
  async getSessionLlmCalls(
    @Payload() payload: { iterationId: string; limit?: number; skip?: number },
  ) {
    return this.service.getSessionLlmCalls(
      payload.iterationId,
      payload.limit ?? 50,
      payload.skip ?? 0,
    );
  }
}
