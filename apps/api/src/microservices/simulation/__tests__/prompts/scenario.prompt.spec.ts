import { buildScenarioSystemPrompt } from '../../prompts/scenario.prompt';

describe('buildScenarioSystemPrompt', () => {
  it('adds a language directive for the requested locale', async () => {
    const prompt = await buildScenarioSystemPrompt('fr-FR');

    expect(prompt).toContain(
      '- Write all user-facing scenario content in French.',
    );
  });

  it('falls back to English (US) when no language is supplied', async () => {
    const prompt = await buildScenarioSystemPrompt();

    expect(prompt).toContain(
      '- Write all user-facing scenario content in English (US).',
    );
  });
});
