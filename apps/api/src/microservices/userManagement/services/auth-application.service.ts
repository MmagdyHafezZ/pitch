import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { UserRepository } from '../repositories/user.repository';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterDto, LoginDto, AuthResponseDto } from '../dto/auth.dto';
import { OAuthProfile, TokenPair } from '../services/auth.service';

/**
 * Auth Application Service
 *
 * This is the ORCHESTRATION layer. It coordinates between:
 * - Domain logic (validation, business rules)
 * - Repositories (data persistence)
 * - External services (JWT generation)
 *
 * NO direct Prisma calls here - all database operations go through repositories.
 * Controllers should delegate to this service, NOT to domain services directly.
 */
@Injectable()
export class AuthApplicationService {
  private readonly logger = new Logger(AuthApplicationService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   * Orchestration: Check existence → Create user → Generate tokens → Store refresh token
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    this.logger.log(`Processing registration for: ${dto.email}`);

    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = await this.userRepository.create({
      email: dto.email,
      name: dto.name,
      avatar: dto.avatar,
    });

    const tokens = this.generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.authRepository.createRefreshToken(
      user.id,
      tokens.refresh_token,
      expiresAt,
    );

    this.logger.log(`User registered successfully: ${user.id}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  /**
   * Login user
   * Orchestration: Validate credentials → Generate tokens → Store refresh token
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Processing login for: ${dto.email}`);

    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const oauthAccounts = await this.authRepository.getOAuthAccounts(user.id);
    if (oauthAccounts.length === 0) {
      throw new UnauthorizedException(
        'No authentication method found. Please use OAuth to sign in.',
      );
    }

    const tokens = this.generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.authRepository.createRefreshToken(
      user.id,
      tokens.refresh_token,
      expiresAt,
    );

    this.logger.log(`User logged in successfully: ${user.id}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  /**
   * Logout user
   * Orchestration: Delete refresh token
   */
  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Processing logout for user: ${userId}`);

    if (refreshToken) {
      try {
        await this.authRepository.deleteRefreshToken(refreshToken);
      } catch (error) {
        this.logger.warn(
          `Failed to delete refresh token during logout: ${error}`,
        );
      }
    }

    this.logger.log(`User logged out successfully: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh access token
   * Orchestration: Validate refresh token → Verify user → Generate new tokens → Rotate refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    this.logger.log('Processing token refresh');

    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);

      const user =
        await this.authRepository.findUserByRefreshToken(refreshToken);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (user.id !== payload.sub) {
        throw new UnauthorizedException('Token user mismatch');
      }

      const tokens = this.generateTokens(user);

      await this.authRepository.deleteRefreshToken(refreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await this.authRepository.createRefreshToken(
        user.id,
        tokens.refresh_token,
        expiresAt,
      );

      this.logger.log(`Token refreshed successfully for user: ${user.id}`);
      return tokens;
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Validate user (for strategies)
   */
  async validateUser(email: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Check if email exists and return associated OAuth provider
   * Used for redirect-based login flow
   */
  async checkEmail(email: string) {
    this.logger.log(`Checking email: ${email}`);

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return {
        exists: false,
        message: 'No account found with this email. Please sign up first.',
      };
    }

    const oauthAccounts = await this.authRepository.getOAuthAccounts(user.id);

    if (oauthAccounts.length === 0) {
      return {
        exists: true,
        requiresOAuth: false,
        message: 'Please use password login',
      };
    }

    const primaryProvider = oauthAccounts[0];

    return {
      exists: true,
      provider: primaryProvider.provider.toLowerCase(),
      requiresOAuth: true,
      message: `Please continue with ${primaryProvider.provider} to sign in`,
    };
  }

  /**
   * Validate OAuth user and create/update
   * Orchestration: Find or create user → Link OAuth account → Generate tokens
   */
  async validateOAuthUser(
    profile: OAuthProfile,
    tokenData?: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
  ): Promise<AuthResponseDto> {
    this.logger.log(
      `Processing OAuth validation for ${profile.provider}: ${profile.email}`,
    );

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
        this.logger.log(
          `Linked OAuth account to existing user: ${existingUser.id}`,
        );
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
        this.logger.log(`Created new user via OAuth: ${user.id}`);
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
      this.logger.log(`Updated OAuth tokens for user: ${user.id}`);
    }

    return this.issueTokensForUser(user);
  }

  async issueTokensForUser(user: {
    id: string;
    email: string;
    name: string | null;
    avatar?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AuthResponseDto> {
    const tokens = this.generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.authRepository.createRefreshToken(
      user.id,
      tokens.refresh_token,
      expiresAt,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email,
        avatar: user.avatar ?? undefined,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  /**
   * Generate JWT tokens
   * Private helper method
   */
  private generateTokens(user: {
    id: string;
    email: string;
    name: string | null;
  }): TokenPair {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION ||
        '15m') as JwtSignOptions['expiresIn'],
    });

    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_REFRESH_EXPIRATION ||
        '7d') as JwtSignOptions['expiresIn'],
    });

    return {
      access_token,
      refresh_token,
    };
  }
}
