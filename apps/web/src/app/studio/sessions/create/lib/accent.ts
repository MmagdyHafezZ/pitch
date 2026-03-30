import type { PersonaTraits } from './types'

export const DEFAULT_ACCENT = 'Persona-based'

const inferAccentFromLanguageHint = (hint?: string): string | null => {
  if (!hint) {
    return null
  }

  const normalized = hint.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized.startsWith('en-gb')) return 'British English'
  if (normalized.startsWith('en-au')) return 'Australian English'
  if (normalized.startsWith('en-ca')) return 'Canadian English'
  if (normalized.startsWith('en-in')) return 'Indian English'
  if (normalized.startsWith('en')) return 'American English'
  if (normalized.startsWith('es')) return 'Spanish'
  if (normalized.startsWith('fr')) return 'French'
  if (normalized.startsWith('de')) return 'German'
  if (normalized.startsWith('it')) return 'Italian'

  if (normalized.includes('british')) return 'British English'
  if (normalized.includes('australian')) return 'Australian English'
  if (normalized.includes('canadian')) return 'Canadian English'
  if (normalized.includes('indian')) return 'Indian English'
  if (normalized.includes('american') || normalized.includes('us')) return 'American English'
  if (normalized.includes('spanish')) return 'Spanish'
  if (normalized.includes('french')) return 'French'
  if (normalized.includes('german')) return 'German'
  if (normalized.includes('italian')) return 'Italian'

  return null
}

export const normalizeAccentSelection = (value?: string): string => {
  if (!value || !value.trim()) {
    return DEFAULT_ACCENT
  }

  const inferred = inferAccentFromLanguageHint(value)
  return inferred ?? DEFAULT_ACCENT
}

export const deriveAccentFromPersonaTraits = (traits: PersonaTraits | null | undefined): string => {
  if (!traits) {
    return DEFAULT_ACCENT
  }

  const fromVoiceLanguage = inferAccentFromLanguageHint(traits.voice?.language)
  if (fromVoiceLanguage) {
    return fromVoiceLanguage
  }

  const fromVoiceProfile = inferAccentFromLanguageHint(traits.voiceProfile)
  if (fromVoiceProfile) {
    return fromVoiceProfile
  }

  return DEFAULT_ACCENT
}
