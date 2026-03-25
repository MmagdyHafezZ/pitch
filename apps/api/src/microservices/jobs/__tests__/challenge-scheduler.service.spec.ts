import { ChallengeSchedulerService } from '../services/challenge-scheduler.service';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

describe('ChallengeSchedulerService', () => {
  let service: ChallengeSchedulerService;
  let simulationClient: { emit: jest.Mock };

  beforeEach(() => {
    simulationClient = { emit: jest.fn() };
    service = new ChallengeSchedulerService(simulationClient as any);
  });

  describe('generateDailyChallenges', () => {
    it('should emit CHALLENGE_TRIGGER_GENERATE with DAILY period', () => {
      service.generateDailyChallenges();

      expect(simulationClient.emit).toHaveBeenCalledTimes(1);
      expect(simulationClient.emit).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'DAILY' },
      );
    });
  });

  describe('generateWeeklyChallenges', () => {
    it('should emit CHALLENGE_TRIGGER_GENERATE with WEEKLY period', () => {
      service.generateWeeklyChallenges();

      expect(simulationClient.emit).toHaveBeenCalledTimes(1);
      expect(simulationClient.emit).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'WEEKLY' },
      );
    });
  });

  describe('generateMonthlyChallenges', () => {
    it('should emit CHALLENGE_TRIGGER_GENERATE with MONTHLY period', () => {
      service.generateMonthlyChallenges();

      expect(simulationClient.emit).toHaveBeenCalledTimes(1);
      expect(simulationClient.emit).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'MONTHLY' },
      );
    });
  });

  describe('emit isolation', () => {
    it('should not cross-contaminate between calls', () => {
      service.generateDailyChallenges();
      service.generateWeeklyChallenges();
      service.generateMonthlyChallenges();

      expect(simulationClient.emit).toHaveBeenCalledTimes(3);

      expect(simulationClient.emit).toHaveBeenNthCalledWith(
        1,
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'DAILY' },
      );
      expect(simulationClient.emit).toHaveBeenNthCalledWith(
        2,
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'WEEKLY' },
      );
      expect(simulationClient.emit).toHaveBeenNthCalledWith(
        3,
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'MONTHLY' },
      );
    });
  });
});
