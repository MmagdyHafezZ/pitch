import { z } from 'zod';
import { AssessmentLabelValue } from '@prisma/simulation-client';

const normalizeEnumToken = (value: string): string =>
  value.replace(/[^a-z]/gi, '').toLowerCase();

const labelSynonyms: Record<string, AssessmentLabelValue> = {
  positiveexample: AssessmentLabelValue.PositiveExample,
  positive: AssessmentLabelValue.PositiveExample,
  negativeexample: AssessmentLabelValue.NegativeExample,
  negative: AssessmentLabelValue.NegativeExample,
  neutral: AssessmentLabelValue.Neutral,
  objectivemet: AssessmentLabelValue.ObjectiveMet,
  metobjective: AssessmentLabelValue.ObjectiveMet,
  objectivenotmet: AssessmentLabelValue.ObjectiveNotMet,
  unmetobjective: AssessmentLabelValue.ObjectiveNotMet,
  insightfulquestion: AssessmentLabelValue.InsightfulQuestion,
  question: AssessmentLabelValue.InsightfulQuestion,
  missedopportunity: AssessmentLabelValue.MissedOpportunity,
};

const coerceLabel = (value: unknown): AssessmentLabelValue | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return labelSynonyms[normalizeEnumToken(value)];
};

const coerceConfidence = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1 && value <= 100) {
      return Math.min(1, Math.max(0, value / 100));
    }
    return Math.min(1, Math.max(0, value));
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.endsWith('%')) {
    const rawPercent = Number(trimmed.slice(0, -1));
    if (!Number.isFinite(rawPercent)) {
      return undefined;
    }
    return Math.min(1, Math.max(0, rawPercent / 100));
  }

  const raw = Number(trimmed);
  if (!Number.isFinite(raw)) {
    return undefined;
  }

  if (raw > 1 && raw <= 100) {
    return Math.min(1, Math.max(0, raw / 100));
  }

  return Math.min(1, Math.max(0, raw));
};

const labelEnum = z.preprocess(
  (value) => coerceLabel(value),
  z.nativeEnum(AssessmentLabelValue),
);

export const JudgeLabelSchema = z.object({
  turnId: z.coerce.string(),
  label: labelEnum,
  confidence: z
    .preprocess((value) => coerceConfidence(value), z.number().min(0).max(1))
    .optional()
    .default(0.5),
  evidence: z
    .preprocess(
      (value) => (value == null ? null : String(value)),
      z.string().nullable(),
    )
    .optional(),
  scoreDelta: z.coerce.number().optional(),
  citations: z
    .preprocess((value) => {
      if (!value) {
        return [];
      }
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
      if (typeof value === 'string') {
        return value
          .split(/[,\n]/)
          .map((token) => token.trim())
          .filter(Boolean);
      }
      return [];
    }, z.array(z.string()))
    .optional()
    .default([]),
  reasonSummary: z.string().optional().default(''),
});

export const JudgeOutputSchema = z.object({
  chunkIndex: z.coerce.number().optional().default(0),
  summary: z.string().optional().default(''),
  labels: z.array(JudgeLabelSchema).optional().default([]),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;
export type JudgeLabelOutput = z.infer<typeof JudgeLabelSchema>;
