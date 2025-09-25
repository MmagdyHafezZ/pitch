import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from './prisma/generated/client';

@Injectable()
export class AuthPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AuthPrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('🔗 Auth database connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to auth database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('📴 Auth database disconnected');
    } catch (error) {
      this.logger.error('❌ Error disconnecting from auth database', error);
    }
  }
}
