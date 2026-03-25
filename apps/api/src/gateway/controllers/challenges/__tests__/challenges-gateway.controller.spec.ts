import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ChallengesGatewayController } from '../challenges-gateway.controller';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const userClaims = { id: 'u1', email: 'u@x.com', name: 'User' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ChallengesGatewayController', () => {
  // ── triggerGenerate ───────────────────────────────────────────────────────

  describe('triggerGenerate()', () => {
    it('sends CHALLENGE_TRIGGER_GENERATE and returns the result', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ triggered: true }));
      const ctrl = new ChallengesGatewayController(client);

      const result = await lastValueFrom(
        ctrl.triggerGenerate({ period: 'DAILY' }, userClaims),
      );

      expect(result).toEqual({ triggered: true });
      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        { period: 'DAILY', userClaims },
      );
    });

    it('defaults period to "DAILY" when not provided', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ triggered: true }));
      const ctrl = new ChallengesGatewayController(client);

      await lastValueFrom(
        ctrl.triggerGenerate({ period: undefined as any }, userClaims),
      );

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_TRIGGER_GENERATE,
        expect.objectContaining({ period: 'DAILY' }),
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(ctrl.triggerGenerate({ period: 'WEEKLY' }, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── listChallenges ────────────────────────────────────────────────────────

  describe('listChallenges()', () => {
    it('sends CHALLENGE_LIST with query params and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ items: [] }));
      const ctrl = new ChallengesGatewayController(client);

      const query = { period: 'WEEKLY', limit: '10' };
      await lastValueFrom(ctrl.listChallenges(query, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_LIST,
        { ...query, userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(ctrl.listChallenges({}, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── globalLeaderboard ─────────────────────────────────────────────────────

  describe('globalLeaderboard()', () => {
    it('sends CHALLENGE_LEADERBOARD with numeric limit when provided', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([{ userId: 'u1', score: 100 }]));
      const ctrl = new ChallengesGatewayController(client);

      await lastValueFrom(ctrl.globalLeaderboard('5', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD,
        { limit: 5, userClaims },
      );
    });

    it('defaults limit to 20 when not provided', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([]));
      const ctrl = new ChallengesGatewayController(client);

      await lastValueFrom(ctrl.globalLeaderboard(undefined, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD,
        { limit: 20, userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(ctrl.globalLeaderboard(undefined, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getChallenge ──────────────────────────────────────────────────────────

  describe('getChallenge()', () => {
    it('sends CHALLENGE_GET with id and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'ch-1' }));
      const ctrl = new ChallengesGatewayController(client);

      const result = await lastValueFrom(ctrl.getChallenge('ch-1', userClaims));

      expect(result).toEqual({ id: 'ch-1' });
      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_GET,
        { id: 'ch-1', userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(
        throwError(() => ({ status: 404, message: 'Not found' })),
      );
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getChallenge('missing', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── participate ───────────────────────────────────────────────────────────

  describe('participate()', () => {
    it('sends CHALLENGE_PARTICIPATE with challengeId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ joined: true }));
      const ctrl = new ChallengesGatewayController(client);

      const result = await lastValueFrom(ctrl.participate('ch-2', userClaims));

      expect(result).toEqual({ joined: true });
      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_PARTICIPATE,
        { challengeId: 'ch-2', userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(ctrl.participate('ch-2', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── submitScore ───────────────────────────────────────────────────────────

  describe('submitScore()', () => {
    it('sends CHALLENGE_SUBMIT_SCORE with correct payload', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ recorded: true }));
      const ctrl = new ChallengesGatewayController(client);

      await lastValueFrom(
        ctrl.submitScore(
          'ch-3',
          { sessionId: 'sess-1', score: 95 },
          userClaims,
        ),
      );

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_SUBMIT_SCORE,
        { challengeId: 'ch-3', sessionId: 'sess-1', score: 95, userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(
          ctrl.submitScore('ch-3', { sessionId: 's', score: 0 }, userClaims),
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── challengeLeaderboard ──────────────────────────────────────────────────

  describe('challengeLeaderboard()', () => {
    it('sends CHALLENGE_LEADERBOARD with challengeId and numeric limit', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([]));
      const ctrl = new ChallengesGatewayController(client);

      await lastValueFrom(ctrl.challengeLeaderboard('ch-4', '5', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD,
        { challengeId: 'ch-4', limit: 5, userClaims },
      );
    });

    it('defaults limit to 10 when not provided', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([]));
      const ctrl = new ChallengesGatewayController(client);

      await lastValueFrom(
        ctrl.challengeLeaderboard('ch-4', undefined, userClaims),
      );

      expect(client.send).toHaveBeenCalledWith(
        SIMULATION_SERVICE_PATTERNS.CHALLENGE_LEADERBOARD,
        { challengeId: 'ch-4', limit: 10, userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new ChallengesGatewayController(client);

      await expect(
        lastValueFrom(ctrl.challengeLeaderboard('ch-4', undefined, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });
});
