export enum WsMessageType {
  CHAT_START = 'chat.start',
  CHAT_DELTA = 'chat.delta',
  CHAT_COMPLETED = 'chat.completed',
  CHAT_ERROR = 'chat.error',
  CHAT_CANCEL = 'chat.cancel',

  STT_START = 'stt.start',
  STT_PARTIAL = 'stt.partial',
  STT_FINAL = 'stt.final',
  STT_ERROR = 'stt.error',

  TTS_REQUEST = 'tts.request',
  TTS_READY = 'tts.ready',
  TTS_ERROR = 'tts.error',

  CONVERSATION_START = 'conversation.start',
  CONVERSATION_TEXT = 'conversation.text',
  CONVERSATION_AUDIO_READY = 'conversation.audio_ready',
  CONVERSATION_ERROR = 'conversation.error',
  CONVERSATION_END = 'conversation.end',
  CONVERSATION_CANCEL = 'conversation.cancel',
  CONVERSATION_STREAM_DELTA = 'conversation.stream.delta',
  CONVERSATION_STREAM_COMPLETED = 'conversation.stream.completed',
  CONVERSATION_STAGE_TRANSITION = 'conversation.stage.transition',
  CONVERSATION_AUDIO_CHUNK = 'conversation.audio.chunk',
  CONVERSATION_VISUAL_STATE = 'conversation.visual_state',
  CONVERSATION_HANGUP_REQUESTED = 'conversation.hangup_requested',
  CONVERSATION_TOOL_EXECUTED = 'conversation.tool_executed',
  CONVERSATION_COACHING_TIP = 'conversation.coaching_tip',

  PING = 'ping',
  PONG = 'pong',
}

export interface WsEnvelope<T = any> {
  type: WsMessageType
  requestId: string
  sessionId: string
  iterationId?: string
  turnId?: string
  payload: T
  timestamp?: string
}

export interface ConversationStartPayload {
  text: string
  startAsAssistant?: boolean
  personaId?: string
  messages?: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  config?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
  ttsConfig?: {
    provider?: string
    voice?: string
    language?: string
    model?: string
    accent?: string
  }
}

export interface ConversationTextPayload {
  text: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costUsd?: number
  }
}

export interface ConversationStreamDeltaPayload {
  delta: string
  isFirstChunk?: boolean
}

export interface ConversationStreamCompletedPayload {
  fullText: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costUsd?: number
  }
  stageInfo?: {
    currentStage: string
    stageIndex: number
    stageTransition: boolean
    confidence: number
  }
  progress?: number
  totalSentences?: number
}

export interface ConversationAudioChunkPayload {
  sentenceIndex: number
  audio: ArrayBuffer | Uint8Array
  contentType: string
  sentenceText?: string
}

export interface ConversationAudioReadyPayload {
  audioBase64: string
  contentType: string
  text?: string
}

export interface CharacterAlignmentPayload {
  characters?: string[]
  characterStartTimesSeconds?: number[]
  characterEndTimesSeconds?: number[]
  character_start_times_seconds?: number[]
  character_end_times_seconds?: number[]
}

export interface ConversationErrorPayload {
  error: string
  code?: string
  stage?: 'llm' | 'tts'
}

export interface ConversationHangupRequestedPayload {
  reason: string
}

export interface ConversationToolExecutedPayload {
  tool: string
  args: Record<string, unknown>
  effect?: Record<string, unknown>
}

export interface ConversationCoachingTipPayload {
  tip: string
  stage: string
  stageIndex: number
}
