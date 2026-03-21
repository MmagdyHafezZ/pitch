import { Schema, Document } from 'mongoose';

export interface IAdminAuditLog extends Document {
  adminEmail: string;
  action: string;
  targetId?: string;
  targetType?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  timestamp: Date;
}

export const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminEmail: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    targetId: { type: String, index: true },
    targetType: { type: String, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true, index: true },
  },
  {
    collection: 'adminAuditLogs',
  },
);

// TTL: 1 year
AdminAuditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);

export const AdminAuditLogModel = 'AdminAuditLog';
