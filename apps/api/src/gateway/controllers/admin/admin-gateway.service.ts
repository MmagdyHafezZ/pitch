import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { ClientProxy } from '@nestjs/microservices';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { RedisService } from '@pitch/shared-backend/redis/index';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Role, type Prisma as UserPrisma } from '@prisma/user-client';
import { Prisma as SimulationPrisma } from '@prisma/simulation-client';
import { UserPrismaService } from '../../../microservices/userManagement/prisma/user-prisma.service';
import { SimulationPrismaService } from '../../../microservices/simulation/prisma/simulation-prisma.service';
import { MongoConnectionService } from '../../../microservices/simulation/services/mongo/mongo-connection.service';
import {
  EnrichedTranscriptModel,
  EnrichedTranscriptSchema,
  EventLogModel,
  EventLogSchema,
  LLMTraceModel,
  LLMTraceSchema,
} from '../../../microservices/simulation/schemas/mongodb';
import { LLMRoutingConfigService } from '../../../microservices/simulation/services/llm/llm-routing-config.service';
import { SimulationRedisService } from '../../../microservices/simulation/services/redis/redis.service';
import { AssessmentService } from '../../../microservices/simulation/assessment/assessment.service';
import { AssessmentModeDto } from '../../../microservices/simulation/assessment/dto/assessment.dto';
import { PhoneCallService } from '../../../microservices/simulation/phone/phone-call.service';
import { RabbitMqAdminService } from './rabbitmq-admin.service';

type SessionListQuery = {
  limit?: number;
  offset?: number;
  status?: string;
  type?: string;
};

type LlmRequestQuery = {
  limit?: number;
  provider?: string;
  orgId?: string;
  userId?: string;
  sessionId?: string;
};

type LlmUsageQuery = {
  orgId?: string;
  userId?: string;
  sessionId?: string;
  provider?: string;
  hours?: number;
};

type AssessmentRunsQuery = {
  limit?: number;
  offset?: number;
  status?: string;
  sessionId?: string;
  iterationId?: string;
  sessionMemberId?: string;
};

type PhoneCallsQuery = {
  limit?: number;
  offset?: number;
  status?: string;
};

type LogQuery = {
  limit?: number;
};

type FeatureFlagOverride = {
  enabled: boolean;
  description?: string;
  reason?: string;
  updatedAt: string;
  updatedByUserId?: string;
  updatedByEmail?: string;
};

type QueueRetryBody = {
  maxMessages?: number;
};

type CacheInvalidateBody = {
  pattern?: string;
  sessionId?: string;
  personaId?: string;
  scenarioId?: string;
  llmRouting?: boolean;
};

type SessionActionBody = {
  reason?: string;
};

type RecomputeAssessmentBody = {
  mode?: AssessmentModeDto;
  forceRecalculate?: boolean;
  configVersion?: string;
};

type TransferOwnerBody = {
  userId?: string;
};

type RedialBody = {
  provider?: string;
  phoneNumber?: string;
};

type FeatureFlagPatchBody = {
  enabled?: boolean;
  clear?: boolean;
  description?: string;
  reason?: string;
};

type LlmRoutingBody = {
  scope?: 'global' | 'org' | 'user';
  orgId?: string;
  userId?: string;
  name?: string;
  isActive?: boolean;
  config?: Record<string, unknown>;
};

type RoutingLookup = {
  scope?: 'global' | 'org' | 'user';
  orgId?: string;
  userId?: string;
};

type PackageVersionInfo = {
  workspaceVersion?: string;
  apiVersion?: string;
};

type BuildMetadataInfo = {
  branch: string | null;
  branchUrl: string | null;
  commitSha: string | null;
  repositoryUrl: string | null;
};

type DataFixName =
  | 'normalize-llm-routing-configs'
  | 'backfill-ended-session-timestamps'
  | 'repair-team-owner-audit';

const FEATURE_FLAG_KEY = 'admin:feature-flags';
const PACKAGE_JSON_CACHE: {
  value?: Promise<PackageVersionInfo>;
} = {};
const BUILD_METADATA_CACHE: {
  value?: Promise<BuildMetadataInfo>;
} = {};
const WORKSPACE_ROOT_CACHE: {
  value?: Promise<string>;
} = {};

const KNOWN_JOBS = [
  {
    id: 'generate-daily-challenges',
    description: 'Generate the daily public challenge set.',
    schedule: '0 0 * * *',
    period: 'DAILY' as const,
  },
  {
    id: 'generate-weekly-challenges',
    description: 'Generate the weekly public challenge set.',
    schedule: '0 0 * * 1',
    period: 'WEEKLY' as const,
  },
  {
    id: 'generate-monthly-challenges',
    description: 'Generate the monthly public challenge set.',
    schedule: '0 0 1 * *',
    period: 'MONTHLY' as const,
  },
] as const;

