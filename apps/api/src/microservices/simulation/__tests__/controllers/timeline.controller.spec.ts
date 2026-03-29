import { TimelineController } from '../../controllers/timeline.controller';
import { SimulationPrismaService } from '../../prisma/simulation-prisma.service';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((err: unknown) => err),
}));

import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';

const mockToRpcException = toRpcException as jest.MockedFunction<
  typeof toRpcException
>;

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makePrismaClient() {
  return {
    session: {
      findUnique: jest.fn(),
    },
    sessionMember: {
      findUnique: jest.fn(),
    },
    iteration: {
      findFirst: jest.fn(),
    },
    turn: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
}

function makePrisma() {
  const client = makePrismaClient();
  return {
    client,
  } as unknown as SimulationPrismaService;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_CLAIMS = { id: 'user-1', email: 'u@test.com', name: 'User' };

const MOCK_SESSION = {
  id: 'session-1',
  sessionConfig: {},
  scenario: { id: 'sc-1', config: {} },
};

const MOCK_MEMBER = {
  id: 'member-1',
  sessionId: 'session-1',
  userId: 'user-1',
};

const MOCK_ITERATION = {
  id: 'iter-1',
  iterationNumber: 1,
  sessionMemberId: 'member-1',
};

const MOCK_TURNS = [
  {
    id: 'turn-1',
    order: 1,
    role: 'user',
    text: 'Hello',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'turn-2',
    order: 2,
    role: 'assistant',
    text: 'Hi',
    createdAt: new Date('2024-01-01'),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimelineController', () => {
  let controller: TimelineController;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    controller = new TimelineController(prisma);
  });

  // -------------------------------------------------------------------------
  // getTimeline – authentication guard
  // -------------------------------------------------------------------------
  describe('getTimeline – authentication', () => {
    it('should throw when userClaims is absent', async () => {
      const payload = { sessionId: 'session-1' };
      await expect(controller.getTimeline(payload as any)).rejects.toThrow();
      expect(mockToRpcException).toHaveBeenCalled();
    });

    it('should throw when userClaims.id is falsy', async () => {
      const payload = {
        sessionId: 'session-1',
        userClaims: { email: 'u@test.com' },
      };
      await expect(controller.getTimeline(payload as any)).rejects.toThrow();
      expect(mockToRpcException).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – session not found
  // -------------------------------------------------------------------------
  describe('getTimeline – session not found', () => {
    it('should throw when session does not exist', async () => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(null);

      const payload = { sessionId: 'nonexistent', userClaims: USER_CLAIMS };
      await expect(controller.getTimeline(payload as any)).rejects.toThrow(
        /Session nonexistent not found/,
      );
      expect(mockToRpcException).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – user not a member
  // -------------------------------------------------------------------------
  describe('getTimeline – membership check', () => {
    it('should throw when user is not a member of the session', async () => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        MOCK_SESSION,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      await expect(controller.getTimeline(payload as any)).rejects.toThrow(
        /not a member/,
      );
      expect(mockToRpcException).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – no iteration yet (early return)
  // -------------------------------------------------------------------------
  describe('getTimeline – no iteration', () => {
    it('should return empty timeline when no iteration exists', async () => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        MOCK_SESSION,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(null);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result).toEqual({
        sessionId: 'session-1',
        plannedStages: [],
        currentProgress: 0,
        conversationHistory: [],
        total: 0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – happy path with turns
  // -------------------------------------------------------------------------
  describe('getTimeline – success', () => {
    beforeEach(() => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        MOCK_SESSION,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(
        MOCK_ITERATION,
      );
      (prisma.client.turn.findMany as jest.Mock).mockResolvedValue(MOCK_TURNS);
      (prisma.client.turn.count as jest.Mock).mockResolvedValue(2);
    });

    it('should return timeline with conversationHistory and planned stages', async () => {
      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.sessionId).toBe('session-1');
      expect(result.conversationHistory).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(Array.isArray(result.plannedStages)).toBe(true);
      expect(result.plannedStages.length).toBeGreaterThan(0);
    });

    it('should format turns with id, order, role, text, and ISO createdAt', async () => {
      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);
      const [firstTurn] = result.conversationHistory;

      expect(firstTurn).toEqual({
        id: 'turn-1',
        order: 1,
        role: 'user',
        text: 'Hello',
        createdAt: new Date('2024-01-01').toISOString(),
      });
    });

    it('should respect the limit parameter (clamped to 1-200)', async () => {
      const payload = {
        sessionId: 'session-1',
        userClaims: USER_CLAIMS,
        limit: 5,
      };
      await controller.getTimeline(payload as any);

      expect(prisma.client.turn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should clamp limit below 1 to 1', async () => {
      const payload = {
        sessionId: 'session-1',
        userClaims: USER_CLAIMS,
        limit: -10,
      };
      await controller.getTimeline(payload as any);

      expect(prisma.client.turn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('should clamp limit above 200 to 200', async () => {
      const payload = {
        sessionId: 'session-1',
        userClaims: USER_CLAIMS,
        limit: 999,
      };
      await controller.getTimeline(payload as any);

      expect(prisma.client.turn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('should default to limit=200 when not supplied', async () => {
      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      await controller.getTimeline(payload as any);

      expect(prisma.client.turn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('should calculate progress > 0 when turns exist', async () => {
      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.currentProgress).toBeGreaterThanOrEqual(1);
      expect(result.currentProgress).toBeLessThanOrEqual(100);
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – explicit stages in scenario config
  // -------------------------------------------------------------------------
  describe('getTimeline – scenario config stages', () => {
    it('should use stages array from scenario config when present', async () => {
      const sessionWithStages = {
        ...MOCK_SESSION,
        scenario: {
          id: 'sc-1',
          config: {
            stages: [
              { label: 'Intro', description: 'Opening' },
              { name: 'Discovery', description: 'Needs' },
              'Closing',
            ],
          },
        },
      };

      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        sessionWithStages,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(
        MOCK_ITERATION,
      );
      (prisma.client.turn.findMany as jest.Mock).mockResolvedValue(MOCK_TURNS);
      (prisma.client.turn.count as jest.Mock).mockResolvedValue(2);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.plannedStages).toHaveLength(3);
      expect(result.plannedStages[0].label).toBe('Intro');
      expect(result.plannedStages[1].label).toBe('Discovery');
      expect(result.plannedStages[2].label).toBe('Closing');
    });

    it('should use phases when stages is absent', async () => {
      const sessionWithPhases = {
        ...MOCK_SESSION,
        scenario: {
          id: 'sc-1',
          config: { phases: [{ label: 'Phase A' }, { title: 'Phase B' }] },
        },
      };

      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        sessionWithPhases,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(
        MOCK_ITERATION,
      );
      (prisma.client.turn.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.turn.count as jest.Mock).mockResolvedValue(0);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.plannedStages).toHaveLength(2);
      expect(result.plannedStages[0].label).toBe('Phase A');
      expect(result.plannedStages[1].label).toBe('Phase B');
    });

    it('should fall back to default 5 stages when no config stages provided', async () => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        MOCK_SESSION,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(
        MOCK_ITERATION,
      );
      (prisma.client.turn.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.turn.count as jest.Mock).mockResolvedValue(0);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.plannedStages).toHaveLength(5);
      expect(result.plannedStages[0].label).toBe('Introduction');
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – progress = 0 when no turns
  // -------------------------------------------------------------------------
  describe('getTimeline – progress calculation', () => {
    it('should return currentProgress = 0 when totalTurns is 0', async () => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        MOCK_SESSION,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(
        MOCK_ITERATION,
      );
      (prisma.client.turn.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.turn.count as jest.Mock).mockResolvedValue(0);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.currentProgress).toBe(0);
    });

    it('should cap currentProgress at 100', async () => {
      (prisma.client.session.findUnique as jest.Mock).mockResolvedValue(
        MOCK_SESSION,
      );
      (prisma.client.sessionMember.findUnique as jest.Mock).mockResolvedValue(
        MOCK_MEMBER,
      );
      (prisma.client.iteration.findFirst as jest.Mock).mockResolvedValue(
        MOCK_ITERATION,
      );
      (prisma.client.turn.findMany as jest.Mock).mockResolvedValue(MOCK_TURNS);
      // Very high turn count relative to estimated total
      (prisma.client.turn.count as jest.Mock).mockResolvedValue(9999);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      const result = await controller.getTimeline(payload as any);

      expect(result.currentProgress).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // getTimeline – prisma error propagation
  // -------------------------------------------------------------------------
  describe('getTimeline – error propagation', () => {
    it('should wrap prisma errors with toRpcException', async () => {
      const error = new Error('DB connection lost');
      (prisma.client.session.findUnique as jest.Mock).mockRejectedValue(error);

      const payload = { sessionId: 'session-1', userClaims: USER_CLAIMS };
      await expect(controller.getTimeline(payload as any)).rejects.toThrow(
        error,
      );
      expect(mockToRpcException).toHaveBeenCalledWith(error);
    });
  });
});
