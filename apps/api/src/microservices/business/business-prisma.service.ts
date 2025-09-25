import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './prisma/generated';

@Injectable()
export class BusinessPrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}