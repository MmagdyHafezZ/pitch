import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoinLedgerDocument = CoinLedger & Document;

export enum CoinLedgerType {
  RESERVE = 'RESERVE',
  ADJUST = 'ADJUST',
  REFILL = 'REFILL',
  RELEASE = 'RELEASE',
  UPGRADE = 'UPGRADE',
}

@Schema({
  collection: 'coin_ledgers',
  timestamps: { createdAt: true, updatedAt: false },
})
export class CoinLedger {
  @Prop({ required: true, index: true }) teamId: string;
  @Prop({ required: true, index: true }) userId: string;

  @Prop({ required: true, index: true }) subscriptionId: string;
  @Prop({ required: true, index: true }) planId: string;

  @Prop({ required: true, index: true }) periodKey: string;

  @Prop({ required: true, index: true }) requestId: string;

  @Prop({ required: true })
  reservationId: string;

  @Prop({ required: true, enum: CoinLedgerType, index: true })
  type: CoinLedgerType;

  // For RESERVE
  @Prop() estimatedCoins?: number;

  // For ADJUST (actual - estimate), can be +/-.
  @Prop() deltaCoins?: number;

  // For RMQ idempotency (ADJUST)
  @Prop({ unique: true, sparse: true, index: true })
  eventId?: string;

  @Prop() sessionId?: string;
  @Prop() model?: string;
}

export const CoinLedgerSchema = SchemaFactory.createForClass(CoinLedger);

CoinLedgerSchema.index({ teamId: 1, periodKey: 1 });
CoinLedgerSchema.index({ reservationId: 1, type: 1 }, { unique: true });
CoinLedgerSchema.index({ subscriptionId: 1, periodKey: 1 });
