import { Injectable } from '@nestjs/common';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import {
  AuthProvider,
  toPrismaAuthProvider,
} from '../../auth/factories/oauth-provider.factory';
import type { User, OAuthAccount } from '@prisma/user-client';

export interface CreateUserData {
  email: string;
  name: string;
  avatar?: string;
  isActive?: boolean;
}

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

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: UserPrismaService) {}

  async findMany(): Promise<User[]> {
    return await this.prisma.user.findMany();
  }

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id },
      include: { oauthAccounts: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
      include: { oauthAccounts: true },
    });
  }

  async findByOAuthAccount(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: {
        oauthAccounts: {
          some: {
            provider: toPrismaAuthProvider(provider),
            providerId,
          },
        },
      },
      include: { oauthAccounts: true },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return await this.prisma.user.create({
      data,
      include: { oauthAccounts: true },
    });
  }

  async createWithOAuth(
    userData: CreateUserData,
    oauthData: Omit<CreateOAuthAccountData, 'userId'>,
  ): Promise<User> {
    return await this.prisma.user.create({
      data: {
        ...userData,
        oauthAccounts: {
          create: {
            ...oauthData,
            provider: toPrismaAuthProvider(oauthData.provider),
          },
        },
      },
      include: { oauthAccounts: true },
    });
  }

  async update(id: string, data: Partial<CreateUserData>): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data,
      include: { oauthAccounts: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async getOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    return await this.prisma.oAuthAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
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

  async findUserByRefreshToken(token: string): Promise<User | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { oauthAccounts: true } } },
    });

    return refreshToken?.user || null;
  }

  async createRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.delete({
      where: { token },
    });
  }

  async deleteExpiredRefreshTokens(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
