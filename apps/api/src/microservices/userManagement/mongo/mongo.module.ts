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
      useFactory: (cfg: ConfigService) => {
        const uri =
          cfg.get<string>('MONGODB_USERMANAGEMENT_URI') ??
          cfg.get<string>('USER_MANAGEMENT_MONGODB_URL') ??
          cfg.get<string>('MONGODB_URL') ??
          process.env.MONGODB_USERMANAGEMENT_URI ??
          process.env.USER_MANAGEMENT_MONGODB_URL ??
          process.env.MONGODB_URL;

        if (!uri) {
          throw new Error(
            'MongoDB URI missing. Set one of: MONGODB_USERMANAGEMENT_URI, USER_MANAGEMENT_MONGODB_URL, or MONGODB_URL.',
          );
        }

        return {
          uri,
          dbName: cfg.get<string>('MONGODB_USERMANAGEMENT_NAME') ?? undefined,
          autoIndex: cfg.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
    MongooseModule.forFeature([
      { name: CoinLedger.name, schema: CoinLedgerSchema },
      { name: CoinBalance.name, schema: CoinBalanceSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
