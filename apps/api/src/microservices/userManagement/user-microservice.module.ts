import { Module } from '@nestjs/common';

import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TeamModule } from './team/team.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PlansModule } from './plans/plans.module';
import { CoinsModule } from './coins/coins.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    TeamModule,
    SubscriptionModule,
    PlansModule,
    CoinsModule,
  ],
})
export class UserMicroserviceModule {}
