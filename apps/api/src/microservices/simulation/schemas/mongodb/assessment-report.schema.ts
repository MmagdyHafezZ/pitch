import { Schema, Document } from 'mongoose';

/**
 * AssessmentReport - MongoDB document
 *
 * Stores full assessment artifacts for a run (chunk outputs, per-turn details,
 * citations, and node trace metadata). This is referenced by AssessmentRun.id.
 */

export interface IAssessmentReport extends Document {
  _id: string;
  runId: string;
  iterationId: string;
  sessionMemberId?: string;
  sessionId?: string;
  mode: 'live' | 'final';
  configVersion: string;
  engineVersion?: string;
  reportVersion: string;
  createdAt: Date;
  updatedAt: Date;
  report: {
    totalScore: number;
    scoreBreakdown?: Record<string, number>;
    summary?: {
      narrativeSummary?: string;
      coachTips?: Array<{ text: string; link?: string }>;
      objectiveMet?: boolean;
    };
    turnAnnotations: Array<{
      turnId: string;
      label: string;
      confidence?: number;
      evidence?: string;
      scoreDelta?: number;
      citations?: string[];
      reasonSummary?: string;
      isFinal?: boolean;
    }>;
    chunks?: Array<{
      chunkIndex: number;
      turnIds: string[];
      summary?: string;
      retrievalContext?: Array<{
        id: string;
        source: string;
        content: string;
      }>;
    }>;
    rag?: {
      namespace?: string;
      snapshotId?: string;
      items?: Array<{
        id: string;
        source: string;
        content: string;
      }>;
    };
  };
  trace?: {
    nodeTimings?: Array<{ node: string; ms: number }>;
    warnings?: string[];
    partial?: boolean;
    reasonSummaries?: string[];
  };
}

const AssessmentReportSchemaDefinition = new Schema<IAssessmentReport>(
  {
    _id: { type: String, required: true },
    runId: { type: String, required: true, index: true, unique: true },
    iterationId: { type: String, required: true, index: true },
    sessionMemberId: { type: String, index: true },
    sessionId: { type: String, index: true },
    mode: { type: String, enum: ['live', 'final'], required: true },
    configVersion: { type: String, required: true },
    engineVersion: { type: String },
    reportVersion: { type: String, required: true },
    report: { type: Schema.Types.Mixed, required: true },
    trace: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'assessment_reports',
  },
);

AssessmentReportSchemaDefinition.index({ iterationId: 1, createdAt: -1 });
AssessmentReportSchemaDefinition.index({ sessionMemberId: 1, createdAt: -1 });
AssessmentReportSchemaDefinition.index({ sessionId: 1, createdAt: -1 });

export const AssessmentReportSchema = AssessmentReportSchemaDefinition;
export const AssessmentReportModel = 'AssessmentReport';
