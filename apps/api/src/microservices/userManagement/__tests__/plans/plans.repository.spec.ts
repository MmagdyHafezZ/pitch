import { PlanRepository } from '../../plans/repositories/plans.repository';

const mockPlan = {
  id: 'plan-1',
  name: 'Pro',
  isActive: true,
  tokensPerSeat: 1000,
  price: 29_99,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrisma = {
  plan: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('PlanRepository', () => {
  let repo: PlanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PlanRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a plan and returns it', async () => {
      mockPrisma.plan.create.mockResolvedValue(mockPlan);

      const input = {
        name: 'Pro',
        isActive: true,
        tokensPerSeat: 1000,
        price: 29_99,
      };
      const result = await repo.create(input as any);

      expect(result).toEqual(mockPlan);
      expect(mockPrisma.plan.create).toHaveBeenCalledWith({ data: input });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates a plan by id', async () => {
      const updated = { ...mockPlan, name: 'Enterprise' };
      mockPrisma.plan.update.mockResolvedValue(updated);

      const result = await repo.update('plan-1', { name: 'Enterprise' } as any);

      expect(result).toEqual(updated);
      expect(mockPrisma.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { name: 'Enterprise' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes a plan by id', async () => {
      mockPrisma.plan.delete.mockResolvedValue(mockPlan);

      const result = await repo.delete('plan-1');

      expect(result).toEqual(mockPlan);
      expect(mockPrisma.plan.delete).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns a plan when found', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await repo.findById('plan-1');

      expect(result).toEqual(mockPlan);
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all plans ordered by createdAt asc', async () => {
      const plans = [mockPlan, { ...mockPlan, id: 'plan-2', name: 'Basic' }];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await repo.findAll();

      expect(result).toEqual(plans);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });

    it('returns empty array when no plans exist', async () => {
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findActive
  // ---------------------------------------------------------------------------

  describe('findActive', () => {
    it('returns only active plans', async () => {
      mockPrisma.plan.findMany.mockResolvedValue([mockPlan]);

      const result = await repo.findActive();

      expect(result).toEqual([mockPlan]);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findByName
  // ---------------------------------------------------------------------------

  describe('findByName', () => {
    it('returns a plan when found by name', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await repo.findByName('Pro');

      expect(result).toEqual(mockPlan);
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { name: 'Pro' },
      });
    });

    it('returns null when name not found', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const result = await repo.findByName('Nonexistent');

      expect(result).toBeNull();
    });
  });
});
