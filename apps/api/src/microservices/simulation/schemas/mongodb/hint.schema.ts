import { Schema, Document } from 'mongoose';
import { HintType, HintStrategy } from '../../dto/hints.dto';

/**
 * Individual hint within a hint generation
 */
export interface IHint {
  id: string;
  type: HintType;
  content: string;
  rationale?: string;
  score?: number;
  context?: {
    conversationLength?: number;
    lastUserMessage?: string;
    inactivityDuration?: number;
    missingObjectives?: string[];
  };
}

/**
 * LLM configuration used for hint generation
 */
export interface IHintLLMConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  routingHints?: Record<string, any>;
}

/**
 * Token usage for hint generation
 */
export interface IHintUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

/**
 * Conversation context at time of hint generation
 */
export interface IConversationContext {
  messages?: Array<{
    role: string;
    content: string;
    timestamp?: Date;
  }>;
  conversationLength?: number;
  lastUserMessageAt?: Date;
  inactivityDuration?: number;
  objectives?: string[];
  completedObjectives?: string[];
  pendingObjectives?: string[];
}

/**
 * MongoDB document for hint generation history
 * Stores full context and results of each hint generation
 */
export interface IHintDocument extends Document {
  _id: string;
  sessionId: string;
  turnId?: string;
  userId?: string;
  orgId?: string;
  strategy: HintStrategy;
  hints: IHint[];
  llmConfig: IHintLLMConfig;
  usage?: IHintUsage;
  conversationContext?: IConversationContext;
  generatedAt: Date;
  requestId?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export const HintSchema = new Schema<IHintDocument>(
  {
    _id: { type: String, required: true },
    sessionId: { type: String, required: true, index: true },
    turnId: { type: String, index: true },
    userId: { type: String, index: true },
    orgId: { type: String, index: true },
    strategy: {
      type: String,
      required: true,
      enum: Object.values(HintStrategy),
    },
    hints: [
      {
        id: { type: String, required: true },
        type: {
          type: String,
          required: true,
          enum: Object.values(HintType),
        },
        content: { type: String, required: true },
        rationale: { type: String },
        score: { type: Number, min: 0, max: 1 },
        context: {
          conversationLength: { type: Number },
          lastUserMessage: { type: String },
          inactivityDuration: { type: Number },
          missingObjectives: [{ type: String }],
        },
      },
    ],
    llmConfig: {
      provider: { type: String, required: true },
      model: { type: String, required: true },
      temperature: { type: Number },
      maxTokens: { type: Number },
      routingHints: { type: Schema.Types.Mixed },
    },
    usage: {
      promptTokens: { type: Number, required: true },
      completionTokens: { type: Number, required: true },
      totalTokens: { type: Number, required: true },
      cost: { type: Number },
    },
    conversationContext: {
      messages: [
        {
          role: { type: String },
          content: { type: String },
          timestamp: { type: Date },
        },
      ],
      conversationLength: { type: Number },
      lastUserMessageAt: { type: Date },
      inactivityDuration: { type: Number },
      objectives: [{ type: String }],
      completedObjectives: [{ type: String }],
      pendingObjectives: [{ type: String }],
    },
    generatedAt: { type: Date, required: true },
    requestId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'hints',
  },
);

// Create indexes for efficient querying
HintSchema.index({ sessionId: 1, generatedAt: -1 });
HintSchema.index({ userId: 1, generatedAt: -1 });
HintSchema.index({ orgId: 1, generatedAt: -1 });
HintSchema.index({ turnId: 1 });
HintSchema.index({ 'hints.type': 1 });

export const HintModel = 'HintDocument';

// Export type alias for convenience
export type HintDocument = IHintDocument;
