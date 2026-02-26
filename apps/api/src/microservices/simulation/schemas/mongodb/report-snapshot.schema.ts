import { Schema, Document } from 'mongoose';

/**
 * ReportSnapshot - MongoDB document
 *
 * Stores full structured report data for JSON format reports.
 * Contains session summary, transcript, scorecard, metrics, and insights.
 *
 * Referenced by ReportRequest.id in PostgreSQL (same ID) for JSON format.
 *
 * Storage: MongoDB (authoritative for structured report data)
 * Reference: PostgreSQL ReportRequest model (tracks status/format)
 */

export interface IReportSnapshot extends Document {
  _id: string;
  iterationId: string;
  sessionMemberId?: string;
  format: 'json';
  generatedAt: Date;

  data: {
    session: {
      id: string;
      mode: string;
      scenario?: {
        name: string;
        description?: string;
      };
      persona?: {
        name: string;
        traits?: Record<string, any>;
      };
      duration?: number;
      startedAt: Date;
      endedAt?: Date;
      status: string;
    };

    turns?: Array<{
      order: number;
      role: string;
      text?: string;
      timestamp: Date;
      metadata?: Record<string, any>;
    }>;

    transcript?: {
      id: string;
      language?: string;
      text: string;
      durationMs?: number;
      speakerCount?: number;
      wordCount?: number;
      summary?: string;
      topics?: Array<{
        label: string;
        confidence?: number;
      }>;
      sentiment?: {
        overall: number;
        trend?: string;
      };
    };

    scorecard?: {
      id: string;
      rubric: {
        name: string;
        version: number;
      };
      totalScore: number;
      maxScore: number;
      percentage?: number;
      items: Array<{
        criterion: string;
        score: number;
        maxPoints: number;
        details?: string;
      }>;
      coachTips?: Array<{
        text: string;
        link?: string;
        excerpt?: string;
      }>;
    };

    metrics?: {
      tokensInput?: number;
      tokensOutput?: number;
      toolCount?: number;
      averageLatencyMs?: number;
      cost?: number;
    };

    benchmarks?: Array<{
      name: string;
      metric: string;
      sessionValue: number;
      benchmarkValue: number;
      percentile?: number;
    }>;

    insights?: {
      strengths?: string[];
      areasForImprovement?: string[];
      recommendations?: string[];
      highlights?: Array<{
        type: string;
        text: string;
        timestamp?: number;
      }>;
    };

    evaluations?: Array<{
      kind: string;
      score: number;
      summary?: string;
    }>;
  };

  metadata?: {
    version: string;
    generatedBy?: string;
    templateVersion?: string;
    locale?: string;
    includeTranscript?: boolean;
    includeScorecard?: boolean;
    includeMetrics?: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const ReportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    _id: { type: String, required: true },
    iterationId: { type: String, required: true },
    sessionMemberId: { type: String },
    format: { type: String, enum: ['json'], default: 'json' },
    generatedAt: { type: Date, required: true },

    data: {
      session: {
        id: { type: String, required: true },
        mode: { type: String, required: true },
        scenario: {
          name: { type: String },
          description: { type: String },
        },
        persona: {
          name: { type: String },
          traits: { type: Schema.Types.Mixed },
        },
        duration: { type: Number },
        startedAt: { type: Date, required: true },
        endedAt: { type: Date },
        status: { type: String, required: true },
      },

      turns: [
        {
          order: { type: Number, required: true },
          role: { type: String, required: true },
          text: { type: String },
          timestamp: { type: Date, required: true },
          metadata: { type: Schema.Types.Mixed },
        },
      ],

      transcript: {
        id: { type: String },
        language: { type: String },
        text: { type: String },
        durationMs: { type: Number },
        speakerCount: { type: Number },
        wordCount: { type: Number },
        summary: { type: String },
        topics: [
          {
            label: { type: String, required: true },
            confidence: { type: Number },
          },
        ],
        sentiment: {
          overall: { type: Number },
          trend: { type: String },
        },
      },

      scorecard: {
        id: { type: String },
        rubric: {
          name: { type: String, required: true },
          version: { type: Number, required: true },
        },
        totalScore: { type: Number },
        maxScore: { type: Number },
        percentage: { type: Number },
        items: [
          {
            criterion: { type: String, required: true },
            score: { type: Number, required: true },
            maxPoints: { type: Number, required: true },
            details: { type: String },
          },
        ],
        coachTips: [
          {
            text: { type: String, required: true },
            link: { type: String },
            excerpt: { type: String },
          },
        ],
      },

      metrics: {
        tokensInput: { type: Number },
        tokensOutput: { type: Number },
        toolCount: { type: Number },
        averageLatencyMs: { type: Number },
        cost: { type: Number },
      },

      benchmarks: [
        {
          name: { type: String, required: true },
          metric: { type: String, required: true },
          sessionValue: { type: Number, required: true },
          benchmarkValue: { type: Number, required: true },
          percentile: { type: Number },
        },
      ],

      insights: {
        strengths: [{ type: String }],
        areasForImprovement: [{ type: String }],
        recommendations: [{ type: String }],
        highlights: [
          {
            type: { type: String, required: true },
            text: { type: String, required: true },
            timestamp: { type: Number },
          },
        ],
      },

      evaluations: [
        {
          kind: { type: String, required: true },
          score: { type: Number, required: true },
          summary: { type: String },
        },
      ],
    },

    metadata: {
      version: { type: String, required: true },
      generatedBy: { type: String },
      templateVersion: { type: String },
      locale: { type: String },
      includeTranscript: { type: Boolean, default: true },
      includeScorecard: { type: Boolean, default: true },
      includeMetrics: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    collection: 'reportSnapshots',
  },
);

ReportSnapshotSchema.index({ iterationId: 1 });
ReportSnapshotSchema.index({ sessionMemberId: 1 });
ReportSnapshotSchema.index({ generatedAt: -1 });
ReportSnapshotSchema.index({ 'data.session.startedAt': -1 });

ReportSnapshotSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);

export const ReportSnapshotModel = 'ReportSnapshot';
