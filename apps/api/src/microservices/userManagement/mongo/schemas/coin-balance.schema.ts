import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoinBalanceDocument = CoinBalance & Document;

@Schema({
  collection: 'coin_balances',
  timestamps: true,
})
export class CoinBalance {
  @Prop({ required: true, index: true }) teamId: string;
  @Prop({ required: true, index: true }) subscriptionId: string;
  @Prop({ required: true, index: true }) periodKey: string;

  @Prop({ required: true }) allowance: number;
  @Prop({ required: true, default: 0 }) reserved: number;
  @Prop({ required: true, default: 0 }) usedActual: number;

  @Prop({ required: true }) remaining: number;

  @Prop() lastReservationId?: string;
  @Prop() lastEventId?: string;
  @Prop() lastRequestId?: string;
}

export const CoinBalanceSchema = SchemaFactory.createForClass(CoinBalance);

CoinBalanceSchema.index({ teamId: 1, periodKey: 1 }, { unique: true });
CoinBalanceSchema.index({ subscriptionId: 1, periodKey: 1 });
