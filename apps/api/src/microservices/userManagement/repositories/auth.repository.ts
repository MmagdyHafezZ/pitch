import { Injectable } from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';
import {
  AuthProvider,
  toPrismaAuthProvider,
} from '../factories/oauth-provider.factory';
import type { User, OAuthAccount, RefreshToken } from '@prisma/user-client';

export interface CreateOAuthAccountData {
  provider: AuthProvider;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId: string;
}

export interface UpdateOAuthAccountData {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  email?: string;
  name?: string;
  avatar?: string;
}

/**
 * Auth Repository
 *
 * Handles all authentication-related data operations:
 * - OAuth accounts
 * - Refresh tokens
 * - User lookup by refresh token
 *
 * This repository follows the Repository Pattern:
 * - Interface per aggregate (auth-related data)
 * - Concrete implementation isolated to this service
 * - No cross-service repository dependencies
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: UserPrismaService) {}

  async getOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    return await this.prisma.oAuthAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOAuthAccount(
    provider: AuthProvider,
    providerId: string,
  ): Promise<OAuthAccount | null> {
    return await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: toPrismaAuthProvider(provider),
          providerId,
        },
      },
    });
  }

  async createOAuthAccount(
    data: CreateOAuthAccountData,
  ): Promise<OAuthAccount> {
    return await this.prisma.oAuthAccount.create({
      data: {
        ...data,
        provider: toPrismaAuthProvider(data.provider),
      },
    });
  }

  async updateOAuthAccount(
    provider: AuthProvider,
    providerId: string,
    data: UpdateOAuthAccountData,
  ): Promise<void> {
    await this.prisma.oAuthAccount.updateMany({
      where: {
        provider: toPrismaAuthProvider(provider),
        providerId,
      },
      data: {
        ...data,
      },
    });
  }

  async deleteOAuthAccount(
    userId: string,
    provider: AuthProvider,
  ): Promise<void> {
    await this.prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider: toPrismaAuthProvider(provider),
      },
    });
  }

  async countOAuthAccountsForUser(userId: string): Promise<number> {
    return await this.prisma.oAuthAccount.count({
      where: { userId },
    });
  }

  async createRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return await this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async findUserByRefreshToken(token: string): Promise<User | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: { oauthAccounts: true },
        },
      },
    });

    return refreshToken?.user || null;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async deleteExpiredRefreshTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get user with all OAuth accounts
   * Useful for OAuth validation flows
   */
  async getUserWithOAuthAccounts(userId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        oauthAccounts: true,
      },
    });
  }

  /**
   * Validate that user has at least one OAuth account
   * Used before unlinking to prevent lockout
   */
  async canUnlinkOAuthAccount(
    userId: string,
    _provider: AuthProvider,
  ): Promise<boolean> {
    void _provider;
    const count = await this.countOAuthAccountsForUser(userId);

    return count > 1;
  }
}
