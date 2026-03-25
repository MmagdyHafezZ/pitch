import { CoinsConsumer } from '../../coins/controllers/coins.consumer';

describe('CoinsConsumer', () => {
  const coinAccountingService = {
    reserveCoins: jest.fn(),
    applyAdjustment: jest.fn(),
  };

  let consumer: CoinsConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new CoinsConsumer(coinAccountingService as never);
  });

  describe('onReserve', () => {
    it('delegates to CoinAccountingService.reserveCoins', async () => {
      const dto = {
        teamId: 'team1',
        userId: 'user1',
        requestId: 'req-1',
        estimatedCoins: 50,
        idempotencyKey: 'idemp-1',
      };
      const expected = { approved: true, reservationId: 'res-1' };
      coinAccountingService.reserveCoins.mockResolvedValue(expected);

      const result = await consumer.onReserve(dto as never);

      expect(coinAccountingService.reserveCoins).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('returns denial response', async () => {
      const dto = {
        teamId: 'team1',
        userId: 'user1',
        requestId: 'req-1',
        estimatedCoins: 50,
        idempotencyKey: 'idemp-1',
      };
      const expected = {
        approved: false,
        reason: 'INSUFFICIENT_COINS',
      };
      coinAccountingService.reserveCoins.mockResolvedValue(expected);

      const result = await consumer.onReserve(dto as never);
      expect(result).toEqual(expected);
    });
  });

  describe('onAdjust', () => {
    it('delegates to CoinAccountingService.applyAdjustment', async () => {
      const event = {
        eventId: 'evt-1',
        reservationId: 'res-1',
        teamId: 'team1',
        periodKey: 'pk1',
        deltaCoins: -20,
        requestId: 'req-1',
      };
      coinAccountingService.applyAdjustment.mockResolvedValue(undefined);

      await consumer.onAdjust(event as never);

      expect(coinAccountingService.applyAdjustment).toHaveBeenCalledWith(event);
    });

    it('propagates errors from the service', async () => {
      coinAccountingService.applyAdjustment.mockRejectedValue(
        new Error('adjustment failed'),
      );

      await expect(
        consumer.onAdjust({
          eventId: 'evt-1',
          reservationId: 'res-1',
          teamId: 'team1',
          periodKey: 'pk1',
          deltaCoins: 0,
          requestId: 'req-1',
        } as never),
      ).rejects.toThrow('adjustment failed');
    });
  });
});
