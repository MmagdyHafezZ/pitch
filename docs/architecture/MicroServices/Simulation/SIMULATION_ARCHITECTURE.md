# Simulation Microservice Architecture

**Version**: `simulation.microservice.v1.0.0` (schema synchronized across
PostgreSQL, MongoDB, RabbitMQ events)

The Simulation Microservice is a bounded-context service responsible for
orchestrating multi-modal sales training simulations, media processing, and
performance evaluation. Internally, it is composed of modular components
(gateways, controllers, services, workers) that can run as a single deployable
or be split into separate services in future without changing contracts.

The overall system structure is shown in Figure [7.2.1] in the appendix.

## Core Storage Overview and Source of Truth

**Storage Tier Responsibilities** (referenced throughout this document):

### PostgreSQL (authoritative for structured data)

- Primary source of truth for all normalized business entities
- Relational integrity via foreign keys and constraints
- ACID transactions for critical state changes
- Entities: Sessions, Turns, Messages, Rubrics, Scores, Metrics, Benchmarks,
  Config

### pgvector (PostgreSQL extension)

- Semantic search on embeddings within PostgreSQL
- HNSW indexes for fast similarity queries

### MongoDB (authoritative for document workloads)

- Large, immutable, nested artifacts
- Always referenced by PostgreSQL ID (**shared ID pattern**: UUIDv7 or CUID for
  global uniqueness and deterministic lookup)
- Collections: EnrichedTranscript, EvalArtifactData, LLMTrace, EventLog,
  ReportSnapshot

### Redis (ephemeral coordination only)

- All keys have TTL (automatic expiration)
- Stores only cached/derived data that is reconstructable
- **Critical**: Redis loss is recoverable; no critical decisions depend solely
  on Redis
- Use cases: session cache, signaling, rate limits, locks, streaming cursors

**Consistency Rule**: PostgreSQL is authoritative → MongoDB stores referenced
documents → Redis caches derived state

## Features

### Simulation Orchestration

Multi-turn simulations with text, voice, and video, including:

- State machine management
- Context assembly from CRM, persona, and scenario data
- Tool routing
- Real-time event streaming

**Execution**:

- Active session context and state snapshots cached in Redis for low-latency
  reads
- PostgreSQL remains canonical

### Text Chat AI

- LLM-powered responses
- RAG over company knowledge bases (pgvector)
- Drafting, translation, safety filters, PII redaction

**Execution**:

- Canonical messages, turns, and PII metadata in PostgreSQL
- Optional LLM prompt/response traces in MongoDB, referenced by turn or tool
  call IDs

### Voice/Video Communication

- WebRTC signaling
- STT/TTS integration
- VAD
- Recording with multiple layouts

**Execution**:

- Call sessions and recording metadata in PostgreSQL
- Ephemeral signaling state (offers/answers/tokens) in Redis
- Final recording references in PostgreSQL and object storage

### Media Ingestion

- Upload audio/video call recordings
- Transcription
- Speaker diarization
- NER, sentiment, topic extraction

**Execution**:

- Jobs, transcript stubs, and enrichment summaries in PostgreSQL
- Full enriched transcript documents (segments, speakers, analysis) in MongoDB

### Feedback Engine

- Rubric-based scoring
- AI coaching tips
- Benchmarks and leaderboards
- PDF and structured report generation

**Execution**:

- Rubrics, scores, benchmarks, and report requests in PostgreSQL
- Deep evaluation artifacts, reasoning traces, and report JSON snapshots in
  MongoDB

---

## Components

### API Gateways

The gateways serve as entry points for all external requests, handling routing,
authentication, and forwarding validated requests to the corresponding
controllers.

**Components**: Session Gateway, Chat Gateway, Call Gateway, Ingestion Gateway,
Feedback Gateway.

### Controllers

Controllers manage incoming RPC requests from gateways, validate inputs,
coordinate with application services, and format outgoing responses.

**Components**: Session Controller, Turn Controller, Chat Controller, Call
Controller, Media Controller, Ingest Controller, Feedback Controller, Rubric
Controller, Transcript Controller.

### Services

Core orchestration and business logic. Interact with PostgreSQL, Redis, MongoDB,
RabbitMQ.

**Components**:

- **Orchestrator Service** – Session lifecycle and state machine; reads/writes
  PostgreSQL; caches session state in Redis
- **LLM Service** – Model routing, completion streaming; logs traces to MongoDB
  via LLMTrace docs
- **Prompt Service** – Template management and prompt assembly
- **Retrieval Service** – Semantic search via pgvector
- **WebRTC Service** – Signaling; uses Redis for ephemeral call state
- **STT Service** – Real-time and batch transcription
- **TTS Service** – Response synthesis
- **Recording Service** – Recording orchestration and muxing
- **Storage Service** – S3/MinIO integration
- **Transcribe Service** – Background transcription workers
- **Enrichment Service** – NER, sentiment, topics; persists structured summaries
  in PostgreSQL; optional full docs in MongoDB
- **Feedback Service** – Scorecards, coaching tips
- **Rubric Service** – Versioned rubric management
- **Cache Service (Redis)** – Session cache, persona/scenario cache, rate
  limits, SSE state, locks, idempotency
- **Document Store Service (MongoDB)** – LLM traces, enriched transcripts,
  evaluation artifacts, report snapshots
- **Benchmark Service** – Aggregates and leaderboards over scorecards and
  metrics

### Component Boundaries (Future Splitting)

The service can run as a monolith or be split into independent services without
contract changes:

**Potential Service Boundaries**:

1. **simulation-orchestrator** - Session/turn management, LLM streaming
   (gateways + orchestrator + LLM service)
2. **media-ingest** - Upload, transcription, enrichment (ingest gateway +
   transcribe + enrichment services)
3. **feedback-engine** - Scoring, coaching, reports (feedback gateway +
   scoring + rubric services)
4. **llm-gateway** - LLM provider abstraction, prompt management (can be shared)

**Contracts** (stable across splits):

- HTTP/RPC APIs with versioned DTOs
- RabbitMQ events with schema versioning
- Shared PostgreSQL (or federated via APIs)
- MongoDB collections remain logically separated

**Non-breaking split**: Add gateway routing layer; existing services continue to
communicate via RPC/events.

### Repositories

Abstractions over concrete storage engines.

**Relational (PostgreSQL)**: Session, Turn, Message, ToolCall, Scenario,
Persona, CallSession, Recording, MediaAsset, IngestionJob, Transcript (stub),
Rubric, Criterion, Scorecard, ScoreItem, CoachTip, Metric, Benchmark,
EvalArtifact (stub), EmbeddingRow, RedactionSpan, DraftEmail, ReportRequest,
Event.

