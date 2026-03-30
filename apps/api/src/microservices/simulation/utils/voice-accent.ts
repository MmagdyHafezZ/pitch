const AUTO_ACCENT_VALUES = new Set([
  'persona based',
  'persona-based',
  'persona',
  'default',
  'auto',
  'automatic',
  'none',
  'original',
]);

const LANGUAGE_HINT_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  {
    pattern:
      /\b(american|british|australian|canadian|indian|irish|scottish|new zealand|south african|english|us|u\.s\.|uk|u\.k\.)\b/i,
    code: 'en',
  },
  { pattern: /\b(spanish|espanol|castilian|mexican)\b/i, code: 'es' },
  { pattern: /\b(french|francais)\b/i, code: 'fr' },
  { pattern: /\b(german|deutsch)\b/i, code: 'de' },
  { pattern: /\b(italian|italiano)\b/i, code: 'it' },
  { pattern: /\b(japanese|nihongo)\b/i, code: 'ja' },
  { pattern: /\b(korean|hangul)\b/i, code: 'ko' },
  { pattern: /\b(chinese|mandarin|cantonese)\b/i, code: 'zh' },
  { pattern: /\b(portuguese|brazilian)\b/i, code: 'pt' },
];

export const normalizeAccent = (input?: string): string | undefined => {
  if (!input) {
    return undefined;
  }

  const normalized = input.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return undefined;
  }

  const lower = normalized.toLowerCase();
  if (AUTO_ACCENT_VALUES.has(lower)) {
    return undefined;
  }

  // Ignore legacy values that actually contain provider/voice labels.
  if (normalized.includes('/')) {
    return undefined;
  }

  return normalized;
};

export const inferLanguageCode = (input?: string): string | undefined => {
  if (!input) {
    return undefined;
  }

  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const localeLike = /^([a-z]{2})(?:[-_][a-z]{2})?$/i.exec(normalized);
  if (localeLike) {
    return localeLike[1].toLowerCase();
  }

  for (const entry of LANGUAGE_HINT_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.code;
    }
  }

  return undefined;
};

export const buildAccentInstruction = (accent?: string): string | undefined => {
  const normalized = normalizeAccent(accent);
  if (!normalized) {
    return undefined;
  }

  if (/\baccent\b/i.test(normalized)) {
    return `Use a ${normalized}. Keep pronunciation natural and clear.`;
  }

  return `Speak with a ${normalized} accent. Keep pronunciation natural and clear.`;
};
