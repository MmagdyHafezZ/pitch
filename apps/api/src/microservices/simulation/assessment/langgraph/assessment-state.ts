import { Annotation } from '@langchain/langgraph';
import {
  AssessmentMode,
  AssessmentLabelValue,
  TurnRole,
} from '@prisma/simulation-client';
import type { AssessmentConfig } from '../config/assessment.config';

export interface NormalizedTurn {
  turnId: string;
  role: string;
  text: string;
  createdAt?: string;
  iterationId?: string;
  iterationNumber?: number;
  isEvaluated: boolean;
}

export interface RawTurn {
  id: string;
  iterationId?: string | null;
  role?: TurnRole | null;
  text?: string | null;
  createdAt?: Date | null;
  iteration?: {
    iterationNumber?: number | null;
  } | null;
  messages?: Array<{
    content?: string | null;
  }> | null;
}

export interface AssessmentChunk {
  chunkIndex: number;
  turns: NormalizedTurn[];
  turnIds: string[];
}

export interface RetrievalItem {
  id: string;
  source: string;
  content: string;
}

export interface ChunkJudgment {
  chunkIndex: number;
  summary?: string;
  labels: Array<{
    turnId: string;
    label: AssessmentLabelValue;
    confidence?: number;
    evidence?: string | null;
    scoreDelta?: number;
    citations?: string[];
    reasonSummary?: string;
    isFinal?: boolean;
  }>;
  retrievalContext?: RetrievalItem[];
}

export interface AssessmentSummaryResult {
  totalScore: number;
  scoreBreakdown?: Record<string, number>;
  narrativeSummary?: string;
  coachTips?: Array<{ text: string; link?: string }>;
}

export interface AssessmentReportPayload {
  totalScore: number;
  scoreBreakdown?: Record<string, number>;
  summary?: {
    narrativeSummary?: string;
    coachTips?: Array<{ text: string; link?: string }>;
    objectiveMet?: boolean;
  };
  turnAnnotations: Array<{
    turnId: string;
    role?: string;
    text?: string;
    label: string;
    confidence?: number;
    evidence?: string | null;
    scoreDelta?: number;
    citations?: string[];
    reasonSummary?: string;
    isFinal?: boolean;
  }>;
  conversationHistory?: Array<{
    turnId: string;
    role?: string;
    text?: string;
    createdAt?: string;
    iterationId?: string;
    iterationNumber?: number;
    isEvaluated?: boolean;
  }>;
  chunks?: Array<{
    chunkIndex: number;
    turnIds: string[];
    summary?: string;
    retrievalContext?: RetrievalItem[];
  }>;
  rag?: {
    namespace?: string;
    snapshotId?: string;
    items?: RetrievalItem[];
  };
}

export interface NodeTiming {
  node: string;
  ms: number;
}

export const AssessmentState = Annotation.Root({
  runId: Annotation<string>(),
  mode: Annotation<AssessmentMode>(),
  config: Annotation<AssessmentConfig>(),
  configVersion: Annotation<string>(),
  engineVersion: Annotation<string>(),
  iterationId: Annotation<string>(),
  sessionId: Annotation<string>(),
  sessionMemberId: Annotation<string>(),
  userId: Annotation<string | null>(),
  turnsRaw: Annotation<RawTurn[]>(),
  turns: Annotation<NormalizedTurn[]>(),
  chunks: Annotation<AssessmentChunk[]>(),
  retrievalByChunk:
    Annotation<Array<{ chunkIndex: number; items: RetrievalItem[] }>>(),
  judgments: Annotation<ChunkJudgment[]>(),
  labels: Annotation<ChunkJudgment['labels']>(),
  summary: Annotation<AssessmentSummaryResult | null>(),
  report: Annotation<AssessmentReportPayload | null>(),
  warnings: Annotation<string[]>(),
  partial: Annotation<boolean>(),
  nodeTimings: Annotation<NodeTiming[]>(),
});

export type AssessmentStateType = typeof AssessmentState.State;