**Cache (Redis)**: SessionCache, ContextCache, PersonaScenarioCache, RateLimit,
SSEChannel, CallSignalCache, JobLock/Idempotency.

**Document (MongoDB)**: EventLog, LLMTrace, STTPartial (optional/short-lived),
EnrichedTranscript, EvalArtifactData, ReportSnapshot.

**Clarification**:

- Event (PostgreSQL): normalized key domain events for queries
- EventLog (MongoDB): verbose event payloads when needed

### Tables (Database Layer) – Figure [7.2.20]

**Clarified roles**:

- PostgreSQL: all normalized entities and relationships
- MongoDB: large immutable documents, always referenced via PostgreSQL IDs
- Redis: never a source of truth; all keys have TTLs and are reproducible

**Core Tables (PostgreSQL)**:

- **Session** - Simulation session state with user/org snapshots
- **Turn** - Individual conversation turns with role and content
- **Message** - Message records with core text content and PII redaction
  metadata
- **ToolCall** - Tool invocation logs with latency metrics
- **Event** - Minimal domain events (type, timestamp, small payload < 1KB)
- **Metric** - Token usage and latency metrics per session/turn

**Configuration Tables (PostgreSQL)**:

- **Scenario** - Training scenario definitions (small config JSON)
- **Persona** - AI persona characteristics and traits (small traits JSON)

**Media Tables (PostgreSQL)**:

- **CallSession** - WebRTC call metadata and SDP data (offers/answers kept
  small)
- **Recording** - Recording references with layout info and asset FK
- **MediaAsset** - Uploaded media files and storage keys

**Ingestion Tables (PostgreSQL)**:

- **IngestionJob** - Background job status tracking

**Transcript Tables (PostgreSQL - Stubs Only)**:

- **Transcript (stub)** - Lightweight index with id, assetId, sessionId,
  language, text summary, metadata
  - Full enriched transcript (segments, speakers, enrichment) stored in MongoDB
    as EnrichedTranscript with same ID

**Evaluation Tables (PostgreSQL)**:

- **Rubric** - Versioned scoring rubrics
- **Criterion** - Individual rubric criteria (source of truth for maxPoints)
- **Scorecard** - Session evaluation results
- **ScoreItem** - Scores for individual criteria (maxPoints removed - derive
  from Criterion)
- **CoachTip** - Coaching feedback text
- **Benchmark** - Team/org performance baselines
- **EvalArtifact (stub)** - Evaluation index (id, kind, score, sessionId,
  turnId)
  - Full evaluation data stored in MongoDB as EvalArtifactData with same ID

**RAG Tables (PostgreSQL with pgvector)**:

- **EmbeddingRow** - Vector embeddings for semantic search (pgvector extension)

**PII & Drafts (PostgreSQL)**:

- **RedactionSpan** - PII detection and masking metadata (small JSON spans)
- **DraftEmail** - AI-generated email drafts

**Reports (PostgreSQL)**:

- **ReportRequest** - Report generation queue (status, format, assetId
  reference)
  - JSON reports stored in MongoDB as ReportSnapshot with same ID

**MongoDB Collections**:

- **EnrichedTranscript** - Full transcript documents with embedded segments,
  speakers, enrichment
- **EvalArtifactData** - Detailed evaluation results (RAGAS, DeepEval, LLM
  judges)
- **EventLog** - Verbose event payloads for debugging/audit
- **LLMTrace** - LLM interaction traces (prompts, responses, usage, latency)
- **ReportSnapshot** - Structured JSON report data

**Redis Keys** (all ephemeral with TTL):

- **Session cache** - Active session state for low-latency reads
- **SSE state** - Server-sent events connection state
- **WebRTC signaling** - Ephemeral offers/answers before finalization
- **STT partials** - Streaming transcription buffers
- **Rate limits** - Per-org/per-user quotas
- **Job locks** - Distributed locks for background processing
- **Idempotency keys** - Request deduplication

### Storage Mapping Table

| Domain Concept        | PostgreSQL Table(s)                     | MongoDB Collection           | Redis Keys                                     |
| --------------------- | --------------------------------------- | ---------------------------- | ---------------------------------------------- |
| **Session**           | Session                                 | -                            | `sim:session:{id}`, `sim:session:{id}:context` |
| **Conversation**      | Turn, Message                           | -                            | `sim:turn:{sessionId}:{turnId}:ctx`            |
| **Transcript (full)** | Transcript (stub only)                  | EnrichedTranscript           | `sim:stt:{callId}:partial`                     |
| **LLM Interaction**   | Turn, Message (result)                  | LLMTrace                     | `sim:llm:{sessionId}:{turnId}:stream`          |
| **Evaluation**        | EvalArtifact (stub)                     | EvalArtifactData             | -                                              |
| **Report**            | ReportRequest                           | ReportSnapshot (JSON format) | -                                              |
| **Event**             | Event (key events)                      | EventLog (verbose)           | -                                              |
| **Configuration**     | Scenario, Persona                       | -                            | `sim:scenario:{id}`, `sim:persona:{id}`        |
| **Scoring**           | Rubric, Criterion, Scorecard, ScoreItem | EvalArtifactData (detailed)  | -                                              |
| **Media**             | MediaAsset, Recording, CallSession      | -                            | `sim:webrtc:{callId}:*`                        |
| **PII**               | RedactionSpan                           | -                            | (transient only)                               |

**ID Sharing Pattern**: When a domain concept spans Postgres + MongoDB, they
share the same ID (e.g., `Transcript.id == EnrichedTranscript._id`). IDs are
**UUIDv7 or CUID** for global uniqueness, time-ordering, and deterministic
lookup across storage tiers.

---

## Data Flow Summary

1. Request enters through an API Gateway
2. Controller validates, authorizes, and maps to a Service
3. Service:
   - Reads/writes canonical state in PostgreSQL
   - Uses Redis for cache/ephemeral/session/signaling
   - Uses MongoDB for large traces and enriched artifacts when applicable
4. Repositories abstract the underlying store
5. Relevant domain events are published to RabbitMQ using versioned schemas
6. Response returned to client

**All Redis state is ephemeral and backed by PostgreSQL/MongoDB. No business
decision depends solely on Redis data.**

---

## Sequence Flows

### Start Simulation Session Figure [7.2.2]

The User sends a `POST /sessions` request with userId, orgId, mode
(text/voice/video), and optional scenarioId, personaId through the Session
Gateway, which forwards it to the Session Controller.

The Session Controller calls the Orchestrator Service to initialize a new
session.

The Orchestrator Service retrieves scenario configuration from the Scenario
Repository if scenarioId is provided. If not found, it returns
`404 Scenario Not Found`.

