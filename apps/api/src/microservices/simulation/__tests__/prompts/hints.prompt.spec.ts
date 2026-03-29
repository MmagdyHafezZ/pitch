import { buildHintsSystemPrompt } from '../../prompts/hints.prompt';
import { HintStrategy } from '../../dto/hints.dto';

describe('buildHintsSystemPrompt', () => {
  it('returns a string containing coaching assistant identity', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.PROACTIVE);

    expect(prompt).toContain('coaching assistant');
    expect(prompt).toContain('hints');
  });

  it('includes proactive strategy guidance', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.PROACTIVE);

    expect(prompt).toContain('proactively');
  });

  it('includes reactive strategy guidance', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.REACTIVE);

    expect(prompt).toContain('inactivity');
  });

  it('includes contextual strategy guidance', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.CONTEXTUAL);

    expect(prompt).toContain('context');
  });

  it('falls back to generic guidance for unknown strategy', async () => {
    const prompt = await buildHintsSystemPrompt('unknown' as HintStrategy);

    expect(prompt).toContain('helpful hints');
  });

  it('includes the latest assistant question when provided', async () => {
    const prompt = await buildHintsSystemPrompt(
      HintStrategy.PROACTIVE,
      'What is your budget?',
    );

    expect(prompt).toContain('What is your budget?');
  });

  it('shows fallback when no assistant question is provided', async () => {
    const prompt = await buildHintsSystemPrompt(
      HintStrategy.PROACTIVE,
      undefined,
    );

    expect(prompt).toContain('No explicit assistant question detected');
  });

  it('includes the maxHints parameter', async () => {
    const prompt = await buildHintsSystemPrompt(
      HintStrategy.PROACTIVE,
      undefined,
      5,
    );

    expect(prompt).toContain('5');
  });

  it('defaults maxHints to 3', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.PROACTIVE);

    expect(prompt).toContain('3');
  });

  it('includes objective alignment note when hasObjectives is true', async () => {
    const prompt = await buildHintsSystemPrompt(
      HintStrategy.PROACTIVE,
      undefined,
      3,
      true,
    );

    expect(prompt).toContain('session objectives');
  });

  it('omits objective alignment note when hasObjectives is false', async () => {
    const prompt = await buildHintsSystemPrompt(
      HintStrategy.PROACTIVE,
      undefined,
      3,
      false,
    );

    expect(prompt).not.toContain('Align hints with session objectives');
  });

  it('includes output schema with hint types', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.PROACTIVE);

    expect(prompt).toContain('next_topic');
    expect(prompt).toContain('clarification');
    expect(prompt).toContain('follow_up');
    expect(prompt).toContain('transition');
    expect(prompt).toContain('objective');
  });

  it('includes boundary rules', async () => {
    const prompt = await buildHintsSystemPrompt(HintStrategy.PROACTIVE);

    expect(prompt).toContain('NOT a participant');
    expect(prompt).toContain('Do NOT roleplay');
  });
});
