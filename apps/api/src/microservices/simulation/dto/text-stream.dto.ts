/**
 * DTOs for text streaming from Web Speech API
 */

export interface TextStreamChunk {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface TextStreamPayload {
  text: string;
  isFinal: boolean;
  timestamp?: number;
}

export enum StreamEventType {
  TEXT_PARTIAL = 'text_partial',
  TEXT_SENTENCE = 'text_sentence',
  LLM_START = 'llm_start',
  LLM_DELTA = 'llm_delta',
  LLM_SENTENCE = 'llm_sentence',
  TTS_START = 'tts_start',
  AUDIO_CHUNK = 'audio_chunk',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export type StreamEvent =
  | {
      type: StreamEventType.TEXT_PARTIAL;
      data: {
        text: string;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.TEXT_SENTENCE;
      data: {
        sentence: string;
        confidence: number;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.LLM_START;
      data: {
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.LLM_DELTA;
      data: {
        delta: string;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.LLM_SENTENCE;
      data: {
        sentence: string;
        sentenceIndex: number;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.TTS_START;
      data: {
        sentenceIndex: number;
        text: string;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.AUDIO_CHUNK;
      data: {
        sentenceIndex: number;
        audioBase64: string;
        contentType: string;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.COMPLETE;
      data: {
        fullText: string;
        totalSentences: number;
        timestamp: number;
      };
    }
  | {
      type: StreamEventType.ERROR;
      data: {
        error: string;
        stage: 'text' | 'llm' | 'tts';
        timestamp: number;
      };
    };
