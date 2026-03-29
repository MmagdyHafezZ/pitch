import { SessionMemberRepository } from '../../repositories/session-member.repository';
import type { CreateSessionMemberData } from '../../repositories/session-member.repository';

const mockMember = {
  id: 'member-1',
  sessionId: 'session-1',
  userId: 'user-1',
  role: 'owner' as const,
  userSnapshot: { name: 'Alice' },
  joinedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrisma = {
  client: {
    sessionMember: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
};

describe('SessionMemberRepository', () => {
  let repo: SessionMemberRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SessionMemberRepository(mockPrisma as never);
  });

  // ---------------------------------------------------------------------------
  // findBySessionId
  // ---------------------------------------------------------------------------

  describe('findBySessionId', () => {
    it('returns members ordered by joinedAt asc', async () => {
      mockPrisma.client.sessionMember.findMany.mockResolvedValue([mockMember]);

      const result = await repo.findBySessionId('session-1');

      expect(result).toEqual([mockMember]);
      expect(mockPrisma.client.sessionMember.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { joinedAt: 'asc' },
      });
    });

    it('returns empty array when session has no members', async () => {
      mockPrisma.client.sessionMember.findMany.mockResolvedValue([]);

      const result = await repo.findBySessionId('session-nobody');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findBySessionIdAndUserId
  // ---------------------------------------------------------------------------

  describe('findBySessionIdAndUserId', () => {
    it('returns member when found', async () => {
      mockPrisma.client.sessionMember.findUnique.mockResolvedValue(mockMember);

      const result = await repo.findBySessionIdAndUserId('session-1', 'user-1');

      expect(result).toEqual(mockMember);
      expect(mockPrisma.client.sessionMember.findUnique).toHaveBeenCalledWith({
        where: {
          sessionId_userId: { sessionId: 'session-1', userId: 'user-1' },
        },
      });
    });

    it('returns null when member not found', async () => {
      mockPrisma.client.sessionMember.findUnique.mockResolvedValue(null);

      const result = await repo.findBySessionIdAndUserId(
        'session-1',
        'user-nobody',
      );

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findOwner
  // ---------------------------------------------------------------------------

  describe('findOwner', () => {
    it('returns the owner member of a session', async () => {
      mockPrisma.client.sessionMember.findFirst.mockResolvedValue(mockMember);

      const result = await repo.findOwner('session-1');

      expect(result).toEqual(mockMember);
      expect(mockPrisma.client.sessionMember.findFirst).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', role: 'owner' },
      });
    });

    it('returns null when session has no owner', async () => {
      mockPrisma.client.sessionMember.findFirst.mockResolvedValue(null);

      const result = await repo.findOwner('session-orphan');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findNextOwner
  // ---------------------------------------------------------------------------

  describe('findNextOwner', () => {
    it('returns the next eligible member excluding the given user', async () => {
      const viewer = {
        ...mockMember,
        id: 'member-2',
        userId: 'user-2',
        role: 'viewer' as const,
      };
      mockPrisma.client.sessionMember.findFirst.mockResolvedValue(viewer);

      const result = await repo.findNextOwner('session-1', 'user-1');

      expect(result).toEqual(viewer);
      expect(mockPrisma.client.sessionMember.findFirst).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', NOT: { userId: 'user-1' } },
        orderBy: { joinedAt: 'asc' },
      });
    });

    it('returns null when no other member exists', async () => {
      mockPrisma.client.sessionMember.findFirst.mockResolvedValue(null);

      const result = await repo.findNextOwner('session-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a member with all provided fields', async () => {
      mockPrisma.client.sessionMember.create.mockResolvedValue(mockMember);

      const createData: CreateSessionMemberData = {
        sessionId: 'session-1',
        userId: 'user-1',
        role: 'owner',
        userSnapshot: { name: 'Alice' },
      };

      const result = await repo.create(createData);

      expect(result).toEqual(mockMember);
      expect(mockPrisma.client.sessionMember.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          userId: 'user-1',
          role: 'owner',
          userSnapshot: { name: 'Alice' },
        },
      });
    });

    it('defaults role to viewer when not provided', async () => {
      const viewerMember = { ...mockMember, role: 'viewer' as const };
      mockPrisma.client.sessionMember.create.mockResolvedValue(viewerMember);

      const result = await repo.create({
        sessionId: 'session-1',
        userId: 'user-2',
      });

      expect(result).toEqual(viewerMember);
      expect(mockPrisma.client.sessionMember.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          userId: 'user-2',
          role: 'viewer',
          userSnapshot: undefined,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createMany
  // ---------------------------------------------------------------------------

  describe('createMany', () => {
    it('returns count of 0 immediately when members array is empty', async () => {
      const result = await repo.createMany([]);

      expect(result).toEqual({ count: 0 });
      expect(mockPrisma.client.sessionMember.createMany).not.toHaveBeenCalled();
    });

    it('creates multiple members and returns the count', async () => {
      mockPrisma.client.sessionMember.createMany.mockResolvedValue({
        count: 2,
      });

      const members: CreateSessionMemberData[] = [
        { sessionId: 'session-1', userId: 'user-1', role: 'owner' },
        { sessionId: 'session-1', userId: 'user-2' },
      ];

      const result = await repo.createMany(members);

      expect(result).toEqual({ count: 2 });
      expect(mockPrisma.client.sessionMember.createMany).toHaveBeenCalledWith({
        data: [
          {
            sessionId: 'session-1',
            userId: 'user-1',
            role: 'owner',
            userSnapshot: undefined,
          },
          {
            sessionId: 'session-1',
            userId: 'user-2',
            role: 'viewer',
            userSnapshot: undefined,
          },
        ],
        skipDuplicates: true,
      });
    });

    it('defaults role to viewer for members without a role', async () => {
      mockPrisma.client.sessionMember.createMany.mockResolvedValue({
        count: 1,
      });

      await repo.createMany([{ sessionId: 'session-1', userId: 'user-2' }]);

      expect(mockPrisma.client.sessionMember.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ role: 'viewer' })],
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateRole
  // ---------------------------------------------------------------------------

  describe('updateRole', () => {
    it('updates the role of a member by id', async () => {
      const updated = { ...mockMember, role: 'viewer' as const };
      mockPrisma.client.sessionMember.update.mockResolvedValue(updated);

      const result = await repo.updateRole('member-1', 'viewer');

      expect(result).toEqual(updated);
      expect(mockPrisma.client.sessionMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { role: 'viewer' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteBySessionIdAndUserId
  // ---------------------------------------------------------------------------

  describe('deleteBySessionIdAndUserId', () => {
    it('deletes member by session and user composite key', async () => {
      mockPrisma.client.sessionMember.delete.mockResolvedValue(mockMember);

      await repo.deleteBySessionIdAndUserId('session-1', 'user-1');

      expect(mockPrisma.client.sessionMember.delete).toHaveBeenCalledWith({
        where: {
          sessionId_userId: { sessionId: 'session-1', userId: 'user-1' },
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // countBySessionId
  // ---------------------------------------------------------------------------

  describe('countBySessionId', () => {
    it('returns member count for a session', async () => {
      mockPrisma.client.sessionMember.count.mockResolvedValue(4);

      const result = await repo.countBySessionId('session-1');

      expect(result).toBe(4);
      expect(mockPrisma.client.sessionMember.count).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });
    });

    it('returns 0 when session has no members', async () => {
      mockPrisma.client.sessionMember.count.mockResolvedValue(0);

      const result = await repo.countBySessionId('session-empty');

      expect(result).toBe(0);
    });
  });
});
