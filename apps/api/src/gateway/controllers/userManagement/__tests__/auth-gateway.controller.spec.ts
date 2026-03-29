import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { AuthGatewayController } from '../auth-gateway.controller';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

const createClientProxyMock = (): jest.Mocked<
  Pick<ClientProxy, 'send' | 'emit'>
> => ({
  send: jest.fn(),
  emit: jest.fn(),
});

const createResMock = (): jest.Mocked<
  Pick<ExpressResponse, 'cookie' | 'clearCookie'>
> => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const createReqMock = (
  cookies: Record<string, string> = {},
): Partial<ExpressRequest> => ({
  cookies,
});

const mockUserPayload = {
  user: { id: 'u-1', email: 'user@example.com', name: 'Test User' },
  token: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
};

describe('AuthGatewayController', () => {
  let controller: AuthGatewayController;
  let userService: ReturnType<typeof createClientProxyMock>;

  beforeEach(async () => {
    userService = createClientProxyMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthGatewayController],
      providers: [{ provide: 'USER_SERVICE', useValue: userService }],
    }).compile();

    controller = module.get(AuthGatewayController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'secret123',
      name: 'New User',
    };

    it('sends REGISTER to user service, sets refresh cookie, and returns user + accessToken', async () => {
      userService.send.mockReturnValue(of(mockUserPayload));
      const res = createResMock() as unknown as ExpressResponse;

      const result = await lastValueFrom(
        controller.register(registerDto as any, res),
      );

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.REGISTER,
        registerDto,
      );
      expect(res.cookie).toHaveBeenCalled();
      expect(result).toEqual({
        user: mockUserPayload.user,
        accessToken: mockUserPayload.token,
      });
    });

    it('throws HttpException on registration failure after retries', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({
          message: 'Email already exists',
          status: HttpStatus.CONFLICT,
        })),
      );
      const res = createResMock() as unknown as ExpressResponse;

      await expect(
        lastValueFrom(controller.register(registerDto as any, res)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const loginDto = { email: 'user@example.com', password: 'secret123' };

    it('sends auth.login to user service, sets refresh cookie, and returns user + accessToken', async () => {
      userService.send.mockReturnValue(of(mockUserPayload));
      const res = createResMock() as unknown as ExpressResponse;

      const result = await lastValueFrom(
        controller.login(loginDto as any, res),
      );

      expect(userService.send).toHaveBeenCalledWith('auth.login', loginDto);
      expect(res.cookie).toHaveBeenCalled();
      expect(result).toEqual({
        user: mockUserPayload.user,
        accessToken: mockUserPayload.token,
      });
    });

    it('throws HttpException with UNAUTHORIZED status on login failure', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({
          message: 'Invalid credentials',
          status: HttpStatus.UNAUTHORIZED,
        })),
      );
      const res = createResMock() as unknown as ExpressResponse;

      const err = await lastValueFrom(
        controller.login(loginDto as any, res),
      ).catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    const cookieName = process.env.REFRESH_COOKIE_NAME ?? 'refreshToken';

    it('sends REFRESH with refreshToken from cookie and returns new accessToken', async () => {
      userService.send.mockReturnValue(
        of({ access_token: 'new-access', refresh_token: 'new-refresh' }),
      );
      const req = createReqMock({
        [cookieName]: 'old-refresh',
      }) as ExpressRequest;
      const res = createResMock() as unknown as ExpressResponse;

      const result = await lastValueFrom(controller.refresh(req, res));

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.REFRESH,
        { refreshToken: 'old-refresh' },
      );
      expect(res.cookie).toHaveBeenCalled();
      expect(result).toEqual({ accessToken: 'new-access' });
    });

    it('throws UNAUTHORIZED immediately when refresh cookie is missing', async () => {
      const req = createReqMock({}) as ExpressRequest;
      const res = createResMock() as unknown as ExpressResponse;

      expect(() => controller.refresh(req, res)).toThrow(HttpException);
      expect(userService.send).not.toHaveBeenCalled();
    });

    it('throws HttpException on user service error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({
          message: 'Token expired',
          status: HttpStatus.UNAUTHORIZED,
        })),
      );
      const req = createReqMock({
        [cookieName]: 'expired-token',
      }) as ExpressRequest;
      const res = createResMock() as unknown as ExpressResponse;

      await expect(lastValueFrom(controller.refresh(req, res))).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    const cookieName = process.env.REFRESH_COOKIE_NAME ?? 'refreshToken';

    it('clears the refresh cookie and sends auth.logout with userId and refreshToken', async () => {
      userService.send.mockReturnValue(of({ loggedOut: true }));
      const req = createReqMock({
        [cookieName]: 'old-refresh',
      }) as ExpressRequest;
      const res = createResMock() as unknown as ExpressResponse;

      const result = await lastValueFrom(controller.logout('u-1', req, res));

      expect(res.clearCookie).toHaveBeenCalled();
      expect(userService.send).toHaveBeenCalledWith('auth.logout', {
        userId: 'u-1',
        refreshToken: 'old-refresh',
      });
      expect(result).toEqual({ loggedOut: true });
    });

    it('sends auth.logout with undefined refreshToken when cookie is missing', async () => {
      userService.send.mockReturnValue(of({ loggedOut: true }));
      const req = createReqMock({}) as ExpressRequest;
      const res = createResMock() as unknown as ExpressResponse;

      await lastValueFrom(controller.logout('u-1', req, res));

      expect(userService.send).toHaveBeenCalledWith('auth.logout', {
        userId: 'u-1',
        refreshToken: undefined,
      });
    });

    it('throws HttpException on user service error', async () => {
      userService.send.mockReturnValue(
        throwError(() => new Error('logout failed')),
      );
      const req = createReqMock({}) as ExpressRequest;
      const res = createResMock() as unknown as ExpressResponse;

      await expect(
        lastValueFrom(controller.logout('u-1', req, res)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile()', () => {
    it('sends GET_USER with userId and userClaims, returns user profile', async () => {
      const profile = {
        id: 'u-1',
        email: 'user@example.com',
        name: 'Test User',
      };
      userService.send.mockReturnValue(of(profile));
      const claims = {
        id: 'u-1',
        email: 'user@example.com',
        name: 'Test User',
      };

      const result = await lastValueFrom(
        controller.getProfile('u-1', claims as any),
      );

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_USER,
        { userId: 'u-1', userClaims: claims },
      );
      expect(result).toEqual(profile);
    });

    it('throws HttpException when user not found', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({
          message: 'User not found',
          status: HttpStatus.NOT_FOUND,
        })),
      );

      await expect(
        lastValueFrom(controller.getProfile('u-99', {} as any)),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── validateToken ─────────────────────────────────────────────────────────

  describe('validateToken()', () => {
    it('returns the user object directly without calling user service', () => {
      const user = { id: 'u-1', email: 'user@example.com', name: 'Test User' };

      const result = controller.validateToken(user as any);

      expect(result).toEqual(user);
      expect(userService.send).not.toHaveBeenCalled();
    });
  });

  // ── getOAuthProviders ─────────────────────────────────────────────────────

  describe('getOAuthProviders()', () => {
    it('sends OAUTH_GET_PROVIDERS and returns list of providers', async () => {
      const providers = [
        {
          name: 'google',
          displayName: 'Google',
          authUrl: '/auth/oauth/google',
        },
      ];
      userService.send.mockReturnValue(of(providers));

      const result = await lastValueFrom(controller.getOAuthProviders());

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.OAUTH_GET_PROVIDERS,
        {},
      );
      expect(result).toEqual(providers);
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => new Error('providers error')),
      );

      await expect(
        lastValueFrom(controller.getOAuthProviders()),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getAuthWhitelist ──────────────────────────────────────────────────────

  describe('getAuthWhitelist()', () => {
    it('returns whitelisted routes without calling user service', () => {
      const result = controller.getAuthWhitelist();

      expect(result).toMatchObject({
        routes: expect.any(Array),
        message: expect.any(String),
      });
      expect(result.routes.length).toBeGreaterThan(0);
      expect(userService.send).not.toHaveBeenCalled();
    });
  });

  // ── checkEmail ────────────────────────────────────────────────────────────

  describe('checkEmail()', () => {
    it('sends CHECK_EMAIL with the provided email and returns check result', async () => {
      const checkResult = {
        exists: true,
        provider: 'google',
        requiresOAuth: true,
      };
      userService.send.mockReturnValue(of(checkResult));

      const result = await lastValueFrom(
        controller.checkEmail({ email: 'existing@example.com' }),
      );

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.CHECK_EMAIL,
        { email: 'existing@example.com' },
      );
      expect(result).toEqual(checkResult);
    });

    it('returns exists: false result for unknown emails', async () => {
      const checkResult = { exists: false, message: 'No account found' };
      userService.send.mockReturnValue(of(checkResult));

      const result = await lastValueFrom(
        controller.checkEmail({ email: 'unknown@example.com' }),
      );

      expect(result).toEqual(checkResult);
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => new Error('email check failed')),
      );

      await expect(
        lastValueFrom(controller.checkEmail({ email: 'error@example.com' })),
      ).rejects.toThrow(HttpException);
    });
  });
});
