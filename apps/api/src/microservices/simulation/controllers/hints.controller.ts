import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { HintsService } from '../services/hints.service';
import {
  GenerateHintRequestDto,
  GenerateHintResponseDto,
  GetHintHistoryRequestDto,
  HintHistoryResponseDto,
} from '../dto/hints.dto';
import { WsEnvelope } from '../dto/websocket.dto';

/**
 * Controller for handling hint generation and retrieval
 */
@Controller()
export class HintsController {
  private readonly logger = new Logger(HintsController.name);

  constructor(private readonly hintsService: HintsService) {}

  /**
   * Generate hints for a session
   * Message Pattern: simulation.hints.generate
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.HINTS_GENERATE)
  async generateHints(
    @Payload() envelope: WsEnvelope<GenerateHintRequestDto>,
  ): Promise<GenerateHintResponseDto> {
    this.logger.log(
      `Received hint generation request for session ${envelope.payload.sessionId}`,
    );

    try {
      // Enrich payload with envelope metadata
      const request: GenerateHintRequestDto = {
        ...envelope.payload,
        userId: envelope.payload.userId || envelope.userId,
        orgId: envelope.payload.orgId,
      };

      const response = await this.hintsService.generateHints(request);

      this.logger.log(
        `Generated ${response.hints.length} hints for session ${envelope.payload.sessionId}`,
      );

      return response;
    } catch (error) {
      const err = normalizeError(error);
      this.logger.error(
        `Error generating hints for session ${envelope.payload.sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get hint history for a session
   * Message Pattern: simulation.hints.history
   */
  @MessagePattern(SIMULATION_SERVICE_PATTERNS.HINTS_HISTORY)
  async getHintHistory(
    @Payload() envelope: WsEnvelope<GetHintHistoryRequestDto>,
  ): Promise<HintHistoryResponseDto> {
    this.logger.log(
      `Received hint history request for session ${envelope.payload.sessionId}`,
    );

    try {
      const request: GetHintHistoryRequestDto = {
        ...envelope.payload,
        userId: envelope.payload.userId || envelope.userId,
      };

      const response = await this.hintsService.getHintHistory(request);

      this.logger.log(
        `Retrieved ${response.history.length} hint entries for session ${envelope.payload.sessionId}`,
      );

      return response;
    } catch (error) {
      const err = normalizeError(error);
      this.logger.error(
        `Error retrieving hint history for session ${envelope.payload.sessionId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
