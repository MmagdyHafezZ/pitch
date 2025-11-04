# Simulation Microservice Architecture

The Simulation Microservice provides a comprehensive framework for orchestrating
multi-modal sales training simulations, media processing, and performance
evaluation. The overall system structure is shown in Figure [8.1] in the
appendix.

## Features

### Simulation Orchestration

Multi-turn conversation orchestration with text, voice, and video support, state
machine management, context assembly from CRM/persona/scenario data, tool
routing, and real-time event streaming.

### Text Chat AI

LLM-powered responses with RAG (Retrieval-Augmented Generation) over company
knowledge bases, message drafting, translation, safety filters, and PII
redaction capabilities.

### Voice/Video Communication

WebRTC signaling for real-time audio/video, speech-to-text (STT) and
text-to-speech (TTS) integration, voice activity detection (VAD), and recording
capabilities with multiple layout options.

### Media Ingestion

Upload and processing pipeline for real sales call recordings, including
transcription, speaker diarization, enrichment with NER (Named Entity
Recognition), sentiment analysis, and topic extraction.

### Feedback Engine

Automated scoring based on customizable rubrics, AI-generated coaching tips,
team benchmarks, and comprehensive report generation.

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

This layer contains core business logic and orchestration. Services coordinate
workflows, enforce business rules, and interact with repositories for data
persistence.

**Components**:

- **Orchestrator Service** - Session lifecycle and state machine management
- **LLM Service** - Language model integration and completion streaming
- **Prompt Service** - Template management and instruction assembly
- **Retrieval Service** - Semantic search over pgvector embeddings
- **WebRTC Service** - Real-time communication signaling
- **STT Service** - Speech-to-text transcription
- **TTS Service** - Text-to-speech synthesis
- **Recording Service** - Media recording and muxing
- **Storage Service** - MinIO/S3 asset management
- **Transcribe Service** - Batch transcription processing
- **Enrichment Service** - NER, topics, sentiment analysis
- **Feedback Service** - Automated scoring and coach tip generation
- **Rubric Service** - Rubric management and versioning

### Repositories

Repositories abstract the data access layer, isolating persistence logic from
business logic. They interact directly with databases for CRUD operations.

**Components**: Session Repository, Turn Repository, Message Repository,
ToolCall Repository, Scenario Repository, Persona Repository, Call Repository,
Recording Repository, Media Repository, Transcript Repository, Rubric
Repository, Score Repository, Embedding Repository.

### Tables (Database Layer) Figure [8.20]

Each repository corresponds to one or more database tables responsible for
storing structured data.

**Core Tables**:

- **Session Table** - Stores simulation session state with user/org context
- **Turn Table** - Individual conversation turns with role and content
- **Message Table** - Message records with redaction support
- **ToolCall Table** - Tool invocation logs with latency metrics
- **Event Table** - System events emitted during simulations

**Configuration Tables**:

- **Scenario Table** - Training scenario definitions
- **Persona Table** - AI persona characteristics and traits

**Media Tables**:

- **CallSession Table** - WebRTC call metadata and SDP data
- **Recording Table** - Recording references with layout info
- **MediaAsset Table** - Uploaded media files and storage keys

**Transcription Tables**:

- **IngestionJob Table** - Background job status tracking
- **Transcript Table** - Full transcription results
- **TranscriptSegment Table** - Time-coded transcript segments
- **Speaker Table** - Speaker identification and diarization
- **Enrichment Table** - NER, sentiment, and topic data

**Evaluation Tables**:

- **Rubric Table** - Versioned scoring rubrics
- **Criterion Table** - Individual rubric criteria
- **Scorecard Table** - Session evaluation results
- **ScoreItem Table** - Scores for individual criteria
- **CoachTip Table** - Coaching feedback text

**Analytics Tables**:

- **Metric Table** - Token usage and latency metrics
- **Benchmark Table** - Team performance baselines
- **EvalArtifact Table** - Evaluation framework results (RAGAS, DeepEval)
- **FeatureVector Table** - Numeric features for ML
- **EmbeddingRow Table** - Vector embeddings for RAG (pgvector)

**PII & Drafts**:

- **RedactionSpan Table** - PII detection and masking metadata
- **DraftEmail Table** - AI-generated email drafts
- **ReportRequest Table** - Report generation queue

