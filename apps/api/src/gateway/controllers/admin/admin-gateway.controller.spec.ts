import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import {
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { AdminGatewayController } from './admin-gateway.controller';

type MockResponse = ReturnType<ClientProxy['send']>;

function responseOf<T>(value: T): MockResponse {
  return of(value) as MockResponse;
}

function errorResponse(error: unknown): MockResponse {
  return throwError(() => error) as MockResponse;
}

describe('AdminGatewayController', () => {
  let controller: AdminGatewayController;
  let userClient: jest.Mocked<ClientProxy>;
  let simulationClient: jest.Mocked<ClientProxy>;

  const userClaims: UserClaims = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
  };

  beforeEach(() => {
    userClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    simulationClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new AdminGatewayController(userClient, simulationClient);
  });

  it('returns admin identity payload', () => {
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

  it('maps upstream failures to HttpException instances', async () => {
    userClient.send.mockReturnValue(errorResponse(new Error('boom')));

    await expect(controller.getPlans(userClaims)).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(controller.getPlans(userClaims)).rejects.toMatchObject({
      message: 'boom',
    });
  });

  it('falls back to the route-level error message when the upstream error has none', async () => {
    userClient.send.mockReturnValue(
      errorResponse({ status: 503, code: 'SERVICE_DOWN' }),
    );

    await expect(controller.getPlans(userClaims)).rejects.toMatchObject({
      message: 'Failed to get plans',
      status: 503,
    });
  });
});
