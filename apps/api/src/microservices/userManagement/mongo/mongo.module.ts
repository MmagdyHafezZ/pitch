import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { CoinLedger, CoinLedgerSchema } from './schemas/coin-ledger.schema';
import { CoinBalance, CoinBalanceSchema } from './schemas/coin-balance.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGODB_USERMANAGEMENT_URI'),
        dbName: cfg.get<string>('MONGODB_USERMANAGEMENT_NAME') ?? undefined,
        autoIndex: cfg.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    MongooseModule.forFeature([
      { name: CoinLedger.name, schema: CoinLedgerSchema },
      { name: CoinBalance.name, schema: CoinBalanceSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
