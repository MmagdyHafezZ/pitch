import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CoinLedger,
  CoinLedgerDocument,
  CoinLedgerType,
} from '../../mongo/schemas/coin-ledger.schema';

@Injectable()
export class CoinLedgerRepository {
  constructor(
    @InjectModel(CoinLedger.name)
    private readonly model: Model<CoinLedgerDocument>,
  ) {}

  create(doc: Partial<CoinLedger>): Promise<CoinLedger> {
    return this.model.create(doc);
  }

  async existsByEventId(eventId: string): Promise<boolean> {
    const res = await this.model.exists({ eventId });
    return !!res;
  }

  async findByReservationId(reservationId: string): Promise<CoinLedger | null> {
    return this.model
      .findOne({
        reservationId,
        type: CoinLedgerType.RESERVE,
      })
      .lean();
  }

  async findAllByReservationId(reservationId: string): Promise<CoinLedger[]> {
    return this.model.find({ reservationId }).lean<CoinLedger[]>().exec();
  }

  async findByTeamId(
    teamId: string,
    periodKey?: string,
    limit = 100,
  ): Promise<CoinLedger[]> {
    const filter: Record<string, unknown> = { teamId };
    if (periodKey) filter['periodKey'] = periodKey;
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<CoinLedger[]>()
      .exec();
  }

  async createRefillIfNotExists(args: {
    userId: string;
    eventId: string;
    teamId: string;
    subscriptionId: string;
    planId: string;
    requestId: string;
    reservationId: string;
    periodKey: string;
    allowance: number;
    debtApplied: number;
    remainingAfter: number;
  }) {
    if (await this.existsByEventId(args.eventId)) return;

    await this.create({
      type: CoinLedgerType.REFILL,
      userId: args.userId,
      eventId: args.eventId,
      teamId: args.teamId,
      subscriptionId: args.subscriptionId,
      planId: args.planId,
      requestId: args.requestId,
      reservationId: args.reservationId,
      periodKey: args.periodKey,
      allowance: args.allowance,
      debtApplied: args.debtApplied,
      remainingAfter: args.remainingAfter,
    } satisfies Partial<CoinLedger>);
  }
}
