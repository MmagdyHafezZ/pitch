import { Schema, Document } from 'mongoose';

/**
 * EventLog - MongoDB document
 *
 * Stores verbose event payloads that are too large for PostgreSQL.
 * Used for debugging, audit trails, and detailed event analysis.
 *
 * Referenced by Event.mongoEventLogId in PostgreSQL (optional).
 *
 * Storage: MongoDB (authoritative for verbose event data)
 * Reference: PostgreSQL Event model (minimal with type/timestamp)
 */

export interface IEventLog extends Document {
  _id: string;
  eventId?: string;
  sessionMemberId: string;
  type: string;

  payload: Record<string, any>;

  context?: {
    userId?: string;
    orgId?: string;
    traceId?: string;
    correlationId?: string;
    source?: string;
    version?: string;
  };

  metadata?: {
    size?: number;
    compressed?: boolean;
    retryCount?: number;
    processingTimeMs?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const EventLogSchema = new Schema<IEventLog>(
  {
    _id: { type: String, required: true },
    eventId: { type: String, index: true },
    sessionMemberId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },

    payload: { type: Schema.Types.Mixed, required: true },

    context: {
      userId: { type: String },
      orgId: { type: String, index: true },
      traceId: { type: String },
      correlationId: { type: String, index: true },
      source: { type: String },
      version: { type: String },
    },

    metadata: {
      size: { type: Number },
      compressed: { type: Boolean, default: false },
      retryCount: { type: Number, default: 0 },
      processingTimeMs: { type: Number },
    },
  },
  {
    timestamps: true,
    collection: 'eventLogs',
  },
);

EventLogSchema.index({ sessionMemberId: 1, type: 1 });
EventLogSchema.index({ sessionMemberId: 1, createdAt: -1 });
EventLogSchema.index({ type: 1, createdAt: -1 });
EventLogSchema.index({ 'context.orgId': 1, createdAt: -1 });
EventLogSchema.index({ 'context.traceId': 1 });

EventLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export const EventLogModel = 'EventLog';
