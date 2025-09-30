import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserPrismaService } from './user-prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, UserPrismaService],
})
export class UserModule {}
