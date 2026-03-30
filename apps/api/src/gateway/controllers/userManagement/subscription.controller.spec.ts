import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { SubscriptionGatewayController } from './subscription.controller';

describe('SubscriptionGatewayController', () => {
  const userService = {
    send: jest.fn(),
  } as any;

  const claims = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Pitch User',
  };

  let controller: SubscriptionGatewayController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SubscriptionGatewayController(userService);
  });

  it('uses the requested accessible team id for getSubscriptionByTeamId', async () => {
    userService.send
      .mockReturnValueOnce(
        of([{ id: 'team-1', memberships: [{ isActive: true }] }]),
      )
      .mockReturnValueOnce(of({ id: 'sub-1', teamId: 'team-1' }));

    await expect(
      controller.getSubscriptionByTeamId('team-1', claims as any),
    ).resolves.toEqual({ id: 'sub-1', teamId: 'team-1' });

    expect(userService.send).toHaveBeenNthCalledWith(
      1,
      USER_SERVICE_PATTERNS.GET_USER_TEAMS,
      {
        userClaims: claims,
      },
    );
    expect(userService.send).toHaveBeenNthCalledWith(
      2,
      USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION,
      {
        teamId: 'team-1',
        userClaims: claims,
      },
    );
  });

  it('does not silently retarget an inaccessible requested team id', async () => {
    userService.send.mockReturnValueOnce(
      of([{ id: 'team-1', memberships: [{ isActive: true }] }]),
    );

    await expect(
      controller.getSubscriptionByTeamId('team-2', claims as any),
    ).rejects.toThrow(ForbiddenException);

    expect(userService.send).toHaveBeenCalledTimes(1);
  });

  it('provisions a personal workspace only when no team was requested and none exist', async () => {
    userService.send
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(
        of({
          id: 'user-1',
          email: 'user@example.com',
          name: 'Pitch User',
          settings: {},
        }),
      )
      .mockReturnValueOnce(of({ id: 'team-personal' }))
      .mockReturnValueOnce(of(undefined))
      .mockReturnValueOnce(of({ id: 'sub-1', teamId: 'team-personal' }));

    await expect(
      controller.createSubscription({ planId: 'plan-1' } as any, claims as any),
    ).resolves.toEqual({ id: 'sub-1', teamId: 'team-personal' });

    expect(userService.send).toHaveBeenLastCalledWith(
      USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION,
      {
        planId: 'plan-1',
        teamId: 'team-personal',
        userClaims: claims,
      },
    );
  });
});
