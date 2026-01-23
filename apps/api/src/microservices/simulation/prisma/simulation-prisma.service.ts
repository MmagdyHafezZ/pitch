import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/simulation-client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { resolvePrismaRuntimeConfig } from '../config/prisma-runtime.config';

@Injectable()
export class SimulationPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private readonly logger = new Logger(SimulationPrismaService.name);

  constructor() {
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.SIMULATION_DATABASE_URL,
      process.env.SIMULATION_DIRECT_URL,
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
    this.logger.log(
      `Prisma client initialized with URL: ${url} and Accelerate mode: ${useAccelerate}`,
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

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
