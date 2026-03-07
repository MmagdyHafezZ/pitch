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
  session: (sessionId: string) => `sim:session:${sessionId}`,
  sessionContext: (sessionId: string) => `sim:session:${sessionId}:context`,

  persona: (personaId: string) => `sim:persona:${personaId}`,
  scenario: (scenarioId: string) => `sim:scenario:${scenarioId}`,

  sseChannel: (sessionId: string) => `sim:sse:${sessionId}`,
  sseLastEventId: (sessionId: string) => `sim:sse:${sessionId}:lastEventId`,

  wsConnection: (sessionId: string) => `sim:ws:${sessionId}`,
  wsRequestState: (requestId: string) => `sim:ws:request:${requestId}`,

  webrtcOffer: (callId: string) => `sim:webrtc:${callId}:offer`,
  webrtcAnswer: (callId: string) => `sim:webrtc:${callId}:answer`,
  webrtcIceCandidate: (callId: string, index: number) =>
    `sim:webrtc:${callId}:ice:${index}`,
  webrtcState: (callId: string) => `sim:webrtc:${callId}:state`,

  sttPartial: (callId: string) => `sim:stt:${callId}:partial`,
  sttBuffer: (callId: string) => `sim:stt:${callId}:buffer`,

  rateLimitOrg: (orgId: string, window: string) =>
    `sim:ratelimit:org:${orgId}:${window}`,
  rateLimitUser: (userId: string, window: string) =>
    `sim:ratelimit:user:${userId}:${window}`,

  idempotencyKey: (key: string) => `sim:idempotency:${key}`,

  jobLock: (jobType: string, jobId: string) => `sim:lock:${jobType}:${jobId}`,

  turnContext: (sessionId: string, turnId: string) =>
    `sim:turn:${sessionId}:${turnId}:ctx`,

  llmStream: (sessionId: string, turnId: string) =>
    `sim:llm:${sessionId}:${turnId}:stream`,

  vadState: (callId: string) => `sim:vad:${callId}:state`,

  llmPricing: (provider: string) => `sim:llm:pricing:${provider}`,
  llmCatalog: (provider: string) => `sim:llm:catalog:${provider}`,
  llmAuthToken: (provider: string) => `sim:llm:auth:${provider}`,

  /** Full session with relations (scenario + persona) */
  sessionFull: (sessionId: string) => `sim:session:${sessionId}:full`,
  /** Iteration message history */
  iterationHistory: (iterationId: string) =>
    `sim:iteration:${iterationId}:history`,
  /** Maps sessionId+userId → { sessionMemberId, iterationId, lastTurnOrder } */
  sessionMemberIteration: (sessionId: string, userId: string) =>
    `sim:smiter:${sessionId}:${userId}`,
  /** Temporary audio asset used for external avatar generation */
  videoAudioAsset: (jobId: string) => `sim:video:${jobId}:audio`,
  /** Pending avatar-generation job metadata */
  videoJob: (jobId: string) => `sim:video:${jobId}:job`,
  /** Cached persona preview audio */
  personaPreviewAudio: (personaId: string) =>
    `sim:persona:${personaId}:preview-audio`,
} as const;

/**
 * TypeScript Interfaces for Redis Data Structures
 */

export interface ISessionCache {
  id: string;
  userId: string;
  orgId: string;
  mode: 'text' | 'voice' | 'video' | 'phone';
  scenarioId?: string;
  personaId?: string;
  status: 'active' | 'ended';
  language?: string;
  crmContextId?: string;
  createdAt: string;
  lastActivityAt: string;
  turnCount?: number;
}

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

export interface ISSEChannelState {
  sessionId: string;
  isActive: boolean;
  lastEventId: string;
  connectedAt: string;
  lastPingAt: string;
}

export interface IWSConnectionState {
  sessionId: string;
  userId: string;
  orgId: string;
  isActive: boolean;
  connectedAt: string;
  lastActivityAt: string;
  activeRequests: string[];
}

export interface IWSRequestState {
  requestId: string;
  sessionId: string;
  turnId?: string;
  type: string;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface IWebRTCState {
  callId: string;
  sessionId: string;
  status: 'created' | 'offered' | 'answered' | 'connected' | 'ended';
  tracks: string[];
  createdAt: string;
  updatedAt: string;
}

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
  timestamp: string;
}

export interface IRateLimitCounter {
  count: number;
  windowStart: string;
  windowEnd: string;
  limit: number;
}

export interface IIdempotencyRecord {
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody?: any;
  createdAt: string;
  expiresAt: string;
}

export interface IJobLock {
  jobType: string;
  jobId: string;
  lockedBy: string;
  lockedAt: string;
  expiresAt: string;
  heartbeatAt: string;
}

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

export interface IVADState {
  callId: string;
  isSpeaking: boolean;
  silenceDurationMs: number;
  speechDurationMs: number;
  lastActivityAt: string;
  threshold: number;
}

/**
 * Serializable conversation message for Redis history cache
 */
export interface IConversationMessage {
  role: string;
  content: string;
}

/**
 * Maps a (sessionId, userId) pair to the current active sessionMember + iteration IDs
 */
export interface ISessionMemberIteration {
  sessionMemberId: string;
  iterationId: string;
  lastTurnOrder: number;
}

export interface IVideoAudioAsset {
  sessionId: string;
  token: string;
  contentType: string;
  audioBase64: string;
  createdAt: string;
}

export interface IVideoJob {
  jobId: string;
  sessionId: string;
  requestId: string;
  provider: 'heygen' | 'azure-avatar';
  text: string;
  language?: string;
  fallbackAttempted: boolean;
  createdAt: string;
}

export interface IPersonaPreviewAudioAsset {
  personaId: string;
  voiceName: string;
  text: string;
  contentType: string;
  audioBase64: string;
  createdAt: string;
}

/**
 * Redis TTL Constants (in seconds)
 */
export const RedisTTL = {
  SESSION_CACHE: 24 * 60 * 60,
  SESSION_CONTEXT: 24 * 60 * 60,
  PERSONA_CACHE: 60 * 60,
  SCENARIO_CACHE: 60 * 60,
  SSE_STATE: 60 * 60,
  WS_CONNECTION: 60 * 60,
  WS_REQUEST: 5 * 60,
  WEBRTC_STATE: 5 * 60,
  STT_PARTIAL: 5 * 60,
  RATE_LIMIT_1MIN: 60,
  RATE_LIMIT_1HOUR: 60 * 60,
  IDEMPOTENCY_KEY: 24 * 60 * 60,
  JOB_LOCK: 10 * 60,
  TURN_CONTEXT: 10 * 60,
  LLM_STREAM: 5 * 60,
  VAD_STATE: 5 * 60,
  LLM_PRICING: 6 * 60 * 60,
  LLM_MODEL_CATALOG: 6 * 60 * 60,
  /** Full session with persona/scenario relations — 10min; refreshed on session mutations */
  SESSION_FULL: 10 * 60,
  /** Iteration message history — 30min; evicted on new turn writes */
  ITERATION_HISTORY: 30 * 60,
  /** sessionId+userId → sessionMemberId + iterationId — 30min */
  SESSION_MEMBER_ITER: 30 * 60,
  /** Temporary public audio for avatar generation — 30min */
  VIDEO_AUDIO_ASSET: 30 * 60,
  /** Avatar job metadata — 24h */
  VIDEO_JOB: 24 * 60 * 60,
  /** Persona preview audio cache — 30 days */
  PERSONA_PREVIEW_AUDIO: 30 * 24 * 60 * 60,
} as const;