If personaId is provided, the service retrieves persona traits from the Persona
Repository. If not found, it returns `404 Persona Not Found`.

The Orchestrator Service creates a snapshot of the user and org context (name,
email, team info) for immutability and stores it as JSON in the session record.

A new Session record is created in the Session Repository with status set to
"active" and all context assembled.

The Event Bus emits a `simulation.started` event with sessionId and metadata for
downstream consumers.

If mode is "voice" or "video", the WebRTC Service initializes call
infrastructure and returns connection details.

The system responds with `201 Created`, returning the sessionId and initial
context data.

---

### Advance Turn - Text Chat Figure [7.2.3]

The User sends a `POST /sessions/{sessionId}/turns` request with text content
through the Session Gateway to the Turn Controller.

The Turn Controller validates session via Redis cache, fallback to PostgreSQL
Session Repository. If not found or status is "ended", returns
`404 Session Not Found` or `409 Session Ended`.

The Orchestrator Service creates a new Turn record with role="user", incremented
order number, and the user's message text in PostgreSQL Turn Repository.

The Guardrail Service scans for PII (emails, phone numbers, SSNs) and creates
RedactionSpan records in PostgreSQL RedactionSpan Repository if detected.

The Context Service retrieves:

- Conversation history from PostgreSQL Turn Repository
- Scenario/persona from Redis cache (or PostgreSQL if cache miss)

The Retrieval Service performs semantic search via pgvector in PostgreSQL
Embedding Repository.

The Prompt Service builds the full prompt with system instructions, conversation
history, retrieved context, and guardrails.

The LLM Service calls the language model API (GPT-4o) and streams the response
back through Server-Sent Events (SSE). SSE state tracked in Redis.

As tokens arrive:

- Assistant Turn and Message records saved to PostgreSQL
- LLM trace (prompt + response + metadata) saved to MongoDB LLMTrace collection

The Metric Service logs token counts (input/output), latency, and model name in
PostgreSQL Metric Repository.

The Event Bus emits `turn.completed` event with turnId, sessionId, and metrics.

The system responds with `200 OK`, streaming the assistant's response to the
client in real-time.

---

### Tool Call - Draft Email Figure [7.2.4]

During a conversation turn, the LLM Service determines an email draft is needed
and invokes the draft tool.

The Orchestrator Service creates a ToolCall record in the ToolCall Repository
with name="draft_email" and input containing audience, purpose, tone, and bullet
points.

The Tool Router delegates to the specialized drafting service, which uses the
LLM Service with a drafting-specific prompt template.

The Prompt Service retrieves the session context from the Session Repository and
assembles bullets and instructions.

The LLM Service generates the email body text with the specified tone and
structure.

A DraftEmail record is created in the DraftEmail Repository with all parameters
and the generated body text.

The ToolCall Repository updates the tool call record with output containing the
draftId and success status, along with latency metrics.

The draft is included in the assistant's response as a formatted preview or
attachment reference.

The system returns `200 OK` with the draft content embedded in the turn
response.

---

### Start Voice/Video Call Figure [7.2.5]

The User sends a `POST /calls` request with sessionId and tracks array
(["audio"] or ["audio", "video"]) through the Call Gateway to the Call
Controller.

The Call Controller validates the session exists and mode is "voice" or "video"
via Session Repository. If invalid, returns `400 Invalid Session Mode`.

The WebRTC Service creates a new CallSession record in PostgreSQL Call
Repository with status="created" and the requested tracks.

The system generates server-side SDP offer using WebRTC signaling layer and
caches it in Redis (ephemeral signaling state).

The Call Controller responds with `201 Created`, returning the callId, SDP
offer, and STUN/TURN server configuration.

The User's client sends a `POST /calls/{callId}/sdp` request with the SDP answer
after local media setup.

The WebRTC Service validates and stores the SDP answer temporarily in Redis,
then establishes the media connection.

Once connection is established:

- PostgreSQL CallSession updated with status="active", sdpOffer, sdpAnswer
  (persisted)
- Redis signaling state can be discarded

If recording is enabled, the Recording Service starts capturing media streams
and creates a Recording record in PostgreSQL Recording Repository linked to the
call.

The Event Bus emits `call.started` event for monitoring and analytics.

The system responds with `200 OK`, confirming the call is established.

---

### Process Real-Time Speech (STT) Figure [7.2.6]

During an active voice call, the WebRTC Service receives audio chunks from the
client's microphone through the RTC connection.

The VAD Service analyzes each audio chunk to detect speech activity and filters
out silence. VAD state managed in memory and Redis.

When speech is detected, audio chunks are buffered and sent to the STT Service
for transcription.

The STT Service calls the Whisper or Azure STT API with streaming enabled,
requesting partial results and timestamps.

As partial transcriptions arrive:

- Stored temporarily in Redis as STT partials (short-lived, discarded after
  finalization)
- Forwarded to Orchestrator Service with speaker labels and timing information

When a complete utterance is detected (pause or turn-end):

- Final Turn and Message records created in PostgreSQL
- Transcript (stub) created in PostgreSQL with text summary
- Full TranscriptSegment details optionally saved to MongoDB EnrichedTranscript

The Context Service assembles the user's speech into the conversation history
for the next LLM turn.

The LLM Service processes the transcribed text and generates a response using
the same flow as text chat.

The TTS Service converts the assistant's text response to speech using
ElevenLabs or Azure TTS with the configured voice profile.

The synthesized audio is streamed back to the client through the WebRTC
connection for playback.

The Metric Service logs STT latency, TTS latency, and audio processing metrics
in PostgreSQL Metric Repository.

The Event Bus emits `stt.completed` events for each completed transcription.

---

### End Simulation Session Figure [7.2.7]

The User sends a `POST /sessions/{sessionId}/end` request with optional reason
through the Session Gateway to the Session Controller.

The Session Controller validates the session exists and is active via Session
Repository. If not found or already ended, returns `404` or `409`.

The Orchestrator Service updates the Session record in PostgreSQL, setting
status="ended", endedReason, and endedAt timestamp.

If a call is active, the WebRTC Service retrieves the CallSession from
PostgreSQL Call Repository and updates its status to "ended".

If recording was active:

- Recording Service stops capture, finalizes the media file
- Uploads to Storage Service (MinIO/S3)
- MediaAsset record created in PostgreSQL Media Repository with storage key,
  MIME type, file size
- Recording Repository updates the Recording record with final assetId and
  duration

The Orchestrator Service:

- Retrieves all Turns and calculates total tokens used via PostgreSQL Metric
  Repository
- Invalidates related Redis keys (session cache, context cache, SSE state)

The Event Bus emits `simulation.completed` event with sessionId, endedReason,
total duration, and usage metrics.

