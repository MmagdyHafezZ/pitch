import { DEFAULT_LOCALE, LOCALE_OPTIONS, normalizeLocale } from './constants'
import { deDE } from './locales/de-DE'
import { enGB } from './locales/en-GB'
import { enUS } from './locales/en-US'
import { esES } from './locales/es-ES'
import { frFR } from './locales/fr-FR'
import type { LocaleDictionary, SupportedLocale, TranslationParams } from './types'

export const dictionaries: Record<SupportedLocale, LocaleDictionary> = {
  'en-US': enUS,
  'en-GB': enGB,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
}

export const getDictionary = (locale?: string | null): LocaleDictionary =>
  dictionaries[normalizeLocale(locale)]

export const translateMessage = (
  locale: string | null | undefined,
  key: string,
  params?: TranslationParams
) => {
  const active = getDictionary(locale)
  const fallback = dictionaries[DEFAULT_LOCALE]
  const template = active.messages[key] ?? fallback.messages[key] ?? key

  return interpolate(template, params)
}

export const translatePhrase = (locale: string | null | undefined, phrase: string) => {
  const active = getDictionary(locale)
  const trimmed = phrase.trim()
  if (!trimmed) {
    return phrase
  }

  const translated = active.phrases[trimmed] ?? trimmed
  const leadingWhitespace = phrase.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = phrase.match(/\s*$/)?.[0] ?? ''
  return `${leadingWhitespace}${translated}${trailingWhitespace}`
}

export const getLocaleOptions = () =>
  LOCALE_OPTIONS.map((option) => ({
    ...option,
    nativeLabel: getDictionary(option.value).nativeLabel,
  }))

const interpolate = (template: string, params?: TranslationParams) => {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined || value === null ? '' : String(value)
  })
}
