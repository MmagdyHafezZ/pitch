import { SubscriptionRepository } from '../../subscription/repositories/subscription.repository';

const mockPlan = {
  id: 'plan-1',
  name: 'Pro',
  isActive: true,
  tokensPerSeat: 1000,
  price: 29_99,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockSubscription = {
  id: 'sub-1',
  teamId: 'team-1',
  planId: 'plan-1',
  isActive: true,
  currentPeriodStart: new Date('2024-01-01'),
  currentPeriodEnd: new Date('2024-02-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockSubscriptionWithPlan = { ...mockSubscription, plan: mockPlan };

const mockPrisma = {
  subscription: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('SubscriptionRepository', () => {
  let repo: SubscriptionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SubscriptionRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a subscription with plan included', async () => {
      mockPrisma.subscription.create.mockResolvedValue(
        mockSubscriptionWithPlan,
      );

      const input = {
        teamId: 'team-1',
        planId: 'plan-1',
        isActive: true,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      };

      const result = await repo.create(input as any);

      expect(result).toEqual(mockSubscriptionWithPlan);
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: input,
        include: { plan: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates a subscription by id with plan included', async () => {
      const updated = { ...mockSubscriptionWithPlan, isActive: false };
      mockPrisma.subscription.update.mockResolvedValue(updated);

      const result = await repo.update('sub-1', { isActive: false } as any);

      expect(result).toEqual(updated);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { isActive: false },
        include: { plan: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes a subscription by id', async () => {
      mockPrisma.subscription.delete.mockResolvedValue(mockSubscription);

      const result = await repo.delete('sub-1');

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns subscription with plan when found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        mockSubscriptionWithPlan,
      );

      const result = await repo.findById('sub-1');

      expect(result).toEqual(mockSubscriptionWithPlan);
      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        include: { plan: true },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all subscriptions ordered by createdAt asc', async () => {
      const subs = [mockSubscription, { ...mockSubscription, id: 'sub-2' }];
      mockPrisma.subscription.findMany.mockResolvedValue(subs);

      const result = await repo.findAll();

      expect(result).toEqual(subs);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns empty array when no subscriptions exist', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveByTeamId
  // ---------------------------------------------------------------------------

  describe('findActiveByTeamId', () => {
    it('returns the active subscription for a team', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await repo.findActiveByTeamId('team-1');

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns null when team has no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const result = await repo.findActiveByTeamId('team-no-sub');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findAllActive
  // ---------------------------------------------------------------------------

  describe('findAllActive', () => {
    it('returns all active subscriptions', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const result = await repo.findAllActive();

      expect(result).toEqual([mockSubscription]);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findDueForRollover
  // ---------------------------------------------------------------------------

  describe('findDueForRollover', () => {
    it('returns subscriptions whose period has ended', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        mockSubscriptionWithPlan,
      ]);

      const cutoff = new Date('2024-02-01');
      const result = await repo.findDueForRollover(cutoff);

      expect(result).toEqual([mockSubscriptionWithPlan]);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          currentPeriodEnd: { lte: cutoff },
        },
        include: { plan: true },
      });
    });

    it('returns empty array when no subscriptions are due', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await repo.findDueForRollover(new Date('2023-12-01'));

      expect(result).toEqual([]);
    });
  });
});