If auto-feedback is enabled, the Feedback Service is triggered asynchronously to
generate a scorecard.

The system responds with `200 OK`, returning session summary with total turns,
duration, and tokens used.

---

### Upload Real Call Recording Figure [7.2.8]

The User initiates an upload by sending `POST /ingest/upload/init` with mimeType
and sizeBytes through the Ingestion Gateway to the Ingest Controller.

The Ingest Controller validates the file type (audio/video only) and size (under
max limit). If invalid, it returns `400 Invalid File`.

The Storage Service generates a unique storageKey and creates a MediaAsset
record in the Media Repository with status="uploading".

The Storage Service generates pre-signed multipart upload URLs for the S3/MinIO
bucket.

The system responds with `200 OK`, returning the assetId and upload URLs array.

The client uploads file parts using `POST /ingest/upload/part` with part numbers
and content ranges.

The Storage Service validates each part and stores it in the bucket, tracking
completion status.

When all parts are uploaded, the client calls `POST /ingest/upload/complete`
with the assetId.

The Storage Service finalizes the multipart upload, combining all parts into a
single file.

The Media Repository updates the MediaAsset record with final status="ready" and
generates a temporary signed URL.

The Event Bus emits a `media.ingested` event with assetId for downstream
processing.

The system responds with `200 OK`, returning the assetId and confirmation.

---

### Process Uploaded Recording (Transcription) Figure [7.2.9]

After a media file is uploaded, the User sends `POST /ingest/jobs` with assetId
and pipeline="transcribe_enrich" through the Ingestion Gateway.

The Ingest Controller validates the asset exists via PostgreSQL Media
Repository. If not found, returns `404 Asset Not Found`.

An IngestionJob record is created in PostgreSQL Ingestion Job Repository with
status="queued" and pipeline type.

The job is picked up by a background worker (BullMQ or similar), which updates
status to "running" and records startedAt timestamp.

The Storage Service retrieves the media file from S3/MinIO using the storageKey.

The Transcribe Service sends the audio to Whisper or Azure STT API for batch
transcription with speaker diarization enabled.

The API returns a full transcript with speaker labels and word-level timestamps.

PostgreSQL Transcript (stub) created:

- Transcript record with id, assetId, sessionId, language
- Text summary for search/preview
- Metadata (duration, speaker count, etc.)

MongoDB EnrichedTranscript created (same ID as Postgres stub):

- Full transcript text
- Embedded segments[] with startMs, endMs, text, speakerId, tokens[], entities[]
- Embedded speakers[] with labels, diarization data, role, statistics
- Empty enrichment{} (populated in next step if pipeline includes enrichment)

If the pipeline includes enrichment, the Enrichment Service processes the
transcript:

- NER extraction identifies entities (company names, products, people)
- Topic modeling extracts main themes
- Sentiment analysis scores emotional tone per segment

MongoDB EnrichedTranscript updated with enrichment{}:

- summary, topics[], sentiment{}, entities{}, highlights[]

The Ingestion Job Repository updates the job in PostgreSQL with
status="completed", transcriptId, and completedAt timestamp.

If the pipeline is "full", the Indexer Service:

- Generates embeddings for each segment using a sentence transformer model
- Stores them in PostgreSQL Embedding Repository (pgvector) for future RAG
  queries

The Event Bus emits `analytics.updated` event with transcriptId and job
metadata.

The system responds with `200 OK` (async job pattern), returning the jobId for
status polling.

---

### Generate Scorecard with Rubric Figure [7.2.10]

After a simulation ends, the Admin Client sends `POST /feedback/score` with
sessionId and optional rubricId through the Feedback Gateway to the Feedback
Controller.

The Feedback Controller validates the session exists and is ended via PostgreSQL
Session Repository. If not ended, returns `409 Session Not Complete`.

If rubricId is provided, the Rubric Service retrieves the Rubric and Criterion
records from PostgreSQL Rubric Repository. If not found, returns
`404 Rubric Not Found`.

If no rubricId is provided, the Rubric Service retrieves the default rubric for
the user's organization.

The Feedback Service retrieves all Turn and Message records for the session from
PostgreSQL Turn Repository and Message Repository.

For each Criterion in the rubric, the Scoring Service evaluates the session:

- **LLM-based scoring**: The LLM Service generates a score (0-maxPoints) with
  reasoning based on conversation analysis
- **Rule-based scoring**: Pattern matching or keyword detection for specific
  behaviors

For each evaluation:

- PostgreSQL EvalArtifact (stub) created with id, sessionId, turnId, kind, score
- MongoDB EvalArtifactData created (same ID) with full data{} (RAGAS metrics,
  LLM judge reasoning, etc.)

A ScoreItem record is created in PostgreSQL Score Repository for each criterion
with the achieved score and details JSON (maxPoints derived from Criterion, not
stored).

The Feedback Service calculates totalScore by summing weighted criterion scores
and maxScore from the rubric definition.

A Scorecard record is created in PostgreSQL Score Repository with totalScore,
maxScore, and rubricId.

The Coaching Service generates actionable tips by analyzing low-scoring areas:

- The LLM Service creates coaching text linked to specific conversation excerpts
- CoachTip records are created in PostgreSQL Score Repository with text,
  excerptRef, and optional resource links

The Benchmark Service updates team/org averages in PostgreSQL Benchmark
Repository for performance tracking.

The Event Bus emits `feedback.ready` event with scorecardId and sessionId.

The system responds with `200 OK`, returning the scorecardId and summary scores.

---

### Retrieve Scorecard Details Figure [7.2.11]

The User sends `GET /feedback/scorecards/{scorecardId}` through the Feedback
Gateway to the Feedback Controller.

The Feedback Controller retrieves the Scorecard record from the Score
Repository. If not found, it returns `404 Scorecard Not Found`.

The Feedback Service retrieves all related ScoreItem records from the Score
Repository.

For each ScoreItem, the Rubric Service retrieves the associated Criterion record
to get labels and descriptions from the Rubric Repository.

The Feedback Service retrieves all CoachTip records linked to the scorecard from
the Score Repository.

For each CoachTip with an excerptRef, the Message Repository or Transcript
Repository retrieves the referenced content to provide context.

The Feedback Service assembles a comprehensive response with:

- Scorecard summary (totalScore, maxScore, percentage)
- Individual criterion scores with labels and details
- Coaching tips with excerpts and resource links
- Session context (duration, turns, mode)

The system responds with `200 OK`, returning the full scorecard with all
details.

---

### Create or Update Rubric Figure [7.2.12]

The Admin Client sends `POST /rubrics` with name, orgId, and criteria array
through the Feedback Gateway to the Rubric Controller.

