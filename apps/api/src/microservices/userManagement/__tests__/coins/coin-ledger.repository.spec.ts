import { CoinLedgerRepository } from '../../coins/repositories/coin-ledger.repository';
import { CoinLedgerType } from '../../mongo/schemas/coin-ledger.schema';

describe('CoinLedgerRepository', () => {
  const mockModel = {
    create: jest.fn(),
    exists: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  let repo: CoinLedgerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CoinLedgerRepository(mockModel as never);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a ledger entry', async () => {
      const doc = {
        type: CoinLedgerType.RESERVE,
        teamId: 'team1',
        userId: 'user1',
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        periodKey: 'pk1',
        requestId: 'req-1',
        reservationId: 'res-1',
        estimatedCoins: 100,
      };
      mockModel.create.mockResolvedValue(doc);

      const result = await repo.create(doc);
      expect(mockModel.create).toHaveBeenCalledWith(doc);
      expect(result).toEqual(doc);
    });
  });

  // ── existsByEventId ────────────────────────────────────────────────────────

  describe('existsByEventId', () => {
    it('returns true when entry exists', async () => {
      mockModel.exists.mockResolvedValue({ _id: 'some-id' });

      const result = await repo.existsByEventId('evt-1');
      expect(mockModel.exists).toHaveBeenCalledWith({ eventId: 'evt-1' });
      expect(result).toBe(true);
    });

    it('returns false when entry does not exist', async () => {
      mockModel.exists.mockResolvedValue(null);

      const result = await repo.existsByEventId('evt-missing');
      expect(result).toBe(false);
    });
  });

  // ── findByReservationId ────────────────────────────────────────────────────

  describe('findByReservationId', () => {
    it('finds RESERVE entry by reservation ID', async () => {
      const entry = {
        reservationId: 'res-1',
        type: CoinLedgerType.RESERVE,
        teamId: 'team1',
      };
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(entry),
      });

      const result = await repo.findByReservationId('res-1');

      expect(mockModel.findOne).toHaveBeenCalledWith({
        reservationId: 'res-1',
        type: CoinLedgerType.RESERVE,
      });
      expect(result).toEqual(entry);
    });

    it('returns null when not found', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await repo.findByReservationId('res-missing');
      expect(result).toBeNull();
    });
  });

  // ── findAllByReservationId ─────────────────────────────────────────────────

  describe('findAllByReservationId', () => {
    it('returns all entries for a reservation', async () => {
      const entries = [
        { type: CoinLedgerType.RESERVE, reservationId: 'res-1' },
        { type: CoinLedgerType.ADJUST, reservationId: 'res-1' },
      ];
      mockModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(entries),
        }),
      });

      const result = await repo.findAllByReservationId('res-1');

      expect(mockModel.find).toHaveBeenCalledWith({ reservationId: 'res-1' });
      expect(result).toEqual(entries);
    });

    it('returns empty array when none found', async () => {
      mockModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await repo.findAllByReservationId('res-missing');
      expect(result).toEqual([]);
    });
  });

  // ── createRefillIfNotExists ────────────────────────────────────────────────

  describe('createRefillIfNotExists', () => {
    const refillArgs = {
      userId: 'system',
      eventId: 'refill:team1:pk1',
      teamId: 'team1',
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      requestId: 'refill:team1:pk1',
      reservationId: 'refill:team1:pk1',
      periodKey: 'pk1',
      allowance: 1000,
      debtApplied: 0,
      remainingAfter: 1000,
    };

    it('creates refill when event does not exist', async () => {
      mockModel.exists.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({});

      await repo.createRefillIfNotExists(refillArgs);

      expect(mockModel.exists).toHaveBeenCalledWith({
        eventId: 'refill:team1:pk1',
      });
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CoinLedgerType.REFILL,
          userId: 'system',
          teamId: 'team1',
        }),
      );
    });

    it('does not create duplicate when event already exists', async () => {
      mockModel.exists.mockResolvedValue({ _id: 'existing-id' });

      await repo.createRefillIfNotExists(refillArgs);

      expect(mockModel.create).not.toHaveBeenCalled();
    });
  });
});
