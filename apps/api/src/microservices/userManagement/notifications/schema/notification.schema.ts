import { Schema, Document } from 'mongoose';

export enum NotificationSourceType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface NotificationDocument extends Document {
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  severity: NotificationSeverity;
  sourceType: NotificationSourceType;
  sourceUserId?: string;
  metadata?: Record<string, unknown>;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = new Schema<NotificationDocument>(
  {
    recipientUserId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: Object.values(NotificationSeverity),
      default: NotificationSeverity.INFO,
      index: true,
    },
    sourceType: {
      type: String,
      enum: Object.values(NotificationSourceType),
      required: true,
      index: true,
    },
    sourceUserId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

NotificationSchema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, sourceType: 1, createdAt: -1 });
