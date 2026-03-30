import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SessionRepository } from '../repositories/session.repository';
import { Prisma } from '@prisma/simulation-client';
import type { PrismaError } from '@pitch/shared-backend/interfaces/error.interface';
import {
  CreateSessionDto,
  UpdateSessionDto,
  ListSessionsQueryDto,
  SessionResponseDto,
  SessionListResponseDto,
  DeleteSessionResponseDto,
  EndSessionDto,
  RestartSessionDto,
  SessionType,
} from '../dto/session.dto';
import { SessionMemberRepository } from '../repositories/session-member.repository';
import { AssessmentService } from '../assessment/assessment.service';
import { AssessmentModeDto } from '../assessment/dto/assessment.dto';
import type { SessionWithOwner } from '../repositories/session.repository';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { PersonaMediaService } from './persona-media.service';
import { SimulationRedisService } from './redis/redis.service';
import { CoinGatingService } from './coin-gating.service';
import { CoinEstimationService } from './coin-estimation.service';
import { ConfigService } from '@nestjs/config';

/**
 * Session Service
 *
 * Handles business logic for session management
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private static readonly PITCHER_ROLE_PATTERN =
    /\b(account executive|ae|sdr|bdr|seller|sales|rep|founder|consultant|solutions consultant)\b/i;
  private static readonly COUNTERPART_ROLE_PATTERN =
    /\b(buyer|prospect|customer|stakeholder|manager|director|vp|executive|cfo|cto|cio|lead|procurement|interviewer|participant|counterpart)\b/i;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionMemberRepository: SessionMemberRepository,
    private readonly assessmentService: AssessmentService,
    private readonly prisma: SimulationPrismaService,
    private readonly personaMediaService: PersonaMediaService,
    private readonly redis: SimulationRedisService,
    private readonly coinGating: CoinGatingService,
    private readonly coinEstimation: CoinEstimationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Find all sessions with optional filters and pagination
   */
  async findAll(
    query: ListSessionsQueryDto,
    requesterUserId?: string,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Finding sessions with filters: ${JSON.stringify(query)}`);

    const effectiveUserId = query.userId || requesterUserId;
    const filters = {
      userId: effectiveUserId,
      orgId: query.orgId,
      type: query.type,
      status: query.status,
      scenarioId: query.scenarioId,
      personaId: query.personaId,
    };

    const limit = query.limit ? Number(query.limit) : 10;
    const offset = query.offset ? Number(query.offset) : 0;

    const { sessions, total } = await this.sessionRepository.findMany(
      filters,
      limit,
      offset,
    );

    this.logger.log(`Found ${sessions.length} sessions out of ${total} total`);

    return {
      sessions: sessions.map(this.mapToResponseDto),
      total,
      limit,
      offset,
    };
  }

  /**
   * Find a single session by ID
   */
  async findOne(
    id: string,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Finding session with ID: ${id}`);

    if (id === undefined || id === null) {
      throw new BadRequestException('Session ID is required');
    }

    if (requesterUserId) {
      const member =
        await this.sessionMemberRepository.findBySessionIdAndUserId(
          id,
          requesterUserId,
        );
      if (!member) {
        throw new ForbiddenException(
          `User ${requesterUserId} does not have access to session ${id}`,
        );
      }
    }

    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    this.logger.log(`Found session: ${session.id}`);
    return this.mapToResponseDto(session);
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Finding sessions for user: ${userId}`);

    const numLimit = Number(limit) || 10;
    const numOffset = Number(offset) || 0;

    const { sessions, total } = await this.sessionRepository.findByUserId(
      userId,
      numLimit,
      numOffset,
    );

    return {
      sessions: sessions.map(this.mapToResponseDto),
      total,
      limit: numLimit,
      offset: numOffset,
    };
  }

  /**
   * Find sessions by organization ID
   */
  async findByOrgId(
    orgId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Finding sessions for organization: ${orgId}`);

    const numLimit = Number(limit) || 10;
    const numOffset = Number(offset) || 0;

    const { sessions, total } = await this.sessionRepository.findByOrgId(
      orgId,
      numLimit,
      numOffset,
    );

    return {
      sessions: sessions.map(this.mapToResponseDto),
      total,
      limit: numLimit,
      offset: numOffset,
    };
  }

  /**
   * Create a new session
   * Note: userId should be provided (either in DTO for testing or via parameter from JWT)
   */
  async create(
    createSessionDto:
      | CreateSessionDto
      | (CreateSessionDto & { userId: string }),
    userId?: string,
  ): Promise<SessionResponseDto> {
    const sessionUserId =
      'userId' in createSessionDto ? createSessionDto.userId : userId;

    if (!sessionUserId) {
      throw new BadRequestException('userId is required to create a session');
    }

    this.logger.log(`Creating new session for user: ${sessionUserId}`);

    // Normalize config first so we can read model/duration for coin estimation
    const sessionConfig = this.normalizeSessionConfig(
      createSessionDto.name,
      createSessionDto.type,
      createSessionDto.sessionConfig,
    );

    const teamId = this.resolveOrgId(createSessionDto.orgId, sessionUserId);

    // Estimate coins based on model + session duration (awaits pricing cache warm-up)
    const rawConfig = (createSessionDto.sessionConfig ?? {}) as Record<
      string,
      unknown
    >;

    const llmCfg = (rawConfig.llm ?? rawConfig.llmConfig ?? {}) as Record<
      string,
      unknown
    >;
    const estimation = await this.coinEstimation.estimate({
      model:
        this.pickText(llmCfg.model) ??
        this.pickText(rawConfig.model) ??
        'gpt-4o-mini',
      provider: this.pickText(llmCfg.provider),
      sessionType: createSessionDto.type,
      durationMinutes:
        typeof rawConfig.durationMinutes === 'number'
          ? rawConfig.durationMinutes
          : typeof rawConfig.duration === 'number'
            ? rawConfig.duration
            : undefined,
    });

    const coinRequestId = randomUUID();
    const coinIdempotencyKey = randomUUID();

    const coinResult = await this.coinGating.reserveForSession({
      teamId,
      userId: sessionUserId,
      sessionType: createSessionDto.type,
      requestId: coinRequestId,
      idempotencyKey: coinIdempotencyKey,
      estimatedCoins: estimation.estimatedCoins,
      coinPriceUsd: estimation.coinPriceUsd,
    });

    if (!coinResult.approved) {
      throw new HttpException(
        coinResult.reason ?? 'COIN_GATE_REJECTED',
        coinResult.reason === 'NO_ACTIVE_SUBSCRIPTION' ? 403 : 402,
      );
    }

    try {
      const session = await this.sessionRepository.create({
        ownerUserId: sessionUserId,
        orgId: teamId,
        ownerSnapshot: createSessionDto.userSnapshot,
        orgSnapshot: createSessionDto.orgSnapshot,
        name: createSessionDto.name,
        type: createSessionDto.type,
        tags: createSessionDto.tags,
        sessionConfig,
        scenarioId: createSessionDto.scenarioId,
        personaId: createSessionDto.personaId,
        language: this.resolveSessionLanguage(
          createSessionDto.language,
          sessionConfig,
          createSessionDto.userSnapshot,
        ),
        crmContextId: createSessionDto.crmContextId,
        coinReservationId: coinResult.reservationId,
        coinPeriodKey: coinResult.periodKey,
        estimatedCoins: coinResult.estimatedCoins,
        coinPriceUsd: coinResult.coinPriceUsd,
      });

      await this.invalidateSessionFullCache(session.id);
      this.logger.log(`Created session: ${session.id}`);
      return this.mapToResponseDto(session);
    } catch (error) {
      const err = error as { code?: string; meta?: { constraint?: string } };

      if (err.code === 'P2003') {
        const meta = err.meta;
        if (meta?.constraint === 'Session_scenarioId_fkey') {
          throw new NotFoundException(
            `Scenario with ID ${createSessionDto.scenarioId} not found. Either omit scenarioId or provide a valid scenario ID.`,
          );
        }
        if (meta?.constraint === 'Session_personaId_fkey') {
          throw new NotFoundException(
            `Persona with ID ${createSessionDto.personaId} not found. Either omit personaId or provide a valid persona ID.`,
          );
        }
      }

      this.logger.error(`Failed to create session: ${error}`);
      throw error;
    }
  }

  /**
   * Update a session
   */
  async update(
    id: string,
    updateSessionDto: UpdateSessionDto,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Updating session: ${id}`);

    try {
      const existingSession = await this.sessionRepository.findById(id);
      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }

      this.assertOwner(existingSession, requesterUserId);

      const normalizedStatus =
        typeof updateSessionDto.status === 'string' &&
        updateSessionDto.status.trim().length > 0
          ? updateSessionDto.status.trim().toLowerCase()
          : undefined;
      const reopenEndedSession =
        existingSession.status === 'ended' && normalizedStatus === 'active';
      const sessionConfig =
        updateSessionDto.sessionConfig === undefined
          ? undefined
          : this.normalizeSessionConfig(
              updateSessionDto.name ?? existingSession.name ?? undefined,
              updateSessionDto.type ?? existingSession.type,
              updateSessionDto.sessionConfig,
            );

      const session = await this.sessionRepository.update(id, {
        orgId:
          updateSessionDto.orgId === undefined
            ? undefined
            : this.resolveOrgId(updateSessionDto.orgId, existingSession.orgId),
        orgSnapshot: updateSessionDto.orgSnapshot,
        name: updateSessionDto.name,
        type: updateSessionDto.type,
        tags: updateSessionDto.tags,
        sessionConfig,
        scenarioId: updateSessionDto.scenarioId,
        personaId: updateSessionDto.personaId,
        language:
          updateSessionDto.language === undefined
            ? undefined
            : this.resolveSessionLanguage(
                updateSessionDto.language,
                sessionConfig,
              ),
        crmContextId: updateSessionDto.crmContextId,
        status: normalizedStatus,
        endedReason: reopenEndedSession ? null : updateSessionDto.endedReason,
        endedAt: reopenEndedSession ? null : undefined,
      });

      await this.invalidateSessionFullCache(session.id);
      this.logger.log(`Updated session: ${session.id}`);
      return this.mapToResponseDto(session);
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * End a session
   */
  async end(
    id: string,
    endSessionDto: EndSessionDto,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(
      `Ending session: ${id} with reason: ${endSessionDto.reason}`,
    );

    try {
      const existingSession = await this.sessionRepository.findById(id);
      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }

      this.assertOwner(existingSession, requesterUserId);

      const ownerMember =
        this.getOwnerMember(existingSession) ||
        (await this.sessionMemberRepository.findOwner(id));
      if (!ownerMember) {
        throw new NotFoundException('No session owner found for session');
      }

      const iteration = await this.prisma.client.iteration.findFirst({
        where: { sessionMemberId: ownerMember.id },
        orderBy: { iterationNumber: 'desc' },
      });
      const turnCount = iteration
        ? await this.prisma.client.turn.count({
            where: { iterationId: iteration.id },
          })
        : 0;

      if (iteration && iteration.status !== 'completed') {
        await this.prisma.client.iteration.update({
          where: { id: iteration.id },
          data: {
            status: 'completed',
            endedReason: endSessionDto.reason,
            endedAt: new Date(),
          },
        });
      }

      if (iteration && turnCount > 0) {
        try {
          await this.assessmentService.requestRun({
            iterationId: iteration.id,
            sessionId: existingSession.id,
            mode: AssessmentModeDto.final,
            requestedBy: requesterUserId,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to enqueue assessment for session ${existingSession.id}: ${
              (error as Error)?.message ?? error
            }`,
          );
        }
      }

      const endedSession = await this.sessionRepository.update(
        existingSession.id,
        {
          status: 'active',
          endedReason: null,
          endedAt: null,
          sessionConfig: this.clearPhoneRuntime(existingSession.sessionConfig),
        },
      );

      // Fire-and-forget coin adjustment — reconcile estimated vs actual usage.
      // Fires even when turnCount === 0 so an unused reservation is always refunded.
      if (endedSession.coinReservationId && endedSession.coinPeriodKey) {
        try {
          const actualCostUsd = await this.sumIterationCosts(
            endedSession.id,
            iteration?.id,
          );
          const markupMultiplier = Number(
            this.configService.get('COIN_MARKUP_MULTIPLIER') ?? 1.3,
          );
          this.coinGating.emitAdjust({
            reservationId: endedSession.coinReservationId,
            teamId: endedSession.orgId,
            periodKey: endedSession.coinPeriodKey,
            estimatedCoins: endedSession.estimatedCoins ?? 0,
            actualCostUsd,
            coinPriceUsd: endedSession.coinPriceUsd ?? 0.1,
            markupMultiplier,
            sessionId: endedSession.id,
            requestId: randomUUID(),
          });
        } catch (err) {
          this.logger.warn(
            `Failed to emit coin adjustment for session ${endedSession.id}: ${err}`,
          );
        }
      }

      await this.invalidateSessionFullCache(existingSession.id);
      this.logger.log(`Completed iteration for session: ${existingSession.id}`);
      return this.mapToResponseDto(endedSession);
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Restart a session by closing the current iteration and creating a fresh one
   * on the same session record.
   */
  async restart(
    id: string,
    restartSessionDto: RestartSessionDto,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    const restartReason =
      restartSessionDto.reason?.trim() || 'restart_from_scratch';
    this.logger.log(`Restarting session: ${id} with reason: ${restartReason}`);

    const existingSession = await this.sessionRepository.findById(id);
    if (!existingSession) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    this.assertOwner(existingSession, requesterUserId);

    const ownerMember =
      this.getOwnerMember(existingSession) ||
      (await this.sessionMemberRepository.findOwner(id));
    if (!ownerMember) {
      throw new NotFoundException('No session owner found for session');
    }

    const latestIteration = await this.prisma.client.iteration.findFirst({
      where: { sessionMemberId: ownerMember.id },
      orderBy: { iterationNumber: 'desc' },
      select: { id: true, iterationNumber: true, status: true },
    });

    if (latestIteration?.status === 'active') {
      await this.prisma.client.iteration.update({
        where: { id: latestIteration.id },
        data: {
          status: 'completed',
          endedReason: restartReason,
          endedAt: new Date(),
        },
      });

      const turnCount = await this.prisma.client.turn.count({
        where: { iterationId: latestIteration.id },
      });

      if (turnCount > 0) {
        try {
          await this.assessmentService.requestRun({
            iterationId: latestIteration.id,
            sessionId: existingSession.id,
            mode: AssessmentModeDto.final,
            requestedBy: requesterUserId,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to enqueue assessment for restarted session ${existingSession.id}: ${
              (error as Error)?.message ?? error
            }`,
          );
        }
      }
    }

    const teamId = this.resolveOrgId(existingSession.orgId, ownerMember.userId);
    const coinRequestId = randomUUID();
    const coinIdempotencyKey = randomUUID();
    const coinResult = await this.coinGating.reserveForSession({
      teamId,
      userId: ownerMember.userId,
      sessionType: existingSession.type,
      requestId: coinRequestId,
      idempotencyKey: coinIdempotencyKey,
    });

    if (!coinResult.approved) {
      throw new HttpException(
        coinResult.reason ?? 'COIN_GATE_REJECTED',
        coinResult.reason === 'NO_ACTIVE_SUBSCRIPTION' ? 403 : 402,
      );
    }

    const nextIteration = await this.prisma.client.iteration.create({
      data: {
        sessionId: existingSession.id,
        sessionMemberId: ownerMember.id,
        iterationNumber: (latestIteration?.iterationNumber ?? 0) + 1,
        status: 'active',
        userSnapshot:
          (ownerMember.userSnapshot as Prisma.InputJsonValue | null) ??
          Prisma.JsonNull,
      },
      select: { id: true },
    });

    await this.prisma.client.session.update({
      where: { id: existingSession.id },
      data: {
        status: 'active',
        endedReason: null,
        endedAt: null,
        sessionConfig: this.clearPhoneRuntime(existingSession.sessionConfig),
        ...(coinResult.reservationId
          ? { coinReservationId: coinResult.reservationId }
          : {}),
        ...(coinResult.periodKey
          ? { coinPeriodKey: coinResult.periodKey }
          : {}),
        ...(typeof coinResult.estimatedCoins === 'number'
          ? { estimatedCoins: coinResult.estimatedCoins }
          : {}),
        ...(typeof coinResult.coinPriceUsd === 'number'
          ? { coinPriceUsd: coinResult.coinPriceUsd }
          : {}),
      },
    });

    try {
      await this.redis.setSessionMemberIteration(
        existingSession.id,
        ownerMember.userId,
        {
          sessionMemberId: ownerMember.id,
          iterationId: nextIteration.id,
          lastTurnOrder: 0,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to update session-member iteration cache for ${existingSession.id}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }

    try {
      await this.redis.clearConversationState(existingSession.id);
    } catch (error) {
      this.logger.warn(
        `Failed to clear conversation state for ${existingSession.id}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }

    await this.invalidateSessionFullCache(existingSession.id);

    const refreshedSession = await this.sessionRepository.findById(
      existingSession.id,
    );
    if (!refreshedSession) {
      throw new NotFoundException(
        `Session with ID ${existingSession.id} not found after restart`,
      );
    }

    this.logger.log(`Restarted session: ${existingSession.id}`);
    return this.mapToResponseDto(refreshedSession);
  }

  /**
   * Delete a session
   */
  async remove(
    id: string,
    requesterUserId?: string,
    isAdmin = false,
  ): Promise<DeleteSessionResponseDto> {
    this.logger.log(`Deleting session: ${id}`);

    try {
      const existingSession = await this.sessionRepository.findById(id);
      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }

      if (!isAdmin) {
        this.assertOwner(existingSession, requesterUserId);
      }

      await this.sessionRepository.delete(id);
      await this.invalidateSessionFullCache(id);

      this.logger.log(`Deleted session: ${id}`);
      return {
        message: `Session ${id} has been deleted successfully`,
        id,
      };
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   */
  async findActiveByUserId(userId: string): Promise<SessionResponseDto[]> {
    this.logger.log(`Finding active sessions for user: ${userId}`);

    const sessions = await this.sessionRepository.findActiveByUserId(userId);

    this.logger.log(
      `Found ${sessions.length} active sessions for user: ${userId}`,
    );
    return sessions.map(this.mapToResponseDto);
  }

  /**
   * Get active sessions for an organization
   */
  async findActiveByOrgId(orgId: string): Promise<SessionResponseDto[]> {
    this.logger.log(`Finding active sessions for organization: ${orgId}`);

    const sessions = await this.sessionRepository.findActiveByOrgId(orgId);

    this.logger.log(
      `Found ${sessions.length} active sessions for organization: ${orgId}`,
    );
    return sessions.map(this.mapToResponseDto);
  }

  /**
   * Aggregate platform-wide session counts for the public landing page.
   * Runs three lightweight COUNT queries in parallel.
   */
  async getPlatformStats(): Promise<{
    activeSessions: number;
    totalRehearsals: number;
    rehearsalsThisWeek: number;
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [activeSessions, totalRehearsals, rehearsalsThisWeek] =
      await Promise.all([
        this.sessionRepository.count({ status: 'active' }),
        this.sessionRepository.count(),
        this.sessionRepository.count({ createdAfter: weekAgo }),
      ]);

    return { activeSessions, totalRehearsals, rehearsalsThisWeek };
  }

  /**
   * Map Prisma Session model to SessionResponseDto
   */
  private mapToResponseDto = (
    session: SessionWithOwner,
  ): SessionResponseDto => {
    const ownerMember = this.getOwnerMember(session);
    const currentIteration = ownerMember?.iterations?.[0];
    const responseStatus =
      currentIteration?.status === 'completed' ? 'ended' : session.status;
    const responseEndedReason =
      currentIteration?.status === 'completed'
        ? currentIteration.endedReason
        : session.endedReason;
    const responseEndedAt =
      currentIteration?.status === 'completed'
        ? currentIteration.endedAt
        : session.endedAt;
    const persona = session.persona
      ? {
          id: session.persona.id,
          orgId: session.persona.orgId,
          name: session.persona.name,
          traits: this.personaMediaService.enrichTraits({
            personaId: session.persona.id,
            name: session.persona.name,
            traits: session.persona.traits,
          }),
          createdAt: session.persona.createdAt,
          updatedAt: session.persona.updatedAt,
        }
      : undefined;
    const scenario = session.scenario
      ? {
          id: session.scenario.id,
          orgId: session.scenario.orgId,
          name: session.scenario.name,
          description: session.scenario.description,
          config: session.scenario.config as Record<string, any> | undefined,
          createdAt: session.scenario.createdAt,
          updatedAt: session.scenario.updatedAt,
        }
      : undefined;

    return {
      id: session.id,
      name: session.name ?? undefined,
      userId: ownerMember?.userId || '',
      orgId: session.orgId,
      userSnapshot: ownerMember?.userSnapshot as
        | Record<string, any>
        | undefined,
      orgSnapshot: session.orgSnapshot as Record<string, any> | undefined,
      type: session.type as SessionType,
      tags: session.tags,
      sessionConfig: session.sessionConfig as Record<string, any> | undefined,
      scenarioId: session.scenarioId || undefined,
      personaId: session.personaId || undefined,
      scenario,
      persona,
      language: session.language || undefined,
      crmContextId: session.crmContextId || undefined,
      status: responseStatus,
      endedReason: responseEndedReason || undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      endedAt: responseEndedAt || undefined,
      coinReservationId: session.coinReservationId ?? undefined,
      coinPeriodKey: session.coinPeriodKey ?? undefined,
      estimatedCoins: session.estimatedCoins ?? undefined,
      coinPriceUsd: session.coinPriceUsd ?? undefined,
      currentIteration: currentIteration
        ? {
            id: currentIteration.id,
            iterationNumber: currentIteration.iterationNumber,
            status: currentIteration.status,
            endedReason: currentIteration.endedReason || undefined,
            endedAt: currentIteration.endedAt || undefined,
          }
        : undefined,
    };
  };

  private getOwnerMember(
    session: SessionWithOwner,
  ): SessionWithOwner['members'][number] | undefined {
    return session.members?.[0];
  }

  private normalizeSessionConfig(
    sessionName: string | undefined,
    sessionType: SessionType | string,
    sessionConfig?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!this.isRecord(sessionConfig)) {
      return sessionConfig;
    }

    const base: Record<string, unknown> = { ...sessionConfig };
    const scenario = this.readRecord(base, 'scenario') ?? {};
    const existingCounterpartProfile =
      this.readRecord(base, 'counterpartProfile') ?? {};
    const topic =
      this.pickText(scenario.topic) ??
      this.pickText(scenario.name) ??
      this.pickText(base.topic) ??
      this.pickText(sessionName);
    const roles = this.alignRolePair(
      this.pickText(base.aiRole) ??
        this.pickText(scenario.aiRole) ??
        this.readStringFromRecord(
          this.readRecord(scenario, 'roles'),
          'assistant',
        ) ??
        this.readStringFromRecord(this.readRecord(scenario, 'roles'), 'ai') ??
        this.deriveCounterpartRole(topic ?? sessionName, base),
      this.pickText(base.userRole) ??
        this.pickText(scenario.userRole) ??
        this.readStringFromRecord(this.readRecord(scenario, 'roles'), 'user') ??
        this.readStringFromRecord(
          this.readRecord(scenario, 'roles'),
          'client',
        ) ??
        'Account Executive',
    );
    const objective =
      this.pickText(scenario.objective) ??
      this.pickText(base.objective) ??
      this.buildObjective(topic);
    const context =
      this.pickText(scenario.context) ??
      this.pickText(scenario.background) ??
      this.pickText(base.context) ??
      this.buildCalendarContext(base);
    const summary =
      this.pickText(base.description) ??
      this.pickText(scenario.description) ??
      this.buildSessionSummary(topic, roles.aiRole, objective);
    const durationMinutes =
      this.pickNumber(scenario.durationMinutes) ??
      this.pickNumber(base.durationMinutes) ??
      this.defaultDurationMinutes(sessionType);
    const successCriteria =
      this.toStringArray(scenario.successCriteria).length > 0
        ? this.toStringArray(scenario.successCriteria)
        : this.buildSuccessCriteria(topic, objective);
    const stages =
      Array.isArray(scenario.stages) && scenario.stages.length > 0
        ? scenario.stages
        : this.buildDefaultStages();
    const counterpartName =
      this.pickText(existingCounterpartProfile.name) ??
      this.pickText(base.counterpartName) ??
      this.getPrimaryAttendeeName(base) ??
      roles.aiRole ??
      'AI counterpart';
    const counterpartProfile = {
      ...existingCounterpartProfile,
      name: counterpartName,
      role:
        this.pickText(existingCounterpartProfile.role) ??
        roles.aiRole ??
        'Counterpart',
      background:
        this.pickText(existingCounterpartProfile.background) ??
        context ??
        undefined,
      tone:
        this.pickText(existingCounterpartProfile.tone) ??
        this.pickText(base.tone) ??
        'Professional',
      personality:
        this.pickText(existingCounterpartProfile.personality) ??
        this.deriveCounterpartPersonality(base),
      objections:
        this.toStringArray(existingCounterpartProfile.objections).length > 0
          ? this.toStringArray(existingCounterpartProfile.objections)
          : this.deriveLikelyObjections(roles.aiRole ?? '', topic ?? ''),
      signatureTraits:
        this.toStringArray(existingCounterpartProfile.signatureTraits).length >
        0
          ? this.toStringArray(existingCounterpartProfile.signatureTraits)
          : ['Asks for specifics', 'Wants a clear next step'],
    };
    const existingRoles = this.readRecord(scenario, 'roles') ?? {};

    if (summary) {
      base.description = summary;
    }
    if (roles.aiRole) {
      base.aiRole = roles.aiRole;
    }
    if (roles.userRole) {
      base.userRole = roles.userRole;
    }
    if (base.durationMinutes === undefined && durationMinutes !== null) {
      base.durationMinutes = durationMinutes;
    }
    base.counterpartProfile = counterpartProfile;

    base.scenario = {
      ...scenario,
      ...(topic ? { name: this.pickText(scenario.name) ?? topic, topic } : {}),
      ...(summary
        ? { description: this.pickText(scenario.description) ?? summary }
        : {}),
      ...(objective ? { objective } : {}),
      ...(context
        ? {
            context,
            background: this.pickText(scenario.background) ?? context,
          }
        : {}),
      roles: {
        ...existingRoles,
        ...(roles.aiRole
          ? {
              assistant: roles.aiRole,
              ai: roles.aiRole,
              counterpart: roles.aiRole,
            }
          : {}),
        ...(roles.userRole
          ? {
              user: roles.userRole,
              client: roles.userRole,
              pitcher: roles.userRole,
            }
          : {}),
      },
      successCriteria,
      stages,
      ...(durationMinutes !== null && scenario.durationMinutes === undefined
        ? { durationMinutes }
        : {}),
      ...(scenario.difficulty === undefined && base.difficulty !== undefined
        ? { difficulty: base.difficulty }
        : {}),
      ...(this.toStringArray(scenario.likelyObjections).length > 0
        ? {}
        : { likelyObjections: counterpartProfile.objections }),
    };

    return base as Record<string, any>;
  }

  private buildObjective(topic?: string | null): string | undefined {
    if (!topic) {
      return;
    }

    return `Prepare for ${topic} and move the conversation to a clear next step.`;
  }

  private buildSessionSummary(
    topic?: string | null,
    counterpartRole?: string,
    objective?: string,
  ): string | undefined {
    if (!topic && !counterpartRole && !objective) {
      return;
    }

    const parts = [
      topic ? `Practice for "${topic}"` : 'Practice session',
      counterpartRole ? `with a realistic ${counterpartRole}` : null,
      objective
        ? `focused on ${objective.replace(/\.$/, '').toLowerCase()}`
        : null,
    ].filter((part): part is string => Boolean(part));

    return `${parts.join(' ')}.`;
  }

  private buildCalendarContext(
    config: Record<string, unknown>,
  ): string | undefined {
    const attendeeNames = this.getAttendeeNames(config);
    const eventStartTime = this.pickText(config.eventStartTime);
    const parts = [
      'This session was generated from an upcoming calendar meeting.',
    ];

    if (eventStartTime) {
      parts.push(`The meeting is scheduled for ${eventStartTime}.`);
    }

    if (attendeeNames.length > 0) {
      parts.push(
        `Expected attendees include ${attendeeNames.slice(0, 3).join(', ')}.`,
      );
    }

    const meetingUrl = this.pickText(config.meetingUrl);
    if (meetingUrl) {
      parts.push('There is a live meeting link attached to the event.');
    }

    return parts.join(' ');
  }

  private buildSuccessCriteria(
    topic?: string | null,
    objective?: string,
  ): string[] {
    const topicLabel = topic ?? 'the meeting';

    return [
      objective ?? `Open ${topicLabel} with a clear agenda and purpose.`,
      `Surface the most important priorities or risks tied to ${topicLabel}.`,
      'Finish with a concrete next step, decision, or owner.',
    ];
  }

  private buildDefaultStages(): Array<{ title: string; goal: string }> {
    return [
      { title: 'Opening', goal: 'Set the agenda and establish the stakes.' },
      {
        title: 'Discovery',
        goal: 'Surface what matters most to the counterpart.',
      },
      {
        title: 'Discussion',
        goal: 'Navigate tension, objections, and tradeoffs.',
      },
      { title: 'Close', goal: 'Land on a clear next step or decision.' },
    ];
  }

  private deriveCounterpartRole(
    topic: string | undefined,
    config: Record<string, unknown>,
  ): string {
    const source =
      `${topic ?? ''} ${this.getAttendeeNames(config).join(' ')}`.toLowerCase();

    if (
      /(demo|proof of concept|poc|technical|architecture|security)/.test(source)
    ) {
      return 'Technical evaluator asking hard questions';
    }
    if (
      /(pricing|contract|procurement|renewal|negotiation|budget|legal)/.test(
        source,
      )
    ) {
      return 'Price-sensitive procurement stakeholder';
    }
    if (
      /(qbr|quarterly|board|executive|exec|review|forecast|pipeline)/.test(
        source,
      )
    ) {
      return 'Skeptical executive stakeholder';
    }
    if (/(discovery|intro|introduction|first call|prospecting)/.test(source)) {
      return 'Cautious enterprise buyer';
    }
    if (/(escalation|complaint|support|issue|incident)/.test(source)) {
      return 'Frustrated customer stakeholder';
    }
    if (/(sync|catch up|check-in|check in|standup|status)/.test(source)) {
      return 'Cross-functional meeting counterpart';
    }

    return 'Professional counterpart';
  }

  private deriveCounterpartPersonality(
    config: Record<string, unknown>,
  ): string {
    const difficulty = config.difficulty;
    const numericDifficulty =
      typeof difficulty === 'number' && Number.isFinite(difficulty)
        ? difficulty
        : null;
    const textDifficulty = this.pickText(difficulty)?.toLowerCase();

    if (
      numericDifficulty !== null
        ? numericDifficulty >= 7
        : textDifficulty === 'challenging' || textDifficulty === 'elite'
    ) {
      return 'Direct, skeptical, and quick to probe weak spots.';
    }

    return 'Professional, realistic, and focused on the meeting outcome.';
  }

  private deriveLikelyObjections(role: string, topic: string): string[] {
    const source = `${role} ${topic}`.toLowerCase();

    if (/(procurement|pricing|budget|contract|renewal|legal)/.test(source)) {
      return ['Budget pressure', 'Contract risk', 'Competing priorities'];
    }
    if (/(technical|architecture|security|integration)/.test(source)) {
      return [
        'Integration complexity',
        'Security concerns',
        'Implementation risk',
      ];
    }
    if (/(executive|board|vp|c-suite|stakeholder)/.test(source)) {
      return ['Business impact', 'Team bandwidth', 'Decision urgency'];
    }
    if (/(customer|support|escalation|issue)/.test(source)) {
      return [
        'Frustration with the current state',
        'Urgency to resolve the issue',
      ];
    }

    return ['Competing priorities', 'Need for a clear next step'];
  }

  private getPrimaryAttendeeName(
    config: Record<string, unknown>,
  ): string | undefined {
    return this.getAttendeeNames(config)[0];
  }

  private getAttendeeNames(config: Record<string, unknown>): string[] {
    const attendees = config.attendees;
    if (!Array.isArray(attendees)) {
      return [];
    }

    return attendees
      .map((attendee) => {
        if (!this.isRecord(attendee) || attendee.self === true) {
          return undefined;
        }

        return this.pickText(attendee.name) ?? this.pickText(attendee.email);
      })
      .filter((item): item is string => Boolean(item));
  }

  private alignRolePair(
    aiRole?: string,
    userRole?: string,
  ): { aiRole?: string; userRole?: string } {
    let resolvedAiRole = this.pickText(aiRole);
    let resolvedUserRole = this.pickText(userRole);

    if (
      resolvedAiRole &&
      resolvedUserRole &&
      SessionService.PITCHER_ROLE_PATTERN.test(resolvedAiRole) &&
      SessionService.COUNTERPART_ROLE_PATTERN.test(resolvedUserRole)
    ) {
      const previousAiRole = resolvedAiRole;
      resolvedAiRole = resolvedUserRole;
      resolvedUserRole = previousAiRole;
    }

    if (
      resolvedAiRole &&
      resolvedUserRole &&
      resolvedAiRole.toLowerCase() === resolvedUserRole.toLowerCase()
    ) {
      resolvedAiRole = undefined;
    }

    return {
      aiRole: resolvedAiRole,
      userRole: resolvedUserRole,
    };
  }

  private readRecord(
    value: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | undefined {
    const field = value[key];
    return this.isRecord(field) ? field : undefined;
  }

  private readStringFromRecord(
    value: Record<string, unknown> | undefined,
    key: string,
  ): string | undefined {
    if (!value) {
      return;
    }

    return this.pickText(value[key]);
  }

  private pickText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private pickNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.pickText(item))
      .filter((item): item is string => Boolean(item));
  }

  private resolveOrgId(orgId: unknown, fallbackOrgId: string): string {
    return this.pickText(orgId) ?? fallbackOrgId;
  }

  private resolveSessionLanguage(
    language: unknown,
    sessionConfig?: Record<string, any>,
    userSnapshot?: Record<string, any>,
  ): string {
    const configLanguage =
      sessionConfig && this.isRecord(sessionConfig)
        ? (this.pickText(sessionConfig.language) ??
          this.readStringFromRecord(
            this.readRecord(sessionConfig, 'voice'),
            'language',
          ))
        : undefined;
    const snapshotLanguage =
      userSnapshot && this.isRecord(userSnapshot)
        ? this.readStringFromRecord(
            this.readRecord(
              this.readRecord(userSnapshot, 'settings') ?? {},
              'language',
            ),
            'locale',
          )
        : undefined;

    return (
      this.pickText(language) ?? configLanguage ?? snapshotLanguage ?? 'en-US'
    );
  }

  private defaultDurationMinutes(sessionType: SessionType | string): number {
    return sessionType === 'text' ? 20 : 15;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async sumIterationCosts(
    sessionId: string,
    iterationId?: string,
  ): Promise<number> {
    const result = await this.prisma.client.metric.aggregate({
      where: iterationId
        ? { iterationId, iteration: { sessionId } }
        : { iteration: { sessionId } },
      _sum: { costUsd: true },
    });
    return result._sum.costUsd ?? 0;
  }

  private async invalidateSessionFullCache(sessionId: string): Promise<void> {
    try {
      await this.redis.deleteSessionFull(sessionId);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate session full cache for ${sessionId}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  private assertOwner(
    session: SessionWithOwner,
    requesterUserId?: string,
  ): void {
    if (!requesterUserId) {
      throw new ForbiddenException('User identity is required');
    }

    const owner = this.getOwnerMember(session);
    if (!owner || owner.userId !== requesterUserId) {
      throw new ForbiddenException(
        `User ${requesterUserId} does not have permission to modify session ${session.id}`,
      );
    }
  }

  private clearPhoneRuntime(
    sessionConfig: unknown,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!sessionConfig || typeof sessionConfig !== 'object') {
      return Prisma.JsonNull;
    }

    const root = sessionConfig as Record<string, unknown>;
    const phone =
      root.phone && typeof root.phone === 'object'
        ? (root.phone as Record<string, unknown>)
        : null;

    if (!phone || !('runtime' in phone)) {
      return root as Prisma.InputJsonValue;
    }

    const restPhone = { ...phone };
    delete restPhone.runtime;

    return {
      ...root,
      phone: restPhone,
    } as Prisma.InputJsonValue;
  }
}
