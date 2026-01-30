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
  };
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
  stage?: 'llm' | 'tts';
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
