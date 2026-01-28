import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/crm-client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { resolvePrismaRuntimeConfig } from '../../../config/prisma-runtime.config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.CRM_DATABASE_URL,
      process.env.CRM_DIRECT_URL,
    );
    const client = new PrismaClient(
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
      ? (client.$extends(withAccelerate()) as unknown as PrismaClient)
      : client;
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
