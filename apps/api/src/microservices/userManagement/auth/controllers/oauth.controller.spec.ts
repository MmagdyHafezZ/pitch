/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import type { AuthService } from '../services/auth.service';
import type { AuthApplicationService } from '../services/auth-application.service';
import {
  AuthProvider,
  type OAuthProviderFactory,
} from '../factories/oauth-provider.factory';

describe('OAuthController', () => {
  let controller: OAuthController;
  let authService: jest.Mocked<AuthService>;
  let authApplicationService: jest.Mocked<AuthApplicationService>;
  let oauthProviderFactory: jest.Mocked<OAuthProviderFactory>;

  beforeEach(() => {
    authService = {
      getUserOAuthAccounts: jest.fn(),
      unlinkOAuthAccount: jest.fn(),
      refreshToken: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    authApplicationService = {
      issueTokensForUser: jest.fn(),
    } as unknown as jest.Mocked<AuthApplicationService>;

    oauthProviderFactory = {
      getProvider: jest.fn(),
    } as unknown as jest.Mocked<OAuthProviderFactory>;

    controller = new OAuthController(
      authService,
      authApplicationService,
      oauthProviderFactory,
    );
  });

  it('returns linked oauth accounts for authenticated user', async () => {
    authService.getUserOAuthAccounts.mockResolvedValue([
      { provider: 'GOOGLE' },
    ] as any);

    await expect(
      controller.getLinkedAccounts({
        id: 'user-1',
        email: 'u@example.com',
        name: 'U',
      } as any),
    ).resolves.toEqual([{ provider: 'GOOGLE' }]);
    expect(authService.getUserOAuthAccounts).toHaveBeenCalledWith('user-1');
  });

  it('rejects linked account lookup when user context is invalid', async () => {
    await expect(controller.getLinkedAccounts(undefined)).rejects.toThrow(
      new UnauthorizedException('Invalid user context'),
    );
  });

  it('unlinks account for authenticated user', async () => {
    authService.unlinkOAuthAccount.mockResolvedValue({ success: true } as any);

    await expect(
      controller.unlinkAccount(
        { id: 'user-1', email: 'u@example.com', name: 'U' } as any,
        AuthProvider.GOOGLE,
      ),
    ).resolves.toEqual({ success: true });
    expect(authService.unlinkOAuthAccount).toHaveBeenCalledWith(
      'user-1',
      AuthProvider.GOOGLE,
    );
  });

  it('returns linking info for a supported provider', () => {
    oauthProviderFactory.getProvider.mockReturnValue({
      name: AuthProvider.GOOGLE,
      displayName: 'Google',
    } as any);

    expect(controller.linkAccount(AuthProvider.GOOGLE, 'user-1')).toEqual({
      message: 'Linking Google account for user user-1...',
      provider: AuthProvider.GOOGLE,
    });
  });

  it('throws on unsupported provider in linkAccount', () => {
    oauthProviderFactory.getProvider.mockReturnValue(undefined as any);

    expect(() => controller.linkAccount(AuthProvider.GOOGLE, 'user-1')).toThrow(
      new BadRequestException('Unsupported OAuth provider'),
    );
  });

  it('refreshToken extracts and trims refresh_token from request body', async () => {
    authService.refreshToken.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
    } as any);

    await expect(
      controller.refreshToken({
        body: { refresh_token: '  token-1  ' },
      } as any),
    ).resolves.toEqual({ access_token: 'a', refresh_token: 'r' });
    expect(authService.refreshToken).toHaveBeenCalledWith('token-1');
  });

  it('refreshToken throws when token is missing', async () => {
    await expect(controller.refreshToken({ body: {} } as any)).rejects.toThrow(
      new BadRequestException('Refresh token is required'),
    );
  });

  it('googleCallback sets refresh cookie and redirects with access token on success', async () => {
    authApplicationService.issueTokensForUser.mockResolvedValue({
      token: 'access',
      refreshToken: 'refresh',
      user: { id: 'user-1' },
    } as any);
    const req = {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        avatar: 'https://example.com/avatar.png',
      },
    };
    const res = {
      cookie: jest.fn(),
      redirect: jest.fn(),
    };

    await controller.googleCallback(req as any, res as any);

    expect(authApplicationService.issueTokensForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'user@example.com' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?token=access'),
    );
  });

  it('googleCallback redirects with encoded error when oauth user is missing', async () => {
    const req = { user: null };
    const res = { cookie: jest.fn(), redirect: jest.fn() };

    await controller.googleCallback(req as any, res as any);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent('No user data received from Google OAuth'),
      ),
    );
  });

  it('provider callbacks redirect with fallback message for non-Error failures', async () => {
    authApplicationService.issueTokensForUser.mockRejectedValue('boom');
    const req = { user: { id: 'u1', email: 'u@example.com' } };
    const res = { cookie: jest.fn(), redirect: jest.fn() };

    await controller.githubCallback(req as any, res as any);

    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('boom')),
    );
  });
});
