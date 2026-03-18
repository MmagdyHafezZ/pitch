export type SupportedLocale = 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE'

export type LocaleOption = {
  value: SupportedLocale
  label: string
  nativeLabel: string
  languageLabel: string
}

export type LocaleDictionary = {
  code: SupportedLocale
  label: string
  nativeLabel: string
  languageLabel: string
  messages: Record<string, string>
  phrases: Record<string, string>
}

export type TranslationParams = Record<string, string | number | null | undefined>
