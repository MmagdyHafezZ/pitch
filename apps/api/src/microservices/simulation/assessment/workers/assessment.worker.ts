import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { AssessmentService } from '../assessment.service';

interface TurnCompletedEventPayload {
  type: 'turn_completed';
  iterationId?: string;
  sessionId: string;
  sessionMemberId?: string;
}

const isTurnCompletedEventPayload = (
  payload: unknown,
): payload is TurnCompletedEventPayload => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const hasIteration = typeof record.iterationId === 'string';
  const hasSessionMember = typeof record.sessionMemberId === 'string';
  return (
    record.type === 'turn_completed' &&
    typeof record.sessionId === 'string' &&
    (hasIteration || hasSessionMember)
  );
};

@Controller()
export class AssessmentWorker {
  private readonly logger = new Logger(AssessmentWorker.name);

  constructor(private readonly assessmentService: AssessmentService) {}

  @EventPattern(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN_REQUEST)
  async handleRunRequest(
    @Payload()
    payload: {
      runId: string;
      iterationId?: string;
      sessionMemberId?: string;
      sessionId?: string;
      mode?: string;
      configVersion?: string;
    },
  ) {
    if (!payload?.runId) {
      this.logger.warn('Received assessment run request without runId');
      return;
    }

    this.logger.log(`Processing assessment run ${payload.runId}`);
    await this.assessmentService.executeRun({
      runId: payload.runId,
      iterationId: payload.iterationId,
      sessionMemberId: payload.sessionMemberId,
      sessionId: payload.sessionId,
      configVersion: payload.configVersion,
    });
  }

  @EventPattern(SIMULATION_SERVICE_PATTERNS.PUBLISH_EVENT)
  async handleSimulationEvent(@Payload() payload: unknown) {
    if (!isTurnCompletedEventPayload(payload)) {
      return;
    }

    await this.assessmentService.enqueueLiveForTurn({
      iterationId: payload.iterationId,
      sessionMemberId: payload.sessionMemberId,
      sessionId: payload.sessionId,
    });
  }

  @EventPattern(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN_COMPLETED)
  handleRunCompleted(@Payload() payload: { runId?: string }) {
    if (!payload?.runId) {
      return;
    }
    this.logger.debug(`Received assessment completed event: ${payload.runId}`);
  }

  @EventPattern(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN_FAILED)
  handleRunFailed(@Payload() payload: { runId?: string; error?: string }) {
    if (!payload?.runId) {
      return;
    }
    this.logger.warn(
      `Received assessment failed event: ${payload.runId} ${payload.error ? `(${payload.error})` : ''}`,
    );
  }
}
