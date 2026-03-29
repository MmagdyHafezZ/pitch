import { CoinBalanceRepository } from '../../coins/repositories/coin-balance.repository';

describe('CoinBalanceRepository', () => {
  const mockModel = {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  let repo: CoinBalanceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CoinBalanceRepository(mockModel as never);
  });

  // ── findByTeamAndPeriodKey ─────────────────────────────────────────────────

  describe('findByTeamAndPeriodKey', () => {
    it('queries by teamId and periodKey', async () => {
      const doc = { teamId: 'team1', periodKey: 'pk1', remaining: 500 };
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(doc),
      });

      const result = await repo.findByTeamAndPeriodKey('team1', 'pk1');

      expect(mockModel.findOne).toHaveBeenCalledWith({
        teamId: 'team1',
        periodKey: 'pk1',
      });
      expect(result).toEqual(doc);
    });

    it('returns null when not found', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await repo.findByTeamAndPeriodKey('team1', 'pk1');
      expect(result).toBeNull();
    });
  });

  // ── getRemaining ───────────────────────────────────────────────────────────

  describe('getRemaining', () => {
    it('returns numeric remaining when document exists', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ remaining: 300 }),
      });

      const result = await repo.getRemaining('team1', 'pk1');
      expect(result).toBe(300);
    });

    it('returns null when document not found', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await repo.getRemaining('team1', 'pk1');
      expect(result).toBeNull();
    });

    it('returns null when remaining is undefined', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({}),
      });

      const result = await repo.getRemaining('team1', 'pk1');
      expect(result).toBeNull();
    });

    it('returns null when remaining is null', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ remaining: null }),
      });

      const result = await repo.getRemaining('team1', 'pk1');
      expect(result).toBeNull();
    });

    it('converts string remaining to number', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ remaining: '750' }),
      });

      const result = await repo.getRemaining('team1', 'pk1');
      expect(result).toBe(750);
    });

    it('returns 0 when remaining is 0', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ remaining: 0 }),
      });

      const result = await repo.getRemaining('team1', 'pk1');
      expect(result).toBe(0);
    });
  });

  // ── upsertReserve ──────────────────────────────────────────────────────────

  describe('upsertReserve', () => {
    it('calls updateOne with upsert and $set/$inc', async () => {
      mockModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await repo.upsertReserve({
        teamId: 'team1',
        subscriptionId: 'sub-1',
        periodKey: 'pk1',
        allowance: 1000,
        estimatedCoins: 100,
        remainingAfter: 900,
        reservationId: 'res-1',
        requestId: 'req-1',
      });

      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { teamId: 'team1', periodKey: 'pk1' },
        {
          $set: expect.objectContaining({
            remaining: 900,
            lastReservationId: 'res-1',
          }),
          $inc: { reserved: 100 },
        },
        { upsert: true },
      );
    });
  });

  // ── upsertAdjust ───────────────────────────────────────────────────────────

  describe('upsertAdjust', () => {
    it('calls updateOne with aggregation pipeline', async () => {
      mockModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await repo.upsertAdjust({
        teamId: 'team1',
        periodKey: 'pk1',
        remainingAfter: 920,
        eventId: 'evt-1',
        reservationId: 'res-1',
        requestId: 'req-1',
        estimatedCoins: 100,
        deltaCoins: -20,
      });

      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { teamId: 'team1', periodKey: 'pk1' },
        expect.arrayContaining([
          expect.objectContaining({
            $set: expect.objectContaining({
              remaining: 920,
              lastEventId: 'evt-1',
            }),
          }),
        ]),
        { upsert: true },
      );
    });
  });

  // ── upsertRefill ───────────────────────────────────────────────────────────

  describe('upsertRefill', () => {
    it('calls updateOne with $set and upsert', async () => {
      mockModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await repo.upsertRefill({
        teamId: 'team1',
        subscriptionId: 'sub-1',
        periodKey: 'pk1',
        allowance: 1000,
        remainingAfter: 950,
        debtApplied: 50,
        eventId: 'evt-refill',
      });

      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { teamId: 'team1', periodKey: 'pk1' },
        {
          $set: expect.objectContaining({
            allowance: 1000,
            remaining: 950,
            lastEventId: 'evt-refill',
          }),
        },
        { upsert: true },
      );
    });
  });
});