---

## Data Flow Summary

1. The request enters through the relevant API Gateway
2. The Gateway Controller validates and routes it to the appropriate Service
3. The Service executes domain logic and orchestrates across multiple
   repositories
4. The Repositories interact with underlying database Tables
5. Events are published to RabbitMQ for async processing
6. The response returns up the stack to the client

---

## Sequence Flows

### Start Simulation Session Figure [8.2]

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

### Advance Turn - Text Chat Figure [8.3]

The User sends a `POST /sessions/{sessionId}/turns` request with text content
through the Session Gateway to the Turn Controller.

The Turn Controller validates the session exists by querying the Session
Repository. If not found or status is "ended", it returns
`404 Session Not Found` or `409 Session Ended`.

The Orchestrator Service creates a new Turn record with role="user", incremented
order number, and the user's message text in the Turn Repository.

The Orchestrator Service checks if any guardrails need to run. The Guardrail
Service scans for PII (emails, phone numbers, SSNs) and creates RedactionSpan
records in the RedactionSpan Repository if detected.

The Context Service assembles the conversation history by retrieving previous
Turns from the Turn Repository, along with scenario instructions and persona
traits.

The Retrieval Service performs semantic search over the Embedding Repository
(pgvector) to find relevant context from company knowledge base or previous
calls.

The Prompt Service builds the full prompt with system instructions, conversation
history, retrieved context, and guardrails.

The LLM Service calls the language model API (GPT-4o) and streams the response
back through Server-Sent Events (SSE).

As tokens arrive, the system saves the assistant's response as a new Turn with
role="assistant" and creates a Message record in the Message Repository.

The Metric Service logs token counts (input/output), latency, and model name in
the Metric Repository.

The Event Bus emits a `turn.completed` event with turnId, sessionId, and
metrics.

The system responds with `200 OK`, streaming the assistant's response to the
client in real-time.

---

### Tool Call - Draft Email Figure [8.4]

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

### Start Voice/Video Call Figure [8.5]

The User sends a `POST /calls` request with sessionId and tracks array
(["audio"] or ["audio", "video"]) through the Call Gateway to the Call
Controller.

The Call Controller validates the session exists and mode is "voice" or "video"
via the Session Repository. If invalid, it returns `400 Invalid Session Mode`.

The WebRTC Service creates a new CallSession record in the Call Repository with
status="created" and the requested tracks.

The system generates server-side SDP offer using the WebRTC signaling layer and
saves it in the CallSession record.

The Call Controller responds with `201 Created`, returning the callId, SDP
offer, and STUN/TURN server configuration.

The User's client sends a `POST /calls/{callId}/sdp` request with the SDP answer
after local media setup.

The WebRTC Service validates and stores the SDP answer in the Call Repository,
then establishes the media connection.

The Call Repository updates the CallSession status to "active" and records the
connection timestamp.

If recording is enabled, the Recording Service starts capturing media streams
and creates a Recording record in the Recording Repository linked to the call.

The Event Bus emits a `call.started` event for monitoring and analytics.

The system responds with `200 OK`, confirming the call is established.

---

### Process Real-Time Speech (STT) Figure [8.6]

During an active voice call, the WebRTC Service receives audio chunks from the
client's microphone through the RTC connection.

The VAD Service analyzes each audio chunk to detect speech activity and filters
out silence.

When speech is detected, audio chunks are buffered and sent to the STT Service
for transcription.

The STT Service calls the Whisper or Azure STT API with streaming enabled,
requesting partial results and timestamps.

As partial transcriptions arrive, they are forwarded to the Orchestrator Service
with speaker labels and timing information.

The Orchestrator Service creates Turn records in real-time with role="user",
text set to partial transcripts, and audio references.

When a complete utterance is detected (pause or turn-end), the final
transcription is saved and a Message record is created in the Message
Repository.

The Context Service assembles the user's speech into the conversation history
for the next LLM turn.

The LLM Service processes the transcribed text and generates a response using
the same flow as text chat.

The TTS Service converts the assistant's text response to speech using
ElevenLabs or Azure TTS with the configured voice profile.

The synthesized audio is streamed back to the client through the WebRTC
connection for playback.

