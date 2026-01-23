import { Module } from '@nestjs/common';
import { MongoModule } from '../mongo/mongo.module';
import { CoinsConsumer } from './controllers/coins.consumer';
import { CoinAccountingService } from './services/coin-accounting.service';
import { CoinRedisService } from './services/coin-redis.service';
import { CoinLedgerRepository } from './repositories/coin-ledger.repository';
import { CoinBalanceRepository } from './repositories/coin-balance.repository';

@Module({
  imports: [MongoModule],
  controllers: [CoinsConsumer],
  providers: [
    CoinRedisService,
    CoinLedgerRepository,
    CoinBalanceRepository,
    CoinAccountingService,
  ],
  exports: [CoinAccountingService],
})
export class CoinsModule {}
