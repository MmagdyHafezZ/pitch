import { ScenarioRepository } from '../../repositories/scenario.repository';

const mockScenario = {
  id: 'scenario-1',
  orgId: 'org-1',
  name: 'Cold Call',
  description: 'A cold call scenario',
  config: { difficulty: 'medium' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrisma = {
  client: {
    scenario: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
};

describe('ScenarioRepository', () => {
  let repo: ScenarioRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ScenarioRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe('findMany', () => {
    it('returns all scenarios when no filter is provided', async () => {
      mockPrisma.client.scenario.findMany.mockResolvedValue([mockScenario]);

      const result = await repo.findMany();

      expect(result).toEqual([mockScenario]);
      expect(mockPrisma.client.scenario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('applies orgId filter when provided', async () => {
      mockPrisma.client.scenario.findMany.mockResolvedValue([mockScenario]);

      const result = await repo.findMany({ orgId: 'org-1' });

      expect(result).toEqual([mockScenario]);
      expect(mockPrisma.client.scenario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });

    it('returns empty array when no scenarios match', async () => {
      mockPrisma.client.scenario.findMany.mockResolvedValue([]);

      const result = await repo.findMany({ orgId: 'org-nobody' });

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns scenario when found', async () => {
      mockPrisma.client.scenario.findUnique.mockResolvedValue(mockScenario);

      const result = await repo.findById('scenario-1');

      expect(result).toEqual(mockScenario);
      expect(mockPrisma.client.scenario.findUnique).toHaveBeenCalledWith({
        where: { id: 'scenario-1' },
      });
    });

    it('returns null when scenario not found', async () => {
      mockPrisma.client.scenario.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a scenario with all fields', async () => {
      mockPrisma.client.scenario.create.mockResolvedValue(mockScenario);

      const result = await repo.create({
        orgId: 'org-1',
        name: 'Cold Call',
        description: 'A cold call scenario',
        config: { difficulty: 'medium' },
      });

      expect(result).toEqual(mockScenario);
      expect(mockPrisma.client.scenario.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          name: 'Cold Call',
          description: 'A cold call scenario',
          config: { difficulty: 'medium' },
        },
      });
    });

    it('creates a scenario without optional description and config', async () => {
      const minimal = {
        ...mockScenario,
        description: undefined,
        config: undefined,
      };
      mockPrisma.client.scenario.create.mockResolvedValue(minimal);

      const result = await repo.create({ orgId: 'org-1', name: 'Minimal' });

      expect(result).toEqual(minimal);
      expect(mockPrisma.client.scenario.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          name: 'Minimal',
          description: undefined,
          config: undefined,
        },
      });
    });

    it('converts null description to undefined', async () => {
      mockPrisma.client.scenario.create.mockResolvedValue(mockScenario);

      await repo.create({
        orgId: 'org-1',
        name: 'Null Desc',
        description: null,
      });

      expect(mockPrisma.client.scenario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: undefined }),
      });
    });

    it('converts null config to undefined', async () => {
      mockPrisma.client.scenario.create.mockResolvedValue(mockScenario);

      await repo.create({ orgId: 'org-1', name: 'Null Config', config: null });

      expect(mockPrisma.client.scenario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ config: undefined }),
      });
    });
  });
});
