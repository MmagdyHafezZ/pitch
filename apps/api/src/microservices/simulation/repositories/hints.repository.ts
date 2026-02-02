import { Injectable } from '@nestjs/common';
import { Types, Model } from 'mongoose';
import { MongoConnectionService } from '../services/mongo/mongo-connection.service';
import {
  HintDocument,
  HintSchema,
  HintModel,
} from '../schemas/mongodb/hint.schema';
import { HintStrategy } from '../dto/hints.dto';

/**
 * Interface for creating a new hint document
 */
export interface CreateHintData {
  sessionId: string;
  turnId?: string;
  userId?: string;
  orgId?: string;
  strategy: HintStrategy;
  hints: Array<{
    id: string;
    type: string;
    content: string;
    rationale?: string;
    score?: number;
    context?: any;
  }>;
  llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    routingHints?: Record<string, any>;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  conversationContext?: any;
  generatedAt: Date;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Repository for hint document operations
 */
@Injectable()
export class HintsRepository {
  constructor(private readonly mongo: MongoConnectionService) {}

  private get model(): Model<HintDocument> {
    if (!this.mongo.isConnected()) {
      throw new Error('MongoDB connection is not initialized');
    }

    return this.mongo.getModel<HintDocument>(HintModel, HintSchema);
  }

  /**
   * Create a new hint document
   */
  async create(data: CreateHintData): Promise<HintDocument> {
    const doc = await this.model.create({
      _id: new Types.ObjectId().toHexString(),
      ...data,
    });

    return doc.toObject() as HintDocument;
  }

  /**
   * Find hint by ID
   */
  async findById(id: string): Promise<HintDocument | null> {
    return (await this.model
      .findById(id)
      .lean()) as unknown as HintDocument | null;
  }

  /**
   * Find hints by session ID
   */
  async findBySessionId(
    sessionId: string,
    limit: number = 10,
  ): Promise<HintDocument[]> {
    return (await this.model
      .find({ sessionId })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean()) as unknown as HintDocument[];
  }

  /**
   * Find hints by session ID and hint type
   */
  async findBySessionIdAndType(
    sessionId: string,
    type: string,
    limit: number = 10,
  ): Promise<HintDocument[]> {
    return (await this.model
      .find({ sessionId, 'hints.type': type })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean()) as unknown as HintDocument[];
  }

  /**
   * Find hints by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 10,
  ): Promise<HintDocument[]> {
    return (await this.model
      .find({ userId })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean()) as unknown as HintDocument[];
  }

  /**
   * Find hints by org ID
   */
  async findByOrgId(
    orgId: string,
    limit: number = 10,
  ): Promise<HintDocument[]> {
    return (await this.model
      .find({ orgId })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean()) as unknown as HintDocument[];
  }

  /**
   * Count hints by session ID
   */
  async countBySessionId(sessionId: string): Promise<number> {
    return await this.model.countDocuments({ sessionId }).exec();
  }

  /**
   * Count hints by session ID and type
   */
  async countBySessionIdAndType(
    sessionId: string,
    type: string,
  ): Promise<number> {
    return await this.model
      .countDocuments({ sessionId, 'hints.type': type })
      .exec();
  }

  /**
   * Delete hint by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Delete all hints for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.model.deleteMany({ sessionId }).exec();
    return result.deletedCount;
  }
}
