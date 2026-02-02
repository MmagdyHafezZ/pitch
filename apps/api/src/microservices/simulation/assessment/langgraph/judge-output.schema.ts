import { z } from 'zod';
import { AssessmentLabelValue } from '@prisma/simulation-client';

const labelEnum = z.nativeEnum(AssessmentLabelValue);

export const JudgeLabelSchema = z.object({
  turnId: z.string(),
  label: labelEnum,
  confidence: z.number().min(0).max(1),
  evidence: z.string().optional().nullable(),
  scoreDelta: z.number(),
  citations: z.array(z.string()).optional().default([]),
  reasonSummary: z.string().optional().default(''),
});

export const JudgeOutputSchema = z.object({
  chunkIndex: z.number(),
  summary: z.string().optional().default(''),
  labels: z.array(JudgeLabelSchema),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;
export type JudgeLabelOutput = z.infer<typeof JudgeLabelSchema>;
