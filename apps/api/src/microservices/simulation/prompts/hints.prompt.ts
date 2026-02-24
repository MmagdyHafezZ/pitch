import { PromptTemplate } from '@langchain/core/prompts';
import { HintStrategy } from '../dto/hints.dto';

const HINT_SYSTEM_PROMPT_TEMPLATE = PromptTemplate.fromTemplate(
  [
    'You are a coaching assistant. Your job is to generate hints that help the user respond effectively in a conversation.',
    '',
    '[BOUNDARY]',
    '- You are NOT a participant in the conversation.',
    '- Do NOT answer the conversation directly.',
    '- Do NOT roleplay as the assistant, client, or user.',
    '- You only produce private coaching hints for the user.',
    '',
    '[STRATEGY]',
    '{strategyGuidance}',
    '',
    '[PRIMARY GOAL]',
    '- If the assistant most recently asked a question, provide hints that help the user ANSWER that question.',
    '- Hints must be phrased as things the user can say next (not new questions).',
    '- Use concrete details from the conversation and objectives.',
    '- If key info is missing, suggest a brief clarifying response the user could give.',
    '',
    '[HINT TYPES]',
    '- next_topic: Suggest the next logical topic to discuss.',
    '- clarification: Ask for clarification on something mentioned.',
    '- follow_up: Suggest a follow-up point or supporting detail.',
    '- transition: Help transition to a new topic.',
    '- objective: Tie back to session objectives (if provided).',
    '',
    '{latestAssistantQuestionLine}',
    '',
    '[OUTPUT FORMAT: JSON ONLY]',
    '{outputSchema}',
    '',
    '[RULES]',
    `- Generate up to {maxHints} hints.`,
    '- Each hint is concise (1-2 sentences).',
    '- Avoid generic prompts; be specific and actionable.',
    '- Do not fabricate facts; only use details present in the conversation/objectives.',
    '- Score reflects relevance (0.0 = low, 1.0 = high).',
    '- Order hints by relevance (most relevant first).',
    '- Be empathetic and encouraging.',
    '- If no useful hints exist, return an empty "hints" array.',
    '{objectiveNote}',
    'Respond ONLY with valid JSON. No extra text.',
  ].join('\n'),
);

export async function buildHintsSystemPrompt(
  strategy: HintStrategy,
  latestAssistantQuestion?: string,
  maxHints = 3,
  hasObjectives = false,
): Promise<string> {
  const strategyGuidance = resolveStrategyGuidance(strategy);
  const latestAssistantQuestionLine = latestAssistantQuestion
    ? `Latest assistant question: "${latestAssistantQuestion}"`
    : 'No explicit assistant question detected.';
  const objectiveNote = hasObjectives
    ? '- Align hints with session objectives when relevant.'
    : '';
  const outputSchema = JSON.stringify(
    {
      hints: [
        {
          type: 'next_topic|clarification|follow_up|transition|objective',
          content: 'The hint text that will be shown to the user',
          rationale: 'Why this hint is relevant right now',
          score: 0.0,
        },
      ],
    },
    null,
    2,
  );

  return await HINT_SYSTEM_PROMPT_TEMPLATE.format({
    strategyGuidance,
    latestAssistantQuestionLine,
    maxHints,
    objectiveNote,
    outputSchema,
  });
}

function resolveStrategyGuidance(strategy: HintStrategy): string {
  switch (strategy) {
    case HintStrategy.PROACTIVE:
      return 'Generate hints proactively to guide the conversation forward, anticipating what the user might need to discuss next.';
    case HintStrategy.REACTIVE:
      return 'Generate hints in response to user inactivity or lack of engagement, helping them re-engage with the conversation.';
    case HintStrategy.CONTEXTUAL:
      return 'Generate hints based on the current conversation context, identifying gaps or areas that need more exploration.';
    default:
      return 'Generate helpful hints to guide the conversation.';
  }
}
