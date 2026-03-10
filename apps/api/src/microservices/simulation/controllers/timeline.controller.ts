import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import type * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';

type TimelineRequest = {
  sessionId: string;
  limit?: number;
} & userClaimsInterface.MessageWithUserClaims;

type JsonRecord = Record<string, unknown>;

interface SessionConfig extends JsonRecord {
  durationMinutes?: number;
  duration?: number;
  stages?: unknown;
  scenario?: unknown;
}

interface ScenarioConfig extends JsonRecord {
  durationMinutes?: number;
  duration?: number;
  stages?: unknown;
  phases?: unknown;
  plan?: unknown;
  objective?: string;
}

interface StageConfig {
  label?: string;
  name?: string;
  title?: string;
  description?: string;
  duration?: number;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const isStageConfig = (value: unknown): value is StageConfig => isRecord(value);

@Controller()
export class TimelineController {
  private readonly logger = new Logger(TimelineController.name);

  constructor(private readonly prisma: SimulationPrismaService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.SESSION_TIMELINE)
  async getTimeline(@Payload() data: TimelineRequest) {
    try {
      if (!data.userClaims?.id) {
        throw new Error('User claims are required to fetch timeline');
      }

      const session = await this.prisma.client.session.findUnique({
        where: { id: data.sessionId },
        include: {
          scenario: true,
        },
      });
      if (!session) {
        throw new Error(`Session ${data.sessionId} not found`);
      }

      const member = await this.prisma.client.sessionMember.findUnique({
        where: {
          sessionId_userId: {
            sessionId: data.sessionId,
            userId: data.userClaims.id,
          },
        },
      });

      if (!member) {
        throw new Error('User is not a member of this session');
      }

      const iteration = await this.prisma.client.iteration.findFirst({
        where: { sessionMemberId: member.id },
        orderBy: { iterationNumber: 'desc' },
      });

      if (!iteration) {
        return {
          sessionId: data.sessionId,
          plannedStages: [],
          currentProgress: 0,
          conversationHistory: [],
          total: 0,
        };
      }

      const sessionConfig = toRecord(session.sessionConfig) as SessionConfig;
      const scenarioConfig = toRecord(
        session.scenario?.config,
      ) as ScenarioConfig;

      // Get planned stages from scenario config
      const plannedStages = this.getPlannedStages(
        sessionConfig,
        scenarioConfig,
      );

      // Get actual conversation turns
      const limit = data.limit ? Math.max(1, Math.min(200, data.limit)) : 200;
      const turns = await this.prisma.client.turn.findMany({
        where: { iterationId: iteration.id },
        orderBy: { order: 'asc' },
        take: limit,
      });

      const totalTurns = await this.prisma.client.turn.count({
        where: { iterationId: iteration.id },
      });

      // Calculate current progress
      const currentProgress = this.calculateProgress(
        totalTurns,
        plannedStages.length,
        sessionConfig,
        scenarioConfig,
      );

      return {
        sessionId: data.sessionId,
        plannedStages,
        currentProgress,
        conversationHistory: turns.map((turn) => ({
          id: turn.id,
          order: turn.order,
          role: turn.role,
          text: turn.text,
          createdAt: turn.createdAt.toISOString(),
        })),
        total: totalTurns,
      };
    } catch (error) {
      this.logger.error('Failed to fetch timeline', error);
      throw toRpcException(error);
    }
  }

  private getPlannedStages(
    sessionConfig: SessionConfig,
    scenarioConfig: ScenarioConfig,
  ): Array<{
    order: number;
    label: string;
    description?: string;
    estimatedDuration?: number;
  }> {
    // Check if scenario has explicit stages/phases defined
    const stagesCandidate =
      scenarioConfig.stages ??
      scenarioConfig.phases ??
      scenarioConfig.plan ??
      sessionConfig.stages ??
      [];
    const stages = Array.isArray(stagesCandidate) ? stagesCandidate : [];

    if (stages.length > 0) {
      return stages.map((stage, index) => {
        const label =
          typeof stage === 'string'
            ? stage
            : isStageConfig(stage)
              ? (stage.label ??
                stage.name ??
                stage.title ??
                `Stage ${index + 1}`)
              : `Stage ${index + 1}`;
        return {
          order: index + 1,
          label,
          description: isStageConfig(stage) ? stage.description : undefined,
          estimatedDuration: isStageConfig(stage) ? stage.duration : undefined,
        };
      });
    }

    // Fallback: Generate default stages based on common sales patterns.
    // Prefer objective from DB scenario config, then sessionConfig.scenario.objective
    // (used by challenge sessions which embed the scenario inline instead of linking a DB record).
    const sessionScenario = toRecord(sessionConfig.scenario);
    const objective =
      typeof scenarioConfig.objective === 'string'
        ? scenarioConfig.objective
        : typeof sessionScenario.objective === 'string'
          ? sessionScenario.objective
          : 'Complete the simulation';
    const defaultStages = [
      { label: 'Introduction', description: 'Opening and building rapport' },
      { label: 'Discovery', description: 'Understanding needs and challenges' },
      {
        label: 'Presentation',
        description: 'Presenting solution and value',
      },
      {
        label: 'Objection Handling',
        description: 'Addressing concerns',
      },
      { label: 'Closing', description: objective },
    ];

    return defaultStages.map((stage, index) => ({
      order: index + 1,
      label: stage.label,
      description: stage.description,
    }));
  }

  private calculateProgress(
    currentTurns: number,
    totalStages: number,
    sessionConfig: SessionConfig,
    scenarioConfig: ScenarioConfig,
  ): number {
    if (currentTurns === 0) return 0;

    const duration =
      toNumber(sessionConfig.durationMinutes) ??
      toNumber(sessionConfig.duration) ??
      toNumber(scenarioConfig.durationMinutes) ??
      toNumber(scenarioConfig.duration) ??
      15;

    // Target turns: ~3 turns per stage, capped by an estimate derived from session duration.
    // Text sessions run faster than voice; 4 turns/minute is a reasonable upper bound.
    // This prevents progress from freezing at a low value for very short sessions.
    const turnsByStage = totalStages * 3;
    const turnsByDuration = Math.round(duration * 4);
    const estimatedTotalTurns = Math.max(
      turnsByStage,
      Math.min(turnsByDuration, totalStages * 6),
    );
    const progress = Math.min(
      100,
      Math.max(1, Math.round((currentTurns / estimatedTotalTurns) * 100)),
    );

    return progress;
  }

  private getTargetTurns(
    sessionConfig: SessionConfig,
    scenarioConfig: ScenarioConfig,
  ): number {
    const duration =
      toNumber(sessionConfig.durationMinutes) ??
      toNumber(sessionConfig.duration) ??
      toNumber(scenarioConfig.durationMinutes) ??
      toNumber(scenarioConfig.duration) ??
      0;
    const normalizedDuration = Number.isFinite(duration) ? duration : 0;
    return normalizedDuration > 0
      ? Math.max(3, Math.round(normalizedDuration))
      : 10;
  }
}