The Metric Service logs STT latency, TTS latency, and audio processing metrics
in the Metric Repository.

The Event Bus emits `stt.completed` events for each completed transcription.

---

### End Simulation Session Figure [8.7]

The User sends a `POST /sessions/{sessionId}/end` request with optional reason
through the Session Gateway to the Session Controller.

The Session Controller validates the session exists and is active via the
Session Repository. If not found or already ended, it returns `404` or `409`.

The Orchestrator Service updates the Session record, setting status="ended",
endedReason, and endedAt timestamp.

If a call is active, the WebRTC Service retrieves the CallSession from the Call
Repository and updates its status to "ended".

If recording was active, the Recording Service stops capture, finalizes the
media file, and uploads it to the Storage Service (MinIO/S3).

A MediaAsset record is created in the Media Repository with the storage key,
MIME type, and file size.

The Recording Repository updates the Recording record with the final assetId and
duration.

The Orchestrator Service retrieves all Turns and calculates total tokens used
via the Metric Repository.

The Event Bus emits a `simulation.completed` event with sessionId, endedReason,
total duration, and usage metrics.

If auto-feedback is enabled, the Feedback Service is triggered asynchronously to
generate a scorecard (see next flow).

The system responds with `200 OK`, returning session summary with total turns,
duration, and tokens used.

---

### Upload Real Call Recording Figure [8.8]

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

### Process Uploaded Recording (Transcription) Figure [8.9]

After a media file is uploaded, the User sends `POST /ingest/jobs` with assetId
and pipeline="transcribe_enrich" through the Ingestion Gateway.

The Ingest Controller validates the asset exists via the Media Repository. If
not found, it returns `404 Asset Not Found`.

An IngestionJob record is created in the Ingestion Job Repository with
status="queued" and pipeline type.

The job is picked up by a background worker (BullMQ or similar), which updates
status to "running" and records startedAt timestamp.

The Storage Service retrieves the media file from S3/MinIO using the storageKey.

The Transcribe Service sends the audio to Whisper or Azure STT API for batch
transcription with speaker diarization enabled.

The API returns a full transcript with speaker labels and word-level timestamps.

The Transcript Repository creates a Transcript record with the full text and
language code.

The Diarization Service processes speaker changes and creates Speaker records in
the Speaker Repository.

The Transcript Repository creates TranscriptSegment records for each utterance,
linked to the appropriate Speaker.

If the pipeline includes enrichment, the Enrichment Service processes the
transcript:

- NER extraction identifies entities (company names, products, people)
- Topic modeling extracts main themes
- Sentiment analysis scores emotional tone per segment

An Enrichment record is created in the Enrichment Repository with summary,
topics, sentiment, and entities.

The Ingestion Job Repository updates the job with status="completed",
transcriptId, and completedAt timestamp.

If the pipeline is "full", the Indexer Service generates embeddings for each
segment using a sentence transformer model and stores them in the Embedding
Repository (pgvector) for future RAG queries.

The Event Bus emits `analytics.updated` event with transcriptId and job
metadata.

The system responds with `200 OK` (async job pattern), returning the jobId for
status polling.

---

### Generate Scorecard with Rubric Figure [8.10]

After a simulation ends, the Admin Client sends `POST /feedback/score` with
sessionId and optional rubricId through the Feedback Gateway to the Feedback
Controller.

The Feedback Controller validates the session exists and is ended via the
Session Repository. If not ended, it returns `409 Session Not Complete`.

If rubricId is provided, the Rubric Service retrieves the Rubric and Criterion
records from the Rubric Repository. If not found, it returns
`404 Rubric Not Found`.

If no rubricId is provided, the Rubric Service retrieves the default rubric for
the user's organization.

The Feedback Service retrieves all Turn and Message records for the session from
the Turn Repository and Message Repository.

For each Criterion in the rubric, the Scoring Service evaluates the session:

- **LLM-based scoring**: The LLM Service generates a score (0-maxPoints) with
  reasoning based on conversation analysis
- **Rule-based scoring**: Pattern matching or keyword detection for specific
  behaviors

A ScoreItem record is created in the Score Repository for each criterion with
the achieved score, maxPoints, and details JSON.

