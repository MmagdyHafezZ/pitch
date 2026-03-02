import {
  buildConversationSystemPrompt,
  type ConversationPromptInput,
} from '../../prompts/conversation.prompt';

const makeInput = (
  tone?: string,
  overrides?: Partial<ConversationPromptInput['sessionConfig']>,
  sessionOverrides?: Partial<ConversationPromptInput['session']>,
): ConversationPromptInput => ({
  persona: null,
  session: {
    name: 'Test Session',
    language: 'English',
    scenario: null,
    ...sessionOverrides,
  },
  sessionConfig: {
    tone,
    ...overrides,
  },
  scenarioConfig: {},
});

describe('buildConversationSystemPrompt', () => {
  it('adds confrontational behavior directives for the Rude Karen tone', () => {
    const prompt = buildConversationSystemPrompt(makeInput('Rude Karen'));

    expect(prompt).toContain('- Tone: Rude Karen');
    expect(prompt).toContain(
      '- Baseline: Blunt, impatient, and hard to satisfy from the start.',
    );
    expect(prompt).toContain(
      '- Push back hard on vague or weak answers. Demand justification and specifics.',
    );
  });

  it('does not add Rude Karen directives for other tones', () => {
    const prompt = buildConversationSystemPrompt(makeInput('Friendly'));

    expect(prompt).toContain('- Tone: Friendly');
    expect(prompt).not.toContain(
      '- Baseline: Blunt, impatient, and hard to satisfy from the start.',
    );
  });

  it('adds patience, response-length, and initiative directives when configured', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput('Professional', {
        patienceLevel: 'Low',
        responseLength: 'Concise',
        initiativeLevel: 'Proactive',
      }),
    );

    expect(prompt).toContain('- Patience level: Low');
    expect(prompt).toContain(
      '- Patience setting: low. If the user rambles or dodges, tighten your tone quickly and force specificity.',
    );
    expect(prompt).toContain(
      '- Prefer short answers. Keep most turns to 1–2 sentences unless detail is explicitly requested.',
    );
    expect(prompt).toContain(
      '- Drive momentum. Offer pointed follow-ups and move the scenario forward without waiting passively.',
    );
  });

  it('maps locale codes to natural language instructions', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(undefined, undefined, {
        language: 'es-ES',
      }),
    );

    expect(prompt).toContain('- Respond only in Spanish.');
  });

  it('falls back to the user locale preference when the session language is missing', () => {
    const prompt = buildConversationSystemPrompt(
      makeInput(
        undefined,
        {
          userSnapshot: {
            settings: {
              language: {
                locale: 'de-DE',
              },
            },
          },
        },
        {
          language: null,
        },
      ),
    );

    expect(prompt).toContain('- Respond only in German.');
  });
});
