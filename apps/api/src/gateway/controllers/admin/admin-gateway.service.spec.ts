/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
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
      teamMembership: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    simulationPrisma = {
      client: {
        $transaction: jest.fn(),
        session: {
          findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
          findUnique: jest.fn().mockResolvedValue({ id: 'session-1' }),
          delete: jest.fn(),
        },
        sessionMember: {
          findUnique: jest.fn(),
          delete: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
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
    simulationService = {
      send: jest.fn().mockReturnValue(of({ ok: true })),
    };
    simulationPrisma.client.$transaction.mockImplementation(
      (callback: (tx: typeof simulationPrisma.client) => unknown) =>
        Promise.resolve(callback(simulationPrisma.client)),
    );

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

  it('reads version metadata from the workspace root', async () => {
    await expect(service.getVersion()).resolves.toMatchObject({
      api: {
        version: expect.any(String),
      },
      workspace: {
        version: expect.any(String),
      },
      build: {
        branch: expect.any(String),
        branchUrl: expect.any(String),
        repositoryUrl: expect.stringContaining('github.com'),
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

  it('stores feature flag overrides', async () => {
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

  it('removes a team member and records an audit entry', async () => {
    userPrisma.teamMembership.findUnique.mockResolvedValue({
      teamId: 'team-1',
      userId: 'user-2',
      role: 'MEMBER',
      isActive: true,
      team: {
        id: 'team-1',
        isActive: true,
        deletedAt: null,
      },
    });
    userPrisma.teamMembership.update.mockResolvedValue({
      teamId: 'team-1',
      userId: 'user-2',
      isActive: false,
    });

    await expect(
      service.removeTeamMember('team-1', 'user-2', actor),
    ).resolves.toEqual({
      message: 'User with ID user-2 has been removed from team with ID: team-1',
      teamId: 'team-1',
      removedUserId: 'user-2',
    });

    expect(userPrisma.teamMembership.update).toHaveBeenCalledWith({
      where: {
        userId_teamId: {
          userId: 'user-2',
          teamId: 'team-1',
        },
      },
      data: {
        isActive: false,
        acceptedAt: null,
        invitedByUserId: null,
      },
    });
  });

  it('blocks removing the active team owner without a transfer', async () => {
    userPrisma.teamMembership.findUnique.mockResolvedValue({
      teamId: 'team-1',
      userId: 'owner-1',
      role: 'OWNER',
      isActive: true,
      team: {
        id: 'team-1',
        isActive: true,
        deletedAt: null,
      },
    });

    await expect(
      service.removeTeamMember('team-1', 'owner-1', actor),
    ).rejects.toThrow(
      'Transfer ownership to another member before removing the current owner.',
    );
    expect(userPrisma.teamMembership.update).not.toHaveBeenCalled();
  });

  it('removes a session owner and promotes the next member', async () => {
    simulationPrisma.client.sessionMember.findUnique.mockResolvedValue({
      id: 'member-1',
      role: 'owner',
      userId: 'owner-1',
    });
    simulationPrisma.client.sessionMember.findMany.mockResolvedValue([
      {
        id: 'member-2',
        userId: 'user-2',
        role: 'viewer',
        joinedAt: new Date('2026-03-20T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.removeSessionMember('session-1', 'owner-1', actor),
    ).resolves.toEqual({
      message:
        'Member owner-1 removed from session session-1; ownership transferred to user-2',
      sessionId: 'session-1',
      removedUserId: 'owner-1',
      newOwnerId: 'user-2',
      sessionDeleted: undefined,
    });

    expect(simulationPrisma.client.sessionMember.delete).toHaveBeenCalledWith({
      where: {
        sessionId_userId: {
          sessionId: 'session-1',
          userId: 'owner-1',
        },
      },
    });
    expect(simulationPrisma.client.sessionMember.update).toHaveBeenCalledWith({
      where: { id: 'member-2' },
      data: { role: 'owner' },
    });
  });

  it('deletes the session when the removed member was the last one left', async () => {
    simulationPrisma.client.sessionMember.findUnique.mockResolvedValue({
      id: 'member-1',
      role: 'viewer',
      userId: 'user-2',
    });
    simulationPrisma.client.sessionMember.findMany.mockResolvedValue([]);

    await expect(
      service.removeSessionMember('session-1', 'user-2', actor),
    ).resolves.toEqual({
      message: 'Session session-1 deleted because it has no members',
      sessionId: 'session-1',
      removedUserId: 'user-2',
      newOwnerId: undefined,
      sessionDeleted: true,
    });

    expect(simulationPrisma.client.session.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });

  it('returns known job definitions when no run exists', () => {
    expect(service.getJob('generate-daily-challenges')).toEqual({
      id: 'generate-daily-challenges',
      description: 'Generate the daily public challenge set.',
      schedule: '0 0 * * *',
      period: 'DAILY',
    });
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
