import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create user (in a real app, hash password here)
    const user = await this.userRepository.create({
      email: dto.email,
      name: dto.name,
      avatar: dto.avatar,
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
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
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  /**
   * Login user
   * Orchestration: Validate credentials → Generate tokens → Store refresh token
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Processing login for: ${dto.email}`);

    // Find user by email
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // In a real app with passwords, validate password here
    // For OAuth-only, we just check if user has OAuth accounts
    const oauthAccounts = await this.authRepository.getOAuthAccounts(user.id);
    if (oauthAccounts.length === 0) {
      throw new UnauthorizedException(
        'No authentication method found. Please use OAuth to sign in.',
      );
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Store refresh token
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
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
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
        // Continue logout even if token deletion fails
      }
    }

    // Could also: Delete all refresh tokens for user, update last seen, etc.

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
      // Verify JWT signature
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);

      // Find user and validate refresh token exists in DB
      const user =
        await this.authRepository.findUserByRefreshToken(refreshToken);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (user.id !== payload.sub) {
        throw new UnauthorizedException('Token user mismatch');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Rotate refresh token: delete old, create new
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

    // Try to find user by OAuth account
    let user = await this.userRepository.findByOAuthAccount(
      profile.provider,
      profile.id,
    );

    if (!user) {
      // Check if user with this email already exists
      const existingUser = await this.userRepository.findByEmail(profile.email);

      if (existingUser) {
        // Link OAuth account to existing user
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
        // Create new user with OAuth account
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
      // Update existing OAuth tokens
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

    // Generate our JWT tokens
    const tokens = this.generateTokens(user);

    // Store refresh token
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
        name: user.name,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
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
}
