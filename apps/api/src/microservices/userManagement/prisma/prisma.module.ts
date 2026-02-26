import { Global, Module } from '@nestjs/common';
import { UserPrismaService } from './user-prisma.service';

@Global()
@Module({
  providers: [UserPrismaService],
  exports: [UserPrismaService],
})
export class PrismaModule {}
