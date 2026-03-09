import {
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LLMMessageDto, LLMConfigDto } from './llm.dto';

/**
 * WebSocket Message Types
 */
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

  // New streaming text messages
  CONVERSATION_TEXT_STREAM = 'conversation.text.stream',
  CONVERSATION_TEXT_PARTIAL = 'conversation.text.partial',
  CONVERSATION_TEXT_SENTENCE = 'conversation.text.sentence',
  CONVERSATION_LLM_START = 'conversation.llm.start',
  CONVERSATION_LLM_DELTA = 'conversation.llm.delta',
  CONVERSATION_LLM_SENTENCE = 'conversation.llm.sentence',
  CONVERSATION_TTS_START = 'conversation.tts.start',
  CONVERSATION_AUDIO_CHUNK = 'conversation.audio.chunk',
  CONVERSATION_COMPLETE = 'conversation.complete',

  CONVERSATION_VISUAL_STATE = 'conversation.visual_state',
  CONVERSATION_HANGUP_REQUESTED = 'conversation.hangup_requested',
  CONVERSATION_TOOL_EXECUTED = 'conversation.tool_executed',

  PING = 'ping',
  PONG = 'pong',
}

/**
 * Base WebSocket Envelope
 * Generic envelope for all WebSocket messages
 */
export class WsEnvelope<T = any> {
  @IsEnum(WsMessageType)
  type: WsMessageType;

  @IsString()
  requestId: string;

  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  iterationId?: string;

  @IsString()
  @IsOptional()
  sessionMemberId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  turnId?: string;

  payload: T;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

/**
 * Chat Start Payload
 * Initiates a new chat turn
 */
export class ChatStartPayload {
  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  turnId?: string;

  @ValidateNested({ each: true })
  @Type(() => LLMMessageDto)
  messages: LLMMessageDto[];

  @ValidateNested()
  @Type(() => LLMConfigDto)
  config: LLMConfigDto;
}

/**
 * Chat Delta Payload
 * Streaming chunk from LLM
 */
export class ChatDeltaPayload {
  @IsString()
  @IsOptional()
  delta?: string;

  @IsObject()
  @IsOptional()
  toolCall?: {
    id: string;
    name: string;
    argumentsDelta: string;
  };
}

/**
 * Chat Completed Payload
 * Final response from LLM
 */
export class ChatCompletedPayload {
  @IsString()
  @IsOptional()
  content?: string;

  @IsObject()
  @IsOptional()
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
  };

  @IsObject()
  @IsOptional()
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;

  @IsString()
  @IsOptional()
  finishReason?: string;
}

/**
 * Chat Error Payload
 */
export class ChatErrorPayload {
  @IsString()
  error: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, any>;
}

/**
 * Chat Cancel Payload
 * Request to cancel an in-progress chat
 */
export class ChatCancelPayload {
  @IsString()
  requestId: string;
}

/**
 * STT Start Payload
 * Initiates speech-to-text processing
 */
export class STTStartPayload {
  @IsString()
  callId: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsObject()
  @IsOptional()
  config?: {
    provider?: string;
    model?: string;
    enableDiarization?: boolean;
    enablePunctuation?: boolean;
  };
}

/**
 * STT Partial Payload
 * Intermediate transcription result
 */
export class STTPartialPayload {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  confidence?: number;

  @IsString()
  @IsOptional()
  speaker?: string;
}

/**
 * STT Final Payload
 * Final transcription result
 */
export class STTFinalPayload {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  confidence?: number;

  @IsString()
  @IsOptional()
  language?: string;

  @IsObject()
  @IsOptional()
  words?: Array<{
    word: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
}

/**
 * STT Error Payload
 */
export class STTErrorPayload {
  @IsString()
  error: string;

  @IsString()
  @IsOptional()
  code?: string;
}

/**
 * TTS Request Payload
 * Request text-to-speech synthesis
 */
export class TTSRequestPayload {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  voice?: string;

  @IsObject()
  @IsOptional()
  config?: {
    provider?: string;
    model?: string;
    speed?: number;
    pitch?: number;
    format?: string;
  };
}

/**
 * TTS Ready Payload
 * Audio is ready for playback
 */
export class TTSReadyPayload {
  @IsString()
  audioUrl: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsString()
  @IsOptional()
  durationMs?: number;
}

/**
 * TTS Error Payload
 */
export class TTSErrorPayload {
  @IsString()
  error: string;

  @IsString()
  @IsOptional()
  code?: string;
}

/**
 * Conversation Start Payload
 * Initiates a voice conversation with text input (STT -> LLM -> TTS)
 */
export class ConversationStartPayload {
  @IsString()
  text: string;

  @IsOptional()
  startAsAssistant?: boolean;

