import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { ChallengeService } from '../services/challenge.service';
import type { MessageWithUserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import type {
  ListChallengesDto,
  TriggerGenerateDto,
} from '../dto/challenge.dto';

@Controller()
export class ChallengeController {
  private readonly logger = new Logger(ChallengeController.name);

  constructor(private readonly challengeService: ChallengeService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHALLENGE_LIST)
  async listChallenges(
    @Payload() data: ListChallengesDto & MessageWithUserClaims,
  ) {
    try {
      const { userClaims, ...query } = data;
      return await this.challengeService.list(query, userClaims?.id);
    } catch (error) {
      this.logger.error('Failed to list challenges', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHALLENGE_GET)
  async getChallenge(@Payload() data: { id: string } & MessageWithUserClaims) {
    try {
      return await this.challengeService.get(data.id, data.userClaims?.id);
    } catch (error) {
      this.logger.error(`Failed to get challenge ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHALLENGE_PARTICIPATE)
  async participate(
    @Payload() data: { challengeId: string } & MessageWithUserClaims,
  ) {
    try {
      if (!data.userClaims?.id) throw new Error('User claims required');
      return await this.challengeService.participate(
        data.challengeId,
        data.userClaims.id,
      );
    } catch (error) {
      this.logger.error('Failed to register participation', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHALLENGE_SUBMIT_SCORE)
  async submitScore(
    @Payload()
    data: {
      challengeId: string;
      sessionId: string;
      score: number;
    } & MessageWithUserClaims,
  ) {
    try {
      if (!data.userClaims?.id) throw new Error('User claims required');
      return await this.challengeService.submitScore(
        data.challengeId,
        data.userClaims.id,
        data.sessionId,
        data.score,
      );
    } catch (error) {
      this.logger.error('Failed to submit score', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD)
  async leaderboard(
    @Payload()
    data: { challengeId?: string; limit?: number } & MessageWithUserClaims,
  ) {
    try {
      return await this.challengeService.leaderboard(
        data.challengeId,
        data.limit,
      );
    } catch (error) {
      this.logger.error('Failed to fetch leaderboard', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE)
  triggerGenerate(@Payload() data: TriggerGenerateDto) {
    try {
      this.logger.log(
        `Received challenge generation trigger for period: ${data.period}`,
      );
      // Run async — don't block the queue
      void this.challengeService
        .triggerGenerate(data)
        .catch((err) =>
          this.logger.error(
            `Challenge generation failed: ${(err as Error).message}`,
          ),
        );
      return { triggered: true, period: data.period };
    } catch (error) {
      this.logger.error('Failed to trigger challenge generation', error);
      throw toRpcException(error);
    }
  }
}
