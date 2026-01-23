import { Module } from '@nestjs/common';

import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TeamModule } from './team/team.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PlansModule } from './plans/plans.module';
import { CoinsModule } from './coins/coins.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MongoModule } from './mongo/mongo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UserModule,
    AuthModule,
    TeamModule,
    SubscriptionModule,
    PlansModule,
    CoinsModule,
    PrismaModule,
    MongoModule,
  ],
})
export class UserMicroserviceModule {}
