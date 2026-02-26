import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient as LtiPrismaClient } from '@prisma/lti-client';
import { resolvePrismaRuntimeConfig } from '../../../config/prisma-runtime.config';

@Injectable()
export class LtiPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: LtiPrismaClient;

  constructor() {
    const { url, useAccelerate } = resolvePrismaRuntimeConfig(
      process.env.LTI_DATABASE_URL,
      process.env.LTI_DIRECT_URL,
    );
    const client = new LtiPrismaClient(
      url ? { datasources: { db: { url } } } : undefined,
    );

    this.prisma = useAccelerate
      ? (client.$extends(withAccelerate()) as unknown as LtiPrismaClient)
      : client;
  }

  get client(): LtiPrismaClient {
    return this.prisma;
  }

  get platform() {
    return this.prisma.ltiPlatform;
  }

  get deployment() {
    return this.prisma.ltiDeployment;
  }

  get nonce() {
    return this.prisma.ltiNonce;
  }

  get session() {
    return this.prisma.ltiSession;
  }

  get lineItem() {
    return this.prisma.ltiLineItem;
  }

  get score() {
    return this.prisma.ltiScore;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
