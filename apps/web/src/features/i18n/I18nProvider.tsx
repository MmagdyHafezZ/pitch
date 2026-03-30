'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale } from './constants'
import { getDictionary, getLocaleOptions, translateMessage, translatePhrase } from './registry'
import type { SupportedLocale, TranslationParams } from './types'

type I18nContextValue = {
  locale: SupportedLocale
  localeOptions: ReturnType<typeof getLocaleOptions>
  languageLabel: string
  t: (key: string, params?: TranslationParams) => string
  tp: (phrase: string) => string
  setLocale: (locale: string) => void
  isSavingLocale: boolean
  localeSaveError: string | null
}

const I18nContext = createContext<I18nContextValue | null>(null)
type TranslationEntry = {
  source: string
  translated: string
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const userLocale = user?.settings?.language?.locale
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE)
  const [isReady, setIsReady] = useState(false)
  const [isSavingLocale, setIsSavingLocale] = useState(false)
  const [localeSaveError, setLocaleSaveError] = useState<string | null>(null)
  const localPreferenceRef = useRef<string | null>(null)
  const pendingPersistRef = useRef<SupportedLocale | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    localPreferenceRef.current = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    const browserLocale = window.navigator?.language
    const resolved = normalizeLocale(localPreferenceRef.current ?? userLocale ?? browserLocale)

    setLocaleState(resolved)
    setIsReady(true)
  }, [userLocale])

  useEffect(() => {
    if (!isReady || localPreferenceRef.current) {
      return
    }

    const nextLocale = userLocale
    if (!nextLocale) {
      return
    }

    const normalized = normalizeLocale(nextLocale)
    setLocaleState((current) => (current === normalized ? current : normalized))
  }, [isReady, userLocale])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (!isReady || !token || !user?.id) {
      return
    }

    const persistedUserLocale = user.settings?.language?.locale
      ? normalizeLocale(user.settings.language.locale)
      : null

    const shouldPersist =
      persistedUserLocale !== locale &&
      (pendingPersistRef.current === locale ||
        localPreferenceRef.current === locale ||
        persistedUserLocale === null)

    if (!shouldPersist) {
      return
    }

    const nextSettings = {
      ...(user.settings ?? {}),
      language: {
        ...(user.settings?.language ?? {}),
        locale,
      },
    }

    pendingPersistRef.current = null
    setIsSavingLocale(true)
    setLocaleSaveError(null)

    void api.users
      .updateMySettings({ settings: nextSettings })
      .then((settings) => {
        const latestUser = useAuthStore.getState().user
        if (!latestUser) {
          return
        }

        useAuthStore.getState().setUser({
          ...latestUser,
          settings: (settings ?? nextSettings) as typeof latestUser.settings,
        })
      })
      .catch(() => {
        pendingPersistRef.current = locale
        setLocaleSaveError(translateMessage(locale, 'settings.language.error'))
      })
      .finally(() => {
        setIsSavingLocale(false)
      })
  }, [isReady, locale, token, user])

  const setLocale = useCallback((nextLocale: string) => {
    const normalized = normalizeLocale(nextLocale)

    setLocaleState(normalized)
    setLocaleSaveError(null)
    pendingPersistRef.current = normalized

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized)
      localPreferenceRef.current = normalized
    }
  }, [])

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = getDictionary(locale)

    return {
      locale,
      localeOptions: getLocaleOptions(),
      languageLabel: dictionary.languageLabel,
      t: (key, params) => translateMessage(locale, key, params),
      tp: (phrase) => translatePhrase(locale, phrase),
      setLocale,
      isSavingLocale,
      localeSaveError,
    }
  }, [isSavingLocale, locale, localeSaveError, setLocale])

  return (
    <I18nContext.Provider value={value}>
      {children}
      <DomTranslationBridge locale={locale} />
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }

  return context
}

function DomTranslationBridge({ locale }: { locale: SupportedLocale }) {
  const textEntriesRef = useRef<WeakMap<Text, TranslationEntry>>(new WeakMap())
  const attributeEntriesRef = useRef<WeakMap<Element, Map<string, TranslationEntry>>>(new WeakMap())

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) {
      return
    }

    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE'])
    const textEntries = textEntriesRef.current
    const attributeEntries = attributeEntriesRef.current

    const shouldSkipElement = (element: Element | null) => {
      if (!element) {
        return true
      }

      if (skipTags.has(element.tagName)) {
        return true
      }

      return Boolean(element.closest('[data-i18n-skip="true"]'))
    }

    const applyTextNode = (node: Text) => {
      const parent = node.parentElement
      if (shouldSkipElement(parent)) {
        return
      }

      const currentValue = node.nodeValue ?? ''
      if (!currentValue.trim()) {
        return
      }

      const existing = textEntries.get(node)
      const source =
        existing && currentValue !== existing.source && currentValue !== existing.translated
          ? currentValue
          : (existing?.source ?? currentValue)

      const translated = translatePhrase(locale, source)
      textEntries.set(node, {
        source,
        translated,
      })

      if (translated !== currentValue) {
        node.nodeValue = translated
      }
    }

    const applyAttributes = (element: Element) => {
      if (shouldSkipElement(element)) {
        return
      }

      const attributeNames = ['placeholder', 'title', 'aria-label']
      const sourceMap = attributeEntries.get(element) ?? new Map<string, TranslationEntry>()
      attributeEntries.set(element, sourceMap)

      for (const attribute of attributeNames) {
        const currentValue = element.getAttribute(attribute)
        if (!currentValue || !currentValue.trim()) {
          continue
        }

        const existing = sourceMap.get(attribute)
        const source =
          existing && currentValue !== existing.source && currentValue !== existing.translated
            ? currentValue
            : (existing?.source ?? currentValue)

        const translated = translatePhrase(locale, source).trim()
        sourceMap.set(attribute, {
          source,
          translated,
        })

        if (translated !== currentValue) {
          element.setAttribute(attribute, translated)
        }
      }
    }

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        applyTextNode(node as Text)
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return
      }

      const element = node as Element
      applyAttributes(element)
      element.childNodes.forEach(walk)
    }

    walk(document.body)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          applyTextNode(mutation.target as Text)
          continue
        }

        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          applyAttributes(mutation.target)
          continue
        }

        mutation.addedNodes.forEach(walk)
      }
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    })

    return () => {
      observer.disconnect()
    }
  }, [locale])

  return null
}
