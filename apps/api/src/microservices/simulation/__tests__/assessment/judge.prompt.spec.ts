import {
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
} from '../../assessment/prompts/judge.prompt';
import { getAssessmentConfig } from '../../assessment/config/assessment.config';

describe('buildJudgeSystemPrompt', () => {
  const config = getAssessmentConfig('v1');

  it('identifies the role as an assessment judge', () => {
    const prompt = buildJudgeSystemPrompt(config);

    expect(prompt).toContain('assessment judge');
    expect(prompt).toContain('sales training simulation');
  });

  it('includes label definitions', () => {
    const prompt = buildJudgeSystemPrompt(config);

    expect(prompt).toContain('PositiveExample');
    expect(prompt).toContain('NegativeExample');
    expect(prompt).toContain('Neutral');
    expect(prompt).toContain('ObjectiveMet');
    expect(prompt).toContain('ObjectiveNotMet');
    expect(prompt).toContain('InsightfulQuestion');
    expect(prompt).toContain('MissedOpportunity');
  });

  it('includes output format schema', () => {
    const prompt = buildJudgeSystemPrompt(config);

    expect(prompt).toContain('chunkIndex');
    expect(prompt).toContain('summary');
    expect(prompt).toContain('labels');
    expect(prompt).toContain('turnId');
    expect(prompt).toContain('confidence');
    expect(prompt).toContain('scoreDelta');
  });

  it('includes session context when provided', () => {
    const prompt = buildJudgeSystemPrompt(config, 'Close the enterprise deal');

    expect(prompt).toContain('Close the enterprise deal');
  });

  it('uses fallback when session context is empty', () => {
    const prompt = buildJudgeSystemPrompt(config, '');

    expect(prompt).toContain('No session objective provided');
  });

  it('uses fallback when session context is undefined', () => {
    const prompt = buildJudgeSystemPrompt(config);

    expect(prompt).toContain('No session objective provided');
  });

  it('includes the judge scope from config', () => {
    const prompt = buildJudgeSystemPrompt(config);

    expect(prompt).toContain(`judgeScope: ${config.judgeScope}`);
  });

  it('includes rules about confidence thresholds', () => {
    const prompt = buildJudgeSystemPrompt(config);

    expect(prompt).toContain('confidence >= 0.7');
    expect(prompt).toContain('confidence 0.4-0.69');
    expect(prompt).toContain('confidence < 0.4');
  });
});

describe('buildJudgeUserPrompt', () => {
  it('returns a valid JSON string with the chunk data', () => {
    const input = {
      chunkIndex: 0,
      turns: [
        { turnId: 't1', role: 'user', text: 'Hello' },
        { turnId: 't2', role: 'assistant', text: 'Hi there' },
      ],
    };

    const result = buildJudgeUserPrompt(input);
    const parsed = JSON.parse(result);

    expect(parsed.chunkIndex).toBe(0);
    expect(parsed.turns).toHaveLength(2);
    expect(parsed.turns[0].turnId).toBe('t1');
    expect(parsed.retrievedContext).toEqual([]);
  });

  it('includes retrieved context when provided', () => {
    const input = {
      chunkIndex: 1,
      turns: [{ turnId: 't1', role: 'user', text: 'Test' }],
      retrievedContext: [
        { id: 'c1', source: 'doc.pdf', content: 'Product details' },
      ],
    };

    const result = buildJudgeUserPrompt(input);
    const parsed = JSON.parse(result);

    expect(parsed.retrievedContext).toHaveLength(1);
    expect(parsed.retrievedContext[0].id).toBe('c1');
  });

  it('defaults retrievedContext to empty array', () => {
    const result = buildJudgeUserPrompt({
      chunkIndex: 0,
      turns: [{ turnId: 't1', role: 'user', text: 'Test' }],
    });
    const parsed = JSON.parse(result);

    expect(parsed.retrievedContext).toEqual([]);
  });
});
