/**
 * Redis Key Patterns and Interfaces
 *
 * Defines typed Redis key patterns for the Simulation microservice.
 * All Redis data is ephemeral and can be reconstructed from PostgreSQL/MongoDB.
 *
 * Design Principles:
 * 1. All keys have TTL (expiration)
 * 2. Keys follow a consistent namespace pattern: {service}:{entity}:{id}:{field}
 * 3. No critical business logic depends solely on Redis data
 * 4. Redis is used for: cache, coordination, ephemeral state
 */

/**
 * Key Pattern Generators
 */
export const RedisKeys = {
  // ===== Session Cache =====
  // Stores active session state for low-latency reads
  // TTL: 24 hours (extended on activity)
  session: (sessionId: string) => `sim:session:${sessionId}`,
  sessionContext: (sessionId: string) => `sim:session:${sessionId}:context`,

  // ===== Persona & Scenario Cache =====
  // Caches frequently accessed persona/scenario config
  // TTL: 1 hour
  persona: (personaId: string) => `sim:persona:${personaId}`,
  scenario: (scenarioId: string) => `sim:scenario:${scenarioId}`,

  // ===== SSE (Server-Sent Events) State =====
  // Tracks SSE connection state and last event ID
  // TTL: 1 hour
  sseChannel: (sessionId: string) => `sim:sse:${sessionId}`,
  sseLastEventId: (sessionId: string) => `sim:sse:${sessionId}:lastEventId`,

  // ===== WebRTC Signaling =====
  // Ephemeral WebRTC signaling state before finalization
  // TTL: 5 minutes (short-lived)
  webrtcOffer: (callId: string) => `sim:webrtc:${callId}:offer`,
  webrtcAnswer: (callId: string) => `sim:webrtc:${callId}:answer`,
  webrtcIceCandidate: (callId: string, index: number) =>
    `sim:webrtc:${callId}:ice:${index}`,
  webrtcState: (callId: string) => `sim:webrtc:${callId}:state`,

  // ===== STT (Speech-to-Text) Partials =====
  // Stores partial transcription results during streaming
  // TTL: 5 minutes (discarded after finalization)
  sttPartial: (callId: string) => `sim:stt:${callId}:partial`,
  sttBuffer: (callId: string) => `sim:stt:${callId}:buffer`,

  // ===== Rate Limiting =====
  // Per-org and per-user rate limit counters
  // TTL: Sliding window (e.g., 1 minute, 1 hour)
  rateLimitOrg: (orgId: string, window: string) =>
    `sim:ratelimit:org:${orgId}:${window}`,
  rateLimitUser: (userId: string, window: string) =>
    `sim:ratelimit:user:${userId}:${window}`,

  // ===== Idempotency Keys =====
  // Prevents duplicate processing of requests
  // TTL: 24 hours
  idempotencyKey: (key: string) => `sim:idempotency:${key}`,

  // ===== Job Locks =====
  // Distributed locks for background jobs
  // TTL: 10 minutes (with heartbeat)
  jobLock: (jobType: string, jobId: string) => `sim:lock:${jobType}:${jobId}`,

  // ===== Turn Context =====
  // Temporary context during turn processing
  // TTL: 10 minutes
  turnContext: (sessionId: string, turnId: string) =>
    `sim:turn:${sessionId}:${turnId}:ctx`,

  // ===== LLM Streaming State =====
  // Tracks LLM streaming state and partial responses
  // TTL: 5 minutes
  llmStream: (sessionId: string, turnId: string) =>
    `sim:llm:${sessionId}:${turnId}:stream`,

  // ===== VAD (Voice Activity Detection) State =====
  // Tracks VAD state during real-time audio processing
  // TTL: 5 minutes
  vadState: (callId: string) => `sim:vad:${callId}:state`,
} as const;

/**
 * TypeScript Interfaces for Redis Data Structures
 */

// Session Cache
export interface ISessionCache {
  id: string;
  userId: string;
  orgId: string;
  mode: 'text' | 'voice' | 'video';
  scenarioId?: string;
  personaId?: string;
  status: 'active' | 'ended';
  language?: string;
  crmContextId?: string;
  createdAt: string; // ISO timestamp
  lastActivityAt: string; // ISO timestamp
  turnCount?: number;
}

// Session Context (expanded for turn processing)
export interface ISessionContext {
  sessionId: string;
  scenario?: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
  persona?: {
    id: string;
    name: string;
    traits: Record<string, any>;
  };
  recentTurns?: Array<{
    order: number;
    role: string;
    text: string;
  }>;
  metadata?: Record<string, any>;
}

// SSE Channel State
export interface ISSEChannelState {
  sessionId: string;
  isActive: boolean;
  lastEventId: string;
  connectedAt: string; // ISO timestamp
  lastPingAt: string; // ISO timestamp
}

// WebRTC State
export interface IWebRTCState {
  callId: string;
  sessionId: string;
  status: 'created' | 'offered' | 'answered' | 'connected' | 'ended';
  tracks: string[]; // ["audio", "video"]
  createdAt: string;
  updatedAt: string;
}

// STT Partial Result
export interface ISTTPartial {
  callId: string;
  text: string;
  isFinal: boolean;
  confidence?: number;
  words?: Array<{
    word: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
  timestamp: string; // ISO timestamp
}

// Rate Limit Counter
export interface IRateLimitCounter {
  count: number;
  windowStart: string; // ISO timestamp
  windowEnd: string; // ISO timestamp
  limit: number;
}

// Idempotency Record
export interface IIdempotencyRecord {
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody?: any;
  createdAt: string;
  expiresAt: string;
}

// Job Lock
export interface IJobLock {
  jobType: string;
  jobId: string;
  lockedBy: string; // Worker/instance ID
  lockedAt: string;
  expiresAt: string;
  heartbeatAt: string;
}

// Turn Context
export interface ITurnContext {
  sessionId: string;
  turnId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text?: string;
  attachments?: any[];
  retrievedDocs?: Array<{
    id: string;
    content: string;
    score: number;
  }>;
  toolCalls?: Array<{
    name: string;
    input: any;
  }>;
  metadata?: Record<string, any>;
}

// LLM Streaming State
export interface ILLMStreamState {
  sessionId: string;
  turnId: string;
  provider: string;
  model: string;
  isActive: boolean;
  partialContent: string;
  totalTokens: number;
  startedAt: string;
  lastChunkAt: string;
}

// VAD State
export interface IVADState {
  callId: string;
  isSpeaking: boolean;
  silenceDurationMs: number;
  speechDurationMs: number;
  lastActivityAt: string;
  threshold: number;
}

/**
 * Redis TTL Constants (in seconds)
 */
export const RedisTTL = {
  SESSION_CACHE: 24 * 60 * 60, // 24 hours
  SESSION_CONTEXT: 24 * 60 * 60, // 24 hours
  PERSONA_CACHE: 60 * 60, // 1 hour
  SCENARIO_CACHE: 60 * 60, // 1 hour
  SSE_STATE: 60 * 60, // 1 hour
  WEBRTC_STATE: 5 * 60, // 5 minutes
  STT_PARTIAL: 5 * 60, // 5 minutes
  RATE_LIMIT_1MIN: 60, // 1 minute
  RATE_LIMIT_1HOUR: 60 * 60, // 1 hour
  IDEMPOTENCY_KEY: 24 * 60 * 60, // 24 hours
  JOB_LOCK: 10 * 60, // 10 minutes
  TURN_CONTEXT: 10 * 60, // 10 minutes
  LLM_STREAM: 5 * 60, // 5 minutes
  VAD_STATE: 5 * 60, // 5 minutes
} as const;
