import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { SubscriptionGatewayController } from '../subscription.controller';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const userClaims = { id: 'u1', email: 'u@x.com', name: 'User' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SubscriptionGatewayController', () => {
  // ── createSubscription ────────────────────────────────────────────────────

  describe('createSubscription()', () => {
    it('sends CREATE_SUBSCRIPTION with dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'sub-1' }));
      const ctrl = new SubscriptionGatewayController(client);

      const dto = { planId: 'plan-1' } as any;
      const result = await lastValueFrom(
        ctrl.createSubscription(dto, userClaims),
      );

      expect(result).toEqual({ id: 'sub-1' });
      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION,
        {
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.createSubscription({} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── updateSubscription ────────────────────────────────────────────────────

  describe('updateSubscription()', () => {
    it('sends UPDATE_SUBSCRIPTION with id, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'sub-1', updated: true }));
      const ctrl = new SubscriptionGatewayController(client);

      const dto = { status: 'ACTIVE' } as any;
      await lastValueFrom(ctrl.updateSubscription('sub-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.UPDATE_SUBSCRIPTION,
        {
          id: 'sub-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.updateSubscription('sub-1', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── upgradeSubscription ───────────────────────────────────────────────────

  describe('upgradeSubscription()', () => {
    it('sends UPGRADE_SUBSCRIPTION with id, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'sub-1', upgraded: true }));
      const ctrl = new SubscriptionGatewayController(client);

      const dto = { newPlanId: 'plan-premium' } as any;
      await lastValueFrom(ctrl.upgradeSubscription('sub-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.UPGRADE_SUBSCRIPTION,
        {
          id: 'sub-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.upgradeSubscription('sub-1', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── deleteSubscription ────────────────────────────────────────────────────

  describe('deleteSubscription()', () => {
    it('sends DELETE_SUBSCRIPTION with id and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ deleted: true }));
      const ctrl = new SubscriptionGatewayController(client);

      await lastValueFrom(ctrl.deleteSubscription('sub-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.DELETE_SUBSCRIPTION,
        {
          id: 'sub-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.deleteSubscription('sub-1', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getSubscriptions ──────────────────────────────────────────────────────

  describe('getSubscriptions()', () => {
    it('sends GET_SUBSCRIPTIONS with userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([{ id: 'sub-1' }]));
      const ctrl = new SubscriptionGatewayController(client);

      const result = await lastValueFrom(ctrl.getSubscriptions(userClaims));

      expect(result).toEqual([{ id: 'sub-1' }]);
      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS,
        {
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getSubscriptions(userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getSubscriptionById ───────────────────────────────────────────────────

  describe('getSubscriptionById()', () => {
    it('sends GET_SUBSCRIPTION with id and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'sub-1' }));
      const ctrl = new SubscriptionGatewayController(client);

      await lastValueFrom(ctrl.getSubscriptionById('sub-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_SUBSCRIPTION,
        {
          id: 'sub-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getSubscriptionById('missing', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getSubscriptionByTeamId ───────────────────────────────────────────────

  describe('getSubscriptionByTeamId()', () => {
    it('sends GET_TEAM_SUBSCRIPTION with teamId and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'sub-t1', teamId: 'team-1' }));
      const ctrl = new SubscriptionGatewayController(client);

      await lastValueFrom(ctrl.getSubscriptionByTeamId('team-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION,
        {
          teamId: 'team-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new SubscriptionGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getSubscriptionByTeamId('missing', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });
});
