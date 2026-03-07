import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { CoinLedger, CoinLedgerSchema } from './schemas/coin-ledger.schema';
import { CoinBalance, CoinBalanceSchema } from './schemas/coin-balance.schema';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const uri =
          cfg.get<string>('USER_MANAGEMENT_MONGODB_URL') ??
          process.env.USER_MANAGEMENT_MONGODB_URL;

        if (!uri) {
          throw new Error(
            'MongoDB URI missing. Set USER_MANAGEMENT_MONGODB_URL.',
          );
        }

        return {
          uri,
          dbName: cfg.get<string>('USERMANAGEMENT_MONGODB_NAME') ?? undefined,
          autoIndex: cfg.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
    MongooseModule.forFeature([
      { name: CoinLedger.name, schema: CoinLedgerSchema },
      { name: CoinBalance.name, schema: CoinBalanceSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
