import type { LocaleOption, SupportedLocale } from './types'

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'
export const LOCALE_STORAGE_KEY = 'pitch.app.locale'

export const LOCALE_OPTIONS: LocaleOption[] = [
  {
    value: 'en-US',
    label: 'English (US)',
    nativeLabel: 'English (US)',
    languageLabel: 'English (US)',
  },
  {
    value: 'en-GB',
    label: 'English (UK)',
    nativeLabel: 'English (UK)',
    languageLabel: 'English (UK)',
  },
  {
    value: 'es-ES',
    label: 'Spanish',
    nativeLabel: 'Español',
    languageLabel: 'Spanish',
  },
  {
    value: 'fr-FR',
    label: 'French',
    nativeLabel: 'Français',
    languageLabel: 'French',
  },
  {
    value: 'de-DE',
    label: 'German',
    nativeLabel: 'Deutsch',
    languageLabel: 'German',
  },
]

const LANGUAGE_TO_LOCALE: Record<string, SupportedLocale> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

export const normalizeLocale = (input?: string | null): SupportedLocale => {
  if (!input) {
    return DEFAULT_LOCALE
  }

  const trimmed = input.trim()
  const exact = LOCALE_OPTIONS.find(
    (option) => option.value.toLowerCase() === trimmed.toLowerCase()
  )
  if (exact) {
    return exact.value
  }

  const languageCode = trimmed.split(/[-_]/)[0]?.toLowerCase()
  return LANGUAGE_TO_LOCALE[languageCode] ?? DEFAULT_LOCALE
}

export const getLocaleOption = (locale?: string | null) =>
  LOCALE_OPTIONS.find((option) => option.value === normalizeLocale(locale)) ?? LOCALE_OPTIONS[0]

export const isSupportedLocale = (input: string): input is SupportedLocale =>
  LOCALE_OPTIONS.some((option) => option.value === input)
