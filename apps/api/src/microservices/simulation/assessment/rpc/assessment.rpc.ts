import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { AssessmentService } from '../assessment.service';
import { AssessmentRunRequestDto } from '../dto/assessment.dto';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';

@Controller()
export class AssessmentRpcController {
  private readonly logger = new Logger(AssessmentRpcController.name);

  constructor(private readonly assessmentService: AssessmentService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_RUN)
  @UsePipes(new ValidationPipe({ transform: true }))
  async runAssessment(@Payload() payload: AssessmentRunRequestDto) {
    try {
      this.logger.log(`RPC assessment run request`);
      return await this.assessmentService.requestRun(payload);
    } catch (error) {
      this.logger.error('RPC assessment run failed', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_STATUS)
  async getStatus(@Payload() payload: { runId: string }) {
    try {
      return await this.assessmentService.getRunStatus(payload.runId);
    } catch (error) {
      this.logger.error('RPC assessment status failed', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.ASSESSMENT_LATEST)
  async getLatest(
    @Payload() payload: { sessionId?: string; sessionMemberId?: string },
  ) {
    try {
      return await this.assessmentService.getLatest(
        payload.sessionId,
        payload.sessionMemberId,
      );
    } catch (error) {
      this.logger.error('RPC assessment latest failed', error);
      throw toRpcException(error);
    }
  }
}
