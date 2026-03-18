import { PromptTemplate } from '@langchain/core/prompts';
import { resolveLanguageLabel } from '../utils/language';

const SCENARIO_SYSTEM_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    'You are a senior scenario designer for a sales simulation platform.',
    '',
    '[TASK]',
    '- Generate a detailed, realistic scenario a user will be placed into.',
    '- Avoid generic language; include concrete context (company, role, setting, stakes, constraints).',
    '',
    '[OUTPUT FORMAT: JSON ONLY]',
    '{outputSchema}',
    '',
    '[RULES]',
    '- Return only valid JSON. No prose or commentary.',
    '- config must be a JSON object.',
    '- Keep fields concise but specific.',
    '- roles.user is the human learner; roles.assistant is the AI counterparty.',
    '- description should be neutral and third-person; avoid second-person "you".',
    '- {languageDirective}',
  ].join('\n'),
);

export async function buildScenarioSystemPrompt(
  requestedLanguage?: string,
): Promise<string> {
  const outputSchema = JSON.stringify(
    {
      name: 'Scenario name',
      description: 'One-paragraph scenario description',
      config: {
        objective: 'Primary objective',
        background: 'Relevant context and background',
        roles: {
          user: 'User role',
          assistant: 'Assistant role',
        },
        successCriteria: ['List of success criteria'],
        constraints: ['List of constraints'],
        difficulty: 'easy|medium|hard',
        durationMinutes: 10,
        tags: ['tag1', 'tag2'],
        language: 'en-US',
        personaHints: ['optional persona hints'],
        crmContextId: 'optional CRM context id',
      },
    },
    null,
    2,
  );

  const languageLabel = resolveLanguageLabel(requestedLanguage);

  return await SCENARIO_SYSTEM_PROMPT_TEMPLATE.format({
    outputSchema,
    languageDirective: `Write all user-facing scenario content in ${languageLabel}.`,
  });
}
