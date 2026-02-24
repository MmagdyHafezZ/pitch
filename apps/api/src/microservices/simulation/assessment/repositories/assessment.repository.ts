import { Injectable } from '@nestjs/common';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';
import {
  AssessmentMode,
  AssessmentRunStatus,
  AssessmentLabelValue,
  Prisma,
} from '@prisma/simulation-client';

export interface CreateAssessmentRunData {
  iterationId: string;
  mode: AssessmentMode;
  inputHash?: string | null;
  config: Prisma.InputJsonValue;
  engineVersion?: string | null;
}

export interface CreateAssessmentLabelData {
  assessmentRunId: string;
  turnId: string;
  label: AssessmentLabelValue;
  confidence?: number | null;
  scoreDelta?: number | null;
  evidence?: string | null;
  isFinal?: boolean;
}

export interface CreateAssessmentSummaryData {
  assessmentRunId: string;
  totalScore: number;
  scoreBreakdown?: Prisma.InputJsonValue;
  narrativeSummary?: string | null;
  coachTips?: Prisma.InputJsonValue;
}

@Injectable()
export class AssessmentRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  async createRun(data: CreateAssessmentRunData) {
    return await this.prisma.client.assessmentRun.create({
      data: {
        iterationId: data.iterationId,
        mode: data.mode,
        inputHash: data.inputHash ?? undefined,
        config: data.config,
        engineVersion: data.engineVersion ?? undefined,
        status: AssessmentRunStatus.queued,
      },
    });
  }

  async findById(runId: string) {
    return await this.prisma.client.assessmentRun.findUnique({
      where: { id: runId },
      include: { summary: true },
    });
  }

  async findCompletedByInputHash(inputHash: string) {
    return await this.prisma.client.assessmentRun.findFirst({
      where: {
        inputHash,
        status: AssessmentRunStatus.completed,
      },
      include: { summary: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findByInputHash(inputHash: string) {
    return await this.prisma.client.assessmentRun.findFirst({
      where: { inputHash },
      include: { summary: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestCompletedForIteration(iterationId: string) {
    return await this.prisma.client.assessmentRun.findFirst({
      where: {
        iterationId,
        status: AssessmentRunStatus.completed,
      },
      include: { summary: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findLatestCompletedForSession(sessionId: string) {
    return await this.prisma.client.assessmentRun.findFirst({
      where: {
        status: AssessmentRunStatus.completed,
        iteration: { sessionId },
      },
      include: { summary: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  async markRunning(runId: string, startedAt: Date = new Date()) {
    return await this.prisma.client.assessmentRun.update({
      where: { id: runId },
      data: {
        status: AssessmentRunStatus.running,
        startedAt,
      },
    });
  }

  async markCompleted(
    runId: string,
    totalScore: number,
    completedAt: Date = new Date(),
    mongoReportId?: string | null,
  ) {
    return await this.prisma.client.assessmentRun.update({
      where: { id: runId },
      data: {
        status: AssessmentRunStatus.completed,
        totalScore,
        completedAt,
        mongoReportId: mongoReportId ?? undefined,
      },
    });
  }

  async markFailed(runId: string, completedAt: Date = new Date()) {
    return await this.prisma.client.assessmentRun.update({
      where: { id: runId },
      data: {
        status: AssessmentRunStatus.failed,
        completedAt,
      },
    });
  }

  async createLabels(labels: CreateAssessmentLabelData[]) {
    if (labels.length === 0) {
      return { count: 0 };
    }

    return await this.prisma.client.turnAssessmentLabel.createMany({
      data: labels.map((label) => ({
        assessmentRunId: label.assessmentRunId,
        turnId: label.turnId,
        label: label.label,
        confidence: label.confidence ?? undefined,
        scoreDelta: label.scoreDelta ?? undefined,
        evidence: label.evidence ?? undefined,
        isFinal: label.isFinal ?? true,
      })),
    });
  }

  async upsertSummary(data: CreateAssessmentSummaryData) {
    return await this.prisma.client.assessmentSummary.upsert({
      where: { assessmentRunId: data.assessmentRunId },
      create: {
        assessmentRunId: data.assessmentRunId,
        totalScore: data.totalScore,
        scoreBreakdown: data.scoreBreakdown ?? undefined,
        narrativeSummary: data.narrativeSummary ?? undefined,
        coachTips: data.coachTips ?? undefined,
      },
      update: {
        totalScore: data.totalScore,
        scoreBreakdown: data.scoreBreakdown ?? undefined,
        narrativeSummary: data.narrativeSummary ?? undefined,
        coachTips: data.coachTips ?? undefined,
      },
    });
  }
}
