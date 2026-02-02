import { readFileSync } from 'fs';
import { join } from 'path';
import { computeScore } from '../../assessment/utils/scoring';
import { getAssessmentConfig } from '../../assessment/config/assessment.config';
import { AssessmentLabelValue } from '@prisma/simulation-client';

interface GoldCase {
  name: string;
  labels: AssessmentLabelValue[];
  expectedTotal: number;
}

describe('Assessment calibration suite', () => {
  it('matches expected score totals for gold cases', () => {
    const datasetPath = join(
      __dirname,
      '../../assessment/config/gold-dataset.json',
    );
    const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as {
      version: string;
      cases: GoldCase[];
    };

    const config = getAssessmentConfig(dataset.version);
    const tolerance = 0.001;

    dataset.cases.forEach((testCase) => {
      const result = computeScore(
        testCase.labels.map((label) => ({ label })),
        config,
      );
      expect(Math.abs(result.totalScore - testCase.expectedTotal)).toBeLessThan(
        tolerance,
      );
    });
  });
});
