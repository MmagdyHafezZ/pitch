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

  create(doc: Partial<CoinLedger>) {
    return this.model.create(doc);
  }

  async existsByEventId(eventId: string): Promise<boolean> {
    const res = await this.model.exists({ eventId });
    return !!res;
  }

  async existsByReservationId(reservationId: string): Promise<boolean> {
    const res = await this.model.exists({ reservationId });
    return !!res;
  }

  async createRefillIfNotExists(args: {
    eventId: string;
    teamId: string;
    subscriptionId: string;
    planId: string;
    periodKey: string;
    allowance: number;
    debtApplied: number;
    remainingAfter: number;
  }) {
    if (await this.existsByEventId(args.eventId)) return;

    await this.create({
      type: CoinLedgerType.REFILL,
      eventId: args.eventId,
      teamId: args.teamId,
      subscriptionId: args.subscriptionId,
      planId: args.planId,
      periodKey: args.periodKey,
      allowance: args.allowance,
      debtApplied: args.debtApplied,
      remainingAfter: args.remainingAfter,
    } as any);
  }
}
