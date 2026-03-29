import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentService } from '../../assessment/assessment.service';
import { AssessmentMode, AssessmentRunStatus } from '@prisma/simulation-client';
import { AssessmentModeDto } from '../../assessment/dto/assessment.dto';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

const makeRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  iterationId: 'iter-1',
  status: AssessmentRunStatus.queued,
  mode: AssessmentMode.final,
  totalScore: null,
  config: { version: 'v1' },
  engineVersion: 'langgraph-v1.1',
  inputHash: 'hash-1',
  createdAt: new Date('2024-01-01'),
  completedAt: null,
  summary: null,
  ...overrides,
});

const makeIteration = (overrides: Record<string, unknown> = {}) => ({
  id: 'iter-1',
  iterationNumber: 1,
  sessionId: 'session-1',
  sessionMemberId: 'sm-1',
  sessionMember: { userId: 'user-1' },
  session: {
    orgId: 'org-1',
    scenario: { id: 'scenario-1', updatedAt: null },
    persona: { id: 'persona-1', updatedAt: null },
  },
  ...overrides,
});

// Mocks for AssessmentRepository
const assessmentRepoMock = {
  findByInputHash: jest.fn(),
  createRun: jest.fn(),
  findById: jest.fn(),
  findLatestCompletedForIteration: jest.fn(),
  findLatestCompletedForSession: jest.fn(),
  markRunning: jest.fn(),
  markCompleted: jest.fn(),
  markFailed: jest.fn(),
};

// Mocks for AssessmentReportRepository
const reportRepoMock = {
  findByRunId: jest.fn(),
};

// Mocks for AssessmentGraphRunner
const graphRunnerMock = {
  run: jest.fn(),
};

// Mocks for SimulationPrismaService
const turnFindManyMock = jest.fn();
const iterationFindUniqueMock = jest.fn();
const iterationFindFirstMock = jest.fn();
const sessionMemberFindManyMock = jest.fn();
const sessionMemberFindFirstMock = jest.fn();

const prismaMock = {
  client: {
    turn: { findMany: turnFindManyMock },
    iteration: {
      findUnique: iterationFindUniqueMock,
      findFirst: iterationFindFirstMock,
    },
    sessionMember: {
      findMany: sessionMemberFindManyMock,
      findFirst: sessionMemberFindFirstMock,
    },
  },
};

// Mocks for AssessmentQueuePublisher
const queuePublisherMock = {
  emitRunRequest: jest.fn(),
  emitCompleted: jest.fn(),
  emitFailed: jest.fn(),
};