  @IsString()
  @IsOptional()
  personaId?: string;

  @ValidateNested({ each: true })
  @Type(() => LLMMessageDto)
  @IsOptional()
  messages?: LLMMessageDto[];

  @ValidateNested()
  @Type(() => LLMConfigDto)
  @IsOptional()
  config?: LLMConfigDto;

  @IsObject()
  @IsOptional()
  ttsConfig?: {
    provider?: string;
    voice?: string;
    model?: string;
  };

  /**
   * Serialised visual context injected by the gateway from the latest
   * CONVERSATION_VISUAL_STATE update received from this session.
   * Human-readable one-liner — injected directly into the system prompt.
   */
  @IsString()
  @IsOptional()
  visualContext?: string;
}

/**
 * Visual State Payload
 * Semantic summary of what the camera sees — computed on the client
 * (MediaPipe Pose Landmarker) and sent at ~2–5 Hz via CONVERSATION_VISUAL_STATE.
 */
export class VisualStatePayload {
  /** Whether a person is detected with sufficient landmark confidence */
  present: boolean;

  /** Upper-body posture from shoulder/hip or Z-depth analysis */
  posture: 'leaning_in' | 'upright' | 'leaning_back' | 'unknown';

  /** Head gaze direction from ear visibility asymmetry */
  gaze: 'camera' | 'left' | 'right' | 'down' | 'unknown';

  /** Body movement level from rolling nose-delta average */
  movement: 'low' | 'medium' | 'high';

  /** What kind of movement is occurring (head only, gesturing, body shift, restless) */
  movementType: 'still' | 'head_only' | 'gesturing' | 'body_shift' | 'restless';

  /** Head gesture detected in the last ~1 second (nod = agreement, shake = objection) */
  headMotion: 'nodding' | 'shaking' | 'still';

  /**
   * Camera-attention percentage over the last ~10 seconds (0–100).
   * -1 = insufficient history (session just started).
   */
  attention: number;

  /**
   * Emotion inferred from MediaPipe Face Landmarker blendshapes.
   * 'unknown' when face is not detected.
   */
  emotion:
    | 'happy'
    | 'sad'
    | 'angry'
    | 'frustrated'
    | 'surprised'
    | 'neutral'
    | 'unknown';
}

/**
 * Conversation Text Payload
 * Text response from LLM (before TTS)
 */
export class ConversationTextPayload {
  @IsString()
  text: string;

  @IsObject()
  @IsOptional()
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
  };
}

/**
 * Conversation Audio Ready Payload
 * Audio response is ready for playback
 */
export class ConversationAudioReadyPayload {
  @IsString()
  audioBase64: string;

  @IsString()
  contentType: string;

  @IsString()
  @IsOptional()
  text?: string;
}

/**
 * Conversation Error Payload
 */
export class ConversationErrorPayload {
  @IsString()
  error: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  stage?: 'llm' | 'tts' | 'gateway';
}

/**
 * Conversation Stream Delta Payload
 * Streaming text chunk from LLM during conversation
 */
export class ConversationStreamDeltaPayload {
  @IsString()
  delta: string;

  @IsOptional()
  isFirstChunk?: boolean;
}

/**
 * Conversation Stream Completed Payload
 * Streaming text completed, about to start TTS
 */
export class ConversationStreamCompletedPayload {
  @IsString()
  fullText: string;

  @IsObject()
  @IsOptional()
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
  };

  @IsObject()
  @IsOptional()
  stageInfo?: {
    currentStage: string;
    stageIndex: number;
    stageTransition: boolean;
    confidence: number;
  };

  @IsOptional()
  progress?: number;

  @IsOptional()
  totalSentences?: number;
}

/**
 * Conversation Stage Transition Payload
 * Emitted when conversation moves to a new stage
 */
export class ConversationStageTransitionPayload {
  @IsString()
  previousStage: string;

  @IsString()
  currentStage: string;

  @IsOptional()
  previousStageIndex?: number;

  @IsOptional()
  currentStageIndex: number;

  @IsOptional()
  confidence?: number;

  @IsString()
  @IsOptional()
  reasoning?: string;
}

/**
 * Conversation Text Stream Payload
 * Streaming text input from Web Speech API
 */
export class ConversationTextStreamPayload {
  @IsString()
  text: string;

  @IsOptional()
  isFinal: boolean;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation Text Partial Payload
 * Partial (interim) transcription from user
 */
export class ConversationTextPartialPayload {
  @IsString()
  text: string;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation Text Sentence Payload
 * Complete sentence detected from user input
 */
export class ConversationTextSentencePayload {
  @IsString()
  sentence: string;

