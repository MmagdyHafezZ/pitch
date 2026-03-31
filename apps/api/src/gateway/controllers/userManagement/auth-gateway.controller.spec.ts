import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { AuthGatewayController } from './auth-gateway.controller';

describe('AuthGatewayController', () => {
  let controller: AuthGatewayController;
  let userService: jest.Mocked<ClientProxy>;
  let send: jest.Mock;

  const originalEnv = { ...process.env };

  const userClaims: UserClaims = {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
  };

  beforeEach(() => {
    send = jest.fn();
    userService = {
      send,
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new AuthGatewayController(userService);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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
    expect(send).toHaveBeenCalledWith(USER_SERVICE_PATTERNS.GET_USER, {
      userId: 'user-1',
      userClaims,
    });
  });

  it('marks login responses as system admin for the dev bypass email', async () => {
    process.env.DEV_BYPASS_ENABLED = 'true';
    process.env.DEV_BYPASS_EMAIL = 'dev-admin@example.com';

    userService.send.mockReturnValue(
      of({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-3',
          email: 'dev-admin@example.com',
          name: 'Dev Admin',
          isActive: true,
          createdAt: new Date('2026-03-23T00:00:00.000Z'),
          updatedAt: new Date('2026-03-23T00:00:00.000Z'),
        },
      }) as never,
    );

    const response = {
      cookie: jest.fn(),
    };

    const result = await lastValueFrom(
      controller.login(
        {
          email: 'dev-admin@example.com',
          password: 'password123',
        } as never,
        response as never,
      ),
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.user).toEqual(
      expect.objectContaining({
        email: 'dev-admin@example.com',
        isSystemAdmin: true,
        hasStudioAccess: true,
      }),
    );
    expect(response.cookie).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(USER_SERVICE_PATTERNS.LOGIN, {
      email: 'dev-admin@example.com',
      password: 'password123',
    });
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
