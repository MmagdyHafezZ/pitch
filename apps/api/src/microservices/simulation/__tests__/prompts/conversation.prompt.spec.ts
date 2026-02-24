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
  it('adds confrontational behavior directives for the Rude Karen tone', async () => {
    const prompt = await buildConversationSystemPrompt(makeInput('Rude Karen'));

    expect(prompt).toContain('- Tone: Rude Karen');
    expect(prompt).toContain(
      '- Persona behavior: Be blunt, impatient, and hard to satisfy.',
    );
    expect(prompt).toContain(
      '- Persona behavior: Challenge weak answers and push the user to justify decisions under pressure.',
    );
  });

  it('does not add Rude Karen directives for other tones', async () => {
    const prompt = await buildConversationSystemPrompt(makeInput('Friendly'));

    expect(prompt).toContain('- Tone: Friendly');
    expect(prompt).not.toContain(
      '- Persona behavior: Be blunt, impatient, and hard to satisfy.',
    );
  });
});
