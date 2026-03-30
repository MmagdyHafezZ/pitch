import { ForbiddenException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { CreateSubscriptionRequestDTO } from '@microservices/userManagement/subscription/dto/subscription.dto';
import { SubscriptionGatewayController } from './subscription.controller';

describe('SubscriptionGatewayController', () => {
  const sendMock = jest.fn();
  const userService = {
    send: sendMock,
  } as Pick<ClientProxy, 'send'> as ClientProxy;

  const claims: UserClaimsType = {
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
    sendMock
      .mockReturnValueOnce(
        of([{ id: 'team-1', memberships: [{ isActive: true }] }]),
      )
      .mockReturnValueOnce(of({ id: 'sub-1', teamId: 'team-1' }));

    await expect(
      controller.getSubscriptionByTeamId('team-1', claims),
    ).resolves.toEqual({ id: 'sub-1', teamId: 'team-1' });

    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      USER_SERVICE_PATTERNS.GET_USER_TEAMS,
      {
        userClaims: claims,
      },
    );
    expect(sendMock).toHaveBeenNthCalledWith(
      2,
      USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION,
      {
        teamId: 'team-1',
        userClaims: claims,
      },
    );
  });

  it('does not silently retarget an inaccessible requested team id', async () => {
    sendMock.mockReturnValueOnce(
      of([{ id: 'team-1', memberships: [{ isActive: true }] }]),
    );

    await expect(
      controller.getSubscriptionByTeamId('team-2', claims),
    ).rejects.toThrow(ForbiddenException);

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('provisions a personal workspace only when no team was requested and none exist', async () => {
    sendMock
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

    const createSubscriptionDto = Object.assign(
      new CreateSubscriptionRequestDTO(),
      { planId: 'plan-1' },
    );

    await expect(
      controller.createSubscription(createSubscriptionDto, claims),
    ).resolves.toEqual({ id: 'sub-1', teamId: 'team-personal' });

    expect(sendMock).toHaveBeenLastCalledWith(
      USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION,
      {
        planId: 'plan-1',
        teamId: 'team-personal',
        userClaims: claims,
      },
    );
  });
});
