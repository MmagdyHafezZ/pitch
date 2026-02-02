import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { AssessmentService } from '../assessment.service';

interface TurnCompletedEventPayload {
  type: 'turn_completed';
  sessionMemberId: string;
  sessionId: string;
}

const isTurnCompletedEventPayload = (
  payload: unknown,
): payload is TurnCompletedEventPayload => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return (
    record.type === 'turn_completed' &&
    typeof record.sessionMemberId === 'string' &&
    typeof record.sessionId === 'string'
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
      sessionMemberId: payload.sessionMemberId,
      sessionId: payload.sessionId,
    });
  }
}
