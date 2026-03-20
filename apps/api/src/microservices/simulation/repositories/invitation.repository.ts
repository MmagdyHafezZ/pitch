import { Injectable } from '@nestjs/common';
import { Types, Model } from 'mongoose';
import { MongoConnectionService } from '../services/mongo/mongo-connection.service';
import {
  SessionInvitationModel,
  SessionInvitationSchema,
  type ISessionInvitation,
} from '../schemas/mongodb';

/**
 * Interface for creating a new invitation
 */
export interface CreateInvitationData {
  sessionId: string;
  inviterId: string;
  inviterSnapshot?: Record<string, any>;
  inviteeId: string;
  inviteeSnapshot?: Record<string, any>;
  message?: string;
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly mongo: MongoConnectionService) {}

  private async getModel(): Promise<Model<ISessionInvitation>> {
    const connected = await this.mongo.waitUntilConnected(10000);
    if (!connected) {
      throw new Error('MongoDB connection is not initialized');
    }

    return this.mongo.getModel<ISessionInvitation>(
      SessionInvitationModel,
      SessionInvitationSchema,
    );
  }

  async create(data: CreateInvitationData): Promise<ISessionInvitation> {
    const model = await this.getModel();
    const doc = await model.create({
      _id: new Types.ObjectId().toHexString(),
      sessionId: data.sessionId,
      inviterId: data.inviterId,
      inviterSnapshot: data.inviterSnapshot,
      inviteeId: data.inviteeId,
      inviteeSnapshot: data.inviteeSnapshot,
      message: data.message,
      status: 'pending',
    });

    return doc.toObject();
  }

  async createMany(
    invitations: CreateInvitationData[],
  ): Promise<{ count: number }> {
    if (invitations.length === 0) {
      return { count: 0 };
    }

    const docs = invitations.map((invitation) => ({
      _id: new Types.ObjectId().toHexString(),
      sessionId: invitation.sessionId,
      inviterId: invitation.inviterId,
      inviterSnapshot: invitation.inviterSnapshot,
      inviteeId: invitation.inviteeId,
      inviteeSnapshot: invitation.inviteeSnapshot,
      message: invitation.message,
      status: 'pending',
    }));

    const model = await this.getModel();
    const result = await model.insertMany(docs, {
      ordered: false,
    });

    return { count: Array.isArray(result) ? result.length : 0 };
  }

  async findById(id: string): Promise<ISessionInvitation | null> {
    const model = await this.getModel();
    return (await model
      .findById(id)
      .lean()) as unknown as ISessionInvitation | null;
  }

  async findBySessionId(sessionId: string): Promise<ISessionInvitation[]> {
    const model = await this.getModel();
    return (await model
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .lean()) as unknown as ISessionInvitation[];
  }

  async findByInviteeId(
    inviteeId: string,
    status?: string,
  ): Promise<ISessionInvitation[]> {
    const model = await this.getModel();
    const query: Record<string, any> = { inviteeId };
    if (status) {
      query.status = status;
    }

    return (await model
      .find(query)
      .sort({ createdAt: -1 })
      .lean()) as unknown as ISessionInvitation[];
  }

  async findByInviterId(
    inviterId: string,
    status?: string,
  ): Promise<ISessionInvitation[]> {
    const model = await this.getModel();
    const query: Record<string, any> = { inviterId };
    if (status) {
      query.status = status;
    }

    return (await model
      .find(query)
      .sort({ createdAt: -1 })
      .lean()) as unknown as ISessionInvitation[];
  }

  async updateStatus(id: string, status: string): Promise<ISessionInvitation> {
    const model = await this.getModel();
    const respondedAt = status !== 'pending' ? new Date() : null;
    const updated = (await model
      .findByIdAndUpdate(id, { status, respondedAt }, { new: true })
      .lean()) as unknown as ISessionInvitation | null;

    if (!updated) {
      throw new Error(`Invitation with ID ${id} not found`);
    }

    return updated;
  }

  async existsForSessionAndInvitee(
    sessionId: string,
    inviteeId: string,
  ): Promise<ISessionInvitation | null> {
    const model = await this.getModel();
    return (await model
      .findOne({ sessionId, inviteeId })
      .lean()) as unknown as ISessionInvitation | null;
  }

  async delete(id: string): Promise<void> {
    const model = await this.getModel();
    await model.findByIdAndDelete(id);
  }

  async countPendingForInvitee(inviteeId: string): Promise<number> {
    const model = await this.getModel();
    return await model.countDocuments({
      inviteeId,
      status: 'pending',
    });
  }

  async countBySessionAndStatus(
    sessionId: string,
    status?: string,
  ): Promise<number> {
    const model = await this.getModel();
    const query: Record<string, any> = { sessionId };
    if (status) {
      query.status = status;
    }

    return await model.countDocuments(query);
  }
}
