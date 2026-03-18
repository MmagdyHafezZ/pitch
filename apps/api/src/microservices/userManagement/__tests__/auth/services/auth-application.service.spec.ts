import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthApplicationService } from '../../../auth/services/auth-application.service';
import { UserRepository } from '../../../user/repositories/user.repository';
import { AuthRepository } from '../../../auth/repositories/auth.repository';
import { AuthProvider } from '../../../auth/factories/oauth-provider.factory';
import type { OAuthProfile } from '../../../auth/services/auth.service';

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let userRepository: jest.Mocked<UserRepository>;
  let authRepository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const baseUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    avatar: null,
    settings: null,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    lastSeen: null,
  } as any;

  const googleProfile: OAuthProfile = {
    id: 'google-1',
    email: 'user@example.com',
    name: 'Google User',
    avatar: 'https://lh3.googleusercontent.com/a/new-avatar',
    provider: AuthProvider.GOOGLE,
  };

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findByOAuthAccount: jest.fn(),
      createWithOAuth: jest.fn(),
      update: jest.fn(),
      touchLastSeen: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    authRepository = {
      createRefreshToken: jest.fn(),
      deleteRefreshToken: jest.fn(),
      findUserByRefreshToken: jest.fn(),
      getOAuthAccounts: jest.fn(),
      createOAuthAccount: jest.fn(),
      updateOAuthAccount: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    jwtService.sign.mockReturnValue('token');

    service = new AuthApplicationService(
      userRepository,
      authRepository,
      jwtService,
    );
  });

  it('registers a user and stores refresh token', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(baseUser);

    const result = await service.register({
      email: baseUser.email,
      name: baseUser.name,
      avatar: 'https://example.com/a.png',
    });

    expect(userRepository.create).toHaveBeenCalledWith({
      email: baseUser.email,
      name: baseUser.name,
      avatar: 'https://example.com/a.png',
    });
    expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
      baseUser.id,
      expect.any(String),
      expect.any(Date),
    );
    expect(userRepository.touchLastSeen).toHaveBeenCalledWith(baseUser.id);
    expect(result).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          id: baseUser.id,
          email: baseUser.email,
        }),
      }),
    );
  });

  it('throws conflict on duplicate registration email', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);

    await expect(
      service.register({ email: baseUser.email, name: 'Dup' }),
    ).rejects.toThrow(ConflictException);
  });

  it('logs in an OAuth-enabled user and stores refresh token', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);
    authRepository.getOAuthAccounts.mockResolvedValue([
      { provider: AuthProvider.GOOGLE } as any,
    ]);
    jwtService.sign
      .mockReturnValueOnce('access-login')
      .mockReturnValueOnce('refresh-login');

    const result = await service.login({ email: baseUser.email });

    expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
      baseUser.id,
      'refresh-login',
      expect.any(Date),
    );
    expect(userRepository.touchLastSeen).toHaveBeenCalledWith(baseUser.id);
    expect(result.token).toBe('access-login');
    expect(result.refreshToken).toBe('refresh-login');
  });

  it('rejects login when no user exists', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(service.login({ email: 'none@example.com' })).rejects.toThrow(
      new UnauthorizedException('Invalid credentials'),
    );
  });

  it('rejects login when user has no auth methods', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);
    authRepository.getOAuthAccounts.mockResolvedValue([]);

    await expect(service.login({ email: baseUser.email })).rejects.toThrow(
      new UnauthorizedException(
        'No authentication method found. Please use OAuth to sign in.',
      ),
    );
  });

  it('logout succeeds even if refresh token deletion fails', async () => {
    authRepository.deleteRefreshToken.mockRejectedValue(new Error('db fail'));

    await expect(service.logout(baseUser.id, 'bad-token')).resolves.toEqual({
      message: 'Logged out successfully',
    });
  });

  it('refreshes tokens when refresh token is valid', async () => {
    jwtService.verify.mockReturnValue({ sub: baseUser.id } as any);
    authRepository.findUserByRefreshToken.mockResolvedValue(baseUser);
    jwtService.sign
      .mockReturnValueOnce('access-refresh')
      .mockReturnValueOnce('refresh-refresh');

    const result = await service.refreshToken('refresh-token');

    expect(authRepository.deleteRefreshToken).toHaveBeenCalledWith(
      'refresh-token',
    );
    expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
      baseUser.id,
      'refresh-refresh',
      expect.any(Date),
    );
    expect(userRepository.touchLastSeen).toHaveBeenCalledWith(baseUser.id);
    expect(result).toEqual({
      access_token: 'access-refresh',
      refresh_token: 'refresh-refresh',
    });
  });

  it('throws a specific unauthorized error when refresh token user mismatches jwt payload', async () => {
    jwtService.verify.mockReturnValue({ sub: 'other-user' } as any);
    authRepository.findUserByRefreshToken.mockResolvedValue(baseUser);

    await expect(service.refreshToken('refresh-token')).rejects.toThrow(
      new UnauthorizedException('Token user mismatch'),
    );
  });

  it('validates user by email', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);

    await expect(service.validateUser(baseUser.email)).resolves.toEqual(
      baseUser,
    );
  });

  it('throws not found when validating unknown user', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(service.validateUser('missing@example.com')).rejects.toThrow(
      new NotFoundException('User not found'),
    );
  });

  it('checkEmail returns no-account response when user is missing', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(service.checkEmail('missing@example.com')).resolves.toEqual(
      expect.objectContaining({
        exists: false,
        message: 'No account found with this email. Please sign up first.',
      }),
    );
  });

  it('checkEmail returns password-login guidance when no oauth accounts exist', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);
    authRepository.getOAuthAccounts.mockResolvedValue([]);

    await expect(service.checkEmail(baseUser.email)).resolves.toEqual(
      expect.objectContaining({ exists: true, requiresOAuth: false }),
    );
  });

  it('checkEmail returns primary oauth provider when linked', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);
    authRepository.getOAuthAccounts.mockResolvedValue([
      { provider: 'GOOGLE' },
      { provider: 'GITHUB' },
    ] as any);

    await expect(service.checkEmail(baseUser.email)).resolves.toEqual(
      expect.objectContaining({
        exists: true,
        requiresOAuth: true,
        provider: 'google',
      }),
    );
  });

  it('creates a new user via OAuth when no linked or existing email user exists', async () => {
    userRepository.findByOAuthAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createWithOAuth.mockResolvedValue(baseUser);
    authRepository.createRefreshToken.mockResolvedValue({} as any);
    jwtService.sign
      .mockReturnValueOnce('oauth-access')
      .mockReturnValueOnce('oauth-refresh');

    const result = await service.validateOAuthUser(googleProfile, {
      accessToken: 'acc',
      refreshToken: 'ref',
    });

    expect(userRepository.createWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ email: googleProfile.email }),
      expect.objectContaining({ providerId: googleProfile.id }),
    );
    expect(result.token).toBe('oauth-access');
    expect(result.refreshToken).toBe('oauth-refresh');
    expect(userRepository.touchLastSeen).toHaveBeenCalledWith(baseUser.id);
  });

  it('links OAuth to existing user and syncs empty google avatar', async () => {
    userRepository.findByOAuthAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(baseUser);
    authRepository.createOAuthAccount.mockResolvedValue({} as any);
    userRepository.update.mockResolvedValue({
      ...baseUser,
      avatar: googleProfile.avatar,
    });
    authRepository.createRefreshToken.mockResolvedValue({} as any);

    const result = await service.validateOAuthUser(googleProfile);

    expect(authRepository.createOAuthAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: baseUser.id,
        provider: AuthProvider.GOOGLE,
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith(baseUser.id, {
      avatar: googleProfile.avatar,
    });
    expect(result.user.avatar).toBe(googleProfile.avatar);
  });

  it('does not overwrite a custom avatar when validating existing Google OAuth user', async () => {
    const customAvatarUser = {
      ...baseUser,
      avatar: 'https://cdn.example.com/custom.png',
    };
    userRepository.findByOAuthAccount.mockResolvedValue(customAvatarUser);
    authRepository.updateOAuthAccount.mockResolvedValue({} as any);
    authRepository.createRefreshToken.mockResolvedValue({} as any);

    await service.validateOAuthUser(googleProfile, { accessToken: 'a' });

    expect(authRepository.updateOAuthAccount).toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('refreshes an existing Google-hosted avatar on OAuth login', async () => {
    const googleAvatarUser = {
      ...baseUser,
      avatar: 'https://lh3.googleusercontent.com/a/old-avatar',
    };
    userRepository.findByOAuthAccount.mockResolvedValue(googleAvatarUser);
    authRepository.updateOAuthAccount.mockResolvedValue({} as any);
    userRepository.update.mockResolvedValue({
      ...googleAvatarUser,
      avatar: googleProfile.avatar,
    });
    authRepository.createRefreshToken.mockResolvedValue({} as any);

    await service.validateOAuthUser(googleProfile);

    expect(userRepository.update).toHaveBeenCalledWith(googleAvatarUser.id, {
      avatar: googleProfile.avatar,
    });
  });

  it('issueTokensForUser falls back to email when name is null', async () => {
    authRepository.createRefreshToken.mockResolvedValue({} as any);
    jwtService.sign
      .mockReturnValueOnce('iss-access')
      .mockReturnValueOnce('iss-refresh');

    const result = await service.issueTokensForUser({
      ...baseUser,
      name: null,
      avatar: null,
    });

    expect(result.user.name).toBe(baseUser.email);
    expect(result.user.avatar).toBeUndefined();
    expect(result.token).toBe('iss-access');
  });

  // ── ltiLogin ──────────────────────────────────────────────────────────────────

  describe('ltiLogin', () => {
    it('creates a new user when email is not yet registered', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(baseUser);

      const result = await service.ltiLogin({
        email: 'learner@university.edu',
        name: 'Alice Learner',
        sub: 'lti-sub-1',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'learner@university.edu',
      );
      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'learner@university.edu',
        name: 'Alice Learner',
      });
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
      expect(result).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({ id: baseUser.id }),
      });
    });

    it('returns tokens for an existing user without creating a new one', async () => {
      userRepository.findByEmail.mockResolvedValue(baseUser);

      const result = await service.ltiLogin({
        email: 'user@example.com',
        name: 'Test User',
        sub: 'lti-sub-existing',
      });

      expect(userRepository.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        user: expect.objectContaining({ id: 'user-1' }),
      });
    });

    it('falls back to email prefix when name is empty string', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(baseUser);

      await service.ltiLogin({
        email: 'student@school.edu',
        name: '',
        sub: 'lti-sub-2',
      });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'student' }),
      );
    });

    it('falls back to email prefix when name is undefined', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(baseUser);

      await service.ltiLogin({ email: 'bob@corp.io', sub: 'lti-sub-3' });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'bob' }),
      );
    });

    it('touches lastSeen after issuing tokens', async () => {
      userRepository.findByEmail.mockResolvedValue(baseUser);

      await service.ltiLogin({ email: 'user@example.com', sub: 'sub-1' });

      expect(userRepository.touchLastSeen).toHaveBeenCalledWith(baseUser.id);
    });

    it('stores a refresh token with a future expiry date', async () => {
      userRepository.findByEmail.mockResolvedValue(baseUser);

      await service.ltiLogin({ email: 'user@example.com', sub: 'sub-1' });

      expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
        baseUser.id,
        expect.any(String),
        expect.any(Date),
      );
      const expiresAt: Date =
        authRepository.createRefreshToken.mock.calls[0][2];
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
