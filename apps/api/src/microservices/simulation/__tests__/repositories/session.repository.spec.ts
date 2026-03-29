import { SessionRepository } from '../../repositories/session.repository';
import type {
  CreateSessionData,
  UpdateSessionData,
  SessionListFilters,
} from '../../repositories/session.repository';

const mockSession = {
  id: 'session-1',
  orgId: 'org-1',
  name: 'Test Session',
  type: 'solo',
  status: 'active',
  tags: [],
  scenarioId: 'scenario-1',
  personaId: 'persona-1',
  language: 'en',
  crmContextId: null,
  sessionConfig: null,
  orgSnapshot: null,
  endedReason: null,
  endedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  scenario: null,
  persona: null,
  members: [
    { id: 'member-1', userId: 'user-1', role: 'owner', sessionId: 'session-1' },
  ],
};

const mockPrisma = {
  client: {
    session: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
};

describe('SessionRepository', () => {
  let repo: SessionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SessionRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe('findMany', () => {
    it('returns sessions and total with no filters', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([mockSession]);
      mockPrisma.client.session.count.mockResolvedValue(1);

      const result = await repo.findMany();

      expect(result).toEqual({ sessions: [mockSession], total: 1 });
      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('applies userId filter via members.some', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({ userId: 'user-1' });

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: 'user-1' } } },
        }),
      );
    });

    it('applies orgId filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({ orgId: 'org-1' });

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });

    it('applies type filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({ type: 'solo' as any });

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'solo' } }),
      );
    });

    it('applies status filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({ status: 'ended' });

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ended' } }),
      );
    });

    it('applies scenarioId filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({ scenarioId: 'scenario-1' });

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { scenarioId: 'scenario-1' } }),
      );
    });

    it('applies personaId filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({ personaId: 'persona-1' });

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { personaId: 'persona-1' } }),
      );
    });

    it('respects custom limit and offset', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.findMany({}, 5, 20);

      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 5 }),
      );
    });

    it('returns empty sessions and zero total when none found', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      const result = await repo.findMany();

      expect(result).toEqual({ sessions: [], total: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns session when found', async () => {
      mockPrisma.client.session.findUnique.mockResolvedValue(mockSession);

      const result = await repo.findById('session-1');

      expect(result).toEqual(mockSession);
      expect(mockPrisma.client.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' } }),
      );
    });

    it('returns null when session not found', async () => {
      mockPrisma.client.session.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findByUserId
  // ---------------------------------------------------------------------------

  describe('findByUserId', () => {
    it('delegates to findMany with userId filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([mockSession]);
      mockPrisma.client.session.count.mockResolvedValue(1);

      const result = await repo.findByUserId('user-1', 5, 10);

      expect(result).toEqual({ sessions: [mockSession], total: 1 });
      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: 'user-1' } } },
          skip: 10,
          take: 5,
        }),
      );
    });

    it('returns empty results when user has no sessions', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      const result = await repo.findByUserId('user-nobody');

      expect(result).toEqual({ sessions: [], total: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // findByOrgId
  // ---------------------------------------------------------------------------

  describe('findByOrgId', () => {
    it('delegates to findMany with orgId filter', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([mockSession]);
      mockPrisma.client.session.count.mockResolvedValue(1);

      const result = await repo.findByOrgId('org-1', 15, 5);

      expect(result).toEqual({ sessions: [mockSession], total: 1 });
      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-1' },
          skip: 5,
          take: 15,
        }),
      );
    });

    it('returns empty results when org has no sessions', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);
      mockPrisma.client.session.count.mockResolvedValue(0);

      const result = await repo.findByOrgId('org-nobody');

      expect(result).toEqual({ sessions: [], total: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    const createData: CreateSessionData = {
      ownerUserId: 'user-1',
      orgId: 'org-1',
      name: 'Test Session',
      type: 'solo' as any,
      tags: ['tag1'],
      sessionConfig: { key: 'value' },
      scenarioId: 'scenario-1',
      personaId: 'persona-1',
      language: 'en',
      crmContextId: 'crm-1',
      ownerSnapshot: { name: 'Owner' },
      orgSnapshot: { name: 'Org' },
    };

    it('creates a session with all provided fields', async () => {
      mockPrisma.client.session.create.mockResolvedValue(mockSession);

      const result = await repo.create(createData);

      expect(result).toEqual(mockSession);
      expect(mockPrisma.client.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org-1',
            name: 'Test Session',
            type: 'solo',
            tags: ['tag1'],
            scenarioId: 'scenario-1',
            personaId: 'persona-1',
            language: 'en',
            crmContextId: 'crm-1',
            members: {
              create: {
                userId: 'user-1',
                role: 'owner',
                userSnapshot: { name: 'Owner' },
              },
            },
          }),
        }),
      );
    });

    it('defaults tags to empty array when not provided', async () => {
      mockPrisma.client.session.create.mockResolvedValue(mockSession);

      await repo.create({
        ownerUserId: 'user-1',
        orgId: 'org-1',
        type: 'solo' as any,
      });

      expect(mockPrisma.client.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: [] }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    const updateData: UpdateSessionData = {
      name: 'Updated Session',
      status: 'ended',
      type: 'solo' as any,
    };

    it('updates session with given data', async () => {
      const updated = { ...mockSession, name: 'Updated Session' };
      mockPrisma.client.session.update.mockResolvedValue(updated);

      const result = await repo.update('session-1', updateData);

      expect(result).toEqual(updated);
      expect(mockPrisma.client.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' } }),
      );
    });

    it('passes undefined type as-is when not in data', async () => {
      mockPrisma.client.session.update.mockResolvedValue(mockSession);

      await repo.update('session-1', { name: 'New name' });

      expect(mockPrisma.client.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New name' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // end
  // ---------------------------------------------------------------------------

  describe('end', () => {
    it('sets status to ended with reason and endedAt timestamp', async () => {
      const ended = {
        ...mockSession,
        status: 'ended',
        endedReason: 'user_left',
      };
      mockPrisma.client.session.update.mockResolvedValue(ended);

      const result = await repo.end('session-1', 'user_left');

      expect(result).toEqual(ended);
      expect(mockPrisma.client.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'ended',
            endedReason: 'user_left',
            endedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('ends session without a reason', async () => {
      mockPrisma.client.session.update.mockResolvedValue(mockSession);

      await repo.end('session-1');

      expect(mockPrisma.client.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ended',
            endedReason: undefined,
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes session by id', async () => {
      mockPrisma.client.session.delete.mockResolvedValue(mockSession);

      await repo.delete('session-1');

      expect(mockPrisma.client.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // count
  // ---------------------------------------------------------------------------

  describe('count', () => {
    it('counts all sessions with no filters', async () => {
      mockPrisma.client.session.count.mockResolvedValue(42);

      const result = await repo.count();

      expect(result).toBe(42);
      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('applies userId filter', async () => {
      mockPrisma.client.session.count.mockResolvedValue(5);

      await repo.count({ userId: 'user-1' });

      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: { members: { some: { userId: 'user-1' } } },
      });
    });

    it('applies orgId filter', async () => {
      mockPrisma.client.session.count.mockResolvedValue(3);

      await repo.count({ orgId: 'org-1' });

      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
      });
    });

    it('applies type filter', async () => {
      mockPrisma.client.session.count.mockResolvedValue(2);

      await repo.count({ type: 'solo' as any });

      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: { type: 'solo' },
      });
    });

    it('applies status filter', async () => {
      mockPrisma.client.session.count.mockResolvedValue(1);

      await repo.count({ status: 'active' });

      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: { status: 'active' },
      });
    });

    it('applies scenarioId filter', async () => {
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.count({ scenarioId: 'scenario-1' });

      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: { scenarioId: 'scenario-1' },
      });
    });

    it('applies personaId filter', async () => {
      mockPrisma.client.session.count.mockResolvedValue(0);

      await repo.count({ personaId: 'persona-1' });

      expect(mockPrisma.client.session.count).toHaveBeenCalledWith({
        where: { personaId: 'persona-1' },
      });
    });

    it('returns zero when no sessions match', async () => {
      mockPrisma.client.session.count.mockResolvedValue(0);

      const result = await repo.count({ orgId: 'nonexistent' });

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveByUserId
  // ---------------------------------------------------------------------------

  describe('findActiveByUserId', () => {
    it('returns active sessions for user', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([mockSession]);

      const result = await repo.findActiveByUserId('user-1');

      expect(result).toEqual([mockSession]);
      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: { some: { userId: 'user-1' } },
            status: 'active',
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('returns empty array when user has no active sessions', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);

      const result = await repo.findActiveByUserId('user-nobody');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveByOrgId
  // ---------------------------------------------------------------------------

  describe('findActiveByOrgId', () => {
    it('returns active sessions for org', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([mockSession]);

      const result = await repo.findActiveByOrgId('org-1');

      expect(result).toEqual([mockSession]);
      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-1', status: 'active' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('returns empty array when org has no active sessions', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([]);

      const result = await repo.findActiveByOrgId('org-nobody');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findByIds
  // ---------------------------------------------------------------------------

  describe('findByIds', () => {
    it('returns sessions matching given ids', async () => {
      mockPrisma.client.session.findMany.mockResolvedValue([mockSession]);

      const result = await repo.findByIds(['session-1', 'session-2']);

      expect(result).toEqual([mockSession]);
      expect(mockPrisma.client.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['session-1', 'session-2'] } },
        }),
      );
    });

    it('returns empty array immediately when ids array is empty', async () => {
      const result = await repo.findByIds([]);

      expect(result).toEqual([]);
      expect(mockPrisma.client.session.findMany).not.toHaveBeenCalled();
    });
  });
});
