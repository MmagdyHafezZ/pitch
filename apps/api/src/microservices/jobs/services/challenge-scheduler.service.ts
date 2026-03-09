import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

@Injectable()
export class ChallengeSchedulerService {
  private readonly logger = new Logger(ChallengeSchedulerService.name);

  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationClient: ClientProxy,
  ) {}

  /** Daily challenges — 00:00 UTC every day */
  @Cron('0 0 * * *', { name: 'generate-daily-challenges' })
  generateDailyChallenges() {
    this.logger.log('Triggering daily challenge generation');
    this.simulationClient.emit(
      SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
      {
        period: 'DAILY',
      },
    );
  }

  /** Weekly challenges — Monday 00:00 UTC */
  @Cron('0 0 * * 1', { name: 'generate-weekly-challenges' })
  generateWeeklyChallenges() {
    this.logger.log('Triggering weekly challenge generation');
    this.simulationClient.emit(
      SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
      {
        period: 'WEEKLY',
      },
    );
  }

  /** Monthly challenges — 1st of month 00:00 UTC */
  @Cron('0 0 1 * *', { name: 'generate-monthly-challenges' })
  generateMonthlyChallenges() {
    this.logger.log('Triggering monthly challenge generation');
    this.simulationClient.emit(
      SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
      {
        period: 'MONTHLY',
      },
    );
  }
}
