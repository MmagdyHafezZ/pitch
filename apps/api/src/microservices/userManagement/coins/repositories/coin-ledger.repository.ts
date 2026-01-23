import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CoinLedger,
  CoinLedgerDocument,
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
}
