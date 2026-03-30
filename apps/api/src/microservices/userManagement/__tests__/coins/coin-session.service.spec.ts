import { CoinSessionService } from '../../coins/services/coin-session.service';

describe('CoinSessionService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PERSONAL_COIN_COST_PER_SESSION') return 10;
      if (key === 'PERSONAL_COIN_PRICE_USD') return 0.1;
      return undefined;
    }),
  } as any;

  const coins = {
    reserveCoins: jest.fn(),
    reservePersonalCoins: jest.fn(),
  } as any;

  const subscriptionRepo = {
    findActiveWithPlanByTeamId: jest.fn(),
  } as any;

  const teamRepo = {
    findMembership: jest.fn(),
    findById: jest.fn(),
  } as any;

  let service: CoinSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoinSessionService(config, coins, subscriptionRepo, teamRepo);
  });

  it('falls back to personal credits when a shared team is out of credits', async () => {
    teamRepo.findMembership.mockResolvedValue({ isActive: true });
    teamRepo.findById.mockResolvedValue({
      id: 'team-1',
      memberships: [{ isActive: true }, { isActive: true }],
    });
    subscriptionRepo.findActiveWithPlanByTeamId.mockResolvedValue({
      id: 'sub-1',
      plan: { coinCostPerSession: 120, coinPriceUsd: 0.2 },
    });
    coins.reserveCoins.mockResolvedValue({
      approved: false,
      reason: 'INSUFFICIENT_COINS',
    });
    coins.reservePersonalCoins.mockResolvedValue({
      approved: true,
      reservationId: 'personal-reserve',
      periodKey: 'personal:user-1:2026-03',
      remainingAfter: 380,
    });

    const result = await service.reserveForSession({
      teamId: 'team-1',
      userId: 'user-1',
      sessionType: 'voice',
      requestId: 'request-1',
      idempotencyKey: 'idem-1',
      estimatedCoins: 120,
      coinPriceUsd: 0.2,
      sessionId: 'session-1',
    });

    expect(coins.reservePersonalCoins).toHaveBeenCalledWith({
      userId: 'user-1',
      requestId: 'request-1',
      idempotencyKey: 'idem-1',
      estimatedCoins: 120,
      sessionId: 'session-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        approved: true,
        reservationId: 'personal-reserve',
        estimatedCoins: 120,
        coinPriceUsd: 0.2,
      }),
    );
  });

  it('does not fall back to personal credits for a personal workspace team balance miss', async () => {
    teamRepo.findMembership.mockResolvedValue({ isActive: true });
    teamRepo.findById.mockResolvedValue({
      id: 'team-personal',
      memberships: [{ isActive: true }],
    });
    subscriptionRepo.findActiveWithPlanByTeamId.mockResolvedValue({
      id: 'sub-1',
      plan: { coinCostPerSession: 120, coinPriceUsd: 0.2 },
    });
    coins.reserveCoins.mockResolvedValue({
      approved: false,
      reason: 'INSUFFICIENT_COINS',
    });

    const result = await service.reserveForSession({
      teamId: 'team-personal',
      userId: 'user-1',
      sessionType: 'voice',
      requestId: 'request-1',
      idempotencyKey: 'idem-1',
      estimatedCoins: 120,
      coinPriceUsd: 0.2,
      sessionId: 'session-1',
    });

    expect(coins.reservePersonalCoins).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        approved: false,
        reason: 'INSUFFICIENT_COINS',
      }),
    );
  });
});
