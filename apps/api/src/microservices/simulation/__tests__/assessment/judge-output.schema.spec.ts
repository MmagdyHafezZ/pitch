import { AssessmentLabelValue } from '@prisma/simulation-client';
import { JudgeOutputSchema } from '../../assessment/langgraph/judge-output.schema';

describe('JudgeOutputSchema', () => {
  it('normalizes label aliases and confidence formats', () => {
    const parsed = JudgeOutputSchema.parse({
      chunkIndex: '1',
      summary: 'test',
      labels: [
        {
          turnId: 123,
          label: 'objective_not_met',
          confidence: '72%',
          evidence: 'No next step provided',
          citations: 'turn-123',
        },
      ],
    });

    expect(parsed.chunkIndex).toBe(1);
    expect(parsed.labels[0]?.turnId).toBe('123');
    expect(parsed.labels[0]?.label).toBe(AssessmentLabelValue.ObjectiveNotMet);
    expect(parsed.labels[0]?.confidence).toBeCloseTo(0.72, 3);
    expect(parsed.labels[0]?.scoreDelta).toBeUndefined();
    expect(parsed.labels[0]?.citations).toEqual(['turn-123']);
  });

  it('fills optional fields with safe defaults', () => {
    const parsed = JudgeOutputSchema.parse({
      labels: [{ turnId: 'turn-1', label: 'positive' }],
    });

    expect(parsed.chunkIndex).toBe(0);
    expect(parsed.summary).toBe('');
    expect(parsed.labels).toHaveLength(1);
    expect(parsed.labels[0]?.label).toBe(AssessmentLabelValue.PositiveExample);
    expect(parsed.labels[0]?.confidence).toBe(0.5);
    expect(parsed.labels[0]?.citations).toEqual([]);
    expect(parsed.labels[0]?.reasonSummary).toBe('');
  });
});
