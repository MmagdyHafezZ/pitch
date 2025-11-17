import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient as SupportPrismaClient } from '@prisma/support-client';

@Injectable()
export class SupportPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: SupportPrismaClient;

  constructor() {
    this.prisma = new SupportPrismaClient().$extends(
      withAccelerate(),
    ) as unknown as SupportPrismaClient;
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
