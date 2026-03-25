import { AssessmentController } from '../../assessment/controllers/assessment.controller';
import { AssessmentService } from '../../assessment/assessment.service';

function makeService(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    requestRun: overrides.requestRun ?? jest.fn(),
    getRunStatus: overrides.getRunStatus ?? jest.fn(),
    getReport: overrides.getReport ?? jest.fn(),
    getLatest: overrides.getLatest ?? jest.fn(),
  } as unknown as AssessmentService;
}

describe('AssessmentController', () => {
  describe('runAssessment', () => {
    it('delegates to service.requestRun and returns the result', async () => {
      const expected = { runId: 'run-1', status: 'queued' };
      const requestRun = jest.fn().mockResolvedValue(expected);
      const service = makeService({ requestRun });
      const controller = new AssessmentController(service);

      const payload = { iterationId: 'iter-1' } as any;
      const result = await controller.runAssessment(payload);

      expect(requestRun).toHaveBeenCalledWith(payload);
      expect(result).toEqual(expected);
    });

    it('propagates errors from the service', async () => {
      const requestRun = jest.fn().mockRejectedValue(new Error('bad payload'));
      const service = makeService({ requestRun });
      const controller = new AssessmentController(service);

      await expect(controller.runAssessment({} as any)).rejects.toThrow(
        'bad payload',
      );
    });
  });

  describe('getRunStatus', () => {
    it('returns run status and summary from the service', async () => {
      const expected = { id: 'run-1', status: 'completed', totalScore: 12 };
      const getRunStatus = jest.fn().mockResolvedValue(expected);
      const service = makeService({ getRunStatus });
      const controller = new AssessmentController(service);

      const result = await controller.getRunStatus('run-1');

      expect(getRunStatus).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getReport', () => {
    it('returns assessment report from the service', async () => {
      const expected = { runId: 'run-1', report: { score: 85 } };
      const getReport = jest.fn().mockResolvedValue(expected);
      const service = makeService({ getReport });
      const controller = new AssessmentController(service);

      const result = await controller.getReport('run-1');

      expect(getReport).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getLatestForSession', () => {
    it('delegates to service.getLatest with all parameters', async () => {
      const expected = { runId: 'run-latest', totalScore: 10 };
      const getLatest = jest.fn().mockResolvedValue(expected);
      const service = makeService({ getLatest });
      const controller = new AssessmentController(service);

      const result = await controller.getLatestForSession(
        'session-1',
        'iter-1',
        'sm-1',
      );

      expect(getLatest).toHaveBeenCalledWith('session-1', 'iter-1', 'sm-1');
      expect(result).toEqual(expected);
    });

    it('passes undefined for optional parameters when not provided', async () => {
      const getLatest = jest.fn().mockResolvedValue({ runId: 'run-1' });
      const service = makeService({ getLatest });
      const controller = new AssessmentController(service);

      await controller.getLatestForSession('session-1');

      expect(getLatest).toHaveBeenCalledWith('session-1', undefined, undefined);
    });
  });
});
