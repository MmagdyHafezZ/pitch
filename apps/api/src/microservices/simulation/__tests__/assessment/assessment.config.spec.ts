import {
  getAssessmentConfig,
  ASSESSMENT_CONFIGS,
  DEFAULT_ASSESSMENT_CONFIG_VERSION,
  ASSESSMENT_ENGINE_VERSION,
  ASSESSMENT_LABEL_DEFINITIONS,
} from '../../assessment/config/assessment.config';

describe('assessment.config', () => {
  describe('ASSESSMENT_LABEL_DEFINITIONS', () => {
    it('defines all 7 label types', () => {
      const labels = Object.keys(ASSESSMENT_LABEL_DEFINITIONS);
      expect(labels).toContain('PositiveExample');
      expect(labels).toContain('NegativeExample');
      expect(labels).toContain('Neutral');
      expect(labels).toContain('ObjectiveMet');
      expect(labels).toContain('ObjectiveNotMet');
      expect(labels).toContain('InsightfulQuestion');
      expect(labels).toContain('MissedOpportunity');
    });

    it('each label has description and severity', () => {
      for (const def of Object.values(ASSESSMENT_LABEL_DEFINITIONS)) {
        expect(typeof def.description).toBe('string');
        expect(['positive', 'negative', 'neutral']).toContain(def.severity);
      }
    });
  });

  describe('ASSESSMENT_ENGINE_VERSION', () => {
    it('is a non-empty string', () => {
      expect(typeof ASSESSMENT_ENGINE_VERSION).toBe('string');
      expect(ASSESSMENT_ENGINE_VERSION.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_ASSESSMENT_CONFIG_VERSION', () => {
    it('matches a key in ASSESSMENT_CONFIGS', () => {
      expect(
        ASSESSMENT_CONFIGS[DEFAULT_ASSESSMENT_CONFIG_VERSION],
      ).toBeDefined();
    });
  });

  describe('getAssessmentConfig', () => {
    it('returns the v1 config when version is "v1"', () => {
      const config = getAssessmentConfig('v1');

      expect(config.version).toBe('v1');
      expect(config.judgeScope).toBe('user-only');
      expect(config.chunk.size).toBe(12);
    });

    it('returns the default config when version is undefined', () => {
      const config = getAssessmentConfig();

      expect(config.version).toBe(DEFAULT_ASSESSMENT_CONFIG_VERSION);
    });

    it('returns the default config when version is not found', () => {
      const config = getAssessmentConfig('nonexistent');

      expect(config.version).toBe(DEFAULT_ASSESSMENT_CONFIG_VERSION);
    });

    it('config has all required fields', () => {
      const config = getAssessmentConfig('v1');

      expect(config.labelScoreDelta).toBeDefined();
      expect(config.conflictRules).toBeDefined();
      expect(config.thresholds).toBeDefined();
      expect(config.chunk).toBeDefined();
      expect(config.limits).toBeDefined();
      expect(config.timeBudgetMs).toBeDefined();
      expect(config.rag).toBeDefined();
      expect(config.judge).toBeDefined();
      expect(config.live).toBeDefined();
    });

    it('labelScoreDelta has expected values', () => {
      const config = getAssessmentConfig('v1');

      expect(config.labelScoreDelta.PositiveExample).toBe(2);
      expect(config.labelScoreDelta.NegativeExample).toBe(-2);
      expect(config.labelScoreDelta.Neutral).toBe(0);
      expect(config.labelScoreDelta.ObjectiveMet).toBe(4);
      expect(config.labelScoreDelta.ObjectiveNotMet).toBe(-4);
    });

    it('thresholds have reasonable values', () => {
      const config = getAssessmentConfig('v1');

      expect(config.thresholds.confidenceCutoff).toBeGreaterThan(0);
      expect(config.thresholds.confidenceCutoff).toBeLessThanOrEqual(1);
      expect(config.thresholds.hardNeutralCutoff).toBeLessThan(
        config.thresholds.confidenceCutoff,
      );
    });
  });
});
