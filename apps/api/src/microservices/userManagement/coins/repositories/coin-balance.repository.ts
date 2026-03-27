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

  async findByTeamAndPeriodKey(teamId: string, periodKey: string) {
    return this.model.findOne({ teamId, periodKey }).lean();
  }

  async getRemaining(
    teamId: string,
    periodKey: string,
  ): Promise<number | null> {
    const doc = await this.model
      .findOne({ teamId, periodKey }, { remaining: 1 })
      .lean<{ remaining?: unknown }>();

    const remaining = doc?.remaining;
    if (remaining === undefined || remaining === null) return null;

    return typeof remaining === 'number' ? remaining : Number(remaining);
  }

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
    estimatedCoins: number;
    deltaCoins: number;
  }) {
    const actualCoins = args.estimatedCoins + args.deltaCoins;

    return this.model.updateOne(
      { teamId: args.teamId, periodKey: args.periodKey },
      [
        {
          $set: {
            teamId: args.teamId,
            periodKey: args.periodKey,
            remaining: args.remainingAfter,
            lastEventId: args.eventId,
            lastReservationId: args.reservationId,
            lastRequestId: args.requestId,
          },
        },
        {
          $set: {
            reserved: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ['$reserved', 0] },
                    args.estimatedCoins,
                  ],
                },
              ],
            },
            usedActual: {
              $max: [
                0,
                { $add: [{ $ifNull: ['$usedActual', 0] }, actualCoins] },
              ],
            },
          },
        },
      ],
      { upsert: true },
    );
  }

  async findAll(): Promise<CoinBalance[]> {
    return this.model.find().lean<CoinBalance[]>().exec();
  }

  upsertRefill(args: {
    teamId: string;
    subscriptionId: string;
    periodKey: string;
    allowance: number;
    remainingAfter: number;
    debtApplied: number;
    eventId: string;
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
          lastEventId: args.eventId,
        },
      },
      { upsert: true },
    );
  }
}
