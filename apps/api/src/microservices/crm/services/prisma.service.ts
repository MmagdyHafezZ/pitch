import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/crm-client';
import { withAccelerate } from '@prisma/extension-accelerate';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient().$extends(
      withAccelerate(),
    ) as unknown as PrismaClient;
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
