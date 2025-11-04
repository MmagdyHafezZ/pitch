// prisma/schema.prisma generator client { provider = "prisma-client-js" }

datasource db { provider = "postgresql" url = env("DATABASE_URL") }

/_ =================== Enums =================== _/

// Mode of the simulation session (text chat, voice, or video) enum SessionMode
{ text voice video }

// The role of each turn or message in a conversation enum TurnRole { user
system assistant tool }

// Types of events emitted during simulations enum EventType {
simulation_started turn_completed simulation_completed recording_available
stt_completed media_ingested analytics_updated }

// Type of ingestion pipeline to run on uploaded media enum IngestPipeline {
transcribe // Only transcription transcribe_enrich // Transcription + enrichment
(NER, sentiment) full // Full processing pipeline (transcribe + enrich + index)
}

// Status of an ingestion job enum IngestStatus { queued running completed
failed }

// How video tracks are arranged in a final recording enum RecordingLayout {
grid // Grid view of all participants speaker // Only active speaker shown
screen // Screen-share focused layout }

// Format of a generated report enum ReportFormat { pdf json }

/_ =================== Orchestrator Core =================== _/ /_ Stores
simulation sessions, turns, messages, events, and metrics. _/ /_ Users/Orgs come
from an external microservice — store only IDs. _/

model Session { id String @id @default(cuid()) // Unique session ID userId
String // External user ID orgId String // External organization ID

userSnapshot Json? // Optional static user data (e.g., name/email at session
start) orgSnapshot Json? // Optional org info (e.g., department/team)

mode SessionMode // Chat, voice, or video simulation scenarioId String? //
Optional scenario reference personaId String? // Optional persona reference
language String? // Language used in session crmContextId String? // CRM link or
context key status String @default("active") // "active" | "ended" endedReason
String? // Why the session ended (timeout, disconnect, etc.)

// Relations turns Turn[] // Turns in this session events Event[] // Events
emitted during this session metrics Metric[] // Metrics such as latency, token
usage calls CallSession[] // Voice/video calls linked to this session scorecards
Scorecard[] // Feedback scorecards drafts DraftEmail[] // Drafted emails or
messages messages Message[] // All messages exchanged ReportRequest
ReportRequest[] // Generated reports EvalArtifact EvalArtifact[] // Evaluation
results for this session Transcript Transcript[] // Transcripts from real calls
MediaAsset MediaAsset[] // Uploaded media assets Persona Persona[] // Possible
persona references Scenario Scenario[] // Possible scenario references ToolCall
ToolCall[] // Explicit tool calls triggered in this session

createdAt DateTime @default(now()) // Creation timestamp updatedAt DateTime
@updatedAt // Auto-updated on modification endedAt DateTime? // When session
ended

@@index([orgId, userId]) @@index([status]) }

// One conversational exchange (system/user/tool turn) model Turn { id String
@id @default(cuid()) sessionId String session Session @relation(fields:
[sessionId], references: [id]) role TurnRole // Role of speaker
(user/system/etc.) text String? // Text content of the turn audioAssetId String?
// Optional audio reference attachments Json? // Linked asset references
metadata Json? // Additional data (timestamps, tool results) order Int //
Sequence number in the session

messages Message[] // Messages generated during this turn toolCalls ToolCall[]
// Tool calls invoked in this turn EvalArtifact EvalArtifact[] // Evaluations
tied to this turn

createdAt DateTime @default(now())

@@index([sessionId, order]) @@index([role]) }

// A single message within a turn model Message { id String @id @default(cuid())
sessionId String session Session @relation(fields: [sessionId], references:
[id]) turnId String? turn Turn? @relation(fields: [turnId], references: [id])
role TurnRole // Who sent it content String? // Plaintext content json Json? //
Tokenized or structured representation redaction Json? // Redaction metadata
(PII spans) language String? // Language code

RedactionSpan RedactionSpan[] // Linked PII redaction records createdAt DateTime
@default(now())

@@index([sessionId, turnId]) }

// Represents a tool invocation (e.g., RAG search, TTS, etc.) model ToolCall {
id String @id @default(cuid()) sessionId String session Session
@relation(fields: [sessionId], references: [id]) turnId String? turn Turn?
@relation(fields: [turnId], references: [id]) name String // Tool name input
Json // Input payload output Json? // Output result latencyMs Int? // Execution
time success Boolean? // Whether it succeeded

createdAt DateTime @default(now())

@@index([sessionId, turnId, name]) }

// System-level events emitted during simulations model Event { id String @id
@default(cuid()) sessionId String session Session @relation(fields: [sessionId],
references: [id]) type EventType // Event type (simulation_started, etc.)
payload Json? // Event data createdAt DateTime @default(now())