@Injectable()
export class AdminGatewayService {
  private readonly logger = new Logger(AdminGatewayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userPrisma: UserPrismaService,
    private readonly simulationPrisma: SimulationPrismaService,
    private readonly mongoConnection: MongoConnectionService,
    private readonly redisService: RedisService,
    private readonly simulationRedis: SimulationRedisService,
    private readonly llmRoutingConfig: LLMRoutingConfigService,
    private readonly assessmentService: AssessmentService,
    private readonly phoneCallService: PhoneCallService,
    private readonly rabbitMqAdmin: RabbitMqAdminService,
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  async getDependenciesHealth() {
    const [userDb, simulationDb, redis, rabbit, mongo] =
      await Promise.allSettled([
        this.userPrisma.user.findFirst({ select: { id: true } }),
        this.simulationPrisma.client.session.findFirst({
          select: { id: true },
        }),
        this.redisService.exists('admin:healthcheck:missing'),
        this.rabbitMqAdmin.getConnectionStatus(),
        Promise.resolve({ connected: this.mongoConnection.isConnected() }),
      ]);

    const redisConfigured = !!(
      this.configService.get<string>('REDIS_URL') || process.env.REDIS_URL
    );
    const mongoConfigured = !!(
      this.configService.get<string>('MONGODB_URL') || process.env.MONGODB_URL
    );

    const dependencies = {
      userDatabase: this.toHealthEntry(userDb, 'User database is unavailable'),
      simulationDatabase: this.toHealthEntry(
        simulationDb,
        'Simulation database is unavailable',
      ),
      redis:
        redis.status === 'fulfilled'
          ? {
              status: 'ok',
              configured: redisConfigured,
            }
          : {
              status: redisConfigured ? 'error' : 'not_configured',
              configured: redisConfigured,
              error: this.readError(redis.reason, 'Redis is unavailable'),
            },
      rabbitMq:
        rabbit.status === 'fulfilled'
          ? rabbit.value
          : {
              status: 'error',
              error: this.readError(rabbit.reason, 'RabbitMQ is unavailable'),
            },
      mongo:
        mongo.status === 'fulfilled'
          ? {
              status: mongo.value.connected
                ? 'ok'
                : mongoConfigured
                  ? 'error'
                  : 'not_configured',
              configured: mongoConfigured,
              connected: mongo.value.connected,
            }
          : {
              status: mongoConfigured ? 'error' : 'not_configured',
              configured: mongoConfigured,
              error: this.readError(mongo.reason, 'MongoDB is unavailable'),
            },
    };

    const degraded = Object.values(dependencies).some(
      (entry) => entry.status !== 'ok',
    );

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  async getVersion() {
    const [versions, buildMetadata] = await Promise.all([
      this.readPackageVersions(),
      this.readBuildMetadata(),
    ]);

    return {
      api: {
        version: versions.apiVersion ?? 'unknown',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV ?? 'development',
        uptimeSeconds: Math.round(process.uptime()),
      },
      workspace: {
        version: versions.workspaceVersion ?? 'unknown',
      },
      build: {
        commitSha: buildMetadata.commitSha,
        branch: buildMetadata.branch,
        branchUrl: buildMetadata.branchUrl,
        repositoryUrl: buildMetadata.repositoryUrl,
        deploymentId:
          process.env.VERCEL_DEPLOYMENT_ID || process.env.BUILD_ID || null,
      },
    };
  }

  async getRuntimeConfig() {
    const featureFlags = await this.getFeatureFlags();
    const superAdmins = this.parseCsv(process.env.SUPER_ADMIN_EMAILS);

    return {
      app: {
        port:
          this.configService.get<string>('PORT') ?? process.env.PORT ?? '8000',
        frontendUrl:
          this.configService.get<string>('FRONTEND_URL') ??
          process.env.FRONTEND_URL ??
          'http://localhost:3000',
        swaggerPath:
          this.configService.get<string>('SWAGGER_PATH') ??
          process.env.SWAGGER_PATH ??
          'docs',
        defaultApiVersion: '1',
      },
      auth: {
        devBypassEnabled: process.env.DEV_BYPASS_ENABLED === 'true',
        devBypassEmail: process.env.DEV_BYPASS_EMAIL || 'dev@local',
        superAdminCount: superAdmins.length,
      },
      integrations: {
        redisConfigured: !!(
          this.configService.get<string>('REDIS_URL') || process.env.REDIS_URL
        ),
        mongoConfigured: !!(
          this.configService.get<string>('MONGODB_URL') ||
          process.env.MONGODB_URL
        ),
        rabbitMqConfigured: !!(
          this.configService.get<string>('RABBITMQ_URL') ||
          this.configService.get<string>('CLOUDAMQP_URL') ||
          process.env.RABBITMQ_URL ||
          process.env.CLOUDAMQP_URL
        ),
        openAiConfigured: !!(
          this.configService.get<string>('OPENAI_API_KEY') ||
          process.env.OPENAI_API_KEY
        ),
        watsonxConfigured: !!(
          this.configService.get<string>('WATSONX_API_KEY') ||
          process.env.WATSONX_API_KEY
        ),
        phoneWebhookConfigured: !!(
          this.configService.get<string>('PHONE_CALL_WEBHOOK_URL') ||
          process.env.PHONE_CALL_WEBHOOK_URL
        ),
        twilioConfigured: !!(
          this.configService.get<string>('TWILIO_ACCOUNT_SID') ||
          process.env.TWILIO_ACCOUNT_SID
        ),
        vapiConfigured: !!(
          this.configService.get<string>('VAPI_API_KEY') ||
          process.env.VAPI_API_KEY
        ),
      },
      featureFlags: {
        count: featureFlags.flags.length,
        overrides: featureFlags.flags.filter(
          (flag) => flag.source === 'override',
        ).length,
      },
    };
  }

  async getFeatureFlags() {
    const overrides =
      await this.redisService.hgetall<FeatureFlagOverride>(FEATURE_FLAG_KEY);
    const envFlags = Object.entries(process.env)
      .filter(([key]) => key.startsWith('FEATURE_FLAG_'))
      .map(([envKey, value]) => {
        const key = envKey
          .replace(/^FEATURE_FLAG_/, '')
          .toLowerCase()
          .replace(/__/g, '.')
          .replace(/_/g, '-');
        return {
          key,
          envKey,
          defaultEnabled: this.parseBoolean(value),
        };
      });

    const keys = new Set([
      ...envFlags.map((flag) => flag.key),
      ...Object.keys(overrides),
    ]);

    const flags = Array.from(keys)
      .sort()
      .map((key) => {
        const envMatch = envFlags.find((flag) => flag.key === key);
        const override = overrides[key];
        return {
          key,
          envKey: envMatch?.envKey ?? null,
          enabled: override?.enabled ?? envMatch?.defaultEnabled ?? false,
          defaultEnabled: envMatch?.defaultEnabled ?? false,
          source: override ? 'override' : envMatch ? 'env' : 'default',
          description: override?.description ?? null,
          reason: override?.reason ?? null,
          updatedAt: override?.updatedAt ?? null,
          updatedByUserId: override?.updatedByUserId ?? null,
          updatedByEmail: override?.updatedByEmail ?? null,
        };
      });

    return { flags };
  }

  async updateFeatureFlag(
    key: string,
    body: FeatureFlagPatchBody,
    actor: UserClaims,
  ) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) {
      throw new BadRequestException('Feature flag key is required');
    }

    if (body.clear) {
      await this.redisService.hdel(FEATURE_FLAG_KEY, normalizedKey);
      this.recordAudit(
        actor,
        'admin.feature-flags.clear',
        'featureFlag',
        normalizedKey,
        {
          key: normalizedKey,
        },
      );
      return {
        key: normalizedKey,
        cleared: true,
      };
    }

    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be provided');
    }

    const override: FeatureFlagOverride = {
      enabled: body.enabled,
      description: body.description,
      reason: body.reason,
      updatedAt: new Date().toISOString(),
      updatedByUserId: actor.id,
      updatedByEmail: actor.email,
    };
    await this.redisService.hset(FEATURE_FLAG_KEY, normalizedKey, override);

    this.recordAudit(
      actor,
      'admin.feature-flags.update',
      'featureFlag',
      normalizedKey,
      {
        enabled: body.enabled,
        reason: body.reason,
      },
    );

