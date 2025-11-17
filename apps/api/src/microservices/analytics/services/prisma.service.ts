import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/analytics-client';
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

  get metric(): PrismaClient['metric'] {
    return this.prisma.metric;
  }

  get statistic(): PrismaClient['statistic'] {
    return this.prisma.statistic;
  }

  get event(): PrismaClient['event'] {
    return this.prisma.event;
  }

  get dashboard(): PrismaClient['dashboard'] {
    return this.prisma.dashboard;
  }

  get report(): PrismaClient['report'] {
    return this.prisma.report;
  }

  get reportExecution(): PrismaClient['reportExecution'] {
    return this.prisma.reportExecution;
  }

  get performanceLog(): PrismaClient['performanceLog'] {
    return this.prisma.performanceLog;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
