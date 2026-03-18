import {
  ASSESSMENT_LABEL_DEFINITIONS,
  type AssessmentConfig,
} from '../config/assessment.config';

export function buildJudgeSystemPrompt(
  config: AssessmentConfig,
  sessionContext?: string,
): string {
  const labelDescriptions = Object.entries(ASSESSMENT_LABEL_DEFINITIONS)
    .map(([label, def]) => `- ${label}: ${def.description}`)
    .join('\n');

  const outputSchema = JSON.stringify(
    {
      chunkIndex: 0,
      summary: 'Brief summary of key wins and misses across the chunk',
      labels: [
        {
          turnId: 'turn-id',
          label: 'LabelName',
          confidence: 0.85,
          evidence: 'Short excerpt from the turn or null',
          scoreDelta: 2,
          citations: ['citation-id'],
          reasonSummary: 'Concrete reason tied to the turn text',
        },
      ],
    },
    null,
    2,
  );

  const sessionCtx =
    sessionContext?.trim() ||
    'No session objective provided — evaluate general sales quality.';

  return [
    'You are an assessment judge for a sales training simulation.',
    'Treat each turn like annotating a chess move: classify the move and explain why.',
    '',
    '[SESSION CONTEXT]',
    sessionCtx,
    '',
    '[RULES]',
    '- Output MUST be valid JSON only — no text before or after the JSON.',
    '- Evaluate each turn independently against the session objective above.',
    '- Return one label entry for every evaluated turnId in the input.',
    '- Include every evaluated turnId exactly once in labels.',
    '- No grammar or language penalties — judge substance and objective impact only.',
    '- Ground your reasoning in the turn text; use domain knowledge to assess quality.',
    '- Do NOT overuse Neutral. Reserve Neutral for turns that are genuinely off-topic or have zero objective impact. If a turn has any positive or negative substance, classify it accordingly.',
    '- Negative labels require an evidence excerpt from the turn text.',
    '- Set confidence >= 0.7 when the label is clearly supported by the turn text.',
    '- Set confidence 0.4-0.69 for plausible but arguable assessments.',
    '- Use confidence < 0.4 only when the turn is ambiguous with no clear signal.',
    '- Every label must have a concise, concrete reasonSummary tied to turn text.',
    '- The summary must mention key wins/misses across the full chunk, not just one turn.',
    `- judgeScope: ${config.judgeScope}. If user-only, only evaluate user turns.`,
    '',
    '[LABELS]',
    labelDescriptions,
    '',
    '[OUTPUT FORMAT: JSON ONLY]',
    outputSchema,
  ].join('\n');
}

export function buildJudgeUserPrompt(input: {
  chunkIndex: number;
  turns: Array<{
    turnId: string;
    role: string;
    text: string;
    createdAt?: string;
  }>;
  retrievedContext?: Array<{ id: string; source: string; content: string }>;
}): string {
  const payload = {
    chunkIndex: input.chunkIndex,
    turns: input.turns,
    retrievedContext: input.retrievedContext ?? [],
  };

  return JSON.stringify(payload, null, 2);
}
