import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import {
  IAssessmentReport,
  AssessmentReportModel,
} from '../../../microservices/simulation/schemas/mongodb/assessment-report.schema';
import {
  ILLMTrace,
  LLMTraceModel,
} from '../../../microservices/simulation/schemas/mongodb/llm-trace.schema';
import { AdminRequestLogService } from '../../services/admin/admin-request-log.service';

@Controller({ path: 'admin/monitoring', version: '1' })
@UseGuards(CheckSystemAdmin)
export class AdminMonitoringController {
  constructor(
    @InjectModel(AssessmentReportModel, 'gateway')
    private readonly assessmentModel: Model<IAssessmentReport>,
    @InjectModel(LLMTraceModel, 'gateway')
    private readonly llmTraceModel: Model<ILLMTrace>,
    private readonly requestLogService: AdminRequestLogService,
  ) {}

  @Get('assessments')
  async listAssessments(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    const skip = offset ? parseInt(offset, 10) : 0;

    const [reports, total] = await Promise.all([
      this.assessmentModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .select({
          _id: 1,
          runId: 1,
          sessionId: 1,
          mode: 1,
          createdAt: 1,
          'report.totalScore': 1,
        })
        .lean()
        .exec(),
      this.assessmentModel.countDocuments().exec(),
    ]);

    return { reports, total };
  }

  @Get('llm')
  async llmUsage() {
    const result = await this.llmTraceModel
      .aggregate([
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
      ])
      .exec();

    const totals = result.reduce(
      (acc, row) => ({
        totalTokens: acc.totalTokens + (row.totalTokens ?? 0),
        totalCost: acc.totalCost + (row.totalCost ?? 0),
        callCount: acc.callCount + (row.callCount ?? 0),
      }),
      { totalTokens: 0, totalCost: 0, callCount: 0 },
    );

    return { breakdown: result, totals };
  }

  @Get('jobs')
  listJobs() {
    // Returns registered background jobs and their last-run status.
    // ScheduleModule-managed jobs are not introspectable at runtime without
    // a custom registry; return a static list of known job names.
    return {
      jobs: [
        { name: 'challenge-generation', schedule: '0 0 * * *', lastRun: null },
        { name: 'session-cleanup', schedule: '0 * * * *', lastRun: null },
      ],
    };
  }

  @Get('request-logs')
  async getRequestLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.requestLogService.findAll(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('audit')
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Audit log is written by application code using AdminAuditLogModel.
    // For now return a placeholder response since no writes are wired yet.
    return { logs: [], total: 0, limit: limit ?? 50, offset: offset ?? 0 };
  }
}