The Rubric Controller validates the request structure and criteria definitions.
If invalid, it returns `400 Invalid Rubric Structure`.

The Rubric Service checks if a rubric with the same name already exists for the
org via the Rubric Repository.

If it exists, the service increments the version number to create a new version
(rubrics are immutable by version).

The Rubric Repository creates a new Rubric record with orgId, name, and version.

For each criterion in the request, the Rubric Service creates a Criterion record
in the Rubric Repository with label, maxPoints, weight, and order.

The system responds with `201 Created`, returning the rubricId and version
number.

To update a rubric, the admin sends `PATCH /rubrics/{rubricId}` which follows
the same flow but always creates a new version rather than modifying the
existing one.

Existing Scorecards remain linked to their original rubric version for
historical accuracy.

---

### Semantic Search (RAG) Figure [7.2.13]

During a simulation turn, the Retrieval Service needs to find relevant context
from the knowledge base or previous calls.

The Retrieval Service receives the user's query text and sessionId from the
Orchestrator Service.

The Embedding Service generates a vector embedding for the query using a
sentence transformer model (e.g., all-MiniLM-L6-v2).

The Embedding Repository performs a pgvector similarity search using the `<->`
operator to find the closest embeddings.

The search is filtered by namespace (e.g., "kb" for knowledge base,
"transcripts" for previous calls) and limited to top-k results (typically 5-10).

For each matching EmbeddingRow, the Retrieval Service retrieves the original
content:

- If refType="TranscriptSegment", fetch from Transcript Repository
- If refType="Document", fetch from document store
- If refType="Message", fetch from Message Repository

The Retrieval Service assembles the retrieved chunks with their metadata
(source, timestamp, relevance score) and returns them to the Orchestrator
Service.

The Prompt Service includes the retrieved context in the LLM prompt as grounding
information.

The system uses the retrieved context to generate more informed and accurate
responses.

---

### Generate PDF Report Figure [7.2.14]

The User sends `POST /reports/generate` with sessionId and format="pdf" (or
"json") through the Feedback Gateway to the Report Controller.

The Report Controller validates the session exists and has a scorecard via
PostgreSQL Session Repository and Score Repository. If no scorecard exists,
returns `404 Scorecard Not Found`.

A ReportRequest record is created in PostgreSQL Report Repository with
status="queued" and format.

The Report Service retrieves comprehensive session data:

- Session metadata from PostgreSQL Session Repository
- All Turns from PostgreSQL Turn Repository
- Scorecard with items and tips from PostgreSQL Score Repository
- Transcript if available from PostgreSQL Transcript (stub) and MongoDB
  EnrichedTranscript
- Metrics from PostgreSQL Metric Repository

The Report Service assembles the report content:

- Executive summary with score and duration
- Conversation transcript with timestamps
- Scoring breakdown by criterion
- Coaching recommendations with excerpts
- Performance charts (scores over time, benchmark comparison)

If format="pdf":

- PDF generation library (e.g., Puppeteer, PDFKit) renders the content with
  branding and formatting
- Generated PDF uploaded to Storage Service (S3/MinIO) as a MediaAsset
- PostgreSQL ReportRequest updated with status="ready", assetId, and signed
  download URL

If format="json":

- PostgreSQL ReportRequest updated with status="ready"
- MongoDB ReportSnapshot created (same ID as ReportRequest) with full structured
  report data{}

The system responds with `200 OK` (async), returning the reportRequestId for
status polling.

When the user polls `GET /reports/{reportRequestId}`:

- If PDF: returns download URL
- If JSON: retrieves from MongoDB ReportSnapshot and returns structured data

---

### Detect and Redact PII Figure [7.2.15]

During message processing, the Guardrail Service automatically scans for
personally identifiable information (PII).

The Guardrail Service receives the message text from the Orchestrator Service
during turn processing.

The service uses pattern matching and NER models to detect:

- Email addresses (regex patterns)
- Phone numbers (formatted and unformatted)
- Social Security Numbers
- Credit card numbers
- Named entities that may be PII (names, addresses)

For each detected PII span, the service records the start position, end
position, and label (e.g., "EMAIL", "PHONE").

The Guardrail Service creates a RedactionSpan record in PostgreSQL RedactionSpan
Repository linked to the Message.

Depending on the configuration:

- **Mask mode**: The displayed text replaces PII with "[REDACTED]" or "[EMAIL]"
- **Flag mode**: The PII is flagged but not modified
- **Audit mode**: The PII is logged for compliance review

The Message Repository stores both the original content (for authorized access)
and the redacted version (for general display) in PostgreSQL.

When messages are retrieved for display, the system checks user permissions:

- Regular users see redacted versions
- Admins with PII access can view original content

Storage security:

- PII in Redis only transient, if at all (short TTL)
- PII fields in PostgreSQL/MongoDB can be encrypted at rest
- No long-lived sensitive data in Redis

The Event Bus emits a `pii.detected` event for security monitoring and
compliance auditing.

---

### Voice Activity Detection (VAD) Figure [7.2.16]

During a live voice call, the VAD Service continuously monitors audio streams to
detect when speech starts and ends.

The WebRTC Service forwards raw audio chunks to the VAD Service in real-time
(e.g., 20ms frames).

The VAD Service uses a lightweight model (e.g., WebRTC VAD, Silero VAD) to
classify each frame as speech or silence.

The service maintains a state machine tracking:

- **Silence**: No speech detected, buffering disabled
- **Potential speech**: Short burst detected, buffering starts
- **Active speech**: Confirmed speech, buffering and forwarding to STT
- **Trailing silence**: Speech ended, waiting for final confirmation

When active speech is detected, the VAD Service signals the STT Service to start
processing and begins forwarding audio buffers.

During speech, audio chunks are continuously streamed to the STT Service for
real-time transcription.

When trailing silence exceeds a threshold (e.g., 300ms), the VAD Service signals
speech end.

The STT Service finalizes the current utterance and returns the complete
transcription with timing information.

The Orchestrator Service creates a Turn record with the finalized text and audio
reference.

This pattern reduces unnecessary STT processing and latency by only transcribing
actual speech segments.

---

### Handle Multi-Speaker Diarization Figure [7.2.17]

When processing a recording with multiple speakers, the Diarization Service
identifies who spoke when.

After the Transcribe Service generates the initial transcript, the Diarization
Service analyzes the audio waveform.

The service uses a speaker diarization model (e.g., pyannote.audio, Azure
speaker recognition) to segment the audio by speaker identity.

The model outputs a timeline with speaker labels (Speaker 1, Speaker 2) and
timestamp ranges.

The Diarization Service creates Speaker records in the Speaker Repository for
each unique speaker identified.

The Transcript Repository updates TranscriptSegment records, linking each
segment to the appropriate Speaker record via speakerId.

