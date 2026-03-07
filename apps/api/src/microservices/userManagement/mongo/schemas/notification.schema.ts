import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum NotificationSourceType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export type NotificationDocument = Notification & Document;

@Schema({
  timestamps: true,
  minimize: false,
  collection: 'notifications',
})
export class Notification {
  @Prop({ required: true, index: true }) recipientUserId: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) message: string;
  @Prop({ required: true, index: true }) type: string;

  @Prop({
    enum: Object.values(NotificationSeverity),
    default: NotificationSeverity.INFO,
    index: true,
  })
  severity: NotificationSeverity;

  @Prop({
    enum: Object.values(NotificationSourceType),
    required: true,
    index: true,
  })
  sourceType: NotificationSourceType;

  @Prop({ default: null }) sourceUserId?: string;
  @Prop({ type: Object, default: {} }) metadata?: Record<string, unknown>;
  @Prop({ type: Date, default: null, index: true }) readAt?: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, sourceType: 1, createdAt: -1 });
