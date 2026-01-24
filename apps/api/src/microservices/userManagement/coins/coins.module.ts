import { forwardRef, Module } from '@nestjs/common';
import { CoinsConsumer } from './controllers/coins.consumer';
import { CoinAccountingService } from './services/coin-accounting.service';
import { CoinRedisService } from './services/coin-redis.service';
import { CoinLedgerRepository } from './repositories/coin-ledger.repository';
import { CoinBalanceRepository } from './repositories/coin-balance.repository';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PlansModule } from '../plans/plans.module';
import { CoinRefillCron } from './services/coin-refill-cron.service';
import { CoinRefillService } from './services/coin-refill.service';

@Module({
  imports: [forwardRef(() => SubscriptionModule), PlansModule],
  controllers: [CoinsConsumer],
  providers: [
    CoinRedisService,
    CoinAccountingService,
    CoinRefillCron,
    CoinRefillService,
    CoinLedgerRepository,
    CoinBalanceRepository,
  ],
  exports: [CoinAccountingService, CoinRedisService, CoinRefillService],
})
export class CoinsModule {}
