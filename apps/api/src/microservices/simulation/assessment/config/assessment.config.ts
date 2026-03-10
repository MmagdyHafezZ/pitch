import { AssessmentLabelValue } from '@prisma/simulation-client';

export type AssessmentJudgeScope = 'user-only' | 'all-roles';

export interface AssessmentConfig {
  version: string;
  labelScoreDelta: Record<AssessmentLabelValue, number>;
  conflictRules: {
    mutuallyExclusive: AssessmentLabelValue[][];
  };
  thresholds: {
    confidenceCutoff: number;
    hardNeutralCutoff: number;
    disagreementCutoff: number;
    negativeDeltaTrigger: number;
  };
  judgeScope: AssessmentJudgeScope;
  chunk: {
    size: number;
  };
  limits: {
    maxParallelChunks: number;
    maxParallelRuns: number;
  };
  timeBudgetMs: {
    retrieval: number;
    judge: number;
    reduce: number;
    persist: number;
  };
  rag: {
    enabled: boolean;
    namespace?: string;
    snapshotId?: string;
  };
  judge: {
    provider?: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  live: {
    maxTurns: number;
  };
}

export const ASSESSMENT_ENGINE_VERSION = 'langgraph-v1.1';

export const ASSESSMENT_LABEL_DEFINITIONS: Record<
  AssessmentLabelValue,
  { description: string; severity: 'positive' | 'negative' | 'neutral' }
> = {
  PositiveExample: {
    description: 'A strong, effective response that aligns with objectives.',
    severity: 'positive',
  },
  NegativeExample: {
    description: 'A response that harms the objective or violates guidelines.',
    severity: 'negative',
  },
  Neutral: {
    description: 'Neither positive nor negative; unclear or ambiguous.',
    severity: 'neutral',
  },
  ObjectiveMet: {
    description: 'Explicitly meets the scenario objective.',
    severity: 'positive',
  },
  ObjectiveNotMet: {
    description: 'Fails to meet the scenario objective.',
    severity: 'negative',
  },
  InsightfulQuestion: {
    description: 'Asks a helpful, clarifying question that advances the goal.',
    severity: 'positive',
  },
  MissedOpportunity: {
    description: 'Misses an obvious chance to advance the objective.',
    severity: 'negative',
  },
};

const baseConfig: Omit<AssessmentConfig, 'version'> = {
  labelScoreDelta: {
    PositiveExample: 2,
    NegativeExample: -2,
    Neutral: 0,
    ObjectiveMet: 4,
    ObjectiveNotMet: -4,
    InsightfulQuestion: 1,
    MissedOpportunity: -1,
  },
  conflictRules: {
    mutuallyExclusive: [
      ['ObjectiveMet', 'ObjectiveNotMet'],
      ['PositiveExample', 'NegativeExample'],
    ],
  },
  thresholds: {
    confidenceCutoff: 0.6,
    // Labels below this are force-overridden to Neutral (garbage output guard).
    // Keep well below confidenceCutoff so only truly zero-confidence outputs are neutered.
    hardNeutralCutoff: 0.1,
    disagreementCutoff: 0.35,
    negativeDeltaTrigger: -2,
  },
  judgeScope: 'user-only',
  chunk: {
    size: 12,
  },
  limits: {
    maxParallelChunks: 5,
    maxParallelRuns: 2,
  },
  timeBudgetMs: {
    retrieval: 3500,
    // 30 s: gpt-4o generating JSON for a full 12-turn chunk can easily exceed 12 s
    // under normal API load; 30 s gives ample headroom without blocking the pipeline.
    judge: 30000,
    reduce: 4000,
    persist: 5000,
  },
  rag: {
    enabled: true,
    namespace: 'simulation',
  },
  judge: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.2,
    // 12 turns × ~200 tokens/label ≈ 2400 tokens minimum; 3500 gives safe headroom
    // and leaves room for a richer summary field.
    maxTokens: 3500,
  },
  live: {
    maxTurns: 2,
  },
};

export const ASSESSMENT_CONFIGS: Record<string, AssessmentConfig> = {
  v1: {
    version: 'v1',
    ...baseConfig,
  },
};

export const DEFAULT_ASSESSMENT_CONFIG_VERSION = 'v1';

export function getAssessmentConfig(version?: string): AssessmentConfig {
  if (version && ASSESSMENT_CONFIGS[version]) {
    return ASSESSMENT_CONFIGS[version];
  }

  return ASSESSMENT_CONFIGS[DEFAULT_ASSESSMENT_CONFIG_VERSION];
}
