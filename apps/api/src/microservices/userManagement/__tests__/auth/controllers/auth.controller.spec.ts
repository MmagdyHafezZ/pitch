import { AuthController } from '../../../auth/controllers/auth.controller';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import type { AuthApplicationService } from '../../../auth/services/auth-application.service';
import type { OAuthProviderFactory } from '../../../auth/factories/oauth-provider.factory';

jest.mock('@pitch/shared-backend/helpers/exceptions', () => ({
  toRpcException: jest.fn((error: unknown) => error),
}));

describe('AuthController', () => {
  const createAuthApplicationServiceMock =
    (): jest.Mocked<AuthApplicationService> =>
      ({
        register: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        validateUser: jest.fn(),
        checkEmail: jest.fn(),
      }) as unknown as jest.Mocked<AuthApplicationService>;

  const createOauthProviderFactoryMock =
    (): jest.Mocked<OAuthProviderFactory> =>
      ({
        getEnabledProviders: jest.fn(),
      }) as unknown as jest.Mocked<OAuthProviderFactory>;

  const toRpcExceptionMock = jest.mocked(toRpcException);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('register delegates to authApplicationService', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    authApp.register.mockResolvedValue({ token: 't' } as any);
    const controller = new AuthController(authApp, factory);

    await expect(
      controller.register({ email: 'u@example.com', name: 'User' } as any),
    ).resolves.toEqual({ token: 't' });
  });

  it('login delegates to authApplicationService', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    authApp.login.mockResolvedValue({ token: 't' } as any);
    const controller = new AuthController(authApp, factory);

    await expect(
      controller.login({ email: 'u@example.com' } as any),
    ).resolves.toEqual({ token: 't' });
  });

  it('logout delegates with userId and refreshToken', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    authApp.logout.mockResolvedValue({ message: 'ok' });
    const controller = new AuthController(authApp, factory);

    await expect(
      controller.logout({ userId: 'user-1', refreshToken: 'rt' }),
    ).resolves.toEqual({ message: 'ok' });
    expect(authApp.logout).toHaveBeenCalledWith('user-1', 'rt');
  });

  it('refresh delegates using refresh token payload', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    authApp.refreshToken.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
    } as any);
    const controller = new AuthController(authApp, factory);

    await expect(controller.refresh({ refreshToken: 'rt' })).resolves.toEqual({
      access_token: 'a',
      refresh_token: 'r',
    });
    expect(authApp.refreshToken).toHaveBeenCalledWith('rt');
  });

  it('validateUser delegates using email only', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    authApp.validateUser.mockResolvedValue({ id: 'u1' } as any);
    const controller = new AuthController(authApp, factory);

    await expect(
      controller.validateUser({ email: 'u@example.com' }),
    ).resolves.toEqual({ id: 'u1' });
    expect(authApp.validateUser).toHaveBeenCalledWith('u@example.com');
  });

  it('getOAuthProviders returns enabled providers from factory', () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    factory.getEnabledProviders.mockReturnValue([{ name: 'google' }] as any);
    const controller = new AuthController(authApp, factory);

    expect(controller.getOAuthProviders()).toEqual([{ name: 'google' }]);
  });

  it('checkEmail delegates to authApplicationService', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    authApp.checkEmail.mockResolvedValue({ exists: true } as any);
    const controller = new AuthController(authApp, factory);

    await expect(
      controller.checkEmail({ email: 'u@example.com' }),
    ).resolves.toEqual({ exists: true });
    expect(authApp.checkEmail).toHaveBeenCalledWith('u@example.com');
  });

  it('wraps register errors with toRpcException', async () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const wrapped = new Error('rpc');
    authApp.register.mockRejectedValue(error);
    toRpcExceptionMock.mockReturnValueOnce(wrapped as any);
    const controller = new AuthController(authApp, factory);

    await expect(
      controller.register({ email: 'u@example.com', name: 'User' } as any),
    ).rejects.toThrow(wrapped);
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  it('wraps oauth provider errors with toRpcException', () => {
    const authApp = createAuthApplicationServiceMock();
    const factory = createOauthProviderFactoryMock();
    const error = new Error('failure');
    const wrapped = new Error('rpc');
    factory.getEnabledProviders.mockImplementation(() => {
      throw error;
    });
    toRpcExceptionMock.mockReturnValueOnce(wrapped as any);
    const controller = new AuthController(authApp, factory);

    expect(() => controller.getOAuthProviders()).toThrow(wrapped);
    expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
  });

  // ── ltiLogin ──────────────────────────────────────────────────────────────────

  describe('ltiLogin', () => {
    const ltiPayload = {
      email: 'learner@university.edu',
      name: 'Alice',
      sub: 'sub-1',
    };
    const authResponse = {
      token: 'access-jwt',
      refreshToken: 'refresh-jwt',
      user: { id: 'user-1', email: 'learner@university.edu', name: 'Alice' },
    };

    it('delegates to authApplicationService.ltiLogin and returns the result', async () => {
      const authApp = createAuthApplicationServiceMock();
      const factory = createOauthProviderFactoryMock();
      (authApp as any).ltiLogin = jest.fn().mockResolvedValue(authResponse);
      const controller = new AuthController(authApp, factory);

      const result = await (controller as any).ltiLogin(ltiPayload);

      expect((authApp as any).ltiLogin).toHaveBeenCalledWith(ltiPayload);
      expect(result).toEqual(authResponse);
    });

    it('wraps ltiLogin errors with toRpcException', async () => {
      const authApp = createAuthApplicationServiceMock();
      const factory = createOauthProviderFactoryMock();
      const error = new Error('db failure');
      const wrapped = new Error('rpc wrapped');
      (authApp as any).ltiLogin = jest.fn().mockRejectedValue(error);
      toRpcExceptionMock.mockReturnValueOnce(wrapped as any);
      const controller = new AuthController(authApp, factory);

      await expect((controller as any).ltiLogin(ltiPayload)).rejects.toThrow(
        wrapped,
      );
      expect(toRpcExceptionMock).toHaveBeenCalledWith(error);
    });
  });
});
