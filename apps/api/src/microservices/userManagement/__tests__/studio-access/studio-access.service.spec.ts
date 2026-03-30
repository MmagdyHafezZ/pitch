import { StudioAccessService } from '../../studio-access/services/studio-access.service';

describe('StudioAccessService', () => {
  const userRepository = {
    findById: jest.fn(),
    findMany: jest.fn(),
    updateSettings: jest.fn(),
  } as any;
  const teamService = {
    createTeam: jest.fn(),
  } as any;
  const teamRepository = {
    findById: jest.fn(),
    findMembership: jest.fn(),
    updateMember: jest.fn(),
    createAcceptedMember: jest.fn(),
  } as any;
  const planRepository = {
    findByName: jest.fn(),
  } as any;
  const planService = {
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
  } as any;
  const subscriptionRepository = {
    findActiveWithPlanByTeamId: jest.fn(),
  } as any;
  const subscriptionService = {
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    upgradeSubscription: jest.fn(),
  } as any;
  const notificationService = {
    createOne: jest.fn(),
    createBatch: jest.fn(),
    markMatchingRead: jest.fn(),
  } as any;
  const studioAccessEmailService = {
    sendDecisionEmail: jest.fn(),
  } as any;

  let service: StudioAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StudioAccessService(
      userRepository,
      teamService,
      teamRepository,
      planRepository,
      planService,
      subscriptionRepository,
      subscriptionService,
      notificationService,
      studioAccessEmailService,
    );
  });

  it('marks a user request as pending', async () => {
    userRepository.findMany.mockResolvedValue([
      { id: 'admin-1', email: 'admin@example.com' },
    ]);
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com';
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      settings: {},
    });
    userRepository.updateSettings.mockResolvedValue({
      studioAccess: {
        status: 'pending',
        requestedAt: '2026-03-24T00:00:00.000Z',
      },
    });

    const result = await service.requestAccess('user-1');

    expect(result.status).toBe('pending');
    expect(userRepository.updateSettings).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        studioAccess: expect.objectContaining({
          status: 'pending',
        }),
      }),
    );
    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserIds: ['admin-1'],
        type: 'STUDIO_ACCESS_REQUEST',
      }),
    );
  });

  it('approves a pending request and provisions quota-backed access', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      settings: {
        studioAccess: {
          status: 'pending',
          requestedAt: '2026-03-20T12:00:00.000Z',
        },
      },
    });
    teamService.createTeam.mockResolvedValue({ id: 'team-1' });
    teamRepository.findMembership.mockResolvedValue({
      userId: 'user-1',
      teamId: 'team-1',
      role: 'OWNER',
    });
    teamRepository.updateMember.mockResolvedValue({
      userId: 'user-1',
      teamId: 'team-1',
      role: 'MEMBER',
    });
    planRepository.findByName.mockResolvedValue(null);
    planService.createPlan.mockResolvedValue({ id: 'plan-1', isActive: true });
    subscriptionRepository.findActiveWithPlanByTeamId.mockResolvedValue(null);
    subscriptionService.createSubscription.mockResolvedValue({ id: 'sub-1' });

    const result = await service.approveRequest(
      'user-1',
      { quota: 5000, role: 'MEMBER' },
      { id: 'admin-1', email: 'admin@example.com' },
    );

    expect(teamService.createTeam).toHaveBeenCalled();
    expect(teamRepository.updateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-1',
        role: 'MEMBER',
      }),
    );
    expect(planService.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        maxCoins: 5000,
      }),
    );
    expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        planId: 'plan-1',
      }),
      'admin-1',
    );
    expect(userRepository.updateSettings).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        studioAccess: expect.objectContaining({
          status: 'approved',
          quota: 5000,
          role: 'MEMBER',
          teamId: 'team-1',
          planId: 'plan-1',
          subscriptionId: 'sub-1',
        }),
      }),
    );
    expect(notificationService.markMatchingRead).toHaveBeenCalledWith({
      type: 'STUDIO_ACCESS_REQUEST',
      metadata: { requesterUserId: 'user-1' },
    });
    expect(notificationService.createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-1',
        type: 'STUDIO_ACCESS_REVIEWED',
      }),
    );
    expect(studioAccessEmailService.sendDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        decision: 'approved',
        quota: 5000,
        role: 'MEMBER',
      }),
    );
    expect(result.status).toBe('approved');
  });

  it('denies a pending request and emails the requester', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      settings: {
        studioAccess: {
          status: 'pending',
          requestedAt: '2026-03-20T12:00:00.000Z',
        },
      },
    });

    const result = await service.denyRequest('user-1', {
      id: 'admin-1',
      email: 'admin@example.com',
    });

    expect(userRepository.updateSettings).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        studioAccess: expect.objectContaining({
          status: 'denied',
          quota: undefined,
          role: undefined,
        }),
      }),
    );
    expect(notificationService.markMatchingRead).toHaveBeenCalledWith({
      type: 'STUDIO_ACCESS_REQUEST',
      metadata: { requesterUserId: 'user-1' },
    });
    expect(studioAccessEmailService.sendDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        decision: 'denied',
      }),
    );
    expect(result.status).toBe('denied');
  });

  it('surfaces decision email failures during approval', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      settings: {
        studioAccess: {
          status: 'pending',
          requestedAt: '2026-03-20T12:00:00.000Z',
        },
      },
    });
    teamService.createTeam.mockResolvedValue({ id: 'team-1' });
    teamRepository.findMembership.mockResolvedValue({
      userId: 'user-1',
      teamId: 'team-1',
      role: 'OWNER',
    });
    teamRepository.updateMember.mockResolvedValue({
      userId: 'user-1',
      teamId: 'team-1',
      role: 'MEMBER',
    });
    planRepository.findByName.mockResolvedValue(null);
    planService.createPlan.mockResolvedValue({ id: 'plan-1', isActive: true });
    subscriptionRepository.findActiveWithPlanByTeamId.mockResolvedValue(null);
    subscriptionService.createSubscription.mockResolvedValue({ id: 'sub-1' });
    studioAccessEmailService.sendDecisionEmail.mockRejectedValue(
      new Error('smtp failed'),
    );

    await expect(
      service.approveRequest(
        'user-1',
        { quota: 5000, role: 'MEMBER' },
        { id: 'admin-1', email: 'admin@example.com' },
      ),
    ).rejects.toThrow('smtp failed');
  });
});
