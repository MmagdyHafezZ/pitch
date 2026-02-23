/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from '../factories/oauth-provider.factory';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthService, type OAuthProfile } from './auth.service';
import { UserRepository } from '../../user/repositories/user.repository';

describe('AuthService', () => {
  let service: AuthService;
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
    id: 'google-id-1',
    email: 'user@example.com',
    name: 'Google User',
    avatar: 'https://lh3.googleusercontent.com/a/avatar-photo',
    provider: AuthProvider.GOOGLE,
  };

  beforeEach(() => {
    userRepository = {
      findByOAuthAccount: jest.fn(),
      findByEmail: jest.fn(),
      createWithOAuth: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    authRepository = {
      createOAuthAccount: jest.fn(),
      updateOAuthAccount: jest.fn(),
      getOAuthAccounts: jest.fn(),
      canUnlinkOAuthAccount: jest.fn(),
      deleteOAuthAccount: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    jwtService = {
      sign: jest.fn().mockReturnValue('token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(userRepository, authRepository, jwtService);
  });

  it('creates a new user with OAuth when no user exists', async () => {
    userRepository.findByOAuthAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createWithOAuth.mockResolvedValue(baseUser);

    const result = await service.validateOAuthUser(googleProfile, {
      accessToken: 'a',
      refreshToken: 'r',
    } as any);

    expect(userRepository.createWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        email: googleProfile.email,
        name: googleProfile.name,
        avatar: googleProfile.avatar,
      }),
      expect.objectContaining({
        provider: AuthProvider.GOOGLE,
        providerId: googleProfile.id,
      }),
    );
    expect(result).toEqual(baseUser);
    expect(authRepository.createOAuthAccount).not.toHaveBeenCalled();
  });

  it('links OAuth to an existing user and populates empty avatar from Google', async () => {
    userRepository.findByOAuthAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(baseUser);
    authRepository.createOAuthAccount.mockResolvedValue({} as any);
    userRepository.update.mockResolvedValue({
      ...baseUser,
      avatar: googleProfile.avatar,
    });

    const result = await service.validateOAuthUser(googleProfile);

    expect(authRepository.createOAuthAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: baseUser.id,
        provider: AuthProvider.GOOGLE,
        avatar: googleProfile.avatar,
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith(baseUser.id, {
      avatar: googleProfile.avatar,
    });
    expect(result.avatar).toBe(googleProfile.avatar);
  });

  it('does not overwrite a custom avatar when linking Google OAuth', async () => {
    const userWithCustomAvatar = {
      ...baseUser,
      avatar: 'https://cdn.example.com/custom-avatar.png',
    };
    userRepository.findByOAuthAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(userWithCustomAvatar);
    authRepository.createOAuthAccount.mockResolvedValue({} as any);

    const result = await service.validateOAuthUser(googleProfile);

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(result).toEqual(userWithCustomAvatar);
  });

  it('updates OAuth account and refreshes existing Google-hosted avatar', async () => {
    const existingOauthUser = {
      ...baseUser,
      avatar: 'https://lh3.googleusercontent.com/a/old-photo',
    };
    userRepository.findByOAuthAccount.mockResolvedValue(existingOauthUser);
    authRepository.updateOAuthAccount.mockResolvedValue(undefined);
    userRepository.update.mockResolvedValue({
      ...existingOauthUser,
      avatar: googleProfile.avatar,
    });

    const result = await service.validateOAuthUser(googleProfile, {
      accessToken: 'new-access',
    } as any);

    expect(authRepository.updateOAuthAccount).toHaveBeenCalledWith(
      AuthProvider.GOOGLE,
      googleProfile.id,
      expect.objectContaining({
        email: googleProfile.email,
        avatar: googleProfile.avatar,
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith(existingOauthUser.id, {
      avatar: googleProfile.avatar,
    });
    expect(result.avatar).toBe(googleProfile.avatar);
  });

  it('does not sync avatar for non-Google providers', async () => {
    const githubProfile: OAuthProfile = {
      ...googleProfile,
      provider: AuthProvider.GITHUB,
      avatar: 'https://avatars.githubusercontent.com/u/1',
    };
    userRepository.findByOAuthAccount.mockResolvedValue(baseUser);
    authRepository.updateOAuthAccount.mockResolvedValue(undefined);

    await service.validateOAuthUser(githubProfile);

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(authRepository.updateOAuthAccount).toHaveBeenCalled();
  });

  it('throws when unlinking the only authentication method', async () => {
    authRepository.canUnlinkOAuthAccount.mockResolvedValue(false);

    await expect(
      service.unlinkOAuthAccount('user-1', AuthProvider.GOOGLE),
    ).rejects.toThrow(
      new UnauthorizedException('Cannot unlink the only authentication method'),
    );
  });

  it('returns tokens when refresh token is valid', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' } as any);
    userRepository.findById.mockResolvedValue(baseUser);
    jwtService.sign
      .mockReturnValueOnce('access')
      .mockReturnValueOnce('refresh');

    await expect(service.refreshToken('refresh-token')).resolves.toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });

  it('throws unauthorized when refresh token resolves to no user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'missing' } as any);
    userRepository.findById.mockResolvedValue(null);

    await expect(service.refreshToken('refresh-token')).rejects.toThrow(
      new UnauthorizedException('Invalid refresh token'),
    );
  });

  it('throws not found when getUser user is missing', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(service.getUser('missing')).rejects.toThrow(
      new NotFoundException('User not found'),
    );
  });
});
