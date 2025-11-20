import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../repositories/user.repository';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthProvider } from '../factories/oauth-provider.factory';
import { ITokenData } from '../interfaces/token-data.interface';

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface TokenPayload {
  id: string;
  email: string;
  name?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}
  async validateOAuthUser(
    profile: OAuthProfile,
    tokenData?: ITokenData,
  ): Promise<any> {
    let user = await this.userRepository.findByOAuthAccount(
      profile.provider,
      profile.id,
    );

    if (!user) {
      const existingUser = await this.userRepository.findByEmail(profile.email);

      if (existingUser) {
        await this.authRepository.createOAuthAccount({
          provider: profile.provider,
          providerId: profile.id,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          accessToken: tokenData?.accessToken,
          refreshToken: tokenData?.refreshToken,
          expiresAt: tokenData?.expiresAt,
          userId: existingUser.id,
        });
        user = existingUser;
      } else {
        user = await this.userRepository.createWithOAuth(
          {
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
          },
          {
            provider: profile.provider,
            providerId: profile.id,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            accessToken: tokenData?.accessToken,
            refreshToken: tokenData?.refreshToken,
            expiresAt: tokenData?.expiresAt,
          },
        );
      }
    } else {
      await this.authRepository.updateOAuthAccount(
        profile.provider,
        profile.id,
        {
          accessToken: tokenData?.accessToken,
          refreshToken: tokenData?.refreshToken,
          expiresAt: tokenData?.expiresAt,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
        },
      );
    }

    return user;
  }

  /**
   * Generate JWT tokens (domain logic)
   */
  generateTokens(user: TokenPayload): TokenPair {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
    });

    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    });

    return {
      access_token,
      refresh_token,
    };
  }

  /**
   * Get user OAuth accounts
   */
  async getUserOAuthAccounts(userId: string) {
    return await this.authRepository.getOAuthAccounts(userId);
  }

  /**
   * Unlink OAuth account
   */
  async unlinkOAuthAccount(userId: string, provider: AuthProvider) {
    // Validate user has multiple OAuth accounts
    const canUnlink = await this.authRepository.canUnlinkOAuthAccount(
      userId,
      provider,
    );

    if (!canUnlink) {
      throw new UnauthorizedException(
        'Cannot unlink the only authentication method',
      );
    }

    await this.authRepository.deleteOAuthAccount(userId, provider);

    return { message: `${provider} account unlinked successfully` };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);
      const user = await this.userRepository.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