@@index([sessionId, type, createdAt]) }

// Metrics collected per turn/session for monitoring and billing model Metric {
id String @id @default(cuid()) sessionId String session Session
@relation(fields: [sessionId], references: [id]) tokensInput Int? // Input token
count tokensOutput Int? // Output token count toolCount Int? // Number of tool
calls latencyMs Int? // Turn latency model String? // Model name used

createdAt DateTime @default(now())

@@index([sessionId, createdAt]) }

/_ =================== Configuration =================== _/

// A training or simulation scenario (conversation setup) model Scenario { id
String @id @default(cuid()) orgId String // External org reference name String
description String? config Json? // Parameters for scenario logic sessions
Session[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([orgId]) }

// Persona definition used in simulations model Persona { id String @id
@default(cuid()) orgId String name String traits Json? // Personality traits,
tone, etc. sessions Session[] createdAt DateTime @default(now()) updatedAt
DateTime @updatedAt

@@index([orgId]) }

/_ =================== Chat (text) =================== _/

// AI-generated or drafted email/message based on session context model
DraftEmail { id String @id @default(cuid()) sessionId String session Session
@relation(fields: [sessionId], references: [id]) audience String // Target
audience (e.g., client, manager) purpose String // Purpose of email (follow-up,
intro, etc.) tone String? // Tone (formal, friendly, persuasive) bullets Json?
// Bullet points before drafting body String? // Final text body

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([sessionId, createdAt]) }

/_ =================== Voice/Video =================== _/

// Represents a live WebRTC call session model CallSession { id String @id
@default(cuid()) sessionId String session Session @relation(fields: [sessionId],
references: [id]) tracks String[] // Media tracks used ("audio", "video")
sdpOffer String? // SDP offer string from client sdpAnswer String? // SDP answer
returned by server status String @default("created") // created|active|ended

recordings Recording[] // Linked recordings createdAt DateTime @default(now())
updatedAt DateTime @updatedAt }

// Metadata for a stored call recording model Recording { id String @id
@default(cuid()) callId String call CallSession @relation(fields: [callId],
references: [id]) layout RecordingLayout? // Layout of video
(grid/speaker/screen) tracks String[] // Recorded media tracks assetId String //
Linked MediaAsset durationMs Int? // Duration in milliseconds createdAt DateTime
@default(now())

@@index([callId, createdAt]) }

// A stored file (audio, video, image, doc, etc.) model MediaAsset { id String
@id @default(cuid()) mimeType String // MIME type sizeBytes BigInt // File size
storageKey String // Storage key in S3/MinIO url String? // Temporary signed URL
(if cached) ownerSessionId String? // Owner session reference ownerSession
Session? @relation(fields: [ownerSessionId], references: [id])

Transcript Transcript[] // Transcripts derived from this media IngestionJob
IngestionJob[] // Processing jobs linked to it

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([storageKey]) }

/_ =================== Media Ingestion =================== _/

// Represents a background job for transcription/enrichment model IngestionJob {
id String @id @default(cuid()) assetId String asset MediaAsset @relation(fields:
[assetId], references: [id]) pipeline IngestPipeline // Which pipeline was run
status IngestStatus @default(queued) error String? // Failure reason if any
transcriptId String? // Produced transcript startedAt DateTime? completedAt
DateTime?

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([assetId, status]) }

/_ =================== Transcripts & Enrichment =================== _/

// Full transcript of a media asset (e.g., call recording) model Transcript { id
String @id @default(cuid()) assetId String asset MediaAsset @relation(fields:
[assetId], references: [id]) sessionId String? session Session?
@relation(fields: [sessionId], references: [id]) language String? // Detected
language text String? // Full transcript text metadata Json? // Extra info

segments TranscriptSegment[] // Subsections of transcript speakers Speaker[] //
Speakers in this call enrichment Enrichment? // Analysis results

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([assetId]) @@index([sessionId]) }

// Individual segment of a transcript with timestamps model TranscriptSegment {
id String @id @default(cuid()) transcriptId String transcript Transcript
@relation(fields: [transcriptId], references: [id]) speakerId String? speaker
Speaker? @relation(fields: [speakerId], references: [id]) startMs Int? // Start
timestamp (ms) endMs Int? // End timestamp (ms) text String // Text content of
this segment tokens Json? // Token-level timing entities Json? // Named entities
detected

createdAt DateTime @default(now())

@@index([transcriptId, startMs]) }

// A participant in a transcripted conversation model Speaker { id String @id
@default(cuid()) transcriptId String transcript Transcript @relation(fields:
[transcriptId], references: [id]) label String? // "Speaker 1", "Agent", etc.
diarization Json? // Raw diarization data (who spoke when) TranscriptSegment
TranscriptSegment[] // All segments for this speaker createdAt DateTime
@default(now())