    const flags = await this.getFeatureFlags();
    return (
      flags.flags.find((flag) => flag.key === normalizedKey) ?? {
        key: normalizedKey,
        enabled: body.enabled,
      }
    );
  }

  async getUserActivity(userId: string) {
    const user = await this.userPrisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
        oauthAccounts: {
          select: {
            id: true,
            provider: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        refreshTokens: {
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [totalSessions, activeSessions, recentSessions] = await Promise.all([
      this.simulationPrisma.client.session.count({
        where: {
          members: {
            some: { userId },
          },
        },
      }),
      this.simulationPrisma.client.session.count({
        where: {
          status: 'active',
          members: {
            some: { userId },
          },
        },
      }),
      this.simulationPrisma.client.session.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          orgId: true,
          createdAt: true,
          endedAt: true,
        },
      }),
    ]);

    return {
      user: {
        ...user,
        refreshTokenCount: user.refreshTokens.length,
      },
      activity: {
        totalSessions,
        activeSessions,
        teamCount: user.memberships.length,
        activeTeamCount: user.memberships.filter(
          (membership) => membership.isActive && membership.team.isActive,
        ).length,
        oauthProviders: user.oauthAccounts.map((account) => account.provider),
        lastSeen: user.lastSeen?.toISOString() ?? null,
      },
      recentSessions,
    };
  }

  async getUserSessions(userId: string, query: SessionListQuery) {
    await this.ensureUser(userId);
    const limit = this.normalizeLimit(query.limit, 50, 200);
    const offset = this.normalizeOffset(query.offset);
    const where: SimulationPrisma.SessionWhereInput = {
      members: {
        some: { userId },
      },
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type as SimulationPrisma.SessionWhereInput['type'];
    }

    const [sessions, total] = await Promise.all([
      this.simulationPrisma.client.session.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          scenario: true,
          persona: true,
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              joinedAt: true,
            },
          },
        },
      }),
      this.simulationPrisma.client.session.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      sessions,
    };
  }

  async impersonateUser(userId: string, actor: UserClaims) {
    const user = await this.ensureUser(userId);
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      impersonatedBy: actor.id,
      impersonatedByEmail: actor.email,
    };
    const expiresIn = process.env.JWT_ACCESS_EXPIRATION || '15m';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
    });

    this.recordAudit(actor, 'admin.users.impersonate', 'user', user.id, {
      impersonatedEmail: user.email,
    });

    return {
      accessToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      actor: {
        id: actor.id,
        email: actor.email,
      },
    };
  }

  async getTeamUsage(teamId: string) {
    const team = await this.userPrisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
          select: {
            id: true,
            userId: true,
            role: true,
            isActive: true,
            tokenLimit: true,
          },
        },
        subscriptions: {
          where: { isActive: true },
          include: {
            plan: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const [sessionTotal, sessionActive, metricSummary] = await Promise.all([
      this.simulationPrisma.client.session.count({
        where: { orgId: teamId },
      }),
      this.simulationPrisma.client.session.count({
        where: { orgId: teamId, status: 'active' },
      }),
      this.simulationPrisma.client.metric.aggregate({
        where: {
          iteration: {
            session: {
              orgId: teamId,
            },
          },
        },
        _sum: {
          tokensInput: true,
          tokensOutput: true,
          toolCount: true,
          latencyMs: true,
          costUsd: true,
        },
      }),
    ]);

    return {
      team,
      usage: {
        sessions: {
          total: sessionTotal,
          active: sessionActive,
        },
        members: {
          total: team.memberships.length,
          active: team.memberships.filter((membership) => membership.isActive)
            .length,
          owners: team.memberships.filter(
            (membership) => membership.role === Role.OWNER,
          ).length,
        },
        tokens: {
          available: team.availableTokens,
          used: team.usedTokens,
        },
        llm: {
          tokensInput: metricSummary._sum.tokensInput ?? 0,
          tokensOutput: metricSummary._sum.tokensOutput ?? 0,
          toolCount: metricSummary._sum.toolCount ?? 0,
          latencyMs: metricSummary._sum.latencyMs ?? 0,
          costUsd: metricSummary._sum.costUsd ?? 0,
        },
      },
    };
  }

  async transferTeamOwner(
    teamId: string,
    body: TransferOwnerBody,
    actor: UserClaims,
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }

    const targetMembership = await this.userPrisma.teamMembership.findUnique({
      where: {
        userId_teamId: {
          userId: body.userId,
          teamId,
        },
      },
    });
    if (!targetMembership) {
      throw new NotFoundException('Target membership not found');
    }

    const updatedMembership = await this.userPrisma.client.$transaction(
      async (tx) => {
        await tx.teamMembership.updateMany({
          where: {
            teamId,
            role: Role.OWNER,
            isActive: true,
            NOT: { userId: body.userId },
          },
          data: {
            role: Role.ADMIN,
          },
        });

        const membership = await tx.teamMembership.update({
          where: {
            userId_teamId: {
              userId: body.userId as string,
              teamId,
            },
          },
          data: {
            role: Role.OWNER,
            isActive: true,
            acceptedAt: targetMembership.acceptedAt ?? new Date(),
          },
        });

        const team = await tx.team.findUnique({
          where: { id: teamId },
          select: {
            metadata: true,
          },
        });

        const metadata = this.readJsonRecord(team?.metadata);
        const audit = this.readJsonRecord(metadata.audit);
        await tx.team.update({
          where: { id: teamId },
          data: {
            metadata: {
              ...metadata,
              audit: {
                ...audit,
                ownerUserId: body.userId,
                updatedByUserId: actor.id,
                updatedAt: new Date().toISOString(),
                version:
                  typeof audit.version === 'number' ? audit.version + 1 : 1,
              },
            } as UserPrisma.InputJsonValue,
          },
        });

        return membership;
      },
    );

    this.recordAudit(actor, 'admin.teams.transfer-owner', 'team', teamId, {
      newOwnerUserId: body.userId,
    });

    return updatedMembership;
  }

  async removeTeamMember(teamId: string, userId: string, actor: UserClaims) {
    const membership = await this.userPrisma.teamMembership.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      include: {
        team: {
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || !membership.team) {
      throw new NotFoundException('Team membership not found');
    }

    if (!membership.team.isActive || membership.team.deletedAt !== null) {
      throw new NotFoundException('Team not found');
    }

    if (membership.isActive !== false && membership.role === Role.OWNER) {
      throw new ConflictException(
        'Transfer ownership to another member before removing the current owner.',
      );
    }

    await this.userPrisma.teamMembership.update({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      data: {
        isActive: false,
        acceptedAt: null,
        invitedByUserId: null,
      },
    });

    this.recordAudit(actor, 'admin.teams.members.remove', 'team', teamId, {
      removedUserId: userId,
      role: membership.role,
      wasActive: membership.isActive !== false,
    });

    return {
      message: `User with ID ${userId} has been removed from team with ID: ${teamId}`,
      teamId,
      removedUserId: userId,
    };
  }

  async getSubscriptionAudit(query: { teamId?: string; limit?: number }) {
    const limit = this.normalizeLimit(query.limit, 100, 250);
    const subscriptions = await this.userPrisma.subscription.findMany({
      where: query.teamId ? { teamId: query.teamId } : undefined,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        team: {
          select: { id: true, name: true, slug: true },
        },
        plan: {
          select: { id: true, name: true, planLevel: true },
        },
      },
    });

    return {
      subscriptions: subscriptions.map((subscription) => {
        const metadata = this.readJsonRecord(subscription.metadata);
        return {
          ...subscription,
          audit: this.readJsonRecord(metadata.audit),
        };
      }),
    };
  }

  async getSessionEvents(sessionId: string, limit?: number) {
    const iterations = await this.getSessionIterations(sessionId);
    const iterationIds = iterations.map((iteration) => iteration.id);
    const take = this.normalizeLimit(limit, 100, 250);
    const events = await this.simulationPrisma.client.event.findMany({
      where: {
        iterationId: { in: iterationIds },
      },
      take,
      orderBy: { createdAt: 'desc' },
    });

    const mongoEvents = await this.findMongoEventLogs(iterationIds, take);
    const mongoByEventId = new Map(
      mongoEvents
        .filter((event) => typeof event.eventId === 'string')
        .map((event) => [event.eventId as string, event]),
    );
    const mongoById = new Map(
      mongoEvents.map((event) => [String(event._id), event]),
    );
    const iterationById = new Map(
      iterations.map((iteration) => [iteration.id, iteration]),
    );

    const combined = events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      iterationId: event.iterationId,
      iterationNumber:
        iterationById.get(event.iterationId)?.iterationNumber ?? null,
      sessionMemberId:
        iterationById.get(event.iterationId)?.sessionMemberId ?? null,
      payload: event.payload,
      mongoEventLogId: event.mongoEventLogId,
      verboseLog:
        (event.mongoEventLogId
          ? mongoById.get(event.mongoEventLogId)
          : undefined) ?? mongoByEventId.get(event.id),
    }));

    return {
      sessionId,
      mongoAvailable: this.mongoConnection.isConnected(),
      events: combined,
    };
  }

  async getSessionTranscript(sessionId: string) {
    const iterations = await this.getSessionIterations(sessionId);
    const iterationIds = iterations.map((iteration) => iteration.id);
    const transcripts = await this.simulationPrisma.client.transcript.findMany({
      where: {
        iterationId: { in: iterationIds },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        asset: {
          select: {
            id: true,
            mimeType: true,
            storageKey: true,
            url: true,
          },
        },
      },
    });

    const enriched = await this.findEnrichedTranscripts(iterationIds);
    const enrichedByAsset = new Map(
      enriched.map((item) => [item.assetId, item]),
    );

    return {
      sessionId,
      mongoAvailable: this.mongoConnection.isConnected(),
      transcripts: transcripts.map((transcript) => ({
        ...transcript,
        enrichedTranscript: enrichedByAsset.get(transcript.assetId) ?? null,
      })),
    };
  }

  async getSessionLlmCalls(sessionId: string, limit?: number) {
    const iterations = await this.getSessionIterations(sessionId);
    const iterationIds = iterations.map((iteration) => iteration.id);
    const traces = await this.findLlmTraces({
      iterationIds,
      limit: this.normalizeLimit(limit, 100, 250),
    });

    const summary = traces.reduce(
      (acc, trace) => {
        acc.total += 1;
        acc.promptTokens += trace.usage?.promptTokens ?? 0;
        acc.completionTokens += trace.usage?.completionTokens ?? 0;
        acc.totalTokens += trace.usage?.totalTokens ?? 0;
        acc.costUsd += trace.usage?.cost ?? 0;
        return acc;
      },
      {
        total: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      },
    );

    return {
      sessionId,
      mongoAvailable: this.mongoConnection.isConnected(),
      summary,
      traces,
    };
  }

  async removeSessionMember(
    sessionId: string,
    userId: string,
    actor: UserClaims,
  ) {
    await this.ensureSession(sessionId);

    const targetMember =
      await this.simulationPrisma.client.sessionMember.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId,
          },
        },
        select: {
          id: true,
          role: true,
          userId: true,
        },
      });

    if (!targetMember) {
      throw new NotFoundException(
        `User ${userId} is not a member of session ${sessionId}`,
      );
    }

    const removalResult = await this.simulationPrisma.client.$transaction(
      async (tx) => {
        await tx.sessionMember.delete({
          where: {
            sessionId_userId: {
              sessionId,
              userId,
            },
          },
        });

        const remainingMembers = await tx.sessionMember.findMany({
          where: { sessionId },
          orderBy: { joinedAt: 'asc' },
        });

        if (remainingMembers.length === 0) {
          await tx.session.delete({
            where: { id: sessionId },
          });
          return {
            sessionDeleted: true,
            newOwnerId: undefined as string | undefined,
          };
        }

        if (targetMember.role === 'owner') {
          const nextOwner = remainingMembers[0];
          await tx.sessionMember.update({
            where: { id: nextOwner.id },
            data: { role: 'owner' },
          });

          return {
            sessionDeleted: false,
            newOwnerId: nextOwner.userId,
          };
        }

        return {
          sessionDeleted: false,
          newOwnerId: undefined as string | undefined,
        };
      },
    );

    await this.invalidateSessionCache(sessionId, userId);

    this.recordAudit(
      actor,
      'admin.sessions.members.remove',
      'session',
      sessionId,
      {
        removedUserId: userId,
        removedRole: targetMember.role,
        newOwnerId: removalResult.newOwnerId,
        sessionDeleted: removalResult.sessionDeleted,
      },
    );

    const message = removalResult.sessionDeleted
      ? `Session ${sessionId} deleted because it has no members`
      : removalResult.newOwnerId
        ? `Member ${userId} removed from session ${sessionId}; ownership transferred to ${removalResult.newOwnerId}`
        : `Member ${userId} removed from session ${sessionId}`;

    return {
      message,
      sessionId,
      removedUserId: userId,
      newOwnerId: removalResult.newOwnerId,
      sessionDeleted: removalResult.sessionDeleted || undefined,
    };
  }

  async forceEndSession(
    sessionId: string,
    body: SessionActionBody,
    actor: UserClaims,
  ) {
    const reason = body.reason?.trim() || 'force_ended_by_admin';
    const { session, ownerMember } =
      await this.requireSessionWithOwner(sessionId);

    const latestIteration =
      await this.simulationPrisma.client.iteration.findFirst({
        where: {
          sessionMemberId: ownerMember.id,
        },
        orderBy: { iterationNumber: 'desc' },
        select: {
          id: true,
          status: true,
        },
      });

    if (latestIteration?.status === 'active') {
      await this.simulationPrisma.client.iteration.update({
        where: { id: latestIteration.id },
        data: {
          status: 'completed',
          endedReason: reason,
          endedAt: new Date(),
        },
      });

      const turnCount = await this.simulationPrisma.client.turn.count({
        where: { iterationId: latestIteration.id },
      });
      if (turnCount > 0) {
        await this.assessmentService.requestRun({
          iterationId: latestIteration.id,
          sessionId,
          mode: AssessmentModeDto.final,
          requestedBy: actor.id,
          forceRecalculate: true,
        });
      }
    }

    const endedSession = await this.simulationPrisma.client.session.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        endedReason: reason,
        endedAt: new Date(),
      },
      include: {
        scenario: true,
        persona: true,
        members: true,
      },
    });

    await this.invalidateSessionCache(sessionId, ownerMember.userId);

    this.recordAudit(actor, 'admin.sessions.force-end', 'session', sessionId, {
      reason,
      previousStatus: session.status,
    });

    return endedSession;
  }

  async recomputeAssessment(
    sessionId: string,
    body: RecomputeAssessmentBody,
    actor: UserClaims,
  ) {
    await this.ensureSession(sessionId);
    const result = await this.assessmentService.requestRun({
      sessionId,
      mode: body.mode ?? AssessmentModeDto.final,
      forceRecalculate: body.forceRecalculate ?? true,
      configVersion: body.configVersion,
      requestedBy: actor.id,
    });

    this.recordAudit(
      actor,
      'admin.sessions.recompute-assessment',
      'session',
      sessionId,
      {
        mode: body.mode ?? AssessmentModeDto.final,
        forceRecalculate: body.forceRecalculate ?? true,
      },
    );

    return result;
  }

  async replaySession(
    sessionId: string,
    body: SessionActionBody,
    actor: UserClaims,
  ) {
    const reason = body.reason?.trim() || 'admin_replay';
    const { ownerMember } = await this.requireSessionWithOwner(sessionId);

    const latestIteration =
      await this.simulationPrisma.client.iteration.findFirst({
        where: {
          sessionMemberId: ownerMember.id,
        },
        orderBy: { iterationNumber: 'desc' },
        select: {
          id: true,
          iterationNumber: true,
          status: true,
        },
      });

    if (latestIteration?.status === 'active') {
      await this.simulationPrisma.client.iteration.update({
        where: { id: latestIteration.id },
        data: {
          status: 'completed',
          endedReason: reason,
          endedAt: new Date(),
        },
      });

      const turnCount = await this.simulationPrisma.client.turn.count({
        where: { iterationId: latestIteration.id },
      });
      if (turnCount > 0) {
        await this.assessmentService.requestRun({
          iterationId: latestIteration.id,
          sessionId,
          mode: AssessmentModeDto.final,
          requestedBy: actor.id,
        });
      }
    }

    const nextIteration = await this.simulationPrisma.client.iteration.create({
      data: {
        sessionId,
        sessionMemberId: ownerMember.id,
        iterationNumber: (latestIteration?.iterationNumber ?? 0) + 1,
        status: 'active',
        userSnapshot:
          (ownerMember.userSnapshot as SimulationPrisma.InputJsonValue | null) ??
          SimulationPrisma.JsonNull,
      },
      select: {
        id: true,
        iterationNumber: true,
      },
    });

    await this.simulationPrisma.client.session.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        endedReason: null,
        endedAt: null,
      },
    });

    await this.simulationRedis.setSessionMemberIteration(
      sessionId,
      ownerMember.userId,
      {
        sessionMemberId: ownerMember.id,
        iterationId: nextIteration.id,
        lastTurnOrder: 0,
      },
    );
    await this.invalidateSessionCache(sessionId, ownerMember.userId);

    this.recordAudit(actor, 'admin.sessions.replay', 'session', sessionId, {
      reason,
      iterationId: nextIteration.id,
      iterationNumber: nextIteration.iterationNumber,
    });

    return {
      sessionId,
      nextIteration,
    };
  }

  async listAssessmentRuns(query: AssessmentRunsQuery) {
    const limit = this.normalizeLimit(query.limit, 50, 200);
    const offset = this.normalizeOffset(query.offset);
    const where: SimulationPrisma.AssessmentRunWhereInput = {};

    if (query.status) {
      where.status =
        query.status as SimulationPrisma.AssessmentRunWhereInput['status'];
    }
    if (query.iterationId) {
      where.iterationId = query.iterationId;
    }
    if (query.sessionId || query.sessionMemberId) {
      where.iteration = {};
      if (query.sessionId) {
        where.iteration.sessionId = query.sessionId;
      }
      if (query.sessionMemberId) {
        where.iteration.sessionMemberId = query.sessionMemberId;
      }
    }

    const [runs, total] = await Promise.all([
      this.simulationPrisma.client.assessmentRun.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          summary: true,
          iteration: {
            select: {
              id: true,
              sessionId: true,
              sessionMemberId: true,
              iterationNumber: true,
            },
          },
        },
      }),
      this.simulationPrisma.client.assessmentRun.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      runs,
    };
  }

  async getLlmRequests(query: LlmRequestQuery) {
    const iterationIds = query.sessionId
      ? await this.getIterationIdsForSession(query.sessionId)
      : undefined;
    const traces = await this.findLlmTraces({
      iterationIds,
      provider: query.provider,
      orgId: query.orgId,
      userId: query.userId,
      limit: this.normalizeLimit(query.limit, 100, 250),
    });

    return {
      mongoAvailable: this.mongoConnection.isConnected(),
      traces,
    };
  }

  async getLlmUsage(query: LlmUsageQuery) {
    const iterationIds = query.sessionId
      ? await this.getIterationIdsForSession(query.sessionId)
      : undefined;
    const traces = await this.findLlmTraces({
      iterationIds,
      provider: query.provider,
      orgId: query.orgId,
      userId: query.userId,
      limit: 1000,
      hours: query.hours,
    });

    const byProvider = new Map<
      string,
      {
        requests: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costUsd: number;
      }
    >();
    const byModel = new Map<
      string,
      { requests: number; totalTokens: number; costUsd: number }
    >();

    let totalRequests = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const trace of traces) {
      const provider = this.readString(trace.provider) ?? 'unknown';
      const model = this.readString(trace.llmModel) ?? 'unknown';
      const promptTokens = this.readNumber(trace.usage?.promptTokens);
      const completionTokens = this.readNumber(trace.usage?.completionTokens);
      const aggregateTokens = this.readNumber(trace.usage?.totalTokens);
      const costUsd = this.readNumber(trace.usage?.cost);

      totalRequests += 1;
      totalPromptTokens += promptTokens;
      totalCompletionTokens += completionTokens;
      totalTokens += aggregateTokens;
      totalCostUsd += costUsd;

      const providerEntry = byProvider.get(provider) ?? {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      };
      providerEntry.requests += 1;
      providerEntry.promptTokens += promptTokens;
      providerEntry.completionTokens += completionTokens;
      providerEntry.totalTokens += aggregateTokens;
      providerEntry.costUsd += costUsd;
      byProvider.set(provider, providerEntry);

      const modelEntry = byModel.get(model) ?? {
        requests: 0,
        totalTokens: 0,
        costUsd: 0,
      };
      modelEntry.requests += 1;
      modelEntry.totalTokens += aggregateTokens;
      modelEntry.costUsd += costUsd;
      byModel.set(model, modelEntry);
    }

    return {
      mongoAvailable: this.mongoConnection.isConnected(),
      totals: {
        requests: totalRequests,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens,
        costUsd: totalCostUsd,
      },
      byProvider: Array.from(byProvider.entries()).map(([provider, stats]) => ({
        provider,
        ...stats,
      })),
      byModel: Array.from(byModel.entries()).map(([model, stats]) => ({
        model,
        ...stats,
      })),
    };
  }

  async getLlmRouting(query: RoutingLookup) {
    const [configs, resolved] = await Promise.all([
      this.simulationPrisma.client.llmRoutingConfig.findMany({
        orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.llmRoutingConfig.getActiveConfig(query),
    ]);

    return {
      resolved,
      configs,
    };
  }

  async updateLlmRouting(body: LlmRoutingBody, actor: UserClaims) {
    if (!body.config) {
      throw new BadRequestException('config is required');
    }

    const updated = await this.llmRoutingConfig.upsertConfig({
      scope: body.scope,
      orgId: body.orgId,
      userId: body.userId,
      name: body.name,
      isActive: body.isActive,
      config: body.config,
    });

    this.recordAudit(
      actor,
      'admin.llm.routing.update',
      'llmRouting',
      body.scope ?? 'global',
      {
        scope: body.scope ?? 'global',
        orgId: body.orgId,
        userId: body.userId,
      },
    );

    return {
      config: updated,
      resolved: await this.llmRoutingConfig.getActiveConfig({
        scope: body.scope,
        orgId: body.orgId,
        userId: body.userId,
      }),
    };
  }

  async reloadLlmRouting(query: RoutingLookup, actor: UserClaims) {
    this.llmRoutingConfig.invalidateCache(
      query.scope,
      query.orgId,
      query.userId,
    );
    const resolved = await this.llmRoutingConfig.getActiveConfig(query);

    this.recordAudit(
      actor,
      'admin.llm.routing.reload',
      'llmRouting',
      query.scope ?? 'global',
      {
        scope: query.scope ?? 'global',
        orgId: query.orgId,
        userId: query.userId,
      },
    );

    return { resolved };
  }

  async listPhoneCalls(query: PhoneCallsQuery) {
    const limit = this.normalizeLimit(query.limit, 50, 200);
    const offset = this.normalizeOffset(query.offset);
    const where: SimulationPrisma.CallSessionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const [calls, total] = await Promise.all([
      this.simulationPrisma.client.callSession.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          recordings: {
            include: {
              asset: true,
            },
          },
          iteration: {
            include: {
              session: true,
              sessionMember: true,
            },
          },
        },
      }),
      this.simulationPrisma.client.callSession.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      calls,
    };
  }

  async getPhoneCall(callId: string) {
    const call = await this.simulationPrisma.client.callSession.findUnique({
      where: { id: callId },
      include: {
        recordings: {
          include: {
            asset: true,
          },
        },
        iteration: {
          include: {
            session: true,
            sessionMember: true,
          },
        },
      },
    });
    if (!call) {
      throw new NotFoundException('Phone call not found');
    }
    return call;
  }

  async getPhoneCallEvents(callId: string, limit?: number) {
    const call = await this.getPhoneCall(callId);
    const take = this.normalizeLimit(limit, 100, 250);
    const events = await this.simulationPrisma.client.event.findMany({
      where: {
        iterationId: call.iterationId,
      },
      take,
      orderBy: { createdAt: 'desc' },
    });

    return {
      callId,
      iterationId: call.iterationId,
      events,
    };
  }

  async redialPhoneCall(callId: string, body: RedialBody, actor: UserClaims) {
    const call = await this.getPhoneCall(callId);
    const result = await this.phoneCallService.startCall({
      sessionId: call.iteration.sessionId,
      userId: call.iteration.sessionMember.userId,
      phoneNumber: body.phoneNumber,
      provider: body.provider,
    });

    this.recordAudit(actor, 'admin.phone-calls.redial', 'phoneCall', callId, {
      sessionId: call.iteration.sessionId,
      provider: body.provider,
    });

    return {
      redialedFromCallId: callId,
      ...result,
    };
  }

  async listJobs(query: LogQuery) {
    void query;
    const queueStats = await this.rabbitMqAdmin.getQueueStats();
    return {
      jobs: KNOWN_JOBS.map((job) => ({ ...job })),
      queues: queueStats,
    };
  }

  getJob(jobId: string) {
    const definition = KNOWN_JOBS.find((job) => job.id === jobId);
    if (!definition) {
      throw new NotFoundException('Job not found');
    }

    return definition;
  }

  async runJob(jobName: string, actor: UserClaims) {
    const definition = KNOWN_JOBS.find((job) => job.id === jobName);
    if (!definition) {
      throw new NotFoundException('Job not found');
    }

    const result: unknown = await lastValueFrom(
      this.simulationService
        .send(SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE, {
          period: definition.period,
          userClaims: actor,
        })
        .pipe(timeout(60000)),
    );

    return {
      jobName: definition.id,
      result,
    };
  }

  async listQueues() {
    const [queues, assessmentQueueDepth] = await Promise.all([
      this.rabbitMqAdmin.getQueueStats(),
      this.redisService.get<number>('metrics:assessment:queue_depth'),
    ]);

    return {
      queues,
      metrics: {
        assessmentQueueDepth: assessmentQueueDepth ?? 0,
      },
    };
  }

  async retryDeadLetters(
    queueName: string,
    body: QueueRetryBody,
    actor: UserClaims,
  ) {
    void actor;
    const result = await this.rabbitMqAdmin.retryDeadLetters(
      queueName,
      this.normalizeLimit(body.maxMessages, 100, 1000),
    );
    return result;
  }

  async invalidateCache(body: CacheInvalidateBody, actor: UserClaims) {
    const patterns = new Set<string>();
    if (body.pattern) patterns.add(body.pattern);
    if (body.sessionId) {
      patterns.add(`sim:session:${body.sessionId}*`);
      patterns.add(`sim:sse:${body.sessionId}*`);
      patterns.add(`sim:smiter:${body.sessionId}:*`);
    }
    if (body.personaId) {
      patterns.add(`sim:persona:${body.personaId}*`);
    }
    if (body.scenarioId) {
      patterns.add(`sim:scenario:${body.scenarioId}*`);
    }

    if (patterns.size === 0 && body.llmRouting !== true) {
      throw new BadRequestException(
        'Provide a pattern, sessionId, personaId, scenarioId, or llmRouting=true',
      );
    }

    const invalidations = await Promise.all(
      Array.from(patterns).map(async (pattern) => ({
        pattern,
        deleted: await this.redisService.deletePattern(pattern),
      })),
    );

    if (body.llmRouting) {
      this.llmRoutingConfig.invalidateCache();
    }

    this.recordAudit(actor, 'admin.cache.invalidate', 'cache', 'redis', {
      invalidations,
      llmRouting: body.llmRouting ?? false,
    });

    return {
      invalidations,
      llmRoutingInvalidated: body.llmRouting ?? false,
    };
  }

  async previewDataFix(name: string) {
    const fixName = this.normalizeDataFixName(name);
    switch (fixName) {
      case 'normalize-llm-routing-configs':
        return this.previewNormalizeLlmRoutingConfigs();
      case 'backfill-ended-session-timestamps':
        return this.previewBackfillEndedSessionTimestamps();
      case 'repair-team-owner-audit':
        return this.previewRepairTeamOwnerAudit();
    }
  }

  async applyDataFix(name: string, actor: UserClaims) {
    const fixName = this.normalizeDataFixName(name);
    let result: unknown;
    switch (fixName) {
      case 'normalize-llm-routing-configs':
        result = await this.applyNormalizeLlmRoutingConfigs();
        break;
      case 'backfill-ended-session-timestamps':
        result = await this.applyBackfillEndedSessionTimestamps();
        break;
      case 'repair-team-owner-audit':
        result = await this.applyRepairTeamOwnerAudit(actor);
        break;
    }

    this.recordAudit(actor, 'admin.data-fixes.apply', 'dataFix', fixName, {
      result: this.isRecord(result) ? result : undefined,
    });

    return result;
  }

  private async previewNormalizeLlmRoutingConfigs() {
    const configs =
      await this.simulationPrisma.client.llmRoutingConfig.findMany({
        orderBy: { updatedAt: 'desc' },
      });
    const preview = configs
      .map((config) => {
        const normalized = this.normalizeRoutingConfig(config.config);
        const changed = !this.jsonEquals(config.config, normalized);
        return changed
          ? {
              id: config.id,
              scope: config.scope,
              orgId: config.orgId,
              userId: config.userId,
              current: config.config,
              next: normalized,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      fix: 'normalize-llm-routing-configs',
      affectedCount: preview.length,
      preview,
    };
  }

  private async applyNormalizeLlmRoutingConfigs() {
    const preview = await this.previewNormalizeLlmRoutingConfigs();
    await Promise.all(
      preview.preview.map((item) =>
        this.simulationPrisma.client.llmRoutingConfig.update({
          where: { id: item.id },
          data: {
            config: item.next as SimulationPrisma.InputJsonValue,
          },
        }),
      ),
    );
    this.llmRoutingConfig.invalidateCache();
    return {
      fix: preview.fix,
      affectedCount: preview.affectedCount,
    };
  }

  private async previewBackfillEndedSessionTimestamps() {
    const sessions = await this.simulationPrisma.client.session.findMany({
      where: {
        status: 'ended',
        endedAt: null,
      },
      include: {
        iterations: {
          select: {
            endedAt: true,
          },
          orderBy: { endedAt: 'desc' },
        },
      },
      take: 200,
    });

    const preview = sessions.map((session) => ({
      id: session.id,
      currentEndedAt: session.endedAt,
      nextEndedAt:
        session.iterations.find((iteration) => iteration.endedAt)?.endedAt ??
        session.updatedAt,
    }));

    return {
      fix: 'backfill-ended-session-timestamps',
      affectedCount: preview.length,
      preview,
    };
  }

  private async applyBackfillEndedSessionTimestamps() {
    const preview = await this.previewBackfillEndedSessionTimestamps();
    await Promise.all(
      preview.preview.map((session) =>
        this.simulationPrisma.client.session.update({
          where: { id: session.id },
          data: {
            endedAt: session.nextEndedAt,
          },
        }),
      ),
    );

    return {
      fix: preview.fix,
      affectedCount: preview.affectedCount,
    };
  }

  private async previewRepairTeamOwnerAudit() {
    const teams = await this.userPrisma.team.findMany({
      include: {
        memberships: {
          where: {
            role: Role.OWNER,
            isActive: true,
          },
          select: {
            userId: true,
          },
        },
      },
      take: 200,
    });

    const preview = teams
      .map((team) => {
        const ownerUserId = team.memberships[0]?.userId;
        const metadata = this.readJsonRecord(team.metadata);
        const audit = this.readJsonRecord(metadata.audit);
        if (!ownerUserId || audit.ownerUserId === ownerUserId) {
          return null;
        }
        return {
          id: team.id,
          currentOwnerUserId: audit.ownerUserId ?? null,
          nextOwnerUserId: ownerUserId,
          metadata,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      fix: 'repair-team-owner-audit',
      affectedCount: preview.length,
      preview,
    };
  }

  private async applyRepairTeamOwnerAudit(actor: UserClaims) {
    const preview = await this.previewRepairTeamOwnerAudit();
    await Promise.all(
      preview.preview.map((team) => {
        const audit = this.readJsonRecord(team.metadata.audit);
        return this.userPrisma.team.update({
          where: { id: team.id },
          data: {
            metadata: {
              ...team.metadata,
              audit: {
                ...audit,
                ownerUserId: team.nextOwnerUserId,
                updatedByUserId: actor.id,
                updatedAt: new Date().toISOString(),
                version:
                  typeof audit.version === 'number' ? audit.version + 1 : 1,
              },
            } as UserPrisma.InputJsonValue,
          },
        });
      }),
    );

    return {
      fix: preview.fix,
      affectedCount: preview.affectedCount,
    };
  }

  private normalizeDataFixName(name: string): DataFixName {
    const normalized = name.trim().toLowerCase() as DataFixName;
    if (
      normalized !== 'normalize-llm-routing-configs' &&
      normalized !== 'backfill-ended-session-timestamps' &&
      normalized !== 'repair-team-owner-audit'
    ) {
      throw new NotFoundException('Unknown data fix');
    }
    return normalized;
  }

  private async getSessionIterations(sessionId: string) {
    await this.ensureSession(sessionId);
    return this.simulationPrisma.client.iteration.findMany({
      where: { sessionId },
      select: {
        id: true,
        sessionMemberId: true,
        iterationNumber: true,
      },
      orderBy: { iterationNumber: 'asc' },
    });
  }

  private async getIterationIdsForSession(sessionId: string) {
    const iterations = await this.getSessionIterations(sessionId);
    return iterations.map((iteration) => iteration.id);
  }

  private async ensureSession(sessionId: string) {
    const session = await this.simulationPrisma.client.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  private async requireSessionWithOwner(sessionId: string) {
    const session = await this.simulationPrisma.client.session.findUnique({
      where: { id: sessionId },
      include: {
        members: {
          where: { role: 'owner' },
          take: 1,
        },
      },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const ownerMember = session.members[0];
    if (!ownerMember) {
      throw new NotFoundException('Session owner not found');
    }
    return { session, ownerMember };
  }

  private async ensureUser(userId: string) {
    const user = await this.userPrisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async findMongoEventLogs(iterationIds: string[], limit: number) {
    if (!this.mongoConnection.isConnected() || iterationIds.length === 0) {
      return [];
    }
    const model = this.mongoConnection.getModel(EventLogModel, EventLogSchema);
    return await model
      .find({ iterationId: { $in: iterationIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  private async findEnrichedTranscripts(iterationIds: string[]) {
    if (!this.mongoConnection.isConnected() || iterationIds.length === 0) {
      return [];
    }
    const model = this.mongoConnection.getModel(
      EnrichedTranscriptModel,
      EnrichedTranscriptSchema,
    );
    return await model
      .find({ iterationId: { $in: iterationIds } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  private async findLlmTraces(input: {
    iterationIds?: string[];
    provider?: string;
    orgId?: string;
    userId?: string;
    limit?: number;
    hours?: number;
  }) {
    if (!this.mongoConnection.isConnected()) {
      return [];
    }

    const model = this.mongoConnection.getModel(LLMTraceModel, LLMTraceSchema);
    const filter: Record<string, unknown> = {};
    if (input.iterationIds) {
      filter.iterationId = { $in: input.iterationIds };
    }
    if (input.provider) {
      filter.provider = input.provider;
    }
    if (input.orgId) {
      filter['context.orgId'] = input.orgId;
    }
    if (input.userId) {
      filter['context.userId'] = input.userId;
    }
    if ((input.hours ?? 0) > 0) {
      filter.createdAt = {
        $gte: new Date(Date.now() - (input.hours as number) * 60 * 60 * 1000),
      };
    }

    return await model
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(input.limit ?? 100)
      .lean()
      .exec();
  }

  private async invalidateSessionCache(sessionId: string, userId: string) {
    await Promise.all([
      this.redisService.deletePattern(`sim:session:${sessionId}*`),
      this.redisService.deletePattern(`sim:sse:${sessionId}*`),
      this.redisService.deletePattern(`sim:smiter:${sessionId}:*`),
      this.simulationRedis.deleteSessionMemberIteration(sessionId, userId),
    ]);
  }

  private recordAudit(
    actor: UserClaims,
    action: string,
    targetType: string,
    targetId: string,
    details?: Record<string, unknown>,
  ) {
    void actor;
    void action;
    void targetType;
    void targetId;
    void details;
  }

  private normalizeRoutingConfig(value: unknown): Record<string, unknown> {
    return this.llmRoutingConfig.normalizeForAdmin(value);
  }

  private jsonEquals(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private readJsonRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readError(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private toHealthEntry(
    result: PromiseSettledResult<unknown>,
    fallbackError: string,
  ) {
    if (result.status === 'fulfilled') {
      return { status: 'ok' as const };
    }
    return {
      status: 'error' as const,
      error: this.readError(result.reason, fallbackError),
    };
  }

  private async readPackageVersions(): Promise<PackageVersionInfo> {
    if (!PACKAGE_JSON_CACHE.value) {
      PACKAGE_JSON_CACHE.value = (async () => {
        const workspaceRoot = await this.resolveWorkspaceRoot();
        const rootPackagePath = path.join(workspaceRoot, 'package.json');
        const apiPackagePath = await this.resolveApiPackagePath(workspaceRoot);
        const [workspaceRaw, apiRaw] = await Promise.all([
          fs.readFile(rootPackagePath, 'utf8').catch(() => '{}'),
          fs.readFile(apiPackagePath, 'utf8').catch(() => '{}'),
        ]);

        const workspaceJson = JSON.parse(workspaceRaw) as { version?: string };
        const apiJson = JSON.parse(apiRaw) as { version?: string };
        return {
          workspaceVersion: workspaceJson.version,
          apiVersion: apiJson.version,
        };
      })();
    }

    return PACKAGE_JSON_CACHE.value;
  }

  private async readBuildMetadata(): Promise<BuildMetadataInfo> {
    if (!BUILD_METADATA_CACHE.value) {
      BUILD_METADATA_CACHE.value = (async () => {
        const gitMetadata = await this.readGitMetadata();
        const branch =
          process.env.VERCEL_GIT_COMMIT_REF ||
          process.env.GIT_BRANCH ||
          gitMetadata.branch ||
          null;
        const commitSha =
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.GIT_COMMIT_SHA ||
          process.env.COMMIT_SHA ||
          gitMetadata.commitSha ||
          null;
        const repositoryUrl =
          this.readRepositoryUrlFromEnv() || gitMetadata.repositoryUrl || null;

        return {
          branch,
          branchUrl: this.buildBranchUrl(repositoryUrl, branch),
          commitSha,
          repositoryUrl,
        };
      })();
    }

    return BUILD_METADATA_CACHE.value;
  }

  private async readGitMetadata(): Promise<{
    branch: string | null;
    commitSha: string | null;
    repositoryUrl: string | null;
  }> {
    const gitDir = await this.resolveGitDirectory();
    if (!gitDir) {
      return {
        branch: null,
        commitSha: null,
        repositoryUrl: null,
      };
    }

    const [headRaw, configRaw, packedRefsRaw] = await Promise.all([
      fs.readFile(path.join(gitDir, 'HEAD'), 'utf8').catch(() => null),
      fs.readFile(path.join(gitDir, 'config'), 'utf8').catch(() => null),
      fs.readFile(path.join(gitDir, 'packed-refs'), 'utf8').catch(() => null),
    ]);

    let branch: string | null = null;
    let commitSha: string | null = null;
    const head = headRaw?.trim() ?? '';
    if (head.startsWith('ref:')) {
      const ref = head.replace(/^ref:\s*/, '').trim();
      branch = ref.replace(/^refs\/heads\//, '');
      commitSha = await this.readGitRef(gitDir, ref, packedRefsRaw);
    } else if (head) {
      commitSha = head;
    }

    return {
      branch,
      commitSha,
      repositoryUrl: this.normalizeRepositoryUrl(
        this.readOriginRemoteUrl(configRaw),
      ),
    };
  }

  private async resolveGitDirectory(): Promise<string | null> {
    const workspaceRoot = await this.resolveWorkspaceRoot();
    const dotGitPath = path.join(workspaceRoot, '.git');
    const gitStat = await fs.stat(dotGitPath).catch(() => null);
    if (!gitStat) {
      return null;
    }

    if (gitStat.isDirectory()) {
      return dotGitPath;
    }

    const dotGitRaw = await fs.readFile(dotGitPath, 'utf8').catch(() => null);
    const gitDirMatch = dotGitRaw?.match(/^gitdir:\s*(.+)$/m);
    if (!gitDirMatch) {
      return null;
    }

    return path.resolve(workspaceRoot, gitDirMatch[1].trim());
  }

  private async readGitRef(
    gitDir: string,
    ref: string,
    packedRefsRaw: string | null,
  ): Promise<string | null> {
    const looseRef = await fs
      .readFile(path.join(gitDir, ref), 'utf8')
      .catch(() => null);
    if (looseRef?.trim()) {
      return looseRef.trim();
    }

    if (!packedRefsRaw) {
      return null;
    }

    const packedLine = packedRefsRaw
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.endsWith(` ${ref}`));
    if (!packedLine) {
      return null;
    }

    const [sha] = packedLine.split(' ');
    return sha?.trim() || null;
  }

  private readOriginRemoteUrl(configRaw: string | null): string | null {
    if (!configRaw) {
      return null;
    }

    const remoteSection = configRaw.match(
      /\[remote "origin"\]([\s\S]*?)(?:\n\[|$)/,
    );
    const urlMatch = remoteSection?.[1]?.match(/^\s*url\s*=\s*(.+)\s*$/m);
    return urlMatch?.[1]?.trim() || null;
  }

  private readRepositoryUrlFromEnv(): string | null {
    const owner = process.env.VERCEL_GIT_REPO_OWNER?.trim();
    const repo = process.env.VERCEL_GIT_REPO_SLUG?.trim();
    if (owner && repo) {
      return `https://github.com/${owner}/${repo}`;
    }

    const githubRepository = process.env.GITHUB_REPOSITORY?.trim();
    if (githubRepository) {
      return `https://github.com/${githubRepository}`;
    }

    return null;
  }

  private async resolveWorkspaceRoot(): Promise<string> {
    if (!WORKSPACE_ROOT_CACHE.value) {
      WORKSPACE_ROOT_CACHE.value = (async () => {
        const startingDir = process.cwd();
        let currentDir = startingDir;

        while (true) {
          const [gitStat, workspaceStat, packageRaw] = await Promise.all([
            fs.stat(path.join(currentDir, '.git')).catch(() => null),
            fs
              .stat(path.join(currentDir, 'pnpm-workspace.yaml'))
              .catch(() => null),
            fs
              .readFile(path.join(currentDir, 'package.json'), 'utf8')
              .catch(() => null),
          ]);

          if (gitStat || workspaceStat) {
            return currentDir;
          }

          if (packageRaw) {
            try {
              const packageJson = JSON.parse(packageRaw) as {
                workspaces?: unknown;
              };
              if (packageJson.workspaces) {
                return currentDir;
              }
            } catch {
              // Ignore malformed package metadata and continue walking upward.
            }
          }

          const parentDir = path.dirname(currentDir);
          if (parentDir === currentDir) {
            return startingDir;
          }

          currentDir = parentDir;
        }
      })();
    }

    return WORKSPACE_ROOT_CACHE.value;
  }

  private async resolveApiPackagePath(workspaceRoot: string): Promise<string> {
    const candidates = [
      path.join(workspaceRoot, 'apps', 'api', 'package.json'),
      path.join(workspaceRoot, 'package.json'),
    ];

    for (const candidate of candidates) {
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isFile()) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private normalizeRepositoryUrl(remoteUrl: string | null): string | null {
    if (!remoteUrl) {
      return null;
    }

    const sshRemote = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshRemote) {
      return `https://${sshRemote[1]}/${sshRemote[2]}`;
    }

    const sshProtocolRemote = remoteUrl.match(
      /^ssh:\/\/git@([^/]+)\/(.+?)(?:\.git)?$/,
    );
    if (sshProtocolRemote) {
      return `https://${sshProtocolRemote[1]}/${sshProtocolRemote[2]}`;
    }

    try {
      const url = new URL(remoteUrl);
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname.replace(/\.git$/, '');
      return url.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  private buildBranchUrl(
    repositoryUrl: string | null,
    branch: string | null,
  ): string | null {
    if (!repositoryUrl || !branch) {
      return null;
    }

    const treePath = repositoryUrl.includes('gitlab') ? '/-/tree/' : '/tree/';
    return `${repositoryUrl}${treePath}${encodeURIComponent(branch)}`;
  }

  private parseCsv(value?: string): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseBoolean(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(
      value.trim().toLowerCase(),
    );
  }

  private normalizeLimit(
    value: number | undefined,
    fallback: number,
    max: number,
  ): number {
    if (!Number.isFinite(value) || !value || value <= 0) {
      return fallback;
    }
    return Math.min(Math.trunc(value), max);
  }

  private normalizeOffset(value: number | undefined): number {
    if (!Number.isFinite(value) || !value || value < 0) {
      return 0;
    }
    return Math.trunc(value);
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
