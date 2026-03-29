import { buildStageDetectorSystemPrompt } from '../../prompts/stage-detector.prompt';

describe('buildStageDetectorSystemPrompt', () => {
  it('returns a string containing the stage classifier identity', async () => {
    const prompt = await buildStageDetectorSystemPrompt(
      '1. Introduction\n2. Discovery',
    );

    expect(prompt).toContain('conversation stage classifier');
  });

  it('includes the stages list in the prompt', async () => {
    const stages = '0. Greeting\n1. Needs Assessment\n2. Proposal';
    const prompt = await buildStageDetectorSystemPrompt(stages);

    expect(prompt).toContain('Greeting');
    expect(prompt).toContain('Needs Assessment');
    expect(prompt).toContain('Proposal');
  });

  it('includes the output schema with required fields', async () => {
    const prompt = await buildStageDetectorSystemPrompt('0. Stage A');

    expect(prompt).toContain('stageIndex');
    expect(prompt).toContain('confidence');
    expect(prompt).toContain('reasoning');
  });

  it('instructs to respond with JSON only', async () => {
    const prompt = await buildStageDetectorSystemPrompt('0. Stage A');

    expect(prompt).toContain('JSON ONLY');
    expect(prompt).toContain('valid JSON');
  });

  it('instructs to return a single best stage index', async () => {
    const prompt = await buildStageDetectorSystemPrompt(
      '0. Stage A\n1. Stage B',
    );

    expect(prompt).toContain('single best stage index');
    expect(prompt).toContain('0-based');
  });
});
