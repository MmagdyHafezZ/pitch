import { Schema, Document } from 'mongoose';

export interface IAdminRequestLog extends Document {
  adminEmail: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: Date;
}

export const AdminRequestLogSchema = new Schema<IAdminRequestLog>(
  {
    adminEmail: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true, index: true },
    statusCode: { type: Number, required: true, index: true },
    durationMs: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
  },
  {
    collection: 'adminRequestLogs',
  },
);

// TTL: 30 days
AdminRequestLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export const AdminRequestLogModel = 'AdminRequestLog';
