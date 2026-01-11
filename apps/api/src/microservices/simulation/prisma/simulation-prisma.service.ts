import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/simulation-client';
import { withAccelerate } from '@prisma/extension-accelerate';

@Injectable()
export class SimulationPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient().$extends(
      withAccelerate(),
    ) as unknown as PrismaClient;
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  get metric(): PrismaClient['metric'] {
    return this.prisma.metric;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
