/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { AuthGatewayController } from './auth-gateway.controller';

describe('AuthGatewayController', () => {
  let controller: AuthGatewayController;
  let userService: jest.Mocked<ClientProxy>;

  const originalEnv = { ...process.env };

  const userClaims: UserClaims = {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
  };

  beforeEach(() => {
    userService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new AuthGatewayController(userService);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('marks login responses as system admin for configured admin emails', async () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com';
    const res = {
      cookie: jest.fn(),
    };

    userService.send.mockReturnValue(
      of({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'admin@example.com',
          name: 'Admin',
          isActive: true,
          createdAt: new Date('2026-03-23T00:00:00.000Z'),
          updatedAt: new Date('2026-03-23T00:00:00.000Z'),
        },
      }) as never,
    );

    const result = await lastValueFrom(
      controller.login({ email: 'admin@example.com' } as never, res as never),
    );

    expect(result).toEqual({
      accessToken: 'access-token',
      user: expect.objectContaining({
        email: 'admin@example.com',
        isSystemAdmin: true,
      }),
    });
    expect(userService.send).toHaveBeenCalledWith('auth.login', {
      email: 'admin@example.com',
    });
    expect(res.cookie).toHaveBeenCalled();
  });

  it('marks profile responses as system admin for configured admin emails', async () => {
    process.env.SUPER_ADMIN_EMAILS = 'admin@example.com';

    userService.send.mockReturnValue(
      of({
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin',
        isActive: true,
        createdAt: new Date('2026-03-23T00:00:00.000Z'),
        updatedAt: new Date('2026-03-23T00:00:00.000Z'),
      }) as never,
    );

    const result = await lastValueFrom(
      controller.getProfile('user-1', userClaims),
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'admin@example.com',
        isSystemAdmin: true,
      }),
    );
    expect(userService.send).toHaveBeenCalledWith(
      USER_SERVICE_PATTERNS.GET_USER,
      {
        userId: 'user-1',
        userClaims,
      },
    );
  });

  it('does not mark non-admin users as system admins during token validation', () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    delete process.env.DEV_BYPASS_ENABLED;

    const result = controller.validateToken({
      id: 'user-2',
      email: 'user@example.com',
      name: 'User',
      isActive: true,
      createdAt: new Date('2026-03-23T00:00:00.000Z'),
      updatedAt: new Date('2026-03-23T00:00:00.000Z'),
    } as never);

    expect(result).toEqual(
      expect.objectContaining({
        email: 'user@example.com',
        isSystemAdmin: false,
      }),
    );
  });
});
