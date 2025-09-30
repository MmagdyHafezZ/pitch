# Simulation Microservice Specification

## A. Features & Functions

### 1. Simulation Orchestrator (multi-turn, tool-augmented)

- Create/restore/end sessions (text/voice/video)
- State machine / LangGraph flow (system ↔ user turns, tool calls, evaluation
  gates)
- Context assembly (CRM/persona/scenario), memory & scratchpad
- Tool routing (Search/RAG, STT/TTS, drafting, knowledge lookups)
- Turn logging, metrics, streaming tokens, guardrails (PII redaction, zod schema
  checks)
- **Emits events**: `simulation.started`, `turn.completed`,
  `simulation.completed`

### 2. Text Chat AI

- LLM responses (GPT-4o/4.1; fallback models)
- Prompt building (system, scenario, persona, style, guardrails)
- RAG (pgvector) over company KB + previous calls
- Message drafting (emails, follow-ups), translation
- Safety filters & redaction spans, prompt eval (DeepEval/Ragas)

### 3. Voice/Video Communication

- WebRTC signaling (SDP/ICE), track control (mic/cam), VAD
- STT (Whisper/Azure), streaming partials with timestamps
- TTS (ElevenLabs/Azure) voice profiles
- Recording muxing (mp4/webm), chunked uploads, asset lifecycle
- **Emits events**: `recording.available`, `stt.completed`

### 4. Media Ingestion (Real call uploads)

- Pre-signed upload, multipart ingest to MinIO/S3
- Transcription (batch), diarization, alignment
- Enrichment (entities, topics, sentiment), QC flags
- Adds transcript to RAG corpus (optional)
- **Emits events**: `media.ingested`, `analytics.updated`

### 5. Feedback Engine

- Rubrics & criteria, auto-scoring (content, objection handling, discovery,
  closing)
- Coach tips (actionable text), examples, links
- Benchmarks, team leaderboards, KPI roll-ups
- Report generation (session & aggregate)

---

## B. Controllers · Services · DTOs · DB Connections

### 1. Simulation Orchestrator

**Controllers**

- `SessionController`
  - `POST /sessions` (start)
  - `GET /sessions/:id`
  - `POST /sessions/:id/end`
- `TurnController`
  - `POST /sessions/:id/turns` (advance, with user msg, audio ref, tool inputs)
  - `GET /sessions/:id/turns`
- `ToolController`
  - `POST /sessions/:id/tool-calls` (explicit tool invocation when needed)

**Services**

- `OrchestratorService` (lifecycle, state machine, event emission)
- `GraphRunner` (LangGraph/LangChainJS flow)
- `ContextService` (persona/CRM/scenario assembly, memory)
- `ToolRouter` (RAG, Draft, STT/TTS, Search)
- `GuardrailService` (PII redaction, schema validation)
- `MetricService` (token usage, latency, tool counts)

**DTOs**

- `StartSessionDto { userId, orgId, mode: 'text'|'voice'|'video', scenarioId?, personaId?, language?, crmContextId? }`
- `AdvanceTurnDto { contentText?, audioAssetId?, attachments?: AssetRef[], metadata?: Json }`
- `EndSessionDto { reason?: string }`
- `ToolCallDto { name: string, input: Json }`

**DB Connections**

- **Postgres (Prisma)**: sessions, turns, messages, toolCalls, scenarios,
  personas, events, metrics
- **Mongo (Prisma)**: context snapshots, scratchpads (JSON), ephemeral flow
  states
- **MinIO/S3**: assets (audio/video)

---

### 2. Text Chat AI

**Controllers**

- `ChatController`
  - `POST /chat/stream` (SSE/WebSocket)
  - `POST /chat/draft-email`
  - `POST /chat/translate`

**Services**

- `LLMService` (model selection, completion/streaming)
- `PromptService` (templates, instructions, safety)
- `RetrievalService` (pgvector semantic search)
- `RedactionService` (PII spans)
- `EvalService` (prompt/output eval)

**DTOs**

- `ChatRequestDto { sessionId, turnId?, text, language?, toolsAllowed?: string[] }`
- `DraftEmailDto { sessionId, audience, purpose, tone?, bullets?: string[] }`
- `TranslateDto { text, from?, to }`

**DB**

- **Postgres**: Messages, Drafts
- **Postgres + pgvector**: Embeddings (RAG)
- **Mongo**: RedactionSpans, EvalArtifacts

---

### 3. Voice/Video

**Controllers**

- `CallController`
  - `POST /calls` (create)
  - `POST /calls/:id/sdp` (offer/answer)
  - `POST /calls/:id/ice`
  - `POST /calls/:id/recordings/start|stop`
- `MediaController`
  - `POST /media/upload/init|part|complete`
  - `GET /media/assets/:id`

**Services**

- `WebRTCService` (signaling)
- `STTService` (stream/batch)
- `TTSService` (voice synth)
- `RecordingService` (mux, store, URLs)
- `VADService` (speech activity)

**DTOs**

- `CreateCallDto { sessionId, tracks: ('audio'|'video')[] }`
- `SdpDto { type: 'offer'|'answer', sdp: string }`
- `IceDto { candidate: string }`
- `StartRecordingDto { callId, layout?, tracks? }`
- `UploadInitDto { mimeType, sizeBytes }`
- `UploadPartDto { assetId, partNumber, contentRange }`

**DB**

- **Postgres**: CallSession, Recording, MediaAsset
- **Mongo**: Transcript (raw & segments)
- **MinIO/S3**: media blobs

---

### 4. Media Ingestion

**Controllers**

- `IngestController`
  - `POST /ingest/upload/init|part|complete`
  - `POST /ingest/jobs` (start transcription+enrich)
  - `GET /ingest/jobs/:id`
- `TranscriptController`
  - `GET /transcripts/:id`
  - `GET /transcripts/:id/segments`

**Services**

- `StorageService` (MinIO/S3)
- `TranscribeService` (Whisper/Azure)
- `DiarizationService` (speaker turns)
- `EnrichService` (NER, topics, sentiment)
- `AlignService` (timestamps)
- `IndexerService` (push to pgvector/RAG)

**DTOs**

- `IngestRequestDto { assetId, pipeline?: ('transcribe'|'transcribe+enrich'|'full') }`
- `IngestJobStatusDto { jobId }`

**DB**

- **Postgres**: IngestionJob, MediaAsset (shared), TranscriptIndexRef
- **Mongo**: Transcript, Segment, Speaker, Enrichment
- **pgvector**: Embedding rows

---

### 5. Feedback Engine

**Controllers**

- `FeedbackController`
  - `POST /feedback/score` (by sessionId)
  - `GET /feedback/scorecards/:id`
- `RubricController`
  - `POST /rubrics`
  - `GET /rubrics/:id`
  - `PATCH /rubrics/:id`

**Services**

- `ScoringService` (LLM & rule-based scores)
- `RubricService` (CRUD, versioning)
- `CoachingService` (tips, exemplars)
- `BenchmarkService` (team/org baselines)
- `ReportService` (PDF/JSON export)

**DTOs**

- `ScoreRequestDto { sessionId, rubricId?, locale? }`
- `RubricDto { name, version?, criteria: CriterionDto[] }`
- `GenerateReportDto { sessionId, format: 'pdf'|'json' }`

**DB**

- **Postgres**: Scorecard, Rubric, Criterion, ScoreItem, CoachTip, Benchmark
- **Mongo**: FeatureVectors (optional), CoachExcerpts
