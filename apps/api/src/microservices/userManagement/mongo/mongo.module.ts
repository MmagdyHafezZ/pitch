import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CoinLedger, CoinLedgerSchema } from './schemas/coin-ledger.schema';
import { CoinBalance, CoinBalanceSchema } from './schemas/coin-balance.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGO_URI'),
        dbName: cfg.get<string>('MONGO_DB_NAME') ?? undefined,
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
