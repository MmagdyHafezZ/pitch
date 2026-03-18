const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  'en-us': 'English (US)',
  'en-gb': 'English (UK)',
  es: 'Spanish',
  'es-es': 'Spanish',
  fr: 'French',
  'fr-fr': 'French',
  de: 'German',
  'de-de': 'German',
};

export const resolveLanguageLabel = (
  ...inputs: Array<string | null | undefined>
) => {
  for (const value of inputs) {
    if (!value || !value.trim()) {
      continue;
    }

    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase().replace(/_/g, '-');
    const directMatch = LOCALE_LABELS[normalized];
    if (directMatch) {
      return directMatch;
    }

    const languageCode = normalized.split('-')[0];
    const languageMatch = LOCALE_LABELS[languageCode];
    if (languageMatch) {
      return languageMatch;
    }

    return trimmed;
  }

  return 'English (US)';
};
