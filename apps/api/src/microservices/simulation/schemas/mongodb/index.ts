/**
 * MongoDB Schemas for Simulation Microservice
 *
 * These schemas store large, immutable, or nested documents that don't fit
 * well in PostgreSQL's relational model.
 *
 * Design Principles:
 * 1. Each MongoDB document is referenced by an ID from PostgreSQL (shared ID pattern)
 * 2. PostgreSQL stores minimal stubs for indexing/querying
 * 3. MongoDB stores full detailed data for retrieval
 * 4. No critical business logic depends solely on MongoDB (PostgreSQL is authoritative)
 *
 * Usage:
 * - Import schemas and register with Mongoose
 * - Use shared IDs between Postgres and MongoDB for consistency
 * - Always create Postgres stub before/with MongoDB document
 */

export {
  EnrichedTranscriptSchema,
  EnrichedTranscriptModel,
} from './enriched-transcript.schema';
export type {
  IEnrichedTranscript,
  ITranscriptSegment,
  ISpeaker,
  IEnrichment,
} from './enriched-transcript.schema';

export {
  EvalArtifactDataSchema,
  EvalArtifactDataModel,
} from './eval-artifact-data.schema';
export type { IEvalArtifactData } from './eval-artifact-data.schema';

export { EventLogSchema, EventLogModel } from './event-log.schema';
export type { IEventLog } from './event-log.schema';

export { LLMTraceSchema, LLMTraceModel } from './llm-trace.schema';
export type { ILLMTrace, ILLMMessage } from './llm-trace.schema';

export {
  ReportSnapshotSchema,
  ReportSnapshotModel,
} from './report-snapshot.schema';
export type { IReportSnapshot } from './report-snapshot.schema';

export {
  SessionInvitationSchema,
  SessionInvitationModel,
} from './session-invitation.schema';
export type { ISessionInvitation } from './session-invitation.schema';
