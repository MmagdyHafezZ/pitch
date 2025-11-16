import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as UserPrismaClient } from '@prisma/user-client';

/**
 * User Prisma Service
 *
 * Manages database connection lifecycle for the user microservice.
 * Connects on module initialization and disconnects on module destruction.
 */
@Injectable()
export class UserPrismaService
  extends UserPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Connects to the database when the module is initialized
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Disconnects from the database when the module is destroyed
   * Ensures proper cleanup of database connections
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
