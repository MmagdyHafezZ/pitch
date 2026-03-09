import { AssessmentLabelValue } from '@prisma/simulation-client';
import { getAssessmentConfig } from '../../assessment/config/assessment.config';
import { AssessmentGraphRunner } from '../../assessment/langgraph/assessment-graph';
import type { JudgeOutput } from '../../assessment/langgraph/judge-output.schema';

type MergeMethod = (
  primary: JudgeOutput,
  secondary: JudgeOutput,
  config: ReturnType<typeof getAssessmentConfig>,
) => JudgeOutput;

const createRunner = () =>
  new AssessmentGraphRunner(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

describe('Assessment merge policy', () => {
  const config = getAssessmentConfig('v1');

  it('keeps a non-neutral label when judges disagree but both are negative', () => {
    const runner = createRunner();
    const mergeJudgeOutputs = (
      runner as unknown as { mergeJudgeOutputs: MergeMethod }
    ).mergeJudgeOutputs.bind(runner);

    const primary: JudgeOutput = {
      chunkIndex: 0,
      summary: 'primary',
      labels: [
        {
          turnId: 'turn-1',
          label: AssessmentLabelValue.NegativeExample,
          confidence: 0.72,
          evidence: 'insult',
          scoreDelta: -2,
          citations: [],
          reasonSummary: 'Hostile language',
        },
      ],
    };
    const secondary: JudgeOutput = {
      chunkIndex: 0,
      summary: 'secondary',
      labels: [
        {
          turnId: 'turn-1',
          label: AssessmentLabelValue.ObjectiveNotMet,
          confidence: 0.68,
          evidence: 'we are done',
          scoreDelta: -4,
          citations: [],
          reasonSummary: 'Objective not advanced',
        },
      ],
    };

    const merged = mergeJudgeOutputs(primary, secondary, config);

    expect(merged.labels).toHaveLength(1);
    expect(merged.labels[0]?.label).toBe(AssessmentLabelValue.NegativeExample);
    expect(merged.labels[0]?.label).not.toBe(AssessmentLabelValue.Neutral);
  });

  it('falls back to neutral when opposite polarities disagree at similar confidence', () => {
    const runner = createRunner();
    const mergeJudgeOutputs = (
      runner as unknown as { mergeJudgeOutputs: MergeMethod }
    ).mergeJudgeOutputs.bind(runner);

    const primary: JudgeOutput = {
      chunkIndex: 1,
      summary: 'primary',
      labels: [
        {
          turnId: 'turn-2',
          label: AssessmentLabelValue.PositiveExample,
          confidence: 0.71,
          evidence: 'clear answer',
          scoreDelta: 2,
          citations: [],
          reasonSummary: 'Strong response',
        },
      ],
    };
    const secondary: JudgeOutput = {
      chunkIndex: 1,
      summary: 'secondary',
      labels: [
        {
          turnId: 'turn-2',
          label: AssessmentLabelValue.NegativeExample,
          confidence: 0.69,
          evidence: 'missed key detail',
          scoreDelta: -2,
          citations: [],
          reasonSummary: 'Incomplete answer',
        },
      ],
    };

    const merged = mergeJudgeOutputs(primary, secondary, config);

    expect(merged.labels).toHaveLength(1);
    expect(merged.labels[0]?.label).toBe(AssessmentLabelValue.Neutral);
    expect(merged.labels[0]?.scoreDelta).toBe(0);
  });
});