  @IsOptional()
  confidence?: number;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation LLM Start Payload
 * LLM generation started
 */
export class ConversationLLMStartPayload {
  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation LLM Delta Payload
 * Streaming text chunk from LLM
 */
export class ConversationLLMDeltaPayload {
  @IsString()
  delta: string;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation LLM Sentence Payload
 * Complete sentence from LLM (queued for TTS)
 */
export class ConversationLLMSentencePayload {
  @IsString()
  sentence: string;

  @IsOptional()
  sentenceIndex: number;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation TTS Start Payload
 * TTS synthesis started for a sentence
 */
export class ConversationTTSStartPayload {
  @IsOptional()
  sentenceIndex: number;

  @IsString()
  text: string;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation Audio Chunk Payload
 * Audio chunk ready for a synthesized sentence
 */
export class ConversationAudioChunkPayload {
  @IsOptional()
  sentenceIndex: number;

  @IsString()
  audioBase64: string;

  @IsString()
  contentType: string;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation Complete Payload
 * All streaming complete
 */
export class ConversationCompletePayload {
  @IsString()
  fullText: string;

  @IsOptional()
  totalSentences: number;

  @IsOptional()
  timestamp?: number;
}

/**
 * Conversation Hangup Requested Payload
 * Emitted when the AI persona signals it wants to end the conversation
 */
export class ConversationHangupRequestedPayload {
  @IsString()
  reason: string;
}

/**
 * Conversation Tool Executed Payload
 * Emitted when the AI persona executes a conversation tool (except end_call)
 */
export class ConversationToolExecutedPayload {
  @IsString()
  tool: string;

  @IsObject()
  args: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  effect?: Record<string, unknown>;
}

/**
 * Type-safe WebSocket Envelope factory
 */
export class WsEnvelopeFactory {
  static create<T>(
    type: WsMessageType,
    requestId: string,
    sessionId: string,
    payload: T,
    turnId?: string,
  ): WsEnvelope<T> {
    return {
      type,
      requestId,
      sessionId,
      turnId,
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  static chatStart(
    requestId: string,
    sessionId: string,
    payload: ChatStartPayload,
    turnId?: string,
  ): WsEnvelope<ChatStartPayload> {
    return this.create(
      WsMessageType.CHAT_START,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }

  static chatDelta(
    requestId: string,
    sessionId: string,
    payload: ChatDeltaPayload,
    turnId?: string,
  ): WsEnvelope<ChatDeltaPayload> {
    return this.create(
      WsMessageType.CHAT_DELTA,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }

  static chatCompleted(
    requestId: string,
    sessionId: string,
    payload: ChatCompletedPayload,
    turnId?: string,
  ): WsEnvelope<ChatCompletedPayload> {
    return this.create(
      WsMessageType.CHAT_COMPLETED,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }

  static chatError(
    requestId: string,
    sessionId: string,
    payload: ChatErrorPayload,
    turnId?: string,
  ): WsEnvelope<ChatErrorPayload> {
    return this.create(
      WsMessageType.CHAT_ERROR,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }

  static sttPartial(
    requestId: string,
    sessionId: string,
    payload: STTPartialPayload,
  ): WsEnvelope<STTPartialPayload> {
    return this.create(
      WsMessageType.STT_PARTIAL,
      requestId,
      sessionId,
      payload,
    );
  }

  static sttFinal(
    requestId: string,
    sessionId: string,
    payload: STTFinalPayload,
  ): WsEnvelope<STTFinalPayload> {
    return this.create(WsMessageType.STT_FINAL, requestId, sessionId, payload);
  }

  static ttsReady(
    requestId: string,
    sessionId: string,
    payload: TTSReadyPayload,
  ): WsEnvelope<TTSReadyPayload> {
    return this.create(WsMessageType.TTS_READY, requestId, sessionId, payload);
  }

  static conversationText(
    requestId: string,
    sessionId: string,
    payload: ConversationTextPayload,
    turnId?: string,
  ): WsEnvelope<ConversationTextPayload> {
    return this.create(
      WsMessageType.CONVERSATION_TEXT,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }

  static conversationAudioReady(
    requestId: string,
    sessionId: string,
    payload: ConversationAudioReadyPayload,
    turnId?: string,
  ): WsEnvelope<ConversationAudioReadyPayload> {
    return this.create(
      WsMessageType.CONVERSATION_AUDIO_READY,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }

  static conversationError(
    requestId: string,
    sessionId: string,
    payload: ConversationErrorPayload,
    turnId?: string,
  ): WsEnvelope<ConversationErrorPayload> {
    return this.create(
      WsMessageType.CONVERSATION_ERROR,
      requestId,
      sessionId,
      payload,
      turnId,
    );
  }
}