If speaker names are known (e.g., from session metadata), the service can label
speakers as "Agent", "Customer", etc. instead of numeric labels.

The Enrichment Service can then perform per-speaker analysis:

- Agent talk-time vs customer talk-time ratio
- Sentiment by speaker
- Question-asking frequency

This enriched data is used for feedback generation, identifying if the agent
dominated the conversation or failed to ask discovery questions.

---

### Benchmark Tracking and Leaderboards Figure [7.2.18]

After each scorecard is generated, the Benchmark Service updates team and
org-level performance metrics.

The Benchmark Service retrieves the new Scorecard from the Score Repository.

For each tracked metric (e.g., "avg_score", "discovery_questions",
"objection_handling"), the service:

- Retrieves all recent scorecards for the team/org from the Score Repository
- Calculates the rolling average, median, or percentile
- Updates or creates a Benchmark record in the Benchmark Repository

Benchmarks are stored per orgId and metric name with a time window (e.g.,
"last_30_days", "this_quarter").

When a user views their scorecard, the Feedback Service retrieves relevant
benchmarks and displays:

- User's current score
- Team average (benchmark)
- Org average (benchmark)
- Percentile ranking

The Admin dashboard can query the Benchmark Repository to generate leaderboards:

- Top performers by score
- Most improved over time
- Team comparison charts

The Event Bus emits `benchmark.updated` events when thresholds are crossed
(e.g., team average drops below target).

---

### Stream LLM Response with SSE Figure [7.2.19]

For text chat, the system streams assistant responses in real-time using
Server-Sent Events (SSE).

The User sends a `POST /sessions/{sessionId}/turns` request with text content
and includes `Accept: text/event-stream` header.

The Turn Controller establishes an SSE connection and keeps it open for
streaming.

The Orchestrator Service processes the turn (context assembly, retrieval,
guardrails) as described in Figure [7.2.3].

When the LLM Service calls the language model API, it requests streaming mode
with delta chunks.

As each token arrives from the API, the LLM Service emits it as an SSE event:

```
event: token
data: {"text": "Hello", "delta": "Hello"}
```

The Turn Controller forwards each event to the client through the open SSE
connection.

Simultaneously, tokens are buffered in memory to construct the complete
response.

When the LLM finishes generating (stream completes), the Orchestrator Service
saves the full response as a Turn and Message record.

The system sends a final SSE event indicating completion:

```
event: done
data: {"turnId": "...", "messageId": "..."}
```

The SSE connection is closed, and the turn is complete.

This provides a responsive user experience where text appears gradually rather
than waiting for the full response.

---

## Technical Notes

### Storage and Consistency Rules

**PostgreSQL and MongoDB are authoritative**:

- PostgreSQL for normalized business data
- MongoDB for large immutable artifacts referenced by PostgreSQL

**Redis**:

- Only caches or coordinates
- All keys have TTL
- Any Redis loss is recoverable

**Events and Idempotency**:

- All events use versioned, documented JSON schemas
- Each event carries an eventId and sessionId
- Consumers implement idempotency:
  - Either via PostgreSQL unique constraints or Redis idempotency keys

**Security and PII**:

- PII detection integrated into message pipeline
- Original content accessible only for authorized roles
- Redacted version used by default

**Encrypted Columns** (at-rest encryption required):

- PostgreSQL: `Message.content` (original), `RedactionSpan.spans`
- MongoDB: `LLMTrace.request.messages[].content`,
  `EnrichedTranscript.segments[].text` (if containing PII)

**Log Redaction Policy**:

- Application logs: Never log message content, user input, or LLM outputs
- LLMTrace (MongoDB): Store full traces for authorized debugging only; apply
  access controls
- EventLog (MongoDB): Sanitize payloads before logging; use `[REDACTED]`
  placeholders for sensitive fields
- Redis: No PII logged; transient only with short TTL
- Audit trail: PII access logged to separate audit log with retention policy

### Database Configuration

The Simulation microservice uses **PostgreSQL** as its primary database with the
**pgvector** extension for semantic search capabilities.

**Database URL**: `SIMULATION_DATABASE_URL` (environment variable)

**Prisma Client**: Generated to `node_modules/@prisma/simulation-client`

To run migrations:

```bash
cd apps/api/src/microservices/simulation
npx prisma migrate dev
npx prisma generate
```

### MongoDB Configuration

MongoDB stores large document workloads (transcripts, eval artifacts, LLM
traces).

**Connection**: Standard MongoDB connection string

**Collections**:

- `enrichedTranscripts` - Full transcript documents
- `evalArtifactData` - Evaluation framework results
- `eventLogs` - Verbose event payloads
- `llmTraces` - LLM interaction traces
- `reportSnapshots` - Structured report data

**ID Strategy**: Shared IDs between PostgreSQL and MongoDB (e.g., Transcript.id
= EnrichedTranscript.\_id)

### Redis Configuration

Redis provides ephemeral caching and coordination.

**Connection**: `REDIS_URL` (environment variable)

**Key Patterns**: Defined in
`apps/api/src/microservices/simulation/services/redis/redis-key-patterns.ts`

**TTL Configuration** (centralized reference):

| Key Pattern                           | Use Case                | TTL          | Invalidation                         |
| ------------------------------------- | ----------------------- | ------------ | ------------------------------------ |
| `sim:session:{id}`                    | Session cache           | 24 hours     | On session end (mandatory)           |
| `sim:session:{id}:context`            | Session context         | 24 hours     | On session end (mandatory)           |
| `sim:persona:{id}`                    | Persona config cache    | 1 hour       | On persona update                    |
| `sim:scenario:{id}`                   | Scenario config cache   | 1 hour       | On scenario update                   |
| `sim:sse:{sessionId}`                 | SSE connection state    | 1 hour       | On disconnect                        |
| `sim:webrtc:{callId}:*`               | WebRTC signaling        | 5 minutes    | On call connected                    |
| `sim:stt:{callId}:partial`            | STT streaming buffers   | 5 minutes    | On utterance complete                |
| `sim:vad:{callId}:state`              | VAD state               | 5 minutes    | On call end                          |
| `sim:ratelimit:*`                     | Rate limit counters     | 1-60 minutes | Sliding window                       |
| `sim:idempotency:{key}`               | Request deduplication   | 24 hours     | Auto-expire                          |
| `sim:lock:{type}:{id}`                | Job locks               | 10 minutes   | On job complete or heartbeat timeout |
| `sim:turn:{sessionId}:{turnId}:ctx`   | Turn processing context | 10 minutes   | On turn complete                     |
| `sim:llm:{sessionId}:{turnId}:stream` | LLM streaming state     | 5 minutes    | On stream complete                   |

