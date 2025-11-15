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
  _id: string; // Same as PostgreSQL ReportRequest.id (cuid)
  sessionId: string;
  format: 'json'; // Only JSON reports stored here; PDF in S3
  generatedAt: Date;

  // Report data
  data: {
    // Session summary
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
      duration?: number; // milliseconds
      startedAt: Date;
      endedAt?: Date;
      status: string;
    };

    // Turn history
    turns?: Array<{
      order: number;
      role: string;
      text?: string;
      timestamp: Date;
      metadata?: Record<string, any>;
    }>;

    // Transcript summary
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

    // Scorecard results
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

    // Performance metrics
    metrics?: {
      tokensInput?: number;
      tokensOutput?: number;
      toolCount?: number;
      averageLatencyMs?: number;
      cost?: number;
    };

    // Benchmarks comparison
    benchmarks?: Array<{
      name: string;
      metric: string;
      sessionValue: number;
      benchmarkValue: number;
      percentile?: number;
    }>;

    // Key insights
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

    // Evaluation artifacts summary
    evaluations?: Array<{
      kind: string;
      score: number;
      summary?: string;
    }>;
  };

  // Report metadata
  metadata?: {
    version: string; // Report schema version
    generatedBy?: string; // Service/user that generated report
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
    _id: { type: String, required: true }, // Same as Postgres ReportRequest.id
    sessionId: { type: String, required: true, index: true },
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

// Indexes for common queries
ReportSnapshotSchema.index({ sessionId: 1 });
ReportSnapshotSchema.index({ generatedAt: -1 });
ReportSnapshotSchema.index({ 'data.session.startedAt': -1 });

// TTL index - auto-delete snapshots older than 1 year
ReportSnapshotSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);

export const ReportSnapshotModel = 'ReportSnapshot';
