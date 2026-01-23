import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CoinBalance,
  CoinBalanceDocument,
} from '../../mongo/schemas/coin-balance.schema';

@Injectable()
export class CoinBalanceRepository {
  constructor(
    @InjectModel(CoinBalance.name)
    private readonly model: Model<CoinBalanceDocument>,
  ) {}

  upsertReserve(args: {
    teamId: string;
    subscriptionId: string;
    periodKey: string;
    allowance: number;
    estimatedCoins: number;
    remainingAfter: number;
    reservationId: string;
    requestId: string;
  }) {
    return this.model.updateOne(
      { teamId: args.teamId, periodKey: args.periodKey },
      {
        $set: {
          teamId: args.teamId,
          subscriptionId: args.subscriptionId,
          periodKey: args.periodKey,
          allowance: args.allowance,
          remaining: args.remainingAfter,
          lastReservationId: args.reservationId,
          lastRequestId: args.requestId,
        },
        $inc: { reserved: args.estimatedCoins },
      },
      { upsert: true },
    );
  }

  upsertAdjust(args: {
    teamId: string;
    periodKey: string;
    remainingAfter: number;
    eventId: string;
    reservationId: string;
    requestId: string;
  }) {
    return this.model.updateOne(
      { teamId: args.teamId, periodKey: args.periodKey },
      {
        $set: {
          remaining: args.remainingAfter,
          lastEventId: args.eventId,
          lastReservationId: args.reservationId,
          lastRequestId: args.requestId,
        },
      },
      { upsert: true },
    );
  }
}
