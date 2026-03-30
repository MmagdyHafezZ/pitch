import { CoinRefillService } from '../../coins/services/coin-refill.service';

describe('CoinRefillService', () => {
  const coinRedis = {
    initRemainingIfMissing: jest.fn(),
    getRemaining: jest.fn(),
    applyDeltaIdempotent: jest.fn(),
    setRemaining: jest.fn(),
  } as any;
  const coinLedgerRepo = {
    createRefillIfNotExists: jest.fn(),
  } as any;
  const coinBalanceRepo = {
    getSnapshot: jest.fn(),
    upsertRefill: jest.fn(),
  } as any;
  const userRepository = {
    findById: jest.fn(),
    findMany: jest.fn(),
    updateSettings: jest.fn(),
  } as any;
  const subscriptionRepository = {
    findActiveWithPlanByTeamId: jest.fn(),
  } as any;
  const teamRepository = {
    findUserTeams: jest.fn(),
  } as any;
  const notificationService = {
    createOne: jest.fn(),
    createBatch: jest.fn(),
    markMatchingRead: jest.fn(),
  } as any;

  let service: CoinRefillService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
    jest.clearAllMocks();
    process.env.SUPER_ADMIN_EMAILS =
      'admin@example.com, second-admin@example.com';
    process.env.PERSONAL_COINS_PER_MONTH = '100';

    service = new CoinRefillService(
      coinRedis,
      coinLedgerRepo,
      coinBalanceRepo,
      userRepository,
      subscriptionRepository,
      teamRepository,
      notificationService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const personalTeam = {
    id: 'team-personal',
    isActive: true,
    memberships: [{ userId: 'user-1', isActive: true }],
  };

  it('stores a pending refill request against the resolved personal workspace and notifies super admins', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Pitch Nova',
      settings: {
        studioAccess: { teamId: 'team-personal' },
      },
    });
    teamRepository.findUserTeams.mockResolvedValue([personalTeam]);
    userRepository.updateSettings.mockResolvedValue({
      coinRefillRequest: {
        requestedCoins: 5000,
        requestedAt: '2026-03-29T12:00:00.000Z',
        status: 'pending',
        teamId: 'team-personal',
      },
    });
    userRepository.findMany.mockResolvedValue([
      { id: 'user-1', email: 'user@example.com' },
      { id: 'admin-1', email: 'admin@example.com' },
      { id: 'admin-2', email: 'second-admin@example.com' },
    ]);

    const result = await service.requestRefill({
      userId: 'user-1',
      teamId: 'spoofed-team',
      requestedCoins: 5000,
    });

    expect(userRepository.updateSettings).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        coinRefillRequest: expect.objectContaining({
          requestedCoins: 5000,
          status: 'pending',
          teamId: 'team-personal',
        }),
      }),
    );
    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserIds: ['admin-1', 'admin-2'],
        type: 'coin_refill_request',
        metadata: expect.objectContaining({
          requesterUserId: 'user-1',
          requesterEmail: 'user@example.com',
          teamId: 'team-personal',
          requestedCoins: 5000,
        }),
      }),
    );
    expect(result.status).toBe('pending');
    expect(result.teamId).toBe('team-personal');
  });

  it('returns and normalizes an existing pending refill request without notifying admins again', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Pitch Nova',
      settings: {
        studioAccess: { teamId: 'team-personal' },
        coinRefillRequest: {
          requestedCoins: 5000,
          requestedAt: '2026-03-29T12:00:00.000Z',
          status: 'pending',
          teamId: 'legacy-team',
        },
      },
    });
    teamRepository.findUserTeams.mockResolvedValue([personalTeam]);
    userRepository.updateSettings.mockResolvedValue({
      coinRefillRequest: {
        requestedCoins: 5000,
        requestedAt: '2026-03-29T12:00:00.000Z',
        status: 'pending',
        teamId: 'team-personal',
      },
    });

    const result = await service.requestRefill({
      userId: 'user-1',
      requestedCoins: 2500,
    });

    expect(notificationService.createBatch).not.toHaveBeenCalled();
    expect(userRepository.updateSettings).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        coinRefillRequest: expect.objectContaining({
          status: 'pending',
          teamId: 'team-personal',
        }),
      }),
    );
    expect(result.teamId).toBe('team-personal');
    expect(result.requestedCoins).toBe(5000);
  });

  it('lists only pending refill requests', async () => {
    userRepository.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Pitch Nova',
        settings: {
          coinRefillRequest: {
            requestedCoins: 5000,
            requestedAt: '2026-03-29T00:00:00.000Z',
            status: 'pending',
            teamId: 'team-1',
          },
        },
      },
      {
        id: 'user-2',
        email: 'done@example.com',
        name: 'Done User',
        settings: {
          coinRefillRequest: {
            requestedCoins: 3000,
            requestedAt: '2026-03-28T00:00:00.000Z',
            status: 'approved',
            teamId: 'team-2',
          },
        },
      },
    ]);

    const result = await service.listPendingRefills();

    expect(result).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        email: 'user@example.com',
        requestedCoins: 5000,
        status: 'pending',
      }),
    ]);
  });

  it('approves a pending refill additively against the personal balance pool', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Pitch Nova',
      settings: {
        studioAccess: { teamId: 'team-personal' },
        coinRefillRequest: {
          requestedCoins: 5000,
          requestedAt: '2026-03-29T00:00:00.000Z',
          status: 'pending',
          teamId: 'spoofed-team',
        },
      },
    });
    teamRepository.findUserTeams.mockResolvedValue([personalTeam]);
    coinBalanceRepo.getSnapshot.mockResolvedValue({
      allowance: 100,
      remaining: 40,
    });
    coinRedis.getRemaining.mockResolvedValue(40);
    coinRedis.applyDeltaIdempotent.mockResolvedValue({
      applied: true,
      remainingAfter: 6040,
      reason: 'APPLIED',
    });
    userRepository.updateSettings.mockResolvedValue({
      coinRefillRequest: {
        requestedCoins: 5000,
        requestedAt: '2026-03-29T00:00:00.000Z',
        status: 'approved',
        teamId: 'team-personal',
        approvedCoins: 6000,
        reviewedBy: 'admin@example.com',
      },
    });

    const result = await service.approveRefill({
      userId: 'user-1',
      approvedCoins: 6000,
      reviewer: 'admin@example.com',
    });

    expect(coinRedis.initRemainingIfMissing).toHaveBeenCalledWith(
      'user:user-1',
      'personal:user-1:2026-03',
      100,
      expect.any(Number),
    );
    expect(coinRedis.applyDeltaIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'user:user-1',
        periodKey: 'personal:user-1:2026-03',
        deltaCoins: -6000,
      }),
    );
    expect(coinBalanceRepo.upsertRefill).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'user:user-1',
        subscriptionId: 'personal',
        periodKey: 'personal:user-1:2026-03',
        allowance: 6100,
        remainingAfter: 6040,
      }),
    );
    expect(coinLedgerRepo.createRefillIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'user:user-1',
        subscriptionId: 'personal',
        planId: 'personal',
        deltaCoins: 6000,
        allowance: 6100,
        remainingAfter: 6040,
      }),
    );
    expect(notificationService.markMatchingRead).toHaveBeenCalledWith({
      type: 'coin_refill_request',
      metadata: { requesterUserId: 'user-1' },
    });
    expect(notificationService.createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-1',
        type: 'coin_refill_decision',
        metadata: expect.objectContaining({
          decision: 'approved',
          requestedCoins: 5000,
          approvedCoins: 6000,
          reviewedBy: 'admin@example.com',
        }),
      }),
    );
    expect(result.status).toBe('approved');
    expect(result.teamId).toBe('team-personal');
    expect(result.periodKey).toBe('personal:user-1:2026-03');
  });

  it('denies a pending refill, clears admin notifications, and notifies the requester', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Pitch Nova',
      settings: {
        studioAccess: { teamId: 'team-personal' },
        coinRefillRequest: {
          requestedCoins: 5000,
          requestedAt: '2026-03-29T00:00:00.000Z',
          status: 'pending',
          teamId: 'spoofed-team',
        },
      },
    });
    teamRepository.findUserTeams.mockResolvedValue([personalTeam]);
    userRepository.updateSettings.mockResolvedValue({
      coinRefillRequest: {
        requestedCoins: 5000,
        requestedAt: '2026-03-29T00:00:00.000Z',
        status: 'denied',
        teamId: 'team-personal',
        reviewedBy: 'admin@example.com',
      },
    });

    const result = await service.denyRefill({
      userId: 'user-1',
      reviewer: 'admin@example.com',
    });

    expect(notificationService.markMatchingRead).toHaveBeenCalledWith({
      type: 'coin_refill_request',
      metadata: { requesterUserId: 'user-1' },
    });
    expect(notificationService.createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-1',
        type: 'coin_refill_decision',
        metadata: expect.objectContaining({
          decision: 'denied',
          requestedCoins: 5000,
          reviewedBy: 'admin@example.com',
        }),
      }),
    );
    expect(result.status).toBe('denied');
    expect(result.teamId).toBe('team-personal');
  });

  it('can skip admin notifications for auto-approved admin refill requests', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      settings: {
        studioAccess: { teamId: 'team-personal' },
      },
    });
    teamRepository.findUserTeams.mockResolvedValue([personalTeam]);
    userRepository.updateSettings.mockResolvedValue({
      coinRefillRequest: {
        requestedCoins: 2000,
        requestedAt: '2026-03-29T00:00:00.000Z',
        status: 'pending',
        teamId: 'team-personal',
      },
    });

    await service.requestRefill({
      userId: 'user-1',
      teamId: 'team-personal',
      requestedCoins: 2000,
      notifyAdmins: false,
    });

    expect(notificationService.createBatch).not.toHaveBeenCalled();
  });
});
