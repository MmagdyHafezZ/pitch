import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserPrismaService } from '../prisma/user-prisma.service';
import {
  AuthProvider,
  toPrismaAuthProvider,
} from '../factories/oauth-provider.factory';
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
  constructor(
    private prisma: UserPrismaService,
    private jwtService: JwtService,
  ) {}

  async validateOAuthUser(
    profile: OAuthProfile,
    tokenData?: ITokenData,
  ): Promise<any> {
    let user = await this.findUserByOAuthAccount(profile.provider, profile.id);

    if (!user) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: profile.email },
        include: { oauthAccounts: true },
      });

      if (existingUser) {
        await this.prisma.oAuthAccount.create({
          data: {
            provider: toPrismaAuthProvider(profile.provider),
            providerId: profile.id,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            accessToken: tokenData?.accessToken,
            refreshToken: tokenData?.refreshToken,
            expiresAt: tokenData?.expiresAt,
            userId: existingUser.id,
          },
        });
        user = existingUser;
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            oauthAccounts: {
              create: {
                provider: toPrismaAuthProvider(profile.provider),
                providerId: profile.id,
                email: profile.email,
                name: profile.name,
                avatar: profile.avatar,
                accessToken: tokenData?.accessToken,
                refreshToken: tokenData?.refreshToken,
                expiresAt: tokenData?.expiresAt,
              },
            },
          },
          include: { oauthAccounts: true },
        });
      }
    } else {
      // User exists, update their OAuth tokens
      await this.prisma.oAuthAccount.updateMany({
        where: {
          provider: toPrismaAuthProvider(profile.provider),
          providerId: profile.id,
        },
        data: {
          accessToken: tokenData?.accessToken,
          refreshToken: tokenData?.refreshToken,
          expiresAt: tokenData?.expiresAt,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
        },
      });
    }

    return user;
  }

  async findUserByOAuthAccount(provider: AuthProvider, providerId: string) {
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

  generateTokens(user: TokenPayload): TokenPair {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      access_token,
      refresh_token,
    };
  }

  async getUserOAuthAccounts(userId: string) {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    });

    return accounts;
  }

  async unlinkOAuthAccount(userId: string, provider: AuthProvider) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Ensure user has at least one OAuth account (since we don't support password auth)
    if (user.oauthAccounts.length <= 1) {
      throw new UnauthorizedException(
        'Cannot unlink the only authentication method',
      );
    }

    await this.prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider: toPrismaAuthProvider(provider),
      },
    });

    return { message: `${provider} account unlinked successfully` };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUser(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { oauthAccounts: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch {
      throw new NotFoundException('User not found');
    }
  }
}
