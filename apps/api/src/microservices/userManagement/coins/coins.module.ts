import { forwardRef, Module } from '@nestjs/common';
import { CoinsConsumer } from './controllers/coins.consumer';
import { CoinAccountingService } from './services/coin-accounting.service';
import { CoinRedisService } from './services/coin-redis.service';
import { CoinSessionService } from './services/coin-session.service';
import { CoinLedgerRepository } from './repositories/coin-ledger.repository';
import { CoinBalanceRepository } from './repositories/coin-balance.repository';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PlansModule } from '../plans/plans.module';
import { UserModule } from '../user/user.module';
import { TeamModule } from '../team/team.module';
import { CoinRefillCron } from './services/coin-refill-cron.service';
import { CoinRefillService } from './services/coin-refill.service';
import { NotificationModule } from '../notifications/notification.module';
import { TeamMembershipAccessGuard } from '../guards/team-membership-access.guard';

@Module({
  imports: [
    forwardRef(() => SubscriptionModule),
    PlansModule,
    forwardRef(() => UserModule),
    TeamModule,
    NotificationModule,
  ],
  controllers: [CoinsConsumer],
  providers: [
    CoinRedisService,
    CoinAccountingService,
    CoinSessionService,
    CoinRefillCron,
    CoinRefillService,
    CoinLedgerRepository,
    CoinBalanceRepository,
    TeamMembershipAccessGuard,
  ],
  exports: [
    CoinAccountingService,
    CoinRedisService,
    CoinRefillService,
    CoinSessionService,
  ],
})
export class CoinsModule {}
