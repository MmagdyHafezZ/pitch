import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AssessmentMode,
  AssessmentRunStatus,
  type Prisma,
} from '@prisma/simulation-client';
import { AssessmentRepository } from './repositories/assessment.repository';
import { AssessmentReportRepository } from './repositories/assessment-report.repository';
import { AssessmentGraphRunner } from './langgraph/assessment-graph';
import {
  ASSESSMENT_ENGINE_VERSION,
  getAssessmentConfig,
  type AssessmentConfig,
} from './config/assessment.config';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { AssessmentQueuePublisher } from './assessment.queue';
import {
  AssessmentRunRequestDto,
  AssessmentModeDto,
  AssessmentRunStatusDto,
  AssessmentSummaryDto,
} from './dto/assessment.dto';
import { RedisService } from '@pitch/shared-backend/redis/index';

type SemaphoreRelease = () => void;

class AsyncSemaphore {
  private active = 0;
  private readonly queue: Array<(release: SemaphoreRelease) => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<SemaphoreRelease> {
    if (this.active < this.max) {
      this.active += 1;
      return () => this.release();
    }

    return new Promise<SemaphoreRelease>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) {
      this.active += 1;
      next(() => this.release());
    }
  }
}

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);
  private readonly runSemaphore: AsyncSemaphore;

  constructor(
    private readonly assessmentRepository: AssessmentRepository,
    private readonly assessmentReportRepository: AssessmentReportRepository,
    private readonly graphRunner: AssessmentGraphRunner,
    private readonly prisma: SimulationPrismaService,
    private readonly queuePublisher: AssessmentQueuePublisher,
    private readonly redisService: RedisService,
  ) {
    const config = getAssessmentConfig();
    this.runSemaphore = new AsyncSemaphore(config.limits.maxParallelRuns);
  }

  async requestRun(request: AssessmentRunRequestDto) {
    const mode =
      request.mode === AssessmentModeDto.live
        ? AssessmentMode.live
        : AssessmentMode.final;
    const forceRecalculate = request.forceRecalculate === true;
    const context = await this.resolveIterationContext({
      iterationId: request.iterationId,
      sessionMemberId: request.sessionMemberId,
      sessionId: request.sessionId,
      requestedBy: request.requestedBy,
    });

    const config = getAssessmentConfig(request.configVersion);
    const inputHash = await this.computeInputHash({
      iterationId: context.iterationId,
      iterationNumber: context.iterationNumber,
      sessionId: context.sessionId,
      sessionMemberId: context.sessionMemberId,
      mode,
      config,
      scenario: context.scenario,
      persona: context.persona,
    });

    if (!forceRecalculate) {
      const existing =
        await this.assessmentRepository.findByInputHash(inputHash);
      if (existing && existing.status !== AssessmentRunStatus.failed) {
        return {
          runId: existing.id,
          iterationId: existing.iterationId,
          status: this.mapRunStatus(existing.status),
          mode: this.mapMode(existing.mode),
          totalScore: existing.totalScore ?? undefined,
          configVersion: config.version,
          engineVersion: existing.engineVersion ?? undefined,
          summary: this.mapSummary(existing.summary ?? undefined),
        };
      }
    }

    const runInputHash = forceRecalculate
      ? createHash('sha256')
          .update(
            `${inputHash}:forced:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
          )
          .digest('hex')
      : inputHash;

    const run = await this.assessmentRepository.createRun({
      iterationId: context.iterationId,
      mode,
      inputHash: runInputHash,
      config: this.buildConfigSnapshot(config),
      engineVersion: ASSESSMENT_ENGINE_VERSION,
    });

    this.queuePublisher.emitRunRequest({
      runId: run.id,
      iterationId: context.iterationId,
      sessionMemberId: context.sessionMemberId,
      sessionId: context.sessionId,
      mode,
      configVersion: config.version,
      requestedBy: request.requestedBy,
    });
    await this.redisService.incr('metrics:assessment:queue_depth', 1);

    return {
      runId: run.id,
      iterationId: run.iterationId,
      status: this.mapRunStatus(run.status),
      mode: this.mapMode(run.mode),
      configVersion: config.version,
      engineVersion: run.engineVersion ?? undefined,
    };
  }

  async getRunStatus(runId: string) {
    const run = await this.assessmentRepository.findById(runId);
    if (!run) {
      throw new NotFoundException('Assessment run not found');
    }

    return {
      runId: run.id,
      iterationId: run.iterationId,
      status: this.mapRunStatus(run.status),
      mode: this.mapMode(run.mode),
      totalScore: run.totalScore ?? undefined,
      configVersion: this.readConfigVersion(run.config),
      engineVersion: run.engineVersion ?? undefined,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      summary: this.mapSummary(run.summary ?? undefined),
      progress: this.buildProgress(run.status),
    };
  }

  async getLatest(
    sessionId?: string,
    iterationId?: string,
    sessionMemberId?: string,
  ) {
    if (!sessionId && !iterationId && !sessionMemberId) {
      throw new BadRequestException(
        'sessionId, iterationId, or sessionMemberId is required',
      );
    }

    let run = null as Awaited<
      ReturnType<typeof this.assessmentRepository.findLatestCompletedForSession>
    > | null;
    let resolvedSessionMemberId: string | undefined = sessionMemberId;

    if (iterationId) {
      run =
        await this.assessmentRepository.findLatestCompletedForIteration(
          iterationId,
        );
      if (!resolvedSessionMemberId) {
        const iteration = await this.prisma.client.iteration.findUnique({
          where: { id: iterationId },
          select: { sessionMemberId: true },
        });
        resolvedSessionMemberId = iteration?.sessionMemberId;
      }
    } else if (sessionMemberId) {
      const iteration = await this.prisma.client.iteration.findFirst({
        where: { sessionMemberId },
        orderBy: { iterationNumber: 'desc' },
        select: { id: true },
      });
      if (!iteration) {
        throw new NotFoundException('No iterations found for session member');
      }
      run = await this.assessmentRepository.findLatestCompletedForIteration(
        iteration.id,
      );
    } else {
      const latestIteration = await this.prisma.client.iteration.findFirst({
        where: { sessionId: sessionId as string },
        orderBy: { iterationNumber: 'desc' },
        select: { id: true, sessionMemberId: true },
      });
      if (!latestIteration) {
        throw new NotFoundException('No iterations found for session');
      }
      resolvedSessionMemberId = latestIteration.sessionMemberId;
      run = await this.assessmentRepository.findLatestCompletedForIteration(
        latestIteration.id,
      );
    }

    if (!run) {
      throw new NotFoundException('No completed assessments found');
    }

    return {
      runId: run.id,
      iterationId: run.iterationId,
      status: this.mapRunStatus(run.status),
      mode: this.mapMode(run.mode),
      totalScore: run.totalScore ?? undefined,
      configVersion: this.readConfigVersion(run.config),
      engineVersion: run.engineVersion ?? undefined,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      summary: this.mapSummary(run.summary ?? undefined),
      sessionMemberId: resolvedSessionMemberId,
      progress: this.buildProgress(run.status),
    };
  }

  private mapRunStatus(status: AssessmentRunStatus): AssessmentRunStatusDto {
    return status as unknown as AssessmentRunStatusDto;
  }

  private mapMode(mode: AssessmentMode): AssessmentModeDto {
    return mode as unknown as AssessmentModeDto;
  }

  private mapSummary(summary?: {
    totalScore: number;
    scoreBreakdown?: Prisma.JsonValue | null;
    narrativeSummary?: string | null;
    coachTips?: Prisma.JsonValue | null;
  }): AssessmentSummaryDto | undefined {
    if (!summary) return undefined;
    return {
      totalScore: summary.totalScore,
      scoreBreakdown: this.normalizeScoreBreakdown(
        summary.scoreBreakdown ?? null,
      ),
      narrativeSummary: summary.narrativeSummary ?? undefined,
      coachTips: this.normalizeCoachTips(summary.coachTips ?? null),
    };
  }

  private normalizeScoreBreakdown(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, number> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => typeof v === 'number',
    );
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries) as Record<string, number>;
  }

  private normalizeCoachTips(
    value: Prisma.JsonValue | null | undefined,
  ): Array<{ text: string; link?: string }> | undefined {
    if (!Array.isArray(value)) return undefined;
    const tips = value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const text = typeof record.text === 'string' ? record.text : undefined;
        if (!text) return null;
        const link = typeof record.link === 'string' ? record.link : undefined;
        return link ? { text, link } : { text };
      })
      .filter(Boolean) as Array<{ text: string; link?: string }>;
    return tips.length ? tips : undefined;
  }

  async getDashboard(userId: string) {
    const members = await this.prisma.client.sessionMember.findMany({
      where: { userId },
      include: {
        session: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            createdAt: true,
            endedAt: true,
          },
        },
        iterations: {
          orderBy: { iterationNumber: 'desc' },
          take: 1,
          include: {
            assessmentRuns: {
              where: {
                status: AssessmentRunStatus.completed,
              },
              orderBy: { completedAt: 'desc' },
              take: 1,
              include: {
                summary: { select: { totalScore: true, scoreBreakdown: true } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return {
      sessions: members.map((member) => {
        const latestRun = member.iterations[0]?.assessmentRuns[0] ?? null;
        const summary = latestRun?.summary ?? null;
        return {
          id: member.session.id,
          name: member.session.name ?? null,
          type: member.session.type as string,
          status: member.session.status,
          createdAt: member.session.createdAt.toISOString(),
          endedAt: member.session.endedAt?.toISOString() ?? null,
          runId: latestRun?.id ?? null,
          totalScore: latestRun?.totalScore ?? summary?.totalScore ?? null,
          scoreBreakdown:
            this.normalizeScoreBreakdown(summary?.scoreBreakdown ?? null) ??
            null,
        };
      }),
    };
  }

  async getReport(runId: string) {
    const report = await this.assessmentReportRepository.findByRunId(runId);
    if (!report) {
      throw new NotFoundException('Assessment report not found');
    }

    return {
      runId: report.runId,
      report: report.report,
    };
  }

  async executeRun(payload: {
    runId: string;
    iterationId?: string;
    sessionMemberId?: string;
    sessionId?: string;
    mode?: AssessmentMode;
    configVersion?: string;
  }) {
    const run = await this.assessmentRepository.findById(payload.runId);
    if (!run) {
      this.logger.warn(`Assessment run ${payload.runId} not found`);
      return;
    }

    if (
      run.status === AssessmentRunStatus.completed ||
      run.status === AssessmentRunStatus.running
    ) {
      this.logger.log(`Assessment run ${payload.runId} already ${run.status}`);
      return;
    }

    const config = this.readConfig(run.config, payload.configVersion);
    const release = await this.runSemaphore.acquire();
    const lockKey = `assessment:run:${run.id}`;
    const lockAcquired = await this.redisService.set(
      lockKey,
      { runId: run.id },
      { ttl: 900, nx: true },
    );
    if (!lockAcquired) {
      this.logger.warn(`Assessment run ${run.id} already locked in Redis`);
      release();
      return;
    }

    const iteration = await this.prisma.client.iteration.findUnique({
      where: { id: run.iterationId },
      select: {
        id: true,
        sessionId: true,
        sessionMemberId: true,
        sessionMember: { select: { userId: true } },
        session: { select: { orgId: true } },
      },
    });

    if (!iteration) {
      this.logger.warn(
        `Assessment run ${run.id} missing iteration ${run.iterationId}`,
      );
      return;
    }

    const startedAt = Date.now();
    const orgKey = await this.acquireOrgToken(
      iteration.session?.orgId ?? null,
      config.limits.maxParallelRuns,
    );
    if (!orgKey) {
      await this.redisService.delete(lockKey);
      release();
      return;
    }
    try {
      await this.redisService.incr('metrics:assessment:queue_depth', -1);
      await this.assessmentRepository.markRunning(run.id, new Date());

      const state = {
        runId: run.id,
        mode: run.mode,
        config,
        configVersion: config.version,
        engineVersion: run.engineVersion ?? ASSESSMENT_ENGINE_VERSION,
        iterationId: iteration.id,
        sessionId: iteration.sessionId,
        sessionMemberId: iteration.sessionMemberId,
        userId: iteration.sessionMember?.userId ?? null,
      };

      const result = await this.graphRunner.run(state);

      await this.assessmentRepository.markCompleted(
        run.id,
        result.summary.totalScore,
        new Date(),
        run.id,
      );

      const durationMs = Date.now() - startedAt;
      await this.redisService.incr('metrics:assessment:runs:total', 1);
      await this.redisService.lpush(
        'metrics:assessment:run_durations_ms',
        durationMs,
      );

      this.queuePublisher.emitCompleted({
        runId: run.id,
        iterationId: iteration.id,
        sessionId: payload.sessionId ?? iteration.sessionId,
        sessionMemberId: iteration.sessionMemberId,
        totalScore: result.summary.totalScore,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Assessment run ${run.id} failed`, error as Error);
      await this.assessmentRepository.markFailed(run.id, new Date());
      await this.redisService.incr('metrics:assessment:runs:failed', 1);
      this.queuePublisher.emitFailed({
        runId: run.id,
        error: (error as Error)?.message ?? 'Unknown error',
      });
    } finally {
      if (orgKey) {
        await this.redisService.incr(orgKey, -1);
      }
      await this.redisService.delete(lockKey);
      release();
    }
  }

  async enqueueLiveForTurn(event: {
    iterationId?: string;
    sessionMemberId?: string;
    sessionId?: string;
    configVersion?: string;
  }) {
    if (!event.iterationId && !event.sessionMemberId && !event.sessionId) {
      return;
    }

    await this.requestRun({
      iterationId: event.iterationId,
      sessionMemberId: event.sessionMemberId,
      sessionId: event.sessionId,
      mode: AssessmentModeDto.live,
      configVersion: event.configVersion,
    });
  }

  private async resolveIterationContext(input: {
    iterationId?: string;
    sessionMemberId?: string;
    sessionId?: string;
    requestedBy?: string;
  }): Promise<{
    iterationId: string;
    iterationNumber: number;
    sessionId: string;
    sessionMemberId: string;
    userId: string | null;
    orgId: string | null;
    scenario: { id: string; updatedAt?: Date | null } | null;
    persona: { id: string; updatedAt?: Date | null } | null;
  }> {
    const select = {
      id: true,
      iterationNumber: true,
      sessionId: true,
      sessionMemberId: true,
      sessionMember: { select: { userId: true } },
      session: {
        select: {
          orgId: true,
          scenario: { select: { id: true, updatedAt: true } },
          persona: { select: { id: true, updatedAt: true } },
        },
      },
    } satisfies Prisma.IterationSelect;

    if (input.iterationId) {
      const iteration = await this.prisma.client.iteration.findUnique({
        where: { id: input.iterationId },
        select,
      });
      if (!iteration) {
        throw new NotFoundException('Iteration not found');
      }
      return {
        iterationId: iteration.id,
        iterationNumber: iteration.iterationNumber,
        sessionId: iteration.sessionId,
        sessionMemberId: iteration.sessionMemberId,
        userId: iteration.sessionMember?.userId ?? null,
        orgId: iteration.session?.orgId ?? null,
        scenario: iteration.session?.scenario ?? null,
        persona: iteration.session?.persona ?? null,
      };
    }

    if (input.sessionMemberId) {
      const iteration = await this.prisma.client.iteration.findFirst({
        where: { sessionMemberId: input.sessionMemberId },
        orderBy: { iterationNumber: 'desc' },
        select,
      });
      if (!iteration) {
        throw new NotFoundException('No iterations found for session member');
      }
      return {
        iterationId: iteration.id,
        iterationNumber: iteration.iterationNumber,
        sessionId: iteration.sessionId,
        sessionMemberId: iteration.sessionMemberId,
        userId: iteration.sessionMember?.userId ?? null,
        orgId: iteration.session?.orgId ?? null,
        scenario: iteration.session?.scenario ?? null,
        persona: iteration.session?.persona ?? null,
      };
    }

    if (!input.sessionId) {
      throw new BadRequestException(
        'sessionId, iterationId, or sessionMemberId is required',
      );
    }

    const member = await this.prisma.client.sessionMember.findFirst({
      where: {
        sessionId: input.sessionId,
        ...(input.requestedBy
          ? { userId: input.requestedBy }
          : { role: 'owner' }),
      },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException('No session member found for session');
    }

    const iteration = await this.prisma.client.iteration.findFirst({
      where: { sessionMemberId: member.id },
      orderBy: { iterationNumber: 'desc' },
      select,
    });

    if (!iteration) {
      throw new NotFoundException('No iterations found for session');
    }

    return {
      iterationId: iteration.id,
      iterationNumber: iteration.iterationNumber,
      sessionId: iteration.sessionId,
      sessionMemberId: iteration.sessionMemberId,
      userId: iteration.sessionMember?.userId ?? null,
      orgId: iteration.session?.orgId ?? null,
      scenario: iteration.session?.scenario ?? null,
      persona: iteration.session?.persona ?? null,
    };
  }

  private buildConfigSnapshot(config: AssessmentConfig): Prisma.InputJsonValue {
    return {
      ...config,
      version: config.version,
      engineVersion: ASSESSMENT_ENGINE_VERSION,
    } as Prisma.InputJsonValue;
  }

  private readConfig(
    rawConfig: Prisma.JsonValue | null,
    fallbackVersion?: string,
  ): AssessmentConfig {
    if (rawConfig && typeof rawConfig === 'object' && 'version' in rawConfig) {
      const version = (rawConfig as { version?: string }).version;
      return getAssessmentConfig(version ?? fallbackVersion);
    }

    return getAssessmentConfig(fallbackVersion);
  }

  private readConfigVersion(
    rawConfig: Prisma.JsonValue | null,
  ): string | undefined {
    if (rawConfig && typeof rawConfig === 'object' && 'version' in rawConfig) {
      return (rawConfig as { version?: string }).version;
    }

    return undefined;
  }

  private async computeInputHash(input: {
    iterationId: string;
    iterationNumber: number;
    sessionId: string;
    sessionMemberId: string;
    mode: AssessmentMode;
    config: AssessmentConfig;
    scenario: { id: string; updatedAt?: Date | null } | null;
    persona: { id: string; updatedAt?: Date | null } | null;
  }): Promise<string> {
    const turns = await this.prisma.client.turn.findMany({
      where: { iterationId: input.iterationId },
      orderBy: [{ order: 'asc' }],
      include: {
        messages: true,
        iteration: { select: { iterationNumber: true } },
      },
    });

    const normalizedTurns = turns.map((turn) => {
      const content =
        turn.text ??
        (turn.messages ?? [])
          .map((message) => message.content)
          .filter(Boolean)
          .join('\n');

      return {
        id: turn.id,
        iterationId: turn.iterationId,
        iterationNumber: turn.iteration?.iterationNumber ?? null,
        role: turn.role,
        text: content ?? '',
        createdAt: turn.createdAt.toISOString(),
      };
    });

    const scopedTurns =
      input.mode === AssessmentMode.live
        ? normalizedTurns.slice(-input.config.live.maxTurns)
        : normalizedTurns;

    const hashPayload = {
      iterationId: input.iterationId,
      iterationNumber: input.iterationNumber,
      sessionMemberId: input.sessionMemberId,
      sessionId: input.sessionId,
      mode: input.mode,
      configVersion: input.config.version,
      engineVersion: ASSESSMENT_ENGINE_VERSION,
      scenario: input.scenario
        ? {
            id: input.scenario.id,
            updatedAt: input.scenario.updatedAt?.toISOString(),
          }
        : null,
      persona: input.persona
        ? {
            id: input.persona.id,
            updatedAt: input.persona.updatedAt?.toISOString(),
          }
        : null,
      rag: {
        namespace: input.config.rag.namespace,
        snapshotId: input.config.rag.snapshotId,
      },
      turns: scopedTurns,
    };

    return createHash('sha256')
      .update(JSON.stringify(hashPayload))
      .digest('hex');
  }

  private async acquireOrgToken(
    orgId: string | null,
    maxParallelRuns: number,
  ): Promise<string | null> {
    try {
      if (!orgId) {
        return null;
      }

      const key = `assessment:org:${orgId}:active_runs`;
      const active = await this.redisService.incr(key, 1);
      await this.redisService.expire(key, 300);
      if (active > maxParallelRuns) {
        await this.redisService.incr(key, -1);
        this.logger.warn(
          `Org ${orgId} exceeded assessment concurrency (${active}/${maxParallelRuns})`,
        );
        return null;
      }

      return key;
    } catch (error) {
      this.logger.warn(
        `Failed to acquire org token: ${String((error as Error)?.message || error)}`,
      );
      return null;
    }
  }

  private buildProgress(status: AssessmentRunStatus) {
    switch (status) {
      case AssessmentRunStatus.queued:
        return { stage: 'queued', percent: 0 };
      case AssessmentRunStatus.running:
        return { stage: 'running', percent: 50 };
      case AssessmentRunStatus.completed:
        return { stage: 'completed', percent: 100 };
      case AssessmentRunStatus.failed:
        return { stage: 'failed', percent: 0 };
      case AssessmentRunStatus.cancelled:
        return { stage: 'cancelled', percent: 0 };
      default:
        return undefined;
    }
  }
}