**Invalidation Policy**: Cache invalidation on session end is **mandatory**, not
best-effort. Use `SimulationRedisService.clearSessionData()` to ensure cleanup.

### Event-Driven Architecture

The microservice publishes events to RabbitMQ for async processing and
cross-service communication.

**Event Schema Standard** (all events follow this structure):

```typescript
interface DomainEvent {
  eventId: string // Unique event identifier (UUID)
  eventType: string // Event type (see list below)
  schemaVersion: string // Event schema version (e.g., "1.0", "2.1")
  occurredAt: string // ISO 8601 timestamp
  sessionId?: string // Optional session context
  actor?: {
    // Optional actor information
    userId?: string
    orgId?: string
    actorType?: 'user' | 'system' | 'service'
  }
  payload: object // Event-specific data (versioned)
  correlationId?: string // For tracing across services
  causationId?: string // ID of the command/event that caused this
}
```

**Published Events**:

- `simulation.started` - Session begins (payload: sessionId, mode, scenarioId,
  personaId)
- `turn.completed` - Conversation turn finishes (payload: turnId, sessionId,
  role, metrics)
- `simulation.completed` - Session ends (payload: sessionId, endedReason,
  duration, usage)
- `recording.available` - Recording ready (payload: recordingId, assetId,
  durationMs)
- `stt.completed` - Transcription finishes (payload: transcriptId, assetId,
  language)
- `media.ingested` - Upload completes (payload: assetId, mimeType, sizeBytes)
- `analytics.updated` - Enrichment/scoring completes (payload: transcriptId,
  enrichmentType)
- `feedback.ready` - Scorecard generated (payload: scorecardId, sessionId,
  totalScore)
- `pii.detected` - PII found (payload: messageId, piiTypes, spanCount)
- `benchmark.updated` - Benchmark recalculated (payload: orgId, metric, value)

**Consumer Guidelines**:

- Events are append-only and non-authoritative vs PostgreSQL
- Consumers must implement idempotency (use eventId for deduplication)
- Events are published after PostgreSQL commit (Outbox pattern recommended for
  future)
- Backward compatibility: only add optional fields; never remove or change
  existing fields

**Contract Schemas** (traceable to code):

- Event schemas:
  [`contracts/simulation-events.json`](../../../contracts/simulation-events.json)
- REST/RPC API:
  [`contracts/simulation-api.yaml`](../../../contracts/simulation-api.yaml)
  (OpenAPI 3.0)
- MongoDB schemas:
  [`apps/api/src/microservices/simulation/schemas/mongodb/`](../../../apps/api/src/microservices/simulation/schemas/mongodb/)
- Prisma schema:
  [`apps/api/src/microservices/simulation/prisma/schema.prisma`](../../../apps/api/src/microservices/simulation/prisma/schema.prisma)

### Service Level Objectives (SLO)

Target performance metrics that align architecture decisions with measurable
goals:

| Metric                             | Target            | Measurement                            |
| ---------------------------------- | ----------------- | -------------------------------------- |
| **Turn Latency (text)**            | p95 < 2s          | Time from user message to first token  |
| **Turn Latency (voice)**           | p95 < 3s          | STT + LLM + TTS round-trip             |
| **LLM Streaming TTFT**             | p95 < 800ms       | Time to first token from LLM           |
| **Concurrent Sessions (per node)** | 1000+             | Active WebSocket/SSE connections       |
| **Ingestion SLA (transcription)**  | p95 < 2x duration | 10-min call transcribed in < 20 min    |
| **Ingestion SLA (enrichment)**     | p95 < 3x duration | 10-min call enriched in < 30 min       |
| **Scorecard Generation**           | p95 < 30s         | End-to-end scoring with LLM evaluation |
| **API Availability**               | 99.9%             | Excluding planned maintenance          |
| **Event Processing Lag**           | p95 < 5s          | RabbitMQ message latency               |

**Monitoring**: Track via Prometheus + Grafana; alert on SLO violations.

### External Service Integrations

**Speech Services** (configurable providers):

- STT: Whisper (OpenAI), Azure Speech Service, Deepgram
- TTS: ElevenLabs, Azure TTS, OpenAI TTS
- Diarization: pyannote.audio, Azure Speaker Recognition

**LLM Providers** (abstracted via LLM Service interface):

Internal interface:

```typescript
interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): AsyncIterable<LLMChunk>
}
```

Supported providers (configurable per-org or per-request):

- OpenAI (GPT-4o, GPT-4-turbo, o1)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Azure OpenAI
- Custom endpoints

**Provider Selection**: Configured via environment or per-request header;
fallback chain for resilience

**Storage**:

- MinIO or AWS S3 for media asset storage
- Pre-signed URLs for secure client uploads

**Caching (Redis)**:

- Session state and context (ephemeral, TTL: 24 hours)
- Persona/scenario config (TTL: 1 hour)
- Rate limits (sliding windows)
- Job locks and idempotency keys
- WebRTC signaling (TTL: 5 minutes)
- STT partials (TTL: 5 minutes)
- SSE connection state

### Retry and Failure Strategy

**Background Jobs** (IngestionJob, Scorecard Generation, Report Generation):

| Job Type              | Max Retries | Backoff Strategy           | Poison Queue                |
| --------------------- | ----------- | -------------------------- | --------------------------- |
| **Transcription**     | 3           | Exponential (30s, 2m, 8m)  | Manual review queue         |
| **Enrichment**        | 3           | Exponential (30s, 2m, 8m)  | Skip non-critical           |
| **Scoring**           | 3           | Exponential (10s, 30s, 2m) | Manual scoring queue        |
| **Report Generation** | 2           | Fixed (1m, 5m)             | Error logged, user notified |

**Implementation**:

- Use BullMQ with built-in retry and backoff
- After max retries, move to Dead Letter Queue (DLQ)
- DLQ monitored for manual intervention
- Failed jobs logged with full context for replay

**API Idempotency**:

- All write APIs accept `Idempotency-Key` header (24-hour window)
- Key format: `{orgId}:{operation}:{nonce}` (e.g., `org123:createSession:uuid`)
- Duplicate requests return cached response (stored in Redis)
- Example:
  ```http
  POST /sessions
  Idempotency-Key: org123:createSession:550e8400-e29b-41d4-a716-446655440000
  ```

**External Service Failures**:

- LLM: Retry with backoff (3 attempts), then fallback provider or return error
- STT/TTS: Retry with backoff (2 attempts), then return partial/error
- Storage: Retry with backoff (3 attempts), then fail request

### Guardrails and Safety

**PII Redaction**: Automatic detection and masking of sensitive information

**Content Filtering**: Safety checks on user inputs and LLM outputs

