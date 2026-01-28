import { Schema, Document } from 'mongoose';

export interface ISessionInvitation extends Document {
  _id: string;
  sessionId: string;
  inviterId: string;
  inviterSnapshot?: Record<string, any>;
  inviteeId: string;
  inviteeSnapshot?: Record<string, any>;
  status: string;
  message?: string;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const SessionInvitationSchema = new Schema<ISessionInvitation>(
  {
    _id: { type: String, required: true },
    sessionId: { type: String, required: true, index: true },
    inviterId: { type: String, required: true, index: true },
    inviterSnapshot: { type: Schema.Types.Mixed },
    inviteeId: { type: String, required: true, index: true },
    inviteeSnapshot: { type: Schema.Types.Mixed },
    status: { type: String, required: true, default: 'pending', index: true },
    message: { type: String },
    respondedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'sessionInvitations',
  },
);

SessionInvitationSchema.index({ sessionId: 1, inviteeId: 1 }, { unique: true });
SessionInvitationSchema.index({ inviteeId: 1, status: 1, createdAt: -1 });
SessionInvitationSchema.index({ inviterId: 1, status: 1, createdAt: -1 });
SessionInvitationSchema.index({ sessionId: 1, createdAt: -1 });

export const SessionInvitationModel = 'SessionInvitation';
