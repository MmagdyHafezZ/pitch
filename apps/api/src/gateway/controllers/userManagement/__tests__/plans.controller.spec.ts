import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { PlanGatewayController } from '../plans.controller';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const userClaims = { id: 'u1', email: 'u@x.com', name: 'User' };

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PlanGatewayController', () => {
  // ── createPlan ────────────────────────────────────────────────────────────

  describe('createPlan()', () => {
    it('sends CREATE_PLAN with dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'plan-1' }));
      const ctrl = new PlanGatewayController(client);

      const dto = { name: 'Starter', price: 9.99 } as any;
      const result = await lastValueFrom(ctrl.createPlan(dto, userClaims));

      expect(result).toEqual({ id: 'plan-1' });
      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.CREATE_PLAN,
        {
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new PlanGatewayController(client);

      await expect(
        lastValueFrom(ctrl.createPlan({} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── updatePlan ────────────────────────────────────────────────────────────

  describe('updatePlan()', () => {
    it('sends UPDATE_PLAN with id, dto and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'plan-1', updated: true }));
      const ctrl = new PlanGatewayController(client);

      const dto = { name: 'Pro' } as any;
      await lastValueFrom(ctrl.updatePlan('plan-1', dto, userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.UPDATE_PLAN,
        {
          id: 'plan-1',
          ...dto,
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(
        throwError(() => ({ status: 404, message: 'Not found' })),
      );
      const ctrl = new PlanGatewayController(client);

      await expect(
        lastValueFrom(ctrl.updatePlan('missing', {} as any, userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── deletePlan ────────────────────────────────────────────────────────────

  describe('deletePlan()', () => {
    it('sends DELETE_PLAN with id and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ deleted: true }));
      const ctrl = new PlanGatewayController(client);

      await lastValueFrom(ctrl.deletePlan('plan-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.DELETE_PLAN,
        {
          id: 'plan-1',
          userClaims,
        },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new PlanGatewayController(client);

      await expect(
        lastValueFrom(ctrl.deletePlan('p', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getPlans ──────────────────────────────────────────────────────────────

  describe('getPlans()', () => {
    it('sends GET_PLANS with userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of([{ id: 'plan-1' }]));
      const ctrl = new PlanGatewayController(client);

      const result = await lastValueFrom(ctrl.getPlans(userClaims));

      expect(result).toEqual([{ id: 'plan-1' }]);
      expect(client.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_PLANS,
        { userClaims },
      );
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(throwError(() => new Error('fail')));
      const ctrl = new PlanGatewayController(client);

      await expect(lastValueFrom(ctrl.getPlans(userClaims))).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── getPlanById ───────────────────────────────────────────────────────────

  describe('getPlanById()', () => {
    it('sends GET_PLAN with id and userClaims', async () => {
      const client = makeClient();
      client.send.mockReturnValue(of({ id: 'plan-1' }));
      const ctrl = new PlanGatewayController(client);

      await lastValueFrom(ctrl.getPlanById('plan-1', userClaims));

      expect(client.send).toHaveBeenCalledWith(USER_SERVICE_PATTERNS.GET_PLAN, {
        id: 'plan-1',
        userClaims,
      });
    });

    it('maps errors to HttpException', async () => {
      const client = makeClient();
      client.send.mockReturnValue(
        throwError(() => ({ status: 404, message: 'Not found' })),
      );
      const ctrl = new PlanGatewayController(client);

      await expect(
        lastValueFrom(ctrl.getPlanById('missing', userClaims)),
      ).rejects.toThrow(HttpException);
    });
  });
});