**Schema Validation**: Zod-based validation on all DTOs

**Rate Limiting**: Token usage quotas per org/user (enforced via Redis counters)

### Performance Considerations

**Streaming**: Real-time token streaming for text chat and STT partials
**Caching**: Frequent data (personas, scenarios, embeddings) cached in Redis
**Async Processing**: Heavy tasks (transcription, enrichment, scoring) run in
background queues **Connection Pooling**: Database connections managed by Prisma
**Vector Indexing**: pgvector HNSW indexes for fast similarity search

### Testing Strategy

**Unit Tests**: Business logic in services **Integration Tests**: Repository
patterns with test database **E2E Tests**: Full simulation flows with
Testcontainers **Load Tests**: WebRTC call handling and LLM streaming under
concurrency

### Data Retention and Lifecycle

**PostgreSQL**:

- **Hot data** (active sessions, recent scorecards): Indefinite retention with
  indexing
- **Cold data** (ended sessions > 1 year): Archive to cold storage or delete per
  org policy
- **PII**: Retain per compliance requirements (GDPR: 30 days after account
  deletion)

**MongoDB**:

- **LLMTrace**: Auto-expire after 180 days (TTL index on `createdAt`)
- **EventLog**: Auto-expire after 90 days (TTL index on `createdAt`)
- **EnrichedTranscript**: Retain indefinitely (linked to sessions)
- **EvalArtifactData**: Retain indefinitely (audit trail)
- **ReportSnapshot**: Auto-expire after 1 year (TTL index on `createdAt`)

**Redis**:

- All keys expire automatically per TTL configuration (see Redis Configuration
  table)
- No manual cleanup required

**Object Storage (S3/MinIO)**:

- **Recordings**: Lifecycle policy to glacier after 90 days; delete after 2
  years (configurable per org)
- **Reports (PDF)**: Lifecycle policy to delete after 1 year
- **MediaAsset**: Retain until session deleted or per org retention policy

**Compliance**: Support for data export (GDPR Subject Access Requests) and
right-to-deletion via dedicated endpoints.

---

## Implementation Roadmap

### Phase 1: Core Orchestration

- Session lifecycle management (create, restore, end)
- Turn processing with text chat
- Basic LLM integration
- Event emission

### Phase 2: Voice/Video

- WebRTC signaling
- STT/TTS integration
- Recording capture and storage
- VAD for speech detection

### Phase 3: Media Processing

- Upload pipeline with pre-signed URLs
- Batch transcription
- Speaker diarization
- NER and enrichment

### Phase 4: RAG & Semantic Search

- pgvector setup and migrations
- Embedding generation pipeline
- Semantic search integration
- Knowledge base indexing

### Phase 5: Feedback Engine

- Rubric management
- LLM-based scoring
- Coaching tip generation
- Benchmark tracking

### Phase 6: Analytics & Reporting

- PDF report generation
- Performance dashboards
- Team leaderboards
- Compliance reporting

---

## Appendix: Figure References

### Architecture Diagrams

- **Figure [7.2.1]**: Overall Simulation Microservice Architecture
  - Component diagram: [architecture.mmd](./architecture.mmd)
  - High-level component diagram:
    [figures/component-architecture.mmd](./figures/component-architecture.mmd)

- **Figure [7.2.20]**: Database Schema Diagram
  - Schema documentation: [prisma.schema.md](./prisma.schema.md)
  - Prisma schema file:
    [../../../apps/api/src/microservices/simulation/prisma/schema.prisma](../../../apps/api/src/microservices/simulation/prisma/schema.prisma)

### Sequence Diagrams

All sequence diagrams are available as Mermaid files in the
[figures/](./figures/) directory.

#### Session Management

- **Figure [7.2.2]**: Start Simulation Session -
  [figures/session-flows.mmd](./figures/session-flows.mmd#figure-82---start-simulation-session)
- **Figure [7.2.3]**: Advance Turn - Text Chat -
  [figures/session-flows.mmd](./figures/session-flows.mmd#figure-83---advance-turn---text-chat)
- **Figure [7.2.7]**: End Simulation Session -
  [figures/session-flows.mmd](./figures/session-flows.mmd#figure-87---end-simulation-session)

#### Tool Integration

- **Figure [7.2.4]**: Tool Call - Draft Email -
  [figures/tool-flows.mmd](./figures/tool-flows.mmd)

#### Voice/Video Communication

- **Figure [7.2.5]**: Start Voice/Video Call -
  [figures/call-flows.mmd](./figures/call-flows.mmd#figure-85---start-voicevideo-call)
- **Figure [7.2.6]**: Process Real-Time Speech (STT) -
  [figures/call-flows.mmd](./figures/call-flows.mmd#figure-86---process-real-time-speech-stt)

#### Media Processing

- **Figure [7.2.8]**: Upload Real Call Recording -
  [figures/media-flows.mmd](./figures/media-flows.mmd#figure-88---upload-real-call-recording)
- **Figure [7.2.9]**: Process Uploaded Recording (Transcription) -
  [figures/media-flows.mmd](./figures/media-flows.mmd#figure-89---process-uploaded-recording-transcription)

#### Feedback & Scoring

- **Figure [7.2.10]**: Generate Scorecard with Rubric -
  [figures/feedback-flows.mmd](./figures/feedback-flows.mmd#figure-810---generate-scorecard-with-rubric)
- **Figure [7.2.11]**: Retrieve Scorecard Details -
  [figures/feedback-flows.mmd](./figures/feedback-flows.mmd#figure-811---retrieve-scorecard-details)
- **Figure [7.2.12]**: Create or Update Rubric -
  [figures/feedback-flows.mmd](./figures/feedback-flows.mmd#figure-812---create-or-update-rubric)

#### Reporting

- **Figure [7.2.14]**: Generate PDF Report -
  [figures/report-flows.mmd](./figures/report-flows.mmd)

#### Technical Implementation Details

- **Figure [7.2.13]**: Semantic Search (RAG) -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-813---semantic-search-rag)
- **Figure [7.2.15]**: Detect and Redact PII -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-815---detect-and-redact-pii)
- **Figure [7.2.16]**: Voice Activity Detection (VAD) -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-816---voice-activity-detection-vad)
- **Figure [7.2.17]**: Handle Multi-Speaker Diarization -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-817---handle-multi-speaker-diarization)
- **Figure [7.2.18]**: Benchmark Tracking and Leaderboards -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-818---benchmark-tracking-and-leaderboards)
- **Figure [7.2.19]**: Stream LLM Response with SSE -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-819---stream-llm-response-with-sse)

### Viewing the Diagrams

See [figures/README.md](./figures/README.md) for instructions on viewing and
rendering these Mermaid diagrams.
