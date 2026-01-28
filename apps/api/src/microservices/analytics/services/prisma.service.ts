import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/analytics-client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { resolvePrismaRuntimeConfig } from '../../../config/prisma-runtime.config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.ANALYTICS_DATABASE_URL,
      process.env.ANALYTICS_DIRECT_URL,
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
