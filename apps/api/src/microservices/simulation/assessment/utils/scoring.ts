import { AssessmentLabelValue } from '@prisma/simulation-client';
import type { AssessmentConfig } from '../config/assessment.config';

export interface ScoredLabelInput {
  label: AssessmentLabelValue;
  scoreDelta?: number | null;
}

export interface ScoreResult {
  totalScore: number;
  scoreBreakdown: Record<string, number>;
}

export function computeScore(
  labels: ScoredLabelInput[],
  config: AssessmentConfig,
): ScoreResult {
  const scoreBreakdown: Record<string, number> = {};
  let totalScore = 0;

  labels.forEach((label) => {
    const delta = label.scoreDelta ?? config.labelScoreDelta[label.label] ?? 0;
    totalScore += delta;
    scoreBreakdown[label.label] = (scoreBreakdown[label.label] ?? 0) + 1;
  });

  return { totalScore, scoreBreakdown };
}
