import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient as UserPrismaClient } from '@prisma/user-client';

@Injectable()
export class UserPrismaService
  extends UserPrismaClient
  implements OnModuleInit
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
