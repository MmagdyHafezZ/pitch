import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { of, throwError } from 'rxjs';
import { AdminGatewayController } from './admin-gateway.controller';
import { AdminGatewayService } from './admin-gateway.service';

function makeClientProxy() {
  return {
    send: jest.fn(),
  };
}

const responseOf = <T>(value: T) => of(value);
const errorResponse = (error: Error) => throwError(() => error);

type AdminServiceMock = {
  getDependenciesHealth: jest.Mock;
  getVersion: jest.Mock;
  getRuntimeConfig: jest.Mock;
  getFeatureFlags: jest.Mock;
  updateFeatureFlag: jest.Mock;
  transferTeamOwner: jest.Mock;
  getUserSessions: jest.Mock;
  listAssessmentRuns: jest.Mock;
  listWebhooks: jest.Mock;
  retryDeadLetters: jest.Mock;
  removeTeamMember: jest.Mock;
  removeSessionMember: jest.Mock;
  listErrors: jest.Mock;
  getLogLevels: jest.Mock;
  updateLogLevels: jest.Mock;
};

describe('AdminGatewayController', () => {
  let controller: AdminGatewayController;
  let userClient: ReturnType<typeof makeClientProxy>;
  let simulationClient: ReturnType<typeof makeClientProxy>;
  let adminService: AdminServiceMock;

  const userClaims = {
    id: 'admin-1',
    email: 'admin@test.com',
  } as UserClaims;

  beforeEach(async () => {
    userClient = makeClientProxy();
    simulationClient = makeClientProxy();
    adminService = {
      getDependenciesHealth: jest.fn(),
      getVersion: jest.fn(),
      getRuntimeConfig: jest.fn(),
      getFeatureFlags: jest.fn(),
      updateFeatureFlag: jest.fn(),
      transferTeamOwner: jest.fn(),
      getUserSessions: jest.fn(),
      listAssessmentRuns: jest.fn(),
      listWebhooks: jest.fn(),
      retryDeadLetters: jest.fn(),
      removeTeamMember: jest.fn(),
      removeSessionMember: jest.fn(),
      listErrors: jest.fn(),
      getLogLevels: jest.fn(),
      updateLogLevels: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminGatewayController],
      providers: [
        { provide: 'USER_SERVICE', useValue: userClient },
        { provide: 'SIMULATION_SERVICE', useValue: simulationClient },
        { provide: AdminGatewayService, useValue: adminService },
      ],
    }).compile();

    controller = module.get(AdminGatewayController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the current admin identity', () => {
    expect(controller.getMe(userClaims)).toEqual({
      ...userClaims,
      isSystemAdmin: true,
    });
  });

  it('aggregates overview metrics and warnings', async () => {
    userClient.send
      .mockReturnValueOnce(
        responseOf([
          { id: 'u1', isActive: true },
          { id: 'u2', isActive: false },
        ]),
      )
      .mockReturnValueOnce(responseOf([{ id: 't1' }]))
      .mockReturnValueOnce(responseOf([{ id: 'p1' }, { id: 'p2' }]))
      .mockReturnValueOnce(
        errorResponse(new Error('subscriptions unavailable')),
      );

    simulationClient.send.mockReturnValue(
      responseOf({
        sessions: [
          { id: 's1', status: 'active' },
          { id: 's2', status: 'ended' },
        ],
        total: 2,
      }),
    );

    const result = await controller.getOverview(userClaims);

    expect(result.status).toBe('degraded');
    expect(result.totals).toEqual({
      users: 2,
      activeUsers: 1,
      teams: 1,
      plans: 2,
      subscriptions: 0,
      sessions: 2,
      activeSessions: 1,
    });
    expect(result.warnings).toContain('subscriptions unavailable');
  });

  it('forwards getUsers through the admin namespace', async () => {
    userClient.send.mockReturnValue(responseOf([{ id: 'user-1' }]));

    const result = await controller.getUsers(userClaims);

    expect(result).toEqual([{ id: 'user-1' }]);
    expect(userClient.send.mock.calls).toEqual([
      [USER_SERVICE_PATTERNS.GET_USERS, { userClaims }],
    ]);
  });

  it('aggregates overview metrics when all dependencies succeed', async () => {
    userClient.send
      .mockReturnValueOnce(responseOf([{ id: 'u1', isActive: true }]))
      .mockReturnValueOnce(responseOf([{ id: 't1' }, { id: 't2' }]))
      .mockReturnValueOnce(responseOf([{ id: 'p1' }]))
      .mockReturnValueOnce(responseOf([{ id: 'sub-1' }]));

    simulationClient.send.mockReturnValue(
      responseOf([
        { id: 's1', status: 'active' },
        { id: 's2', status: 'queued' },
      ]),
    );

    const result = await controller.getOverview(userClaims);

    expect(result.status).toBe('ok');
    expect(result.totals).toEqual({
      users: 1,
      activeUsers: 1,
      teams: 2,
      plans: 1,
      subscriptions: 1,
      sessions: 2,
      activeSessions: 1,
    });
    expect(result.warnings).toEqual([]);
  });

  it('ignores malformed overview payloads instead of inflating counts', async () => {
    userClient.send
      .mockReturnValueOnce(responseOf([{ id: 'u1' }, null, 'bad-data']))
      .mockReturnValueOnce(responseOf('not-an-array'))
      .mockReturnValueOnce(responseOf([{ id: 'p1' }, 42]))
      .mockReturnValueOnce(responseOf(undefined));

    simulationClient.send.mockReturnValue(
      responseOf({
        sessions: [{ id: 's1', status: 'active' }, null, 'bad-event'],
      }),
    );

    const result = await controller.getOverview(userClaims);

    expect(result.status).toBe('ok');
    expect(result.totals).toEqual({
      users: 1,
      activeUsers: 1,
      teams: 0,
      plans: 1,
      subscriptions: 0,
      sessions: 1,
      activeSessions: 1,
    });
    expect(result.warnings).toEqual([]);
  });

  it.each([
    [
      'getUserById',
      () => controller.getUserById('user-2', userClaims),
      USER_SERVICE_PATTERNS.GET_USER,
      { userId: 'user-2', userClaims },
      { id: 'user-2' },
    ],
    [
      'updateUser',
      () => controller.updateUser('user-2', { name: 'Updated' }, userClaims),
      USER_SERVICE_PATTERNS.UPDATE_USER,
      { userId: 'user-2', name: 'Updated', userClaims },
      { id: 'user-2', name: 'Updated' },
    ],
    [
      'deleteUser',
      () => controller.deleteUser('user-2', userClaims),
      USER_SERVICE_PATTERNS.DELETE_USER,
      { userId: 'user-2', userClaims },
      { deleted: true },
    ],
    [
      'createTeam',
      () =>
        controller.createTeam(
          {
            name: 'New Team',
            slug: 'new-team',
            billingEmail: 'billing@example.com',
          },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.CREATE_TEAM,
      {
        name: 'New Team',
        slug: 'new-team',
        billingEmail: 'billing@example.com',
        ownerId: 'admin-1',
        createdBy: 'admin-1',
        userClaims,
      },
      { id: 'team-1', name: 'New Team' },
    ],
    [
      'getTeams',
      () => controller.getTeams(userClaims),
      USER_SERVICE_PATTERNS.GET_TEAMS,
      { userClaims },
      [{ id: 'team-1' }],
    ],
    [
      'getTeamById',
      () => controller.getTeamById('team-1', userClaims),
      USER_SERVICE_PATTERNS.GET_TEAM,
      { teamId: 'team-1', userClaims },
      { id: 'team-1' },
    ],
    [
      'updateTeam',
      () =>
        controller.updateTeam(
          'team-1',
          { name: 'Renamed Team', billingEmail: 'billing@example.com' },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.UPDATE_TEAM,
      {
        teamId: 'team-1',
        name: 'Renamed Team',
        billingEmail: 'billing@example.com',
        userClaims,
      },
      { id: 'team-1', name: 'Renamed Team' },
    ],
    [
      'deleteTeam',
      () => controller.deleteTeam('team-1', userClaims),
      USER_SERVICE_PATTERNS.DELETE_TEAM,
      { teamId: 'team-1', userClaims },
      { message: 'deleted' },
    ],
    [
      'addTeamMember',
      () =>
        controller.addTeamMember(
          'team-1',
          { userId: 'user-2', role: 'MEMBER' },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.ADD_TEAM_MEMBER,
      { teamId: 'team-1', userId: 'user-2', role: 'MEMBER', userClaims },
      { id: 'membership-1' },
    ],
    [
      'updateTeamMember',
      () =>
        controller.updateTeamMember(
          'team-1',
          'user-2',
          { role: 'ADMIN', tokenLimit: 10 },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.UPDATE_TEAM_MEMBER,
      {
        teamId: 'team-1',
        userId: 'user-2',
        role: 'ADMIN',
        tokenLimit: 10,
        userClaims,
      },
      { id: 'membership-1', role: 'ADMIN' },
    ],
    [
      'sendTeamSignupInvite',
      () =>
        controller.sendTeamSignupInvite(
          'team-1',
          { email: 'new@example.com', role: 'MEMBER' },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.SEND_TEAM_SIGNUP_INVITE,
      {
        teamId: 'team-1',
        email: 'new@example.com',
        role: 'MEMBER',
        userClaims,
      },
      { queued: true },
    ],
    [
      'getPlans',
      () => controller.getPlans(userClaims),
      USER_SERVICE_PATTERNS.GET_PLANS,
      { userClaims },
      [{ id: 'plan-1' }],
    ],
    [
      'getPlanById',
      () => controller.getPlanById('plan-1', userClaims),
      USER_SERVICE_PATTERNS.GET_PLAN,
      { id: 'plan-1', userClaims },
      { id: 'plan-1' },
    ],
    [
      'createPlan',
      () => controller.createPlan({ name: 'Pro' }, userClaims),
      USER_SERVICE_PATTERNS.CREATE_PLAN,
      { name: 'Pro', userClaims },
      { id: 'plan-1', name: 'Pro' },
    ],
    [
      'updatePlan',
      () => controller.updatePlan('plan-1', { name: 'Plus' }, userClaims),
      USER_SERVICE_PATTERNS.UPDATE_PLAN,
      { id: 'plan-1', name: 'Plus', userClaims },
      { id: 'plan-1', name: 'Plus' },
    ],
    [
      'deletePlan',
      () => controller.deletePlan('plan-1', userClaims),
      USER_SERVICE_PATTERNS.DELETE_PLAN,
      { id: 'plan-1', userClaims },
      { deleted: true },
    ],
    [
      'getSubscriptions',
      () => controller.getSubscriptions(userClaims),
      USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS,
      { userClaims },
      [{ id: 'sub-1' }],
    ],
    [
      'getTeamSubscription',
      () => controller.getTeamSubscription('team-1', userClaims),
      USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION,
      { teamId: 'team-1', userClaims },
      { id: 'sub-1' },
    ],
    [
      'getSubscriptionById',
      () => controller.getSubscriptionById('sub-1', userClaims),
      USER_SERVICE_PATTERNS.GET_SUBSCRIPTION,
      { id: 'sub-1', userClaims },
      { id: 'sub-1' },
    ],
    [
      'createSubscription',
      () =>
        controller.createSubscription(
          { teamId: 'team-1', planId: 'plan-1' },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION,
      { teamId: 'team-1', planId: 'plan-1', userClaims },
      { id: 'sub-1' },
    ],
    [
      'updateSubscription',
      () =>
        controller.updateSubscription(
          'sub-1',
          { cancelAtPeriodEnd: true },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.UPDATE_SUBSCRIPTION,
      { id: 'sub-1', cancelAtPeriodEnd: true, userClaims },
      { id: 'sub-1', cancelAtPeriodEnd: true },
    ],
    [
      'upgradeSubscription',
      () =>
        controller.upgradeSubscription(
          'sub-1',
          { planId: 'plan-pro' },
          userClaims,
        ),
      USER_SERVICE_PATTERNS.UPGRADE_SUBSCRIPTION,
      { id: 'sub-1', planId: 'plan-pro', userClaims },
      { id: 'sub-1', planId: 'plan-pro' },
    ],
    [
      'deleteSubscription',
      () => controller.deleteSubscription('sub-1', userClaims),
      USER_SERVICE_PATTERNS.DELETE_SUBSCRIPTION,
      { id: 'sub-1', userClaims },
      { deleted: true },
    ],
  ])(
    '%s forwards to the user microservice correctly',
    async (_name, invoke, pattern, payload, response) => {
      userClient.send.mockReturnValue(responseOf(response));

      const result = await invoke();

      expect(result).toEqual(response);
      expect(userClient.send.mock.calls).toEqual([[pattern, payload]]);
    },
  );

  it('delegates team member removal to the admin service', async () => {
    adminService.removeTeamMember = jest.fn().mockResolvedValue({
      message: 'removed',
    } as never);

    await expect(
      controller.removeTeamMember('team-1', 'user-2', userClaims),
    ).resolves.toEqual({
      message: 'removed',
    });

    expect(adminService.removeTeamMember.mock.calls).toEqual([
      ['team-1', 'user-2', userClaims],
    ]);
  });

  it('listSessions parses numeric filters before forwarding', async () => {
    simulationClient.send.mockReturnValue(
      responseOf({ sessions: [], total: 0 }),
    );

    await controller.listSessions(
      {
        limit: '25',
        offset: '10',
        status: 'active',
        type: 'phone',
      },
      userClaims,
    );

    expect(simulationClient.send.mock.calls).toEqual([
      [
        SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS,
        {
          limit: 25,
          offset: 10,
          status: 'active',
          type: 'phone',
          userClaims,
        },
      ],
    ]);
  });

  it('listSessions drops invalid numeric filters', async () => {
    simulationClient.send.mockReturnValue(
      responseOf({ sessions: [], total: 0 }),
    );

    await controller.listSessions(
      { limit: 'oops', offset: 'NaN', orgId: 'org-1' },
      userClaims,
    );

    expect(simulationClient.send.mock.calls).toEqual([
      [
        SIMULATION_SERVICE_PATTERNS.LIST_SESSIONS,
        {
          limit: undefined,
          offset: undefined,
          orgId: 'org-1',
          userClaims,
        },
      ],
    ]);
  });

  it.each([
    [
      'createSession',
      () =>
        controller.createSession(
          { orgId: 'team-1', type: 'text', name: 'Demo session' },
          userClaims,
        ),
      SIMULATION_SERVICE_PATTERNS.CREATE_SESSION,
      { orgId: 'team-1', type: 'text', name: 'Demo session', userClaims },
      { id: 'session-1' },
    ],
    [
      'updateSession',
      () =>
        controller.updateSession(
          'session-1',
          { name: 'Updated session', status: 'ended' },
          userClaims,
        ),
      SIMULATION_SERVICE_PATTERNS.UPDATE_SESSION,
      {
        id: 'session-1',
        name: 'Updated session',
        status: 'ended',
        userClaims,
      },
      { id: 'session-1', name: 'Updated session' },
    ],
    [
      'addSessionMembers',
      () =>
        controller.addSessionMembers(
          'session-1',
          { userIds: ['user-2'], role: 'viewer' },
          userClaims,
        ),
      SIMULATION_SERVICE_PATTERNS.ADD_SESSION_MEMBERS,
      {
        sessionId: 'session-1',
        userIds: ['user-2'],
        role: 'viewer',
        userClaims,
      },
      { members: [{ id: 'member-1' }], created: 1, failed: 0 },
    ],
    [
      'listSessionInvitations',
      () => controller.listSessionInvitations('session-1', userClaims),
      SIMULATION_SERVICE_PATTERNS.LIST_SESSION_INVITATIONS,
      { sessionId: 'session-1', userClaims },
      [{ id: 'invite-1' }],
    ],
    [
      'listSessionMembers',
      () => controller.listSessionMembers('session-1', userClaims),
      SIMULATION_SERVICE_PATTERNS.LIST_SESSION_MEMBERS,
      { sessionId: 'session-1', userClaims },
      [{ id: 'member-1' }],
    ],
    [
      'getSessionById',
      () => controller.getSessionById('session-1', userClaims),
      SIMULATION_SERVICE_PATTERNS.GET_SESSION,
      { id: 'session-1', userClaims },
      { id: 'session-1' },
    ],
  ])(
    '%s forwards to the simulation microservice correctly',
    async (_name, invoke, pattern, payload, response) => {
      simulationClient.send.mockReturnValue(responseOf(response));

      const result = await invoke();

      expect(result).toEqual(response);
      expect(simulationClient.send.mock.calls).toEqual([[pattern, payload]]);
    },
  );

  it('delegates session member removal to the admin service', async () => {
    adminService.removeSessionMember = jest.fn().mockResolvedValue({
      message: 'removed',
    } as never);

    await expect(
      controller.removeSessionMember('session-1', 'user-2', userClaims),
    ).resolves.toEqual({
      message: 'removed',
    });

    expect(adminService.removeSessionMember.mock.calls).toEqual([
      ['session-1', 'user-2', userClaims],
    ]);
  });

  it('getSessionTimeline parses numeric limits before forwarding', async () => {
    simulationClient.send.mockReturnValue(responseOf([{ id: 'evt-1' }]));

    await controller.getSessionTimeline('session-1', '15', userClaims);

    expect(simulationClient.send.mock.calls).toEqual([
      [
        SIMULATION_SERVICE_PATTERNS.SESSION_TIMELINE,
        {
          sessionId: 'session-1',
          limit: 15,
          userClaims,
        },
      ],
    ]);
  });

  it('getSessionTimeline drops invalid numeric limits', async () => {
    simulationClient.send.mockReturnValue(responseOf([{ id: 'evt-1' }]));

    await controller.getSessionTimeline('session-1', 'bad', userClaims);

    expect(simulationClient.send.mock.calls).toEqual([
      [
        SIMULATION_SERVICE_PATTERNS.SESSION_TIMELINE,
        {
          sessionId: 'session-1',
          limit: undefined,
          userClaims,
        },
      ],
    ]);
  });

  it('forwards latest session assessment lookups to the simulation microservice', async () => {
    simulationClient.send.mockReturnValue(responseOf({ id: 'assessment-1' }));

    await expect(
      controller.getLatestSessionAssessment('session-1', {
        iterationId: 'iter-1',
        sessionMemberId: 'member-1',
      }),
    ).resolves.toEqual({ id: 'assessment-1' });

    expect(simulationClient.send.mock.calls).toEqual([
      [
        SIMULATION_SERVICE_PATTERNS.ASSESSMENT_LATEST,
        {
          sessionId: 'session-1',
          iterationId: 'iter-1',
          sessionMemberId: 'member-1',
        },
      ],
    ]);
  });

  it('maps upstream failures to HttpException instances', async () => {
    userClient.send.mockReturnValue(errorResponse(new Error('boom')));

    await expect(controller.getPlans(userClaims)).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(controller.getPlans(userClaims)).rejects.toMatchObject({
      message: 'boom',
    });
  });

  it('delegates team ownership transfers to the admin service', async () => {
    adminService.transferTeamOwner.mockResolvedValue({
      message: 'transferred',
    });

    await expect(
      controller.transferTeamOwner('team-1', { userId: 'user-2' }, userClaims),
    ).resolves.toEqual({
      message: 'transferred',
    });
    expect(adminService.transferTeamOwner.mock.calls).toEqual([
      ['team-1', { userId: 'user-2' }, userClaims],
    ]);
  });

  it('parses user session filters before delegating to the admin service', async () => {
    adminService.getUserSessions.mockResolvedValue({
      sessions: [],
      total: 0,
    });

    await controller.getUserSessions('user-9', {
      limit: '20',
      offset: '4',
      status: 'active',
      type: 'phone',
    });

    expect(adminService.getUserSessions.mock.calls).toEqual([
      [
        'user-9',
        {
          limit: 20,
          offset: 4,
          status: 'active',
          type: 'phone',
        },
      ],
    ]);
  });

  it('delegates logs alias to the error log service', () => {
    adminService.listErrors = jest.fn().mockReturnValue({
      logs: [],
    } as never);

    const result = controller.listLogs({ limit: '25' });

    expect(result).toEqual({ logs: [] });
    expect(adminService.listErrors.mock.calls).toEqual([[{ limit: 25 }]]);
  });

  it('delegates runtime log level reads to the admin service', () => {
    adminService.getLogLevels = jest.fn().mockReturnValue({
      debugEnabled: true,
    } as never);

    expect(controller.getLogLevels()).toEqual({
      debugEnabled: true,
    });
    expect(adminService.getLogLevels.mock.calls).toEqual([[]]);
  });

  it('delegates runtime log level updates to the admin service', () => {
    adminService.updateLogLevels = jest.fn().mockReturnValue({
      debugEnabled: false,
    } as never);

    expect(
      controller.updateLogLevels({ debugEnabled: false }, userClaims),
    ).toEqual({
      debugEnabled: false,
    });
    expect(adminService.updateLogLevels.mock.calls).toEqual([
      [{ debugEnabled: false }, userClaims],
    ]);
  });

  it('delegates feature flag updates to the admin service', async () => {
    adminService.updateFeatureFlag = jest.fn().mockResolvedValue({
      key: 'admin-ui',
      enabled: true,
    } as never);

    await expect(
      controller.patchFeatureFlag('admin-ui', { enabled: true }, userClaims),
    ).resolves.toEqual({
      key: 'admin-ui',
      enabled: true,
    });
    expect(adminService.updateFeatureFlag.mock.calls).toEqual([
      ['admin-ui', { enabled: true }, userClaims],
    ]);
  });

  it('parses user session list filters before delegating to the admin service', async () => {
    adminService.getUserSessions = jest.fn().mockResolvedValue({
      sessions: [],
      total: 0,
    } as never);

    await controller.getUserSessions('user-9', {
      limit: '20',
      offset: '4',
      status: 'active',
      type: 'phone',
    });

    expect(adminService.getUserSessions.mock.calls).toEqual([
      [
        'user-9',
        {
          limit: 20,
          offset: 4,
          status: 'active',
          type: 'phone',
        },
      ],
    ]);
  });

  it('parses assessment run filters before delegating to the admin service', async () => {
    adminService.listAssessmentRuns = jest.fn().mockResolvedValue({
      runs: [],
      total: 0,
    } as never);

    await controller.listAssessmentRuns({
      limit: '50',
      offset: '10',
      status: 'completed',
      sessionId: 'session-1',
      iterationId: 'iter-1',
      sessionMemberId: 'member-1',
    });

    expect(adminService.listAssessmentRuns.mock.calls).toEqual([
      [
        {
          limit: 50,
          offset: 10,
          status: 'completed',
          sessionId: 'session-1',
          iterationId: 'iter-1',
          sessionMemberId: 'member-1',
        },
      ],
    ]);
  });

  it('parses webhook list limits before delegating to the admin service', () => {
    adminService.listWebhooks = jest.fn().mockReturnValue({
      providers: [],
    } as never);

    controller.listWebhooks({ limit: '15' });

    expect(adminService.listWebhooks.mock.calls).toEqual([[{ limit: 15 }]]);
  });

  it('delegates queue retries to the admin service', async () => {
    adminService.retryDeadLetters = jest.fn().mockResolvedValue({
      queueName: 'simulation_queue',
      retried: 2,
    } as never);

    await expect(
      controller.retryDeadLetters(
        'simulation_queue',
        { maxMessages: 2 },
        userClaims,
      ),
    ).resolves.toEqual({
      queueName: 'simulation_queue',
      retried: 2,
    });

    expect(adminService.retryDeadLetters.mock.calls).toEqual([
      ['simulation_queue', { maxMessages: 2 }, userClaims],
    ]);
  });
});