The Feedback Service calculates totalScore by summing weighted criterion scores
and maxScore from the rubric definition.

A Scorecard record is created in the Score Repository with totalScore, maxScore,
and rubricId.

The Coaching Service generates actionable tips by analyzing low-scoring areas:

- The LLM Service creates coaching text linked to specific conversation excerpts
- CoachTip records are created in the Score Repository with text, excerptRef,
  and optional resource links

The Benchmark Service updates team/org averages in the Benchmark Repository for
performance tracking.

The Event Bus emits a `feedback.ready` event with scorecardId and sessionId.

The system responds with `200 OK`, returning the scorecardId and summary scores.

---

### Retrieve Scorecard Details Figure [8.11]

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

### Create or Update Rubric Figure [8.12]

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

### Semantic Search (RAG) Figure [8.13]

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

### Generate PDF Report Figure [8.14]

The User sends `POST /reports/generate` with sessionId and format="pdf" through
the Feedback Gateway to the Report Controller.

The Report Controller validates the session exists and has a scorecard via the
Session Repository and Score Repository. If no scorecard exists, it returns
`404 Scorecard Not Found`.

A ReportRequest record is created in the Report Repository with status="queued"
and format="pdf".

The Report Service retrieves comprehensive session data:

- Session metadata from Session Repository
- All Turns from Turn Repository
- Scorecard with items and tips from Score Repository
- Transcript if available from Transcript Repository
- Metrics from Metric Repository

The Report Service assembles the report content:

- Executive summary with score and duration
- Conversation transcript with timestamps
- Scoring breakdown by criterion
- Coaching recommendations with excerpts
- Performance charts (scores over time, benchmark comparison)

The Report Service uses a PDF generation library (e.g., Puppeteer, PDFKit) to
render the content with branding and formatting.

The generated PDF is uploaded to the Storage Service (S3/MinIO) as a MediaAsset.

The Report Repository updates the ReportRequest with status="ready", assetId,
and a signed download URL.

The system responds with `200 OK` (async), returning the reportRequestId for
status polling.

When the user polls `GET /reports/{reportRequestId}`, the system returns the
download URL if ready.

---

### Detect and Redact PII Figure [8.15]

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

The Guardrail Service creates a RedactionSpan record in the RedactionSpan
Repository linked to the Message.

Depending on the configuration:

- **Mask mode**: The displayed text replaces PII with "[REDACTED]" or "[EMAIL]"
- **Flag mode**: The PII is flagged but not modified
- **Audit mode**: The PII is logged for compliance review

The Message Repository stores both the original content (for authorized access)
and the redacted version (for general display).

When messages are retrieved for display, the system checks user permissions:

- Regular users see redacted versions
- Admins with PII access can view original content

The Event Bus emits a `pii.detected` event for security monitoring and
compliance auditing.

---

### Voice Activity Detection (VAD) Figure [8.16]

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

### Handle Multi-Speaker Diarization Figure [8.17]

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

### Benchmark Tracking and Leaderboards Figure [8.18]

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

### Stream LLM Response with SSE Figure [8.19]

For text chat, the system streams assistant responses in real-time using
Server-Sent Events (SSE).

The User sends a `POST /sessions/{sessionId}/turns` request with text content
and includes `Accept: text/event-stream` header.

The Turn Controller establishes an SSE connection and keeps it open for
streaming.

The Orchestrator Service processes the turn (context assembly, retrieval,
guardrails) as described in Figure [8.3].

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

### Event-Driven Architecture

The microservice publishes events to RabbitMQ for async processing and
cross-service communication:

- `simulation.started` - Session begins
- `turn.completed` - Each conversation turn finishes
- `simulation.completed` - Session ends
- `recording.available` - Recording is ready
- `stt.completed` - Transcription finishes
- `media.ingested` - Upload completes
- `analytics.updated` - Enrichment or scoring completes
- `feedback.ready` - Scorecard is generated
- `pii.detected` - PII is found in content

### External Service Integrations

**Speech Services**:

- Whisper (OpenAI) or Azure Speech Service for STT
- ElevenLabs or Azure TTS for voice synthesis

**LLM Providers**:

- OpenAI (GPT-4o, GPT-4.1)
- Fallback models for cost optimization

