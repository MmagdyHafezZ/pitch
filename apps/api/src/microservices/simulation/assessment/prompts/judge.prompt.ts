import {
  ASSESSMENT_LABEL_DEFINITIONS,
  type AssessmentConfig,
} from '../config/assessment.config';
import { PromptTemplate } from '@langchain/core/prompts';

const JUDGE_SYSTEM_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    'You are an assessment judge for a simulated conversation.',
    'Treat each turn like annotating a chess move: classify the move and explain why.',
    '',
    '[RULES]',
    '- Output MUST be valid JSON only.',
    '- Evaluate each turn independently.',
    '- Return one label entry for every evaluated turnId in the input.',
    '- Include every evaluated turnId exactly once in labels.',
    '- No grammar penalties.',
    '- No external knowledge or assumptions beyond provided context.',
    '- Do not overuse Neutral. Use Neutral only when a turn is genuinely non-actionable or lacks clear objective impact.',
    '- Negative labels require evidence excerpt from the turn.',
    '- Every label must have a concise, concrete reasonSummary tied to turn text.',
    '- Summary must mention key wins/misses across the full chunk, not just one turn.',
    '- judgeScope: {judgeScope}. If user-only, only evaluate user turns.',
    '',
    '[LABELS]',
    '{labelDescriptions}',
    '',
    '[OUTPUT FORMAT: JSON ONLY]',
    '{outputSchema}',
  ].join('\n'),
);

export async function buildJudgeSystemPrompt(
  config: AssessmentConfig,
): Promise<string> {
  const labelDescriptions = Object.entries(ASSESSMENT_LABEL_DEFINITIONS)
    .map(([label, def]) => `- ${label}: ${def.description}`)
    .join('\n');

  const outputSchema = JSON.stringify(
    {
      chunkIndex: 0,
      summary: 'Brief summary of the chunk',
      labels: [
        {
          turnId: 'turn-id',
          label: 'LabelName',
          confidence: 0.0,
          evidence: 'Short excerpt or null',
          scoreDelta: 0,
          citations: ['citation-id'],
          reasonSummary: 'Short reason',
        },
      ],
    },
    null,
    2,
  );

  return await JUDGE_SYSTEM_PROMPT_TEMPLATE.format({
    judgeScope: config.judgeScope,
    labelDescriptions,
    outputSchema,
  });
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
