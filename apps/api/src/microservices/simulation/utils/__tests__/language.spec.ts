import { resolveLanguageLabel } from '../language';

describe('resolveLanguageLabel', () => {
  // -------------------------------------------------------------------------
  // Direct locale code matches
  // -------------------------------------------------------------------------
  describe('direct locale code matches', () => {
    it('should return "English" for "en"', () => {
      expect(resolveLanguageLabel('en')).toBe('English');
    });

    it('should return "English (US)" for "en-us"', () => {
      expect(resolveLanguageLabel('en-us')).toBe('English (US)');
    });

    it('should return "English (UK)" for "en-gb"', () => {
      expect(resolveLanguageLabel('en-gb')).toBe('English (UK)');
    });

    it('should return "Spanish" for "es"', () => {
      expect(resolveLanguageLabel('es')).toBe('Spanish');
    });

    it('should return "Spanish" for "es-es"', () => {
      expect(resolveLanguageLabel('es-es')).toBe('Spanish');
    });

    it('should return "French" for "fr"', () => {
      expect(resolveLanguageLabel('fr')).toBe('French');
    });

    it('should return "French" for "fr-fr"', () => {
      expect(resolveLanguageLabel('fr-fr')).toBe('French');
    });

    it('should return "German" for "de"', () => {
      expect(resolveLanguageLabel('de')).toBe('German');
    });

    it('should return "German" for "de-de"', () => {
      expect(resolveLanguageLabel('de-de')).toBe('German');
    });
  });

  // -------------------------------------------------------------------------
  // Case insensitivity
  // -------------------------------------------------------------------------
  describe('case insensitivity', () => {
    it('should handle uppercase "EN"', () => {
      expect(resolveLanguageLabel('EN')).toBe('English');
    });

    it('should handle mixed case "En-US"', () => {
      expect(resolveLanguageLabel('En-US')).toBe('English (US)');
    });

    it('should handle uppercase "FR-FR"', () => {
      expect(resolveLanguageLabel('FR-FR')).toBe('French');
    });

    it('should handle uppercase "DE"', () => {
      expect(resolveLanguageLabel('DE')).toBe('German');
    });
  });

  // -------------------------------------------------------------------------
  // Underscore normalization
  // -------------------------------------------------------------------------
  describe('underscore normalization (BCP-47 with underscores)', () => {
    it('should normalise "en_US" underscores to hyphens → "English (US)"', () => {
      expect(resolveLanguageLabel('en_US')).toBe('English (US)');
    });

    it('should normalise "fr_FR" → "French"', () => {
      expect(resolveLanguageLabel('fr_FR')).toBe('French');
    });

    it('should normalise "de_DE" → "German"', () => {
      expect(resolveLanguageLabel('de_DE')).toBe('German');
    });
  });

  // -------------------------------------------------------------------------
  // Language-code prefix fallback (e.g. "en-au" → "English")
  // -------------------------------------------------------------------------
  describe('language-code prefix fallback', () => {
    it('should return "English" for "en-au" (region not in map, prefix matches)', () => {
      expect(resolveLanguageLabel('en-au')).toBe('English');
    });

    it('should return "English" for "en-ca"', () => {
      expect(resolveLanguageLabel('en-ca')).toBe('English');
    });

    it('should return "Spanish" for "es-mx" (region not in map, prefix matches)', () => {
      expect(resolveLanguageLabel('es-mx')).toBe('Spanish');
    });

    it('should return "German" for "de-at" (region not in map, prefix matches)', () => {
      expect(resolveLanguageLabel('de-at')).toBe('German');
    });
  });

  // -------------------------------------------------------------------------
  // Trimming whitespace
  // -------------------------------------------------------------------------
  describe('whitespace trimming', () => {
    it('should trim leading and trailing spaces', () => {
      expect(resolveLanguageLabel('  en  ')).toBe('English');
    });

    it('should trim spaces around a locale with region', () => {
      expect(resolveLanguageLabel('  en-us  ')).toBe('English (US)');
    });
  });

  // -------------------------------------------------------------------------
  // Unrecognised values – returned verbatim (trimmed)
  // -------------------------------------------------------------------------
  describe('unrecognised locale values', () => {
    it('should return the trimmed value when the locale is completely unknown', () => {
      expect(resolveLanguageLabel('xx-yy')).toBe('xx-yy');
    });

    it('should return the trimmed value for an unknown language code "zh"', () => {
      expect(resolveLanguageLabel('zh')).toBe('zh');
    });

    it('should return a human-readable language name when passed one directly', () => {
      expect(resolveLanguageLabel('Klingon')).toBe('Klingon');
    });
  });

  // -------------------------------------------------------------------------
  // Fallback default – English (US)
  // -------------------------------------------------------------------------
  describe('default fallback to "English (US)"', () => {
    it('should return "English (US)" when called with no arguments', () => {
      expect(resolveLanguageLabel()).toBe('English (US)');
    });

    it('should return "English (US)" when the only argument is null', () => {
      expect(resolveLanguageLabel(null)).toBe('English (US)');
    });

    it('should return "English (US)" when the only argument is undefined', () => {
      expect(resolveLanguageLabel(undefined)).toBe('English (US)');
    });

    it('should return "English (US)" when the only argument is an empty string', () => {
      expect(resolveLanguageLabel('')).toBe('English (US)');
    });

    it('should return "English (US)" when the only argument is a whitespace string', () => {
      expect(resolveLanguageLabel('   ')).toBe('English (US)');
    });

    it('should return "English (US)" for multiple null/undefined/empty arguments', () => {
      expect(resolveLanguageLabel(null, undefined, '')).toBe('English (US)');
    });
  });

  // -------------------------------------------------------------------------
  // Multiple arguments – first non-empty wins
  // -------------------------------------------------------------------------
  describe('multiple arguments – first non-empty wins', () => {
    it('should return the label for the first non-empty valid argument', () => {
      expect(resolveLanguageLabel(null, 'fr', 'de')).toBe('French');
    });

    it('should skip null and undefined, then resolve', () => {
      expect(resolveLanguageLabel(undefined, null, 'de')).toBe('German');
    });

    it('should skip empty strings and pick the first valid one', () => {
      expect(resolveLanguageLabel('', '  ', 'es')).toBe('Spanish');
    });

    it('should return label from first arg when first arg is valid', () => {
      expect(resolveLanguageLabel('en-gb', 'fr')).toBe('English (UK)');
    });

    it('should fall back to default when all args are empty/null/undefined', () => {
      expect(resolveLanguageLabel(null, '', undefined)).toBe('English (US)');
    });
  });
});