@@index([transcriptId]) }

// Enrichment/analysis results for a transcript model Enrichment { id String @id
@default(cuid()) transcriptId String @unique transcript Transcript
@relation(fields: [transcriptId], references: [id]) summary String? // Summary
of conversation topics String[] // Extracted topics/keywords sentiment Json? //
Sentiment analysis data entities Json? // NER data

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt }

/_ =================== Redactions & Evals =================== _/

// Stores detected PII spans for messages model RedactionSpan { id String @id
@default(cuid()) messageId String message Message @relation(fields: [messageId],
references: [id]) spans Json // [{start, end, label}] createdAt DateTime
@default(now())

@@index([messageId]) }

// Stores evaluation metrics for prompts/responses (RAGAS, DeepEval, etc.) model
EvalArtifact { id String @id @default(cuid()) sessionId String session Session
@relation(fields: [sessionId], references: [id]) turnId String? turn Turn?
@relation(fields: [turnId], references: [id]) kind String // "prompt_eval" |
"ragas" | ... data Json // Arbitrary evaluation data score Float? // Optional
numeric score createdAt DateTime @default(now())

@@index([sessionId, kind]) }

/_ =================== Analytics Features =================== _/

// Numeric features for reporting or ML (not vector embeddings) model
FeatureVector { id String @id @default(cuid()) refType String // Reference type
(TranscriptSegment, Message, etc.) refId String // Reference ID features Json //
Key-value or numeric array createdAt DateTime @default(now())

@@index([refType, refId]) }

/_ =================== RAG: pgvector =================== _/

// Embeddings stored for semantic search (pgvector extension) model EmbeddingRow
{ id String @id @default(cuid()) embedding Unsupported("vector") // Actual
vector column added via SQL migration namespace String // Group (kb, transcript,
etc.) refType String // Origin type (TranscriptSegment, Doc, etc.) refId String
// Origin ID metadata Json? // Context info

createdAt DateTime @default(now())

@@index([namespace]) }

/_ =================== Feedback Engine =================== _/

// Defines a rubric used for scoring sessions model Rubric { id String @id
@default(cuid()) orgId String // External org name String version Int
@default(1) criteria Criterion[] // Rubric criteria

Scorecard Scorecard[] // Linked scorecards

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@unique([orgId, name, version]) @@index([orgId]) }

// Individual scoring criterion within a rubric model Criterion { id String @id
@default(cuid()) rubricId String rubric Rubric @relation(fields: [rubricId],
references: [id]) label String // Criterion name maxPoints Int // Maximum score
weight Float? // Optional weighting order Int // Display order

ScoreItem ScoreItem[] // Items graded under this criterion createdAt DateTime
@default(now())

@@index([rubricId, order]) }

// Scorecard for a completed session model Scorecard { id String @id
@default(cuid()) sessionId String session Session @relation(fields: [sessionId],
references: [id]) rubricId String? rubric Rubric? @relation(fields: [rubricId],
references: [id]) totalScore Float? // Sum of all scores maxScore Float? // Max
possible locale String? // Localization of feedback

items ScoreItem[] // Scores for each criterion coachTips CoachTip[] // Text
feedback

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([sessionId]) }

// Score assigned for one criterion model ScoreItem { id String @id
@default(cuid()) scorecardId String scorecard Scorecard @relation(fields:
[scorecardId], references: [id]) criterionId String? criterion Criterion?
@relation(fields: [criterionId], references: [id]) score Float? // Achieved
score maxPoints Int? // Possible max details Json? // Explanation or breakdown

createdAt DateTime @default(now())

@@index([scorecardId]) }

// Coaching tip or feedback message linked to a scorecard model CoachTip { id
String @id @default(cuid()) scorecardId String scorecard Scorecard
@relation(fields: [scorecardId], references: [id]) text String // Coach guidance
text link String? // Optional URL to resource excerptRef String? // Pointer to
Message/Segment/etc. createdAt DateTime @default(now())

@@index([scorecardId]) }

// Aggregated benchmark metric stored per org model Benchmark { id String @id
@default(cuid()) orgId String name String metric String value Float window
String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([orgId, name]) }

/_ =================== Reports =================== _/

// Tracks exported report artifacts (PDF/JSON) model ReportRequest { id String
@id @default(cuid()) sessionId String session Session @relation(fields:
[sessionId], references: [id]) format ReportFormat // pdf or json status String
@default("queued") // queued|ready|failed assetId String? // MediaAsset
containing the report file error String? // Failure details

createdAt DateTime @default(now()) updatedAt DateTime @updatedAt

@@index([sessionId, format, status]) }
