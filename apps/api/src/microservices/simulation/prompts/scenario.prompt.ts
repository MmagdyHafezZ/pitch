import { PromptTemplate } from '@langchain/core/prompts';
import { resolveLanguageLabel } from '../utils/language';

const SCENARIO_SYSTEM_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    'You are a senior scenario designer for a sales simulation platform.',
    '',
    '[TASK]',
    '- Generate a realistic, practical scenario a learner can immediately practice.',
    '- Ground the scenario in the provided topic, objective, roles, persona cues, CRM context, duration, and workspace context.',
    '- Avoid generic filler. Use concrete company context, meeting situation, stakes, constraints, and likely objections.',
    '- Make the situation feel commercially believable and useful for coaching.',
    '',
    '[OUTPUT FORMAT: JSON ONLY]',
    '{outputSchema}',
    '',
    '[RULES]',
    '- Return only valid JSON. No prose or commentary.',
    '- config must be a JSON object.',
    '- Keep fields concise but specific and operationally useful.',
    '- roles.user is the human learner; roles.assistant is the AI counterparty.',
    '- description should be neutral and third-person; avoid second-person "you".',
    '- successCriteria, constraints, stakes, and stages must be actionable, not generic.',
    '- stages should describe how the conversation should realistically progress.',
    '- If some grounding input is missing, infer the most plausible business context instead of leaving the scenario vague.',
    '- {languageDirective}',
  ].join('\n'),
);

export async function buildScenarioSystemPrompt(
  requestedLanguage?: string,
): Promise<string> {
  const outputSchema = JSON.stringify(
    {
      name: 'Specific scenario title',
      description:
        'One short paragraph describing the realistic business situation',
      config: {
        objective: 'Primary learner objective',
        background:
          'Relevant company, relationship, meeting, and commercial context',
        roles: {
          user: 'Human learner role',
          assistant: 'AI counterpart role',
        },
        successCriteria: [
          'Concrete outcomes that indicate a strong performance',
        ],
        constraints: ['Realistic limitations, blockers, or non-negotiables'],
        stakes: [
          'What the learner risks losing or gaining in this interaction',
        ],
        stages: [
          {
            label: 'Opening',
            description: 'How the stage should unfold',
            duration: 5,
          },
        ],
        difficulty: 'easy|medium|hard',
        durationMinutes: 20,
        tags: ['tag1', 'tag2'],
        language: 'en-US',
        grounding: {
          meetingType:
            'Discovery call / renewal / escalation / executive review',
          companyContext:
            'Short concrete summary of the account or internal context',
          likelyObjections: ['Most likely objections or friction points'],
        },
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
