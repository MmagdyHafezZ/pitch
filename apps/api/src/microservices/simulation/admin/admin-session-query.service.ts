import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { MongoConnectionService } from '../services/mongo/mongo-connection.service';
import {
  EventLogModel,
  EventLogSchema,
  EnrichedTranscriptModel,
  EnrichedTranscriptSchema,
  LLMTraceModel,
  LLMTraceSchema,
  type IEventLog,
  type IEnrichedTranscript,
  type ILLMTrace,
} from '../schemas/mongodb';

@Injectable()
export class AdminSessionQueryService {
  constructor(private readonly mongo: MongoConnectionService) {}

  private async getEventLogModel(): Promise<Model<IEventLog>> {
    const connected = await this.mongo.waitUntilConnected(10000);
    if (!connected) throw new Error('MongoDB connection is not initialized');
    return this.mongo.getModel<IEventLog>(EventLogModel, EventLogSchema);
  }

  private async getTranscriptModel(): Promise<Model<IEnrichedTranscript>> {
    const connected = await this.mongo.waitUntilConnected(10000);
    if (!connected) throw new Error('MongoDB connection is not initialized');
    return this.mongo.getModel<IEnrichedTranscript>(
      EnrichedTranscriptModel,
      EnrichedTranscriptSchema,
    );
  }

  private async getLLMTraceModel(): Promise<Model<ILLMTrace>> {
    const connected = await this.mongo.waitUntilConnected(10000);
    if (!connected) throw new Error('MongoDB connection is not initialized');
    return this.mongo.getModel<ILLMTrace>(LLMTraceModel, LLMTraceSchema);
  }

  async getSessionEvents(iterationId: string, limit: number, skip: number) {
    const model = await this.getEventLogModel();
    const [events, total] = await Promise.all([
      model
        .find({ iterationId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      model.countDocuments({ iterationId }).exec(),
    ]);
    return { events, total };
  }

  async getSessionTranscript(iterationId: string) {
    const model = await this.getTranscriptModel();
    return model.findOne({ iterationId }).lean().exec();
  }

  async getSessionLlmCalls(iterationId: string, limit: number, skip: number) {
    const model = await this.getLLMTraceModel();
    const [traces, total] = await Promise.all([
      model
        .find({ iterationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      model.countDocuments({ iterationId }).exec(),
    ]);
    return { traces, total };
  }
}
