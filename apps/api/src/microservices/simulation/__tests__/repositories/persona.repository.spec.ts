import { PersonaRepository } from '../../repositories/persona.repository';

const mockPersona = {
  id: 'persona-1',
  orgId: 'org-1',
  name: 'Friendly Buyer',
  traits: { tone: 'friendly', budget: 'high' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrisma = {
  client: {
    persona: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
};

describe('PersonaRepository', () => {
  let repo: PersonaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PersonaRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe('findMany', () => {
    it('returns all personas when no filter is provided', async () => {
      mockPrisma.client.persona.findMany.mockResolvedValue([mockPersona]);

      const result = await repo.findMany();

      expect(result).toEqual([mockPersona]);
      expect(mockPrisma.client.persona.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: { name: 'asc' } }),
      );
    });

    it('applies orgId filter when provided', async () => {
      mockPrisma.client.persona.findMany.mockResolvedValue([mockPersona]);

      const result = await repo.findMany({ orgId: 'org-1' });

      expect(result).toEqual([mockPersona]);
      expect(mockPrisma.client.persona.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });

    it('returns empty array when no personas exist', async () => {
      mockPrisma.client.persona.findMany.mockResolvedValue([]);

      const result = await repo.findMany();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns persona when found', async () => {
      mockPrisma.client.persona.findUnique.mockResolvedValue(mockPersona);

      const result = await repo.findById('persona-1');

      expect(result).toEqual(mockPersona);
      expect(mockPrisma.client.persona.findUnique).toHaveBeenCalledWith({
        where: { id: 'persona-1' },
      });
    });

    it('returns null when persona not found', async () => {
      mockPrisma.client.persona.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findByOrgId
  // ---------------------------------------------------------------------------

  describe('findByOrgId', () => {
    it('returns personas for the given org ordered by name', async () => {
      const personas = [
        { ...mockPersona, id: 'p-1', name: 'Alpha' },
        { ...mockPersona, id: 'p-2', name: 'Beta' },
      ];
      mockPrisma.client.persona.findMany.mockResolvedValue(personas);

      const result = await repo.findByOrgId('org-1');

      expect(result).toEqual(personas);
      expect(mockPrisma.client.persona.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        orderBy: { name: 'asc' },
      });
    });

    it('returns empty array when org has no personas', async () => {
      mockPrisma.client.persona.findMany.mockResolvedValue([]);

      const result = await repo.findByOrgId('org-nobody');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a persona with name and traits', async () => {
      mockPrisma.client.persona.create.mockResolvedValue(mockPersona);

      const result = await repo.create({
        orgId: 'org-1',
        name: 'Friendly Buyer',
        traits: { tone: 'friendly' },
      });

      expect(result).toEqual(mockPersona);
      expect(mockPrisma.client.persona.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          name: 'Friendly Buyer',
          traits: { tone: 'friendly' },
        },
      });
    });

    it('creates a persona without traits', async () => {
      const minimal = { ...mockPersona, traits: undefined };
      mockPrisma.client.persona.create.mockResolvedValue(minimal);

      const result = await repo.create({ orgId: 'org-1', name: 'Minimal' });

      expect(result).toEqual(minimal);
      expect(mockPrisma.client.persona.create).toHaveBeenCalledWith({
        data: { orgId: 'org-1', name: 'Minimal', traits: undefined },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates persona name', async () => {
      const updated = { ...mockPersona, name: 'Updated Name' };
      mockPrisma.client.persona.update.mockResolvedValue(updated);

      const result = await repo.update('persona-1', { name: 'Updated Name' });

      expect(result).toEqual(updated);
      expect(mockPrisma.client.persona.update).toHaveBeenCalledWith({
        where: { id: 'persona-1' },
        data: { name: 'Updated Name' },
      });
    });

    it('updates persona traits', async () => {
      const updated = { ...mockPersona, traits: { tone: 'assertive' } };
      mockPrisma.client.persona.update.mockResolvedValue(updated);

      const result = await repo.update('persona-1', {
        traits: { tone: 'assertive' },
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.client.persona.update).toHaveBeenCalledWith({
        where: { id: 'persona-1' },
        data: { traits: { tone: 'assertive' } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes persona and returns the deleted record', async () => {
      mockPrisma.client.persona.delete.mockResolvedValue(mockPersona);

      const result = await repo.delete('persona-1');

      expect(result).toEqual(mockPersona);
      expect(mockPrisma.client.persona.delete).toHaveBeenCalledWith({
        where: { id: 'persona-1' },
      });
    });
  });
});
