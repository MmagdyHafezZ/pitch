/**
 * Typed events emitted by ConversationOrchestrationService
 * and consumed by the WebSocket gateway.
 */
export type ConversationStreamEvent =
  | {
      type: 'delta';
      data: {
        delta: string;
        isFirstChunk?: boolean;
      };
    }
  | {
      type: 'completed';
      data: {
        fullText: string;
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
          costUsd?: number;
        };
        totalSentences: number;
        progress?: number;
      };
    }
  | {
      type: 'stage_transition';
      data: {
        previousStage: string;
        currentStage: string;
        previousStageIndex?: number;
        currentStageIndex?: number;
        confidence?: number;
        reasoning?: string;
      };
    }
  | {
      type: 'audio_sentence';
      data: {
        sentenceIndex: number;
        audio: Buffer;
        contentType: string;
        sentenceText?: string;
      };
    }
  | {
      type: 'hangup_requested';
      data: {
        reason: string;
      };
    }
  | {
      type: 'tool_executed';
      data: {
        tool: string;
        args: Record<string, unknown>;
        effect?: Record<string, unknown>;
      };
    }
  | {
      type: 'coaching_tip';
      data: {
        tip: string;
        stage: string;
        stageIndex: number;
      };
    };
