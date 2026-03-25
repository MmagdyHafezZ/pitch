import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminMonitoringController } from './admin-monitoring.controller';
import { AdminRequestLogService } from '../../services/admin/admin-request-log.service';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { JwtService } from '@nestjs/jwt';
import { AssessmentReportModel } from '../../../microservices/simulation/schemas/mongodb/assessment-report.schema';
import { LLMTraceModel } from '../../../microservices/simulation/schemas/mongodb/llm-trace.schema';

function makeMongooseModel(findResult: unknown[] = [], countResult = 0) {
  const chainable = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(findResult),
  };

  return {
    find: jest.fn().mockReturnValue(chainable),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(findResult[0] ?? null),
      }),
    }),
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(countResult),
    }),
    aggregate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
    _chainable: chainable,
  };
}

describe('AdminMonitoringController', () => {
  let controller: AdminMonitoringController;
  let assessmentModel: ReturnType<typeof makeMongooseModel>;
  let llmTraceModel: ReturnType<typeof makeMongooseModel>;
  let requestLogService: { findAll: jest.Mock };

  beforeEach(async () => {
    assessmentModel = makeMongooseModel();
    llmTraceModel = makeMongooseModel();
    requestLogService = {
      findAll: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMonitoringController],
      providers: [
        CheckSystemAdmin,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ email: 'admin@test.com' }),
          },
        },
        {
          provide: getModelToken(AssessmentReportModel, 'gateway'),
          useValue: assessmentModel,
        },
        {
          provide: getModelToken(LLMTraceModel, 'gateway'),
          useValue: llmTraceModel,
        },
        {
          provide: AdminRequestLogService,
          useValue: requestLogService,
        },
      ],
    }).compile();

    controller = module.get<AdminMonitoringController>(
      AdminMonitoringController,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listAssessments()', () => {
    it('queries assessmentModel with default limit/offset', async () => {
      const reports = [{ _id: 'r1', sessionId: 's1', mode: 'final' }];
      assessmentModel._chainable.exec.mockResolvedValue(reports);
      assessmentModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await controller.listAssessments();

      expect(assessmentModel.find).toHaveBeenCalledWith();
      expect(assessmentModel._chainable.sort).toHaveBeenCalledWith({
        createdAt: -1,
      });
      expect(assessmentModel._chainable.skip).toHaveBeenCalledWith(0);
      expect(assessmentModel._chainable.limit).toHaveBeenCalledWith(50);
      expect(assessmentModel._chainable.select).toHaveBeenCalledWith({
        _id: 1,
        runId: 1,
        sessionId: 1,
        mode: 1,
        createdAt: 1,
        'report.totalScore': 1,
      });
      expect(result).toEqual({ reports, total: 1 });
    });

    it('parses custom limit/offset', async () => {
      assessmentModel._chainable.exec.mockResolvedValue([]);
      assessmentModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await controller.listAssessments('10', '20');

      expect(assessmentModel._chainable.skip).toHaveBeenCalledWith(20);
      expect(assessmentModel._chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ reports: [], total: 0 });
    });
  });

  describe('llmUsage()', () => {
    it('returns breakdown and totals from aggregation', async () => {
      const aggResult = [
        {
          _id: { provider: 'openai', model: 'gpt-4' },
          totalPromptTokens: 1000,
          totalCompletionTokens: 500,
          totalTokens: 1500,
          totalCost: 0.05,
          callCount: 10,
          avgLatencyMs: 200,
        },
        {
          _id: { provider: 'openai', model: 'gpt-3.5' },
          totalPromptTokens: 2000,
          totalCompletionTokens: 1000,
          totalTokens: 3000,
          totalCost: 0.01,
          callCount: 20,
          avgLatencyMs: 100,
        },
      ];
      llmTraceModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggResult),
      });

      const result = await controller.llmUsage();

      expect(result.breakdown).toEqual(aggResult);
      expect(result.totals.totalTokens).toBe(4500);
      expect(result.totals.totalCost).toBeCloseTo(0.06);
      expect(result.totals.callCount).toBe(30);
    });

    it('returns zero totals when no data', async () => {
      llmTraceModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await controller.llmUsage();

      expect(result.breakdown).toEqual([]);
      expect(result.totals).toEqual({
        totalTokens: 0,
        totalCost: 0,
        callCount: 0,
      });
    });

    it('calls aggregate with correct pipeline', async () => {
      llmTraceModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await controller.llmUsage();

      expect(llmTraceModel.aggregate).toHaveBeenCalledWith([
        {
          $group: {
            _id: { provider: '$provider', model: '$llmModel' },
            totalPromptTokens: { $sum: '$usage.promptTokens' },
            totalCompletionTokens: { $sum: '$usage.completionTokens' },
            totalTokens: { $sum: '$usage.totalTokens' },
            totalCost: { $sum: '$usage.cost' },
            callCount: { $sum: 1 },
            avgLatencyMs: { $avg: '$performance.latencyMs' },
          },
        },
        { $sort: { totalTokens: -1 } },
      ]);
    });

    it('handles null values in aggregation rows gracefully', async () => {
      const aggResult = [
        {
          _id: { provider: 'openai', model: 'gpt-4' },
          totalPromptTokens: null,
          totalCompletionTokens: null,
          totalTokens: null,
          totalCost: null,
          callCount: null,
          avgLatencyMs: null,
        },
      ];
      llmTraceModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggResult),
      });

      const result = await controller.llmUsage();

      expect(result.totals).toEqual({
        totalTokens: 0,
        totalCost: 0,
        callCount: 0,
      });
    });
  });

  describe('listJobs()', () => {
    it('returns static list of known jobs', () => {
      const result = controller.listJobs();

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0]).toEqual({
        name: 'challenge-generation',
        schedule: '0 0 * * *',
        lastRun: null,
      });
      expect(result.jobs[1]).toEqual({
        name: 'session-cleanup',
        schedule: '0 * * * *',
        lastRun: null,
      });
    });
  });

  describe('getRequestLogs()', () => {
    it('calls requestLogService.findAll with default limit/offset', async () => {
      await controller.getRequestLogs();

      expect(requestLogService.findAll).toHaveBeenCalledWith(50, 0);
    });

    it('parses custom limit/offset', async () => {
      await controller.getRequestLogs('25', '10');

      expect(requestLogService.findAll).toHaveBeenCalledWith(25, 10);
    });

    it('returns the result from requestLogService', async () => {
      const logs = {
        logs: [{ adminEmail: 'admin@test.com', method: 'GET', path: '/' }],
        total: 1,
      };
      requestLogService.findAll.mockResolvedValue(logs);

      const result = await controller.getRequestLogs();

      expect(result).toEqual(logs);
    });
  });
});
