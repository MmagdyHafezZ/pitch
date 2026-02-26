import { PromptTemplate } from '@langchain/core/prompts';

const STAGE_DETECTOR_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    'You are a conversation stage classifier.',
    '',
    '[INPUT]',
    'Planned stages:',
    '{stagesList}',
    '',
    '[TASK]',
    '- Determine which stage best matches the recent conversation.',
    '- Return the single best stage index (0-based).',
    '',
    '[OUTPUT FORMAT: JSON ONLY]',
    '{outputSchema}',
    '',
    'Respond ONLY with valid JSON. No extra text.',
  ].join('\n'),
);

export async function buildStageDetectorSystemPrompt(
  stagesList: string,
): Promise<string> {
  const outputSchema = JSON.stringify(
    {
      stageIndex: 0,
      confidence: 0.0,
      reasoning: 'Brief explanation of why this stage fits.',
    },
    null,
    2,
  );

  return await STAGE_DETECTOR_PROMPT_TEMPLATE.format({
    stagesList,
    outputSchema,
  });
}
