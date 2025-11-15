import { Schema, Document } from 'mongoose';

/**
 * EvalArtifactData - MongoDB document
 *
 * Stores detailed evaluation artifacts from various frameworks
 * (RAGAS, DeepEval, LLM judges, custom evaluators).
 *
 * Referenced by EvalArtifact.id in PostgreSQL (same ID).
 *
 * Storage: MongoDB (authoritative for large evaluation data)
 * Reference: PostgreSQL EvalArtifact model (stub with kind/score)
 */

export interface IEvalArtifactData extends Document {
  _id: string; // Same as PostgreSQL EvalArtifact.id (cuid)
  sessionId: string;
  turnId?: string;
  kind: string; // "ragas" | "deepeval" | "llm_judge" | "prompt_eval"

  // Full evaluation data (can be large)
  data: {
    // RAGAS metrics
    ragas?: {
      faithfulness?: number;
      answer_relevancy?: number;
      context_precision?: number;
      context_recall?: number;
      answer_correctness?: number;
      answer_similarity?: number;
      harmfulness?: number;
    };

    // DeepEval metrics
    deepeval?: {
      answerRelevancy?: number;
      faithfulness?: number;
      contextualPrecision?: number;
      contextualRecall?: number;
      hallucination?: number;
      toxicity?: number;
      bias?: number;
    };

    // LLM Judge results
    llmJudge?: {
      model: string;
      prompt: string;
      response: string;
      reasoning: string;
      score: number;
      criteria: Array<{
        name: string;
        score: number;
        feedback: string;
      }>;
    };

    // Prompt evaluation
    promptEval?: {
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      cost?: number;
      modelParams?: Record<string, any>;
    };

    // Custom evaluator results
    custom?: Record<string, any>;
  };

  // Overall aggregated score (denormalized from PostgreSQL)
  score?: number;

  // Evaluation metadata
  metadata?: {
    evaluatorVersion?: string;
    modelVersion?: string;
    evaluatedAt?: Date;
    processingTimeMs?: number;
    contextUsed?: {
      retrievedDocs?: number;
      totalTokens?: number;
    };
  };

  createdAt: Date;
  updatedAt: Date;
}

export const EvalArtifactDataSchema = new Schema<IEvalArtifactData>(
  {
    _id: { type: String, required: true }, // Same as Postgres EvalArtifact.id
    sessionId: { type: String, required: true, index: true },
    turnId: { type: String, index: true },
    kind: { type: String, required: true, index: true },

    data: {
      ragas: {
        faithfulness: { type: Number },
        answer_relevancy: { type: Number },
        context_precision: { type: Number },
        context_recall: { type: Number },
        answer_correctness: { type: Number },
        answer_similarity: { type: Number },
        harmfulness: { type: Number },
      },
      deepeval: {
        answerRelevancy: { type: Number },
        faithfulness: { type: Number },
        contextualPrecision: { type: Number },
        contextualRecall: { type: Number },
        hallucination: { type: Number },
        toxicity: { type: Number },
        bias: { type: Number },
      },
      llmJudge: {
        model: { type: String },
        prompt: { type: String },
        response: { type: String },
        reasoning: { type: String },
        score: { type: Number },
        criteria: [
          {
            name: { type: String, required: true },
            score: { type: Number, required: true },
            feedback: { type: String },
          },
        ],
      },
      promptEval: {
        inputTokens: { type: Number },
        outputTokens: { type: Number },
        latencyMs: { type: Number },
        cost: { type: Number },
        modelParams: { type: Schema.Types.Mixed },
      },
      custom: { type: Schema.Types.Mixed },
    },

    score: { type: Number },

    metadata: {
      evaluatorVersion: { type: String },
      modelVersion: { type: String },
      evaluatedAt: { type: Date },
      processingTimeMs: { type: Number },
      contextUsed: {
        retrievedDocs: { type: Number },
        totalTokens: { type: Number },
      },
    },
  },
  {
    timestamps: true,
    collection: 'evalArtifactData',
  },
);

// Indexes for common queries
EvalArtifactDataSchema.index({ sessionId: 1, kind: 1 });
EvalArtifactDataSchema.index({ turnId: 1 });
EvalArtifactDataSchema.index({ kind: 1, score: -1 });
EvalArtifactDataSchema.index({ createdAt: -1 });

export const EvalArtifactDataModel = 'EvalArtifactData';
