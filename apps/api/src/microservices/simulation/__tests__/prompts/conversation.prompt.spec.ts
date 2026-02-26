import {
  buildConversationSystemPrompt,
  type ConversationPromptInput,
} from '../../prompts/conversation.prompt';

const makeInput = (tone?: string): ConversationPromptInput => ({
  persona: null,
  session: {
    name: 'Test Session',
    language: 'English',
    scenario: null,
  },
  sessionConfig: {
    tone,
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
});
