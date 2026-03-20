/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { AdminGatewayService } from './admin-gateway.service';

describe('AdminGatewayService', () => {
  let service: AdminGatewayService;
  let configService: { get: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let userPrisma: any;
  let simulationPrisma: any;
  let mongoConnection: any;
  let redisService: any;
  let simulationRedis: any;
  let llmRoutingConfig: any;
  let assessmentService: any;
  let phoneCallService: any;
  let rabbitMqAdmin: any;
  let adminObservability: any;
  let phoneWebhookService: any;
  let simulationService: any;
  let flagOverrides: Record<string, unknown>;

  const actor: UserClaims = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
  };

  const originalFeatureFlag = process.env.FEATURE_FLAG_ADMIN_UI;
  const originalAccessExpiration = process.env.JWT_ACCESS_EXPIRATION;

  beforeEach(() => {
    process.env.JWT_ACCESS_EXPIRATION = '15m';
    flagOverrides = {};
    configService = {
      get: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };
    userPrisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-2',
          email: 'user@example.com',
          name: 'Target User',
        }),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    simulationPrisma = {
      client: {
        session: {
          findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
        },
        llmRoutingConfig: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
        },
      },
    };
    mongoConnection = {
      isConnected: jest.fn().mockReturnValue(true),
    };
    redisService = {
      exists: jest.fn().mockResolvedValue(false),
      hgetall: jest.fn().mockImplementation(() => flagOverrides),
      hset: jest
        .fn()
        .mockImplementation((_key: string, field: string, value: unknown) => {
          flagOverrides[field] = value;
          return true;
        }),
      hdel: jest.fn().mockImplementation((_key: string, field: string) => {
        delete flagOverrides[field];
        return 1;
      }),
      deletePattern: jest.fn().mockResolvedValue(3),
      get: jest.fn().mockResolvedValue(0),
    };
    simulationRedis = {
      deleteSessionMemberIteration: jest.fn(),
    };
    llmRoutingConfig = {
      invalidateCache: jest.fn(),
      normalizeForAdmin: jest
        .fn()
        .mockImplementation((value: unknown) => value),
      getActiveConfig: jest.fn().mockResolvedValue({
        defaultRoute: { provider: 'openai', model: 'gpt-4o' },
      }),
      upsertConfig: jest.fn(),
    };
    assessmentService = {};
    phoneCallService = {};
    rabbitMqAdmin = {
      getConnectionStatus: jest.fn().mockResolvedValue({ status: 'ok' }),
      getQueueStats: jest.fn().mockResolvedValue([]),
      retryDeadLetters: jest.fn().mockResolvedValue({
        queueName: 'simulation_queue',
        retried: 0,
      }),
    };
    adminObservability = {
      recordAudit: jest.fn(),
      getJobRun: jest.fn(),
      listJobRuns: jest.fn().mockReturnValue([]),
      getWebhookEvent: jest.fn(),
      listWebhookProviders: jest.fn().mockReturnValue([]),
      listWebhookEvents: jest.fn().mockReturnValue([]),
      listAuditLogs: jest.fn().mockReturnValue([]),
      listErrorLogs: jest.fn().mockReturnValue([]),
      listRequestLogs: jest.fn().mockReturnValue([]),
      recordJobRun: jest.fn(),
      updateJobRun: jest.fn(),
    };
    phoneWebhookService = {
      processTwilioWebhook: jest.fn().mockResolvedValue({
        status: 'processed',
        provider: 'twilio',
      }),
    };
    simulationService = {
      send: jest.fn().mockReturnValue(of({ ok: true })),
    };

    service = new AdminGatewayService(
      configService as any,
      jwtService as any,
      userPrisma,
      simulationPrisma,
      mongoConnection,
      redisService,
      simulationRedis,
      llmRoutingConfig,
      assessmentService,
      phoneCallService,
      rabbitMqAdmin,
      adminObservability,
      phoneWebhookService,
      simulationService,
    );
  });

  afterEach(() => {
    if (originalFeatureFlag === undefined) {
      delete process.env.FEATURE_FLAG_ADMIN_UI;
    } else {
      process.env.FEATURE_FLAG_ADMIN_UI = originalFeatureFlag;
    }

    if (originalAccessExpiration === undefined) {
      delete process.env.JWT_ACCESS_EXPIRATION;
    } else {
      process.env.JWT_ACCESS_EXPIRATION = originalAccessExpiration;
    }
  });

  it('reports healthy dependencies when backing services are reachable', async () => {
    await expect(service.getDependenciesHealth()).resolves.toMatchObject({
      status: 'ok',
      dependencies: {
        userDatabase: { status: 'ok' },
        simulationDatabase: { status: 'ok' },
        rabbitMq: { status: 'ok' },
        mongo: { status: 'ok', connected: true },
      },
    });
  });

  it('merges env and override feature flags', async () => {
    process.env.FEATURE_FLAG_ADMIN_UI = 'true';
    flagOverrides['admin-ui'] = {
      enabled: false,
      reason: 'disabled for testing',
      updatedAt: '2026-03-20T00:00:00.000Z',
      updatedByUserId: actor.id,
      updatedByEmail: actor.email,
    };

    await expect(service.getFeatureFlags()).resolves.toEqual({
      flags: [
        expect.objectContaining({
          key: 'admin-ui',
          enabled: false,
          defaultEnabled: true,
          source: 'override',
          reason: 'disabled for testing',
        }),
      ],
    });
  });

  it('stores feature flag overrides and records an audit log', async () => {
    await expect(
      service.updateFeatureFlag(
        'admin-ui',
        { enabled: true, reason: 'ship it' },
        actor,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        key: 'admin-ui',
        enabled: true,
        source: 'override',
      }),
    );

    expect(redisService.hset).toHaveBeenCalledWith(
      'admin:feature-flags',
      'admin-ui',
      expect.objectContaining({
        enabled: true,
        reason: 'ship it',
        updatedByUserId: actor.id,
      }),
    );
    expect(adminObservability.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.feature-flags.update',
        actorUserId: actor.id,
        targetId: 'admin-ui',
      }),
    );
  });

  it('creates impersonation access tokens for existing users', async () => {
    await expect(service.impersonateUser('user-2', actor)).resolves.toEqual({
      accessToken: 'signed-token',
      expiresIn: '15m',
      user: {
        id: 'user-2',
        email: 'user@example.com',
        name: 'Target User',
      },
      actor: {
        id: actor.id,
        email: actor.email,
      },
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-2',
        impersonatedBy: actor.id,
      }),
      expect.objectContaining({
        expiresIn: '15m',
      }),
    );
  });

  it('returns known job definitions when no run exists', () => {
    expect(service.getJob('generate-daily-challenges')).toEqual({
      id: 'generate-daily-challenges',
      description: 'Generate the daily public challenge set.',
      schedule: '0 0 * * *',
      period: 'DAILY',
      recentRuns: [],
    });
  });

  it('replays stored Twilio webhook events', async () => {
    adminObservability.getWebhookEvent.mockReturnValue({
      id: 'evt-1',
      provider: 'twilio',
      payload: { CallSid: 'CA123' },
      query: { sessionId: 'session-1', userId: 'user-1' },
    });

    await expect(
      service.replayWebhookEvent('twilio', 'evt-1'),
    ).resolves.toEqual({
      replayedEventId: 'evt-1',
      result: {
        status: 'processed',
        provider: 'twilio',
      },
    });

    expect(phoneWebhookService.processTwilioWebhook).toHaveBeenCalledWith(
      { CallSid: 'CA123' },
      { sessionId: 'session-1', userId: 'user-1' },
      {
        source: 'replay',
        replayedFromId: 'evt-1',
      },
    );
  });

  it('rejects unsupported webhook replays', async () => {
    adminObservability.getWebhookEvent.mockReturnValue({
      id: 'evt-2',
      provider: 'stripe',
      payload: {},
      query: {},
    });

    await expect(service.replayWebhookEvent('stripe', 'evt-2')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('invalidates cache patterns and LLM routing cache', async () => {
    await expect(
      service.invalidateCache(
        {
          sessionId: 'session-5',
          llmRouting: true,
        },
        actor,
      ),
    ).resolves.toEqual({
      invalidations: [
        { pattern: 'sim:session:session-5*', deleted: 3 },
        { pattern: 'sim:sse:session-5*', deleted: 3 },
        { pattern: 'sim:smiter:session-5:*', deleted: 3 },
      ],
      llmRoutingInvalidated: true,
    });

    expect(llmRoutingConfig.invalidateCache).toHaveBeenCalledWith();
  });

  it('previews routing config normalization changes', async () => {
    simulationPrisma.client.llmRoutingConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-1',
        scope: 'global',
        orgId: null,
        userId: null,
        config: { providers: { OpenAI: { defaultModel: 'gpt-4o' } } },
      },
    ]);
    llmRoutingConfig.normalizeForAdmin.mockReturnValue({
      providers: { openai: { defaultModel: 'gpt-4o' } },
    });

    await expect(
      service.previewDataFix('normalize-llm-routing-configs'),
    ).resolves.toEqual({
      fix: 'normalize-llm-routing-configs',
      affectedCount: 1,
      preview: [
        {
          id: 'cfg-1',
          scope: 'global',
          orgId: null,
          userId: null,
          current: { providers: { OpenAI: { defaultModel: 'gpt-4o' } } },
          next: { providers: { openai: { defaultModel: 'gpt-4o' } } },
        },
      ],
    });
  });

  it('throws when an unknown data fix is requested', async () => {
    await expect(service.previewDataFix('missing-fix')).rejects.toThrow(
      NotFoundException,
    );
  });
});
