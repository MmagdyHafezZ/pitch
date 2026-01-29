import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as UserPrismaClient } from '@prisma/user-client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { resolvePrismaRuntimeConfig } from '../../../config/prisma-runtime.config';

@Injectable()
export class UserPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: UserPrismaClient;

  constructor() {
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.USER_DATABASE_URL,
      process.env.USER_DIRECT_URL,
    );
    const client = new UserPrismaClient(
      url
        ? {
            datasources: {
              db: {
                url,
              },
            },
          }
        : undefined,
    );

    this.prisma = useAccelerate
      ? (client.$extends(withAccelerate()) as unknown as UserPrismaClient)
      : client;
  }

  get client(): UserPrismaClient {
    return this.prisma;
  }

  get user(): UserPrismaClient['user'] {
    return this.prisma.user;
  }

  get oAuthAccount(): UserPrismaClient['oAuthAccount'] {
    return this.prisma.oAuthAccount;
  }

  get refreshToken(): UserPrismaClient['refreshToken'] {
    return this.prisma.refreshToken;
  }

  get team(): UserPrismaClient['team'] {
    return this.prisma.team;
  }

  get teamMembership(): UserPrismaClient['teamMembership'] {
    return this.prisma.teamMembership;
  }

  get plan(): UserPrismaClient['plan'] {
    return this.prisma.plan;
  }

  get subscription(): UserPrismaClient['subscription'] {
    return this.prisma.subscription;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
