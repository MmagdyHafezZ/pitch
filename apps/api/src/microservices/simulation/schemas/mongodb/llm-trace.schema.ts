import { Schema, Document } from 'mongoose';

/**
 * LLMTrace - MongoDB document
 *
 * Stores detailed LLM interaction traces including prompts, responses,
 * token usage, latency, and model parameters.
 *
 * Used for debugging, prompt optimization, and cost analysis.
 *
 * Storage: MongoDB (authoritative for LLM trace data)
 * Reference: Can be linked from Turn, ToolCall, or Message via metadata
 */

export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ILLMTrace extends Document {
  _id: string;
  iterationId: string;
  sessionMemberId?: string;
  turnId?: string;
  toolCallId?: string;
  messageId?: string;

  provider: string;
  llmModel: string;
  modelVersion?: string;

  request: {
    messages: ILLMMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    stream?: boolean;
    tools?: Array<{
      type: string;
      function: {
        name: string;
        description?: string;
        parameters?: Record<string, any>;
      };
    }>;
    toolChoice?: string | Record<string, any>;
  };

  response: {
    content?: string;
    role?: string;
    finishReason?: string;
    toolCalls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };

  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };

  performance: {
    latencyMs: number;
    timeToFirstTokenMs?: number;
    tokensPerSecond?: number;
    requestId?: string;
  };

  context?: {
    userId?: string;
    orgId?: string;
    traceId?: string;
    purpose?: string;
  };

  error?: {
    occurred: boolean;
    type?: string;
    message?: string;
    retryCount?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const LLMTraceSchema = new Schema<ILLMTrace>(
  {
    _id: { type: String, required: true },
    iterationId: { type: String, required: true, index: true },
    sessionMemberId: { type: String, index: true },
    turnId: { type: String, index: true },
    toolCallId: { type: String, index: true },
    messageId: { type: String, index: true },

    provider: { type: String, required: true, index: true },
    llmModel: { type: String, required: true, index: true },
    modelVersion: { type: String },

    request: {
      messages: [
        {
          role: {
            type: String,
            required: true,
            enum: ['system', 'user', 'assistant', 'tool'],
          },
          content: { type: String, required: true },
          name: { type: String },
          toolCallId: { type: String },
        },
      ],
      temperature: { type: Number },
      maxTokens: { type: Number },
      topP: { type: Number },
      frequencyPenalty: { type: Number },
      presencePenalty: { type: Number },
      stop: [{ type: String }],
      stream: { type: Boolean },
      tools: [
        {
          type: { type: String },
          function: {
            name: { type: String, required: true },
            description: { type: String },
            parameters: { type: Schema.Types.Mixed },
          },
        },
      ],
      toolChoice: { type: Schema.Types.Mixed },
    },

    response: {
      content: { type: String },
      role: { type: String },
      finishReason: {
        type: String,
        enum: ['stop', 'length', 'tool_calls', 'content_filter', 'error'],
      },
      toolCalls: [
        {
          id: { type: String, required: true },
          type: { type: String, required: true },
          function: {
            name: { type: String, required: true },
            arguments: { type: String, required: true },
          },
        },
      ],
    },

    usage: {
      promptTokens: { type: Number, required: true },
      completionTokens: { type: Number, required: true },
      totalTokens: { type: Number, required: true },
      cost: { type: Number },
    },

    performance: {
      latencyMs: { type: Number, required: true },
      timeToFirstTokenMs: { type: Number },
      tokensPerSecond: { type: Number },
      requestId: { type: String },
    },

    context: {
      userId: { type: String },
      orgId: { type: String, index: true },
      traceId: { type: String, index: true },
      purpose: {
        type: String,
        enum: ['chat', 'tool_call', 'evaluation', 'enrichment', 'other'],
      },
    },

    error: {
      occurred: { type: Boolean, default: false },
      type: { type: String },
      message: { type: String },
      retryCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: 'llmTraces',
  },
);

LLMTraceSchema.index({ iterationId: 1, createdAt: -1 });
LLMTraceSchema.index({ sessionMemberId: 1, createdAt: -1 });
LLMTraceSchema.index({ provider: 1, llmModel: 1 });
LLMTraceSchema.index({ 'context.orgId': 1, createdAt: -1 });
LLMTraceSchema.index({ 'context.purpose': 1 });
LLMTraceSchema.index({ 'usage.totalTokens': -1 });
LLMTraceSchema.index({ 'performance.latencyMs': -1 });
LLMTraceSchema.index({ 'error.occurred': 1 });

LLMTraceSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);

export const LLMTraceModel = 'LLMTrace';
