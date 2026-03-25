import { computeScore } from '../../assessment/utils/scoring';
import { getAssessmentConfig } from '../../assessment/config/assessment.config';

const config = getAssessmentConfig('v1');

describe('computeScore', () => {
  it('returns zero score for empty labels array', () => {
    const result = computeScore([], config);

    expect(result.totalScore).toBe(0);
    expect(result.scoreBreakdown).toEqual({});
  });

  it('uses config labelScoreDelta when scoreDelta is not provided', () => {
    const labels = [
      { label: 'PositiveExample' as const },
      { label: 'NegativeExample' as const },
    ];

    const result = computeScore(labels, config);

    expect(result.totalScore).toBe(
      config.labelScoreDelta.PositiveExample +
        config.labelScoreDelta.NegativeExample,
    );
  });

  it('uses explicit scoreDelta when provided', () => {
    const labels = [
      { label: 'PositiveExample' as const, scoreDelta: 5 },
      { label: 'NegativeExample' as const, scoreDelta: -3 },
    ];

    const result = computeScore(labels, config);

    expect(result.totalScore).toBe(2);
  });

  it('counts label occurrences in scoreBreakdown', () => {
    const labels = [
      { label: 'PositiveExample' as const },
      { label: 'PositiveExample' as const },
      { label: 'NegativeExample' as const },
      { label: 'Neutral' as const },
    ];

    const result = computeScore(labels, config);

    expect(result.scoreBreakdown.PositiveExample).toBe(2);
    expect(result.scoreBreakdown.NegativeExample).toBe(1);
    expect(result.scoreBreakdown.Neutral).toBe(1);
  });

  it('handles null scoreDelta by falling back to config', () => {
    const labels = [{ label: 'ObjectiveMet' as const, scoreDelta: null }];

    const result = computeScore(labels, config);

    expect(result.totalScore).toBe(config.labelScoreDelta.ObjectiveMet);
  });

  it('computes a mixed scenario correctly', () => {
    const labels = [
      { label: 'ObjectiveMet' as const },
      { label: 'PositiveExample' as const },
      { label: 'MissedOpportunity' as const },
      { label: 'Neutral' as const },
    ];

    const result = computeScore(labels, config);

    const expected =
      config.labelScoreDelta.ObjectiveMet +
      config.labelScoreDelta.PositiveExample +
      config.labelScoreDelta.MissedOpportunity +
      config.labelScoreDelta.Neutral;

    expect(result.totalScore).toBe(expected);
    expect(result.scoreBreakdown.ObjectiveMet).toBe(1);
    expect(result.scoreBreakdown.PositiveExample).toBe(1);
    expect(result.scoreBreakdown.MissedOpportunity).toBe(1);
    expect(result.scoreBreakdown.Neutral).toBe(1);
  });

  it('handles all-negative labels', () => {
    const labels = [
      { label: 'NegativeExample' as const },
      { label: 'ObjectiveNotMet' as const },
      { label: 'MissedOpportunity' as const },
    ];

    const result = computeScore(labels, config);

    expect(result.totalScore).toBeLessThan(0);
  });

  it('uses zero delta for scoreDelta of 0', () => {
    const labels = [{ label: 'PositiveExample' as const, scoreDelta: 0 }];

    const result = computeScore(labels, config);

    expect(result.totalScore).toBe(0);
  });
});