// Mocks for RedisService
const redisMock = {
  incr: jest.fn().mockResolvedValue(1),
  set: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  delete: jest.fn().mockResolvedValue(undefined),
  expire: jest.fn().mockResolvedValue(undefined),
  lpush: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const createService = () =>
  new AssessmentService(
    assessmentRepoMock as any,
    reportRepoMock as any,
    graphRunnerMock as any,
    prismaMock as any,
    queuePublisherMock as any,
    redisMock as any,
  );

// ---------------------------------------------------------------------------
// Shared iteration setup for requestRun / resolveIterationContext
// ---------------------------------------------------------------------------

const setupIterationByIterationId = () => {
  iterationFindUniqueMock.mockResolvedValue(makeIteration());
  turnFindManyMock.mockResolvedValue([]);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssessmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.incr.mockResolvedValue(1);
    redisMock.set.mockResolvedValue(true);
    redisMock.get.mockResolvedValue(null);
    redisMock.delete.mockResolvedValue(undefined);
    redisMock.lpush.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // requestRun
  // -------------------------------------------------------------------------

  describe('requestRun', () => {
    it('returns existing run when input hash matches a non-failed run', async () => {
      setupIterationByIterationId();
      const existingRun = makeRun({
        status: AssessmentRunStatus.completed,
        totalScore: 80,
      });
      assessmentRepoMock.findByInputHash.mockResolvedValue(existingRun);

      const svc = createService();
      const result = await svc.requestRun({
        iterationId: 'iter-1',
        mode: AssessmentModeDto.final,
      });

      expect(result.runId).toBe('run-1');
      expect(result.status).toBe(AssessmentRunStatus.completed);
      expect(assessmentRepoMock.createRun).not.toHaveBeenCalled();
    });

    it('creates a new run when no existing hash match', async () => {
      setupIterationByIterationId();
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      const newRun = makeRun();
      assessmentRepoMock.createRun.mockResolvedValue(newRun);

      const svc = createService();
      const result = await svc.requestRun({
        iterationId: 'iter-1',
        mode: AssessmentModeDto.final,
      });

      expect(assessmentRepoMock.createRun).toHaveBeenCalled();
      expect(queuePublisherMock.emitRunRequest).toHaveBeenCalled();
      expect(redisMock.incr).toHaveBeenCalledWith(
        'metrics:assessment:queue_depth',
        1,
      );
      expect(result.runId).toBe('run-1');
    });

    it('creates a new run when existing run is failed (not returned)', async () => {
      setupIterationByIterationId();
      const failedRun = makeRun({ status: AssessmentRunStatus.failed });
      assessmentRepoMock.findByInputHash.mockResolvedValue(failedRun);
      const newRun = makeRun();
      assessmentRepoMock.createRun.mockResolvedValue(newRun);

      const svc = createService();
      const result = await svc.requestRun({
        iterationId: 'iter-1',
        mode: AssessmentModeDto.final,
      });

      expect(assessmentRepoMock.createRun).toHaveBeenCalled();
      expect(result.runId).toBe('run-1');
    });

    it('forces a new run when forceRecalculate is true', async () => {
      setupIterationByIterationId();
      const existingRun = makeRun({ status: AssessmentRunStatus.completed });
      assessmentRepoMock.findByInputHash.mockResolvedValue(existingRun);
      const newRun = makeRun({ id: 'run-forced' });
      assessmentRepoMock.createRun.mockResolvedValue(newRun);

      const svc = createService();
      const result = await svc.requestRun({
        iterationId: 'iter-1',
        mode: AssessmentModeDto.final,
        forceRecalculate: true,
      });

      expect(assessmentRepoMock.createRun).toHaveBeenCalled();
      expect(result.runId).toBe('run-forced');
    });

    it('maps mode dto to prisma enum — live', async () => {
      setupIterationByIterationId();
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      const newRun = makeRun({ mode: AssessmentMode.live });
      assessmentRepoMock.createRun.mockResolvedValue(newRun);

      const svc = createService();
      await svc.requestRun({
        iterationId: 'iter-1',
        mode: AssessmentModeDto.live,
      });

      expect(assessmentRepoMock.createRun).toHaveBeenCalledWith(
        expect.objectContaining({ mode: AssessmentMode.live }),
      );
    });

    it('resolves context via sessionMemberId', async () => {
      iterationFindFirstMock.mockResolvedValue(makeIteration());
      turnFindManyMock.mockResolvedValue([]);
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      assessmentRepoMock.createRun.mockResolvedValue(makeRun());

      const svc = createService();
      const result = await svc.requestRun({
        sessionMemberId: 'sm-1',
        mode: AssessmentModeDto.final,
      });

      expect(result.runId).toBe('run-1');
    });

    it('resolves context via sessionId with requestedBy', async () => {
      sessionMemberFindFirstMock.mockResolvedValue({ id: 'sm-1' });
      iterationFindFirstMock.mockResolvedValue(makeIteration());
      turnFindManyMock.mockResolvedValue([]);
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      assessmentRepoMock.createRun.mockResolvedValue(makeRun());

      const svc = createService();
      const result = await svc.requestRun({
        sessionId: 'session-1',
        requestedBy: 'user-1',
        mode: AssessmentModeDto.final,
      });

      expect(result.runId).toBe('run-1');
    });

    it('resolves context via sessionId using role:owner fallback', async () => {
      sessionMemberFindFirstMock.mockResolvedValue({ id: 'sm-1' });
      iterationFindFirstMock.mockResolvedValue(makeIteration());
      turnFindManyMock.mockResolvedValue([]);
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      assessmentRepoMock.createRun.mockResolvedValue(makeRun());

      const svc = createService();
      const result = await svc.requestRun({
        sessionId: 'session-1',
        mode: AssessmentModeDto.final,
      });

      expect(result.runId).toBe('run-1');
    });

    it('throws NotFoundException when sessionId has no member', async () => {
      sessionMemberFindFirstMock.mockResolvedValue(null);

      const svc = createService();
      await expect(
        svc.requestRun({
          sessionId: 'session-1',
          mode: AssessmentModeDto.final,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when sessionId member has no iterations', async () => {
      sessionMemberFindFirstMock.mockResolvedValue({ id: 'sm-1' });
      iterationFindFirstMock.mockResolvedValue(null);

      const svc = createService();
      await expect(
        svc.requestRun({
          sessionId: 'session-1',
          mode: AssessmentModeDto.final,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when iterationId is not found', async () => {
      iterationFindUniqueMock.mockResolvedValue(null);

      const svc = createService();
      await expect(
        svc.requestRun({
          iterationId: 'missing',
          mode: AssessmentModeDto.final,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when sessionMemberId has no iterations', async () => {
      iterationFindFirstMock.mockResolvedValue(null);

      const svc = createService();
      await expect(
        svc.requestRun({
          sessionMemberId: 'sm-missing',
          mode: AssessmentModeDto.final,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when no identifiers are provided', async () => {
      const svc = createService();
      await expect(
        svc.requestRun({ mode: AssessmentModeDto.final }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // getRunStatus
  // -------------------------------------------------------------------------

  describe('getRunStatus', () => {
    it('returns run status for a known run', async () => {
      const run = makeRun({
        status: AssessmentRunStatus.completed,
        totalScore: 90,
        completedAt: new Date('2024-06-01'),
        summary: {
          totalScore: 90,
          scoreBreakdown: { clarity: 45, engagement: 45 },
          narrativeSummary: 'Great job',
          coachTips: [{ text: 'Speak clearly' }],
        },
      });
      assessmentRepoMock.findById.mockResolvedValue(run);

      const svc = createService();
      const result = await svc.getRunStatus('run-1');

      expect(result.runId).toBe('run-1');
      expect(result.status).toBe(AssessmentRunStatus.completed);
      expect(result.totalScore).toBe(90);
      expect(result.summary?.narrativeSummary).toBe('Great job');
      expect(result.summary?.coachTips?.[0].text).toBe('Speak clearly');
      expect(result.progress?.stage).toBe('completed');
    });

    it('throws NotFoundException when run does not exist', async () => {
      assessmentRepoMock.findById.mockResolvedValue(null);

      const svc = createService();
      await expect(svc.getRunStatus('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns progress stage for queued runs', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({ status: AssessmentRunStatus.queued }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.progress?.stage).toBe('queued');
      expect(result.progress?.percent).toBe(0);
    });

    it('returns progress stage for running runs', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({ status: AssessmentRunStatus.running }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.progress?.stage).toBe('running');
      expect(result.progress?.percent).toBe(50);
    });

    it('returns progress stage for failed runs', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({ status: AssessmentRunStatus.failed }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.progress?.stage).toBe('failed');
    });

    it('returns progress stage for cancelled runs', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({ status: AssessmentRunStatus.cancelled }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.progress?.stage).toBe('cancelled');
    });

    it('handles null summary gracefully', async () => {
      assessmentRepoMock.findById.mockResolvedValue(makeRun({ summary: null }));

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary).toBeUndefined();
    });

    it('handles scoreBreakdown that is not a plain object', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({
          summary: {
            totalScore: 50,
            scoreBreakdown: [1, 2, 3], // array — should be normalized to undefined
            narrativeSummary: null,
            coachTips: null,
          },
        }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary?.scoreBreakdown).toBeUndefined();
    });

    it('handles scoreBreakdown with non-numeric values filtered out', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({
          summary: {
            totalScore: 50,
            scoreBreakdown: { clarity: 30, label: 'bad' }, // 'bad' is not number
            narrativeSummary: null,
            coachTips: null,
          },
        }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary?.scoreBreakdown).toEqual({ clarity: 30 });
    });

    it('returns undefined scoreBreakdown when all values are non-numeric', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({
          summary: {
            totalScore: 50,
            scoreBreakdown: { label: 'bad' },
            narrativeSummary: null,
            coachTips: null,
          },
        }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary?.scoreBreakdown).toBeUndefined();
    });

    it('handles coachTips that are not an array', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({
          summary: {
            totalScore: 50,
            scoreBreakdown: null,
            narrativeSummary: null,
            coachTips: { text: 'not an array' }, // wrong shape
          },
        }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary?.coachTips).toBeUndefined();
    });

    it('filters out coach tips without a text field', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({
          summary: {
            totalScore: 50,
            scoreBreakdown: null,
            narrativeSummary: null,
            coachTips: [
              { text: 'Good tip' },
              { link: 'http://example.com' }, // no text
              null,
              { text: 'Another tip', link: 'http://link.com' },
            ],
          },
        }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary?.coachTips).toHaveLength(2);
      expect(result.summary?.coachTips?.[0]).toEqual({ text: 'Good tip' });
      expect(result.summary?.coachTips?.[1]).toEqual({
        text: 'Another tip',
        link: 'http://link.com',
      });
    });

    it('returns undefined coachTips when all tips are invalid', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({
          summary: {
            totalScore: 50,
            scoreBreakdown: null,
            narrativeSummary: null,
            coachTips: [null, { link: 'no text' }],
          },
        }),
      );

      const svc = createService();
      const result = await svc.getRunStatus('run-1');
      expect(result.summary?.coachTips).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getLatest
  // -------------------------------------------------------------------------

  describe('getLatest', () => {
    it('throws BadRequestException when no identifiers provided', async () => {
      const svc = createService();
      await expect(svc.getLatest()).rejects.toThrow(BadRequestException);
    });

    it('finds latest by iterationId', async () => {
      const run = makeRun({
        status: AssessmentRunStatus.completed,
        totalScore: 75,
      });
      assessmentRepoMock.findLatestCompletedForIteration.mockResolvedValue(run);

      const svc = createService();
      const result = await svc.getLatest(undefined, 'iter-1');

      expect(result.runId).toBe('run-1');
      expect(result.totalScore).toBe(75);
    });

    it('resolves sessionMemberId from iteration when iterationId given and sessionMemberId absent', async () => {
      const run = makeRun({
        status: AssessmentRunStatus.completed,
        totalScore: 75,
      });
      assessmentRepoMock.findLatestCompletedForIteration.mockResolvedValue(run);
      iterationFindUniqueMock.mockResolvedValue({
        sessionMemberId: 'sm-resolved',
      });

      const svc = createService();
      const result = await svc.getLatest(undefined, 'iter-1');

      expect(result.sessionMemberId).toBe('sm-resolved');
    });

    it('finds latest by sessionMemberId', async () => {
      const run = makeRun({
        status: AssessmentRunStatus.completed,
        totalScore: 60,
      });
      iterationFindFirstMock.mockResolvedValue({ id: 'iter-1' });
      assessmentRepoMock.findLatestCompletedForIteration.mockResolvedValue(run);

      const svc = createService();
      const result = await svc.getLatest(undefined, undefined, 'sm-1');

      expect(result.runId).toBe('run-1');
    });

    it('throws NotFoundException when sessionMemberId has no iterations', async () => {
      iterationFindFirstMock.mockResolvedValue(null);

      const svc = createService();
      await expect(
        svc.getLatest(undefined, undefined, 'sm-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('finds latest by sessionId', async () => {
      const run = makeRun({
        status: AssessmentRunStatus.completed,
        totalScore: 55,
      });
      assessmentRepoMock.findLatestCompletedForSession.mockResolvedValue(run);

      const svc = createService();
      const result = await svc.getLatest('session-1');

      expect(result.runId).toBe('run-1');
    });

    it('throws NotFoundException when no completed assessments found', async () => {
      assessmentRepoMock.findLatestCompletedForSession.mockResolvedValue(null);

      const svc = createService();
      await expect(svc.getLatest('session-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDashboard
  // -------------------------------------------------------------------------

  describe('getDashboard', () => {
    it('returns dashboard sessions for a user', async () => {
      const now = new Date();
      sessionMemberFindManyMock.mockResolvedValue([
        {
          session: {
            id: 'session-1',
            name: 'Demo Session',
            type: 'practice',
            status: 'ended',
            createdAt: now,
            endedAt: now,
          },
          iterations: [
            {
              assessmentRuns: [
                {
                  id: 'run-1',
                  totalScore: 88,
                  summary: {
                    totalScore: 88,
                    scoreBreakdown: { clarity: 44 },
                  },
                },
              ],
            },
          ],
        },
      ]);

      const svc = createService();
      const result = await svc.getDashboard('user-1');

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].id).toBe('session-1');
      expect(result.sessions[0].runId).toBe('run-1');
      expect(result.sessions[0].totalScore).toBe(88);
      expect(result.sessions[0].scoreBreakdown).toEqual({ clarity: 44 });
    });

    it('returns null runId when member has no iterations', async () => {
      sessionMemberFindManyMock.mockResolvedValue([
        {
          session: {
            id: 'session-2',
            name: null,
            type: 'practice',
            status: 'active',
            createdAt: new Date(),
            endedAt: null,
          },
          iterations: [],
        },
      ]);

      const svc = createService();
      const result = await svc.getDashboard('user-2');

      expect(result.sessions[0].runId).toBeNull();
      expect(result.sessions[0].totalScore).toBeNull();
    });

    it('returns empty sessions array when user has no memberships', async () => {
      sessionMemberFindManyMock.mockResolvedValue([]);

      const svc = createService();
      const result = await svc.getDashboard('user-nobody');

      expect(result.sessions).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getReport
  // -------------------------------------------------------------------------

  describe('getReport', () => {
    it('returns report data when found', async () => {
      reportRepoMock.findByRunId.mockResolvedValue({
        runId: 'run-1',
        report: { sections: [] },
      });

      const svc = createService();
      const result = await svc.getReport('run-1');

      expect(result.runId).toBe('run-1');
      expect(result.report).toEqual({ sections: [] });
    });

    it('throws NotFoundException when report is not found', async () => {
      reportRepoMock.findByRunId.mockResolvedValue(null);

      const svc = createService();
      await expect(svc.getReport('run-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // executeRun
  // -------------------------------------------------------------------------

  describe('executeRun', () => {
    const setupExecuteRun = () => {
      const run = makeRun({ status: AssessmentRunStatus.queued });
      assessmentRepoMock.findById.mockResolvedValue(run);
      iterationFindUniqueMock.mockResolvedValue({
        id: 'iter-1',
        sessionId: 'session-1',
        sessionMemberId: 'sm-1',
        sessionMember: { userId: 'user-1' },
        session: { orgId: 'org-1' },
      });
      redisMock.set.mockResolvedValue(true); // lock acquired
      redisMock.incr.mockResolvedValue(1); // below max parallel
      graphRunnerMock.run.mockResolvedValue({
        summary: { totalScore: 85 },
      });
      assessmentRepoMock.markRunning.mockResolvedValue(undefined);
      assessmentRepoMock.markCompleted.mockResolvedValue(undefined);
    };

    it('executes the run successfully', async () => {
      setupExecuteRun();

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(assessmentRepoMock.markRunning).toHaveBeenCalledWith(
        'run-1',
        expect.any(Date),
      );
      expect(graphRunnerMock.run).toHaveBeenCalled();
      expect(assessmentRepoMock.markCompleted).toHaveBeenCalledWith(
        'run-1',
        85,
        expect.any(Date),
        'run-1',
      );
      expect(queuePublisherMock.emitCompleted).toHaveBeenCalled();
    });

    it('returns early when run is not found', async () => {
      assessmentRepoMock.findById.mockResolvedValue(null);

      const svc = createService();
      await svc.executeRun({ runId: 'missing' });

      expect(graphRunnerMock.run).not.toHaveBeenCalled();
    });

    it('returns early when run is already completed', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({ status: AssessmentRunStatus.completed }),
      );

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(graphRunnerMock.run).not.toHaveBeenCalled();
    });

    it('returns early when run is already running', async () => {
      assessmentRepoMock.findById.mockResolvedValue(
        makeRun({ status: AssessmentRunStatus.running }),
      );

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(graphRunnerMock.run).not.toHaveBeenCalled();
    });

    it('returns early when Redis lock is not acquired', async () => {
      const run = makeRun({ status: AssessmentRunStatus.queued });
      assessmentRepoMock.findById.mockResolvedValue(run);
      iterationFindUniqueMock.mockResolvedValue({
        id: 'iter-1',
        sessionId: 'session-1',
        sessionMemberId: 'sm-1',
        sessionMember: { userId: 'user-1' },
        session: { orgId: 'org-1' },
      });
      redisMock.set.mockResolvedValue(false); // lock NOT acquired
      redisMock.incr.mockResolvedValue(1);

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(graphRunnerMock.run).not.toHaveBeenCalled();
    });

    it('returns early when iteration is not found', async () => {
      const run = makeRun({ status: AssessmentRunStatus.queued });
      assessmentRepoMock.findById.mockResolvedValue(run);
      iterationFindUniqueMock.mockResolvedValue(null);

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(graphRunnerMock.run).not.toHaveBeenCalled();
    });

    it('returns early when org concurrency limit is exceeded', async () => {
      const run = makeRun({ status: AssessmentRunStatus.queued });
      assessmentRepoMock.findById.mockResolvedValue(run);
      iterationFindUniqueMock.mockResolvedValue({
        id: 'iter-1',
        sessionId: 'session-1',
        sessionMemberId: 'sm-1',
        sessionMember: { userId: 'user-1' },
        session: { orgId: 'org-1' },
      });
      redisMock.set.mockResolvedValue(true); // lock acquired
      // incr returns value > maxParallelRuns (2) for the org token
      redisMock.incr.mockResolvedValue(999);

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(graphRunnerMock.run).not.toHaveBeenCalled();
    });

    it('marks run failed and emits failure event on graph error', async () => {
      setupExecuteRun();
      graphRunnerMock.run.mockRejectedValue(new Error('graph exploded'));
      assessmentRepoMock.markFailed.mockResolvedValue(undefined);

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(assessmentRepoMock.markFailed).toHaveBeenCalledWith(
        'run-1',
        expect.any(Date),
      );
      expect(queuePublisherMock.emitFailed).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', error: 'graph exploded' }),
      );
    });

    it('releases semaphore and Redis lock even when graph fails', async () => {
      setupExecuteRun();
      graphRunnerMock.run.mockRejectedValue(new Error('fail'));
      assessmentRepoMock.markFailed.mockResolvedValue(undefined);

      const svc = createService();
      await svc.executeRun({ runId: 'run-1' });

      expect(redisMock.delete).toHaveBeenCalledWith(
        expect.stringContaining('run-1'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // enqueueLiveForTurn
  // -------------------------------------------------------------------------

  describe('enqueueLiveForTurn', () => {
    it('does nothing when no identifiers are present', async () => {
      const svc = createService();
      await svc.enqueueLiveForTurn({});

      expect(assessmentRepoMock.findByInputHash).not.toHaveBeenCalled();
    });

    it('calls requestRun in live mode with iterationId', async () => {
      setupIterationByIterationId();
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      assessmentRepoMock.createRun.mockResolvedValue(makeRun());

      const svc = createService();
      await svc.enqueueLiveForTurn({ iterationId: 'iter-1' });

      expect(assessmentRepoMock.createRun).toHaveBeenCalledWith(
        expect.objectContaining({ mode: AssessmentMode.live }),
      );
    });

    it('calls requestRun with sessionId', async () => {
      sessionMemberFindFirstMock.mockResolvedValue({ id: 'sm-1' });
      iterationFindFirstMock.mockResolvedValue(makeIteration());
      turnFindManyMock.mockResolvedValue([]);
      assessmentRepoMock.findByInputHash.mockResolvedValue(null);
      assessmentRepoMock.createRun.mockResolvedValue(makeRun());

      const svc = createService();
      await svc.enqueueLiveForTurn({ sessionId: 'session-1' });

      expect(assessmentRepoMock.createRun).toHaveBeenCalled();
    });
  });
});
