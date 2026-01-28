import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient as SupportPrismaClient } from '@prisma/support-client';
import { resolvePrismaRuntimeConfig } from '../../config/prisma-runtime.config';

@Injectable()
export class SupportPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: SupportPrismaClient;

  constructor() {
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.SUPPORT_DATABASE_URL,
      process.env.SUPPORT_DIRECT_URL,
    );
    const client = new SupportPrismaClient(
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
      ? (client.$extends(withAccelerate()) as unknown as SupportPrismaClient)
      : client;
  }

  get client(): SupportPrismaClient {
    return this.prisma;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
