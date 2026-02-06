import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

@Injectable()
export class AssessmentQueuePublisher {
  private readonly logger = new Logger(AssessmentQueuePublisher.name);

  constructor(
    @Inject('SIMULATION_QUEUE_CLIENT')
    private readonly client: ClientProxy,
  ) {}

  emitRunRequest(payload: Record<string, any>) {
    this.logger.debug(`Emitting assessment run request: ${payload.runId}`);
    this.client
      .emit(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN_REQUEST, payload)
      .subscribe({
        error: (error) =>
          this.logger.error(`Failed to emit assessment run request`, error),
      });
  }

  emitCompleted(payload: Record<string, any>) {
    this.logger.debug(`Emitting assessment completed: ${payload.runId}`);
    this.client
      .emit(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN_COMPLETED, payload)
      .subscribe({
        error: (error) =>
          this.logger.error(`Failed to emit assessment completed`, error),
      });
  }

  emitFailed(payload: Record<string, any>) {
    this.logger.debug(`Emitting assessment failed: ${payload.runId}`);
    this.client
      .emit(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN_FAILED, payload)
      .subscribe({
        error: (error) =>
          this.logger.error(`Failed to emit assessment failed`, error),
      });
  }
}