**Storage**:

- MinIO or AWS S3 for media asset storage
- Pre-signed URLs for secure client uploads

**Caching**:

- Redis for session state, prompt templates, and embedding cache

### Guardrails and Safety

**PII Redaction**: Automatic detection and masking of sensitive information
**Content Filtering**: Safety checks on user inputs and LLM outputs **Schema
Validation**: Zod-based validation on all DTOs **Rate Limiting**: Token usage
quotas per org/user

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

- **Figure [8.1]**: Overall Simulation Microservice Architecture
  - Component diagram: [architecture.mmd](./architecture.mmd)
  - High-level component diagram:
    [figures/component-architecture.mmd](./figures/component-architecture.mmd)

- **Figure [8.20]**: Database Schema Diagram
  - Schema documentation: [prisma.schema.md](./prisma.schema.md)
  - Prisma schema file:
    [../../../apps/api/src/microservices/simulation/prisma/schema.prisma](../../../apps/api/src/microservices/simulation/prisma/schema.prisma)

### Sequence Diagrams

All sequence diagrams are available as Mermaid files in the
[figures/](./figures/) directory.

#### Session Management

- **Figure [8.2]**: Start Simulation Session -
  [figures/session-flows.mmd](./figures/session-flows.mmd#figure-82---start-simulation-session)
- **Figure [8.3]**: Advance Turn - Text Chat -
  [figures/session-flows.mmd](./figures/session-flows.mmd#figure-83---advance-turn---text-chat)
- **Figure [8.7]**: End Simulation Session -
  [figures/session-flows.mmd](./figures/session-flows.mmd#figure-87---end-simulation-session)

#### Tool Integration

- **Figure [8.4]**: Tool Call - Draft Email -
  [figures/tool-flows.mmd](./figures/tool-flows.mmd)

#### Voice/Video Communication

- **Figure [8.5]**: Start Voice/Video Call -
  [figures/call-flows.mmd](./figures/call-flows.mmd#figure-85---start-voicevideo-call)
- **Figure [8.6]**: Process Real-Time Speech (STT) -
  [figures/call-flows.mmd](./figures/call-flows.mmd#figure-86---process-real-time-speech-stt)

#### Media Processing

- **Figure [8.8]**: Upload Real Call Recording -
  [figures/media-flows.mmd](./figures/media-flows.mmd#figure-88---upload-real-call-recording)
- **Figure [8.9]**: Process Uploaded Recording (Transcription) -
  [figures/media-flows.mmd](./figures/media-flows.mmd#figure-89---process-uploaded-recording-transcription)

#### Feedback & Scoring

- **Figure [8.10]**: Generate Scorecard with Rubric -
  [figures/feedback-flows.mmd](./figures/feedback-flows.mmd#figure-810---generate-scorecard-with-rubric)
- **Figure [8.11]**: Retrieve Scorecard Details -
  [figures/feedback-flows.mmd](./figures/feedback-flows.mmd#figure-811---retrieve-scorecard-details)
- **Figure [8.12]**: Create or Update Rubric -
  [figures/feedback-flows.mmd](./figures/feedback-flows.mmd#figure-812---create-or-update-rubric)

#### Reporting

- **Figure [8.14]**: Generate PDF Report -
  [figures/report-flows.mmd](./figures/report-flows.mmd)

#### Technical Implementation Details

- **Figure [8.13]**: Semantic Search (RAG) -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-813---semantic-search-rag)
- **Figure [8.15]**: Detect and Redact PII -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-815---detect-and-redact-pii)
- **Figure [8.16]**: Voice Activity Detection (VAD) -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-816---voice-activity-detection-vad)
- **Figure [8.17]**: Handle Multi-Speaker Diarization -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-817---handle-multi-speaker-diarization)
- **Figure [8.18]**: Benchmark Tracking and Leaderboards -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-818---benchmark-tracking-and-leaderboards)
- **Figure [8.19]**: Stream LLM Response with SSE -
  [figures/technical-flows.mmd](./figures/technical-flows.mmd#figure-819---stream-llm-response-with-sse)

### Viewing the Diagrams

See [figures/README.md](./figures/README.md) for instructions on viewing and
rendering these Mermaid diagrams.
