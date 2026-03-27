'use client'

import {
  MantineProvider,
  ColorSchemeScript,
  createTheme,
  type ButtonProps,
  type MantineTheme,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './client'
import { useEffect, useMemo, useState } from 'react'
import { generateColors } from '@mantine/colors-generator'
import { useAppearanceStore } from '@/lib/stores/appearance.store'
import { I18nProvider } from '@/features/i18n'
import {
  getAccentStrong,
  getReadableMutedColor,
  getReadableTextColor,
  isLightColor,
  mixColors,
  setColorLightness,
} from '@/lib/colors/contrast'

// Import Mantine CSS
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
interface ProvidersProps {
  children: React.ReactNode
}

type CardPalette = {
  bg: string
  elevated: string
  subtle: string
  heroStart: string
  heroEnd: string
  border: string
  borderStrong: string
  shadow: string
}

const CURATED_CARD_PALETTES: Record<
  string,
  { light: CardPalette; dark: CardPalette }
> = {
  ocean: {
    light: {
      bg: '#f4f8fc',
      elevated: '#eaf2fb',
      subtle: '#eef5fb',
      heroStart: '#e9f2fb',
      heroEnd: '#e3eefb',
      border: '#bfd4ea',
      borderStrong: '#9bbfe4',
      shadow: '#9cb6d2',
    },
    dark: {
      bg: '#1a2633',
      elevated: '#213247',
      subtle: '#1e2d3d',
      heroStart: '#223449',
      heroEnd: '#1d2c3d',
      border: '#3e5673',
      borderStrong: '#54749a',
      shadow: '#0a1320',
    },
  },
  sunset: {
    light: {
      bg: '#fff6ee',
      elevated: '#feefe0',
      subtle: '#fff2e6',
      heroStart: '#fff0df',
      heroEnd: '#fce7d4',
      border: '#e6c1a3',
      borderStrong: '#d89f74',
      shadow: '#c7a189',
    },
    dark: {
      bg: '#342722',
      elevated: '#41302a',
      subtle: '#392b25',
      heroStart: '#47322a',
      heroEnd: '#3a2b25',
      border: '#6f5244',
      borderStrong: '#95684d',
      shadow: '#18100d',
    },
  },
  forest: {
    light: {
      bg: '#f3f8f4',
      elevated: '#eaf3ec',
      subtle: '#edf5ee',
      heroStart: '#e9f2ea',
      heroEnd: '#e2eee4',
      border: '#b8cfbf',
      borderStrong: '#8fb09a',
      shadow: '#9eb4a5',
    },
    dark: {
      bg: '#1e2d24',
      elevated: '#25382c',
      subtle: '#223228',
      heroStart: '#294033',
      heroEnd: '#223328',
      border: '#476252',
      borderStrong: '#5f806d',
      shadow: '#0f1813',
    },
  },
  citrus: {
    light: {
      bg: '#fffbea',
      elevated: '#fff4d8',
      subtle: '#fff7e1',
      heroStart: '#fff2d1',
      heroEnd: '#fce9bf',
      border: '#e4d091',
      borderStrong: '#d2b563',
      shadow: '#c8b47d',
    },
    dark: {
      bg: '#332e1d',
      elevated: '#403825',
      subtle: '#39321f',
      heroStart: '#473c25',
      heroEnd: '#3a311f',
      border: '#6a5c2f',
      borderStrong: '#8e7732',
      shadow: '#171308',
    },
  },
  lagoon: {
    light: {
      bg: '#f2faf8',
      elevated: '#e4f4ef',
      subtle: '#e9f7f2',
      heroStart: '#e2f2ec',
      heroEnd: '#dcf0e9',
      border: '#afd4c8',
      borderStrong: '#7ebca8',
      shadow: '#98b8ad',
    },
    dark: {
      bg: '#173032',
      elevated: '#1e3b3d',
      subtle: '#1a3537',
      heroStart: '#214244',
      heroEnd: '#1b3638',
      border: '#3f6a6a',
      borderStrong: '#4d8b82',
      shadow: '#091516',
    },
  },
  rosewood: {
    light: {
      bg: '#fff5f6',
      elevated: '#feecee',
      subtle: '#fff0f2',
      heroStart: '#fee9ec',
      heroEnd: '#fde3e8',
      border: '#e4bcc3',
      borderStrong: '#d68d9e',
      shadow: '#c6a3ac',
    },
    dark: {
      bg: '#332126',
      elevated: '#40282f',
      subtle: '#39242a',
      heroStart: '#472a33',
      heroEnd: '#3b252d',
      border: '#6d4652',
      borderStrong: '#925b6f',
      shadow: '#170d10',
    },
  },
  slate: {
    light: {
      bg: '#f6f8fb',
      elevated: '#eef2f6',
      subtle: '#f1f4f7',
      heroStart: '#edf1f5',
      heroEnd: '#e7edf4',
      border: '#c3ccd6',
      borderStrong: '#9daab8',
      shadow: '#aab3be',
    },
    dark: {
      bg: '#232c36',
      elevated: '#2b3744',
      subtle: '#27313c',
      heroStart: '#31404e',
      heroEnd: '#293440',
      border: '#4f6174',
      borderStrong: '#667c92',
      shadow: '#0d1218',
    },
  },
  arctic: {
    light: {
      bg: '#f4f7ff',
      elevated: '#ebf0fe',
      subtle: '#eef2ff',
      heroStart: '#e8eeff',
      heroEnd: '#e2eaff',
      border: '#becaee',
      borderStrong: '#97aae9',
      shadow: '#a3b0d4',
    },
    dark: {
      bg: '#1b2740',
      elevated: '#223152',
      subtle: '#1f2c49',
      heroStart: '#25365a',
      heroEnd: '#202f4c',
      border: '#415b8d',
      borderStrong: '#5c7cc0',
      shadow: '#09111f',
    },
  },
}
export function Providers({ children }: ProvidersProps) {
  const colorMode = useAppearanceStore((state) => state.colorMode)
  const profiles = useAppearanceStore((state) => state.profiles)
  const activeProfileId = useAppearanceStore((state) => state.activeProfileId)
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateScheme = () => setSystemScheme(mediaQuery.matches ? 'dark' : 'light')

    updateScheme()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateScheme)
      return () => mediaQuery.removeEventListener('change', updateScheme)
    }

    mediaQuery.addListener(updateScheme)
    return () => mediaQuery.removeListener(updateScheme)
  }, [])

  const resolvedScheme = useMemo(
    () => (colorMode === 'system' ? systemScheme : colorMode),
    [colorMode, systemScheme]
  )

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId]
  )

  const theme = useMemo(() => {
    if (!activeProfile) {
      return createTheme({})
    }

    return createTheme({
      colors: {
        brand: generateColors(activeProfile.tokens.accent),
        selected: generateColors(activeProfile.tokens.selected),
        success: generateColors(activeProfile.tokens.success),
        info: generateColors(activeProfile.tokens.info),
        nav: generateColors(activeProfile.tokens.navBg),
        surface: generateColors(activeProfile.tokens.surfaceBg),
        gray: generateColors(activeProfile.tokens.surfaceBg),
      },
      primaryColor: 'brand',
      shadows: {
        md: '1px 1px 3px rgba(0, 0, 0, .25)',
        xl: '5px 5px 3px rgba(0, 0, 0, .25)',
      },
      headings: {
        fontFamily: 'Roboto, sans-serif',
        sizes: {
          h1: { fontSize: '36px' },
        },
      },
      components: {
        Anchor: {
          styles: {
            root: {
              color: 'var(--pitch-accent-strong)',
            },
          },
        },
        Button: {
          vars: (_theme: MantineTheme, props: ButtonProps) => ({
            root:
              props.variant === 'filled'
                ? {
                    '--button-bg': 'var(--pitch-accent)',
                    '--button-hover': 'var(--pitch-accent-strong)',
                    '--button-color': 'var(--mantine-color-white)',
                  }
                : {},
          }),
        },
        Progress: {
          styles: {
            section: {
              backgroundColor: 'var(--pitch-accent-strong)',
            },
          },
        },
      },
    })
  }, [activeProfile])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    document.documentElement.classList.toggle('dark', resolvedScheme === 'dark')
  }, [resolvedScheme])

  useEffect(() => {
    if (typeof document === 'undefined' || !activeProfile) {
      return
    }
    const accentStrong = getAccentStrong(activeProfile.tokens.accent, resolvedScheme)
    const preferDark = resolvedScheme === 'dark'
    const adjustForScheme = (color: string, darkRatio: number, lightRatio: number) => {
      const light = isLightColor(color)
      if (preferDark) {
        return light ? mixColors(color, '#000000', darkRatio) : color
      }
      return light ? color : mixColors(color, '#ffffff', lightRatio)
    }
    // In dark mode: keep the nav at its raw dark token (darken only if somehow light).
    // In light mode: lift the nav's HSL lightness to ~42% so it reads as a bright
    // medium-tone that shows the profile's hue, rather than the near-black raw token.
    const rawNavBg = activeProfile.tokens.navBg
    const navBg = preferDark
      ? isLightColor(rawNavBg)
        ? mixColors(rawNavBg, '#000000', 0.7)
        : rawNavBg
      : isLightColor(rawNavBg)
        ? rawNavBg
        : setColorLightness(rawNavBg, 0.42)
    const navText = getReadableTextColor(navBg)
    const navTextDim = getReadableMutedColor(navBg)
    const surfaceBg = adjustForScheme(activeProfile.tokens.surfaceBg, 0.82, 0.7)
    const surfaceText = getReadableTextColor(surfaceBg)
    const surfaceTextDim = getReadableMutedColor(surfaceBg)
    const lightSurface = isLightColor(surfaceBg)
    const borderColor = lightSurface
      ? mixColors(surfaceBg, '#000000', 0.18)
      : mixColors(surfaceBg, '#ffffff', 0.22)
    const inputBg = lightSurface
      ? mixColors(surfaceBg, '#000000', 0.06)
      : mixColors(surfaceBg, '#ffffff', 0.08)
    const inputText = getReadableTextColor(inputBg)
    const inputPlaceholder = lightSurface ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)'
    const navAccentSoft = mixColors(navBg, activeProfile.tokens.accent, 0.12)
    const navAccentHover = mixColors(navBg, activeProfile.tokens.accent, 0.18)
    const curatedPalette = CURATED_CARD_PALETTES[activeProfile.id]?.[preferDark ? 'dark' : 'light']
    const fallbackBase = preferDark
      ? mixColors(activeProfile.tokens.navBg, activeProfile.tokens.accent, 0.24)
      : mixColors(surfaceBg, activeProfile.tokens.accent, 0.08)
    const fallbackElevated = preferDark
      ? mixColors(fallbackBase, activeProfile.tokens.selected, 0.18)
      : mixColors(fallbackBase, activeProfile.tokens.selected, 0.14)
    const fallbackSubtle = preferDark
      ? mixColors(fallbackBase, activeProfile.tokens.accent, 0.12)
      : mixColors(surfaceBg, activeProfile.tokens.selected, 0.06)
    const fallbackHeroStart = preferDark
      ? mixColors(fallbackBase, activeProfile.tokens.accent, 0.18)
      : mixColors(surfaceBg, activeProfile.tokens.accent, 0.14)
    const fallbackHeroEnd = preferDark
      ? mixColors(fallbackElevated, activeProfile.tokens.selected, 0.12)
      : mixColors(surfaceBg, activeProfile.tokens.selected, 0.12)
    const fallbackBorder = preferDark
      ? mixColors(fallbackBase, activeProfile.tokens.selected, 0.16)
      : mixColors(fallbackBase, activeProfile.tokens.selected, 0.22)
    const fallbackBorderStrong = preferDark
      ? mixColors(fallbackElevated, activeProfile.tokens.accent, 0.18)
      : mixColors(fallbackElevated, activeProfile.tokens.accent, 0.3)
    const fallbackShadow = preferDark
      ? mixColors(activeProfile.tokens.navBg, '#000000', 0.4)
      : mixColors(activeProfile.tokens.selected, activeProfile.tokens.navBg, 0.3)
    const cardBase = curatedPalette?.bg ?? fallbackBase
    const cardElevated = curatedPalette?.elevated ?? fallbackElevated
    const cardSubtle = curatedPalette?.subtle ?? fallbackSubtle
    const cardHeroStart = curatedPalette?.heroStart ?? fallbackHeroStart
    const cardHeroEnd = curatedPalette?.heroEnd ?? fallbackHeroEnd
    const cardBorder = curatedPalette?.border ?? fallbackBorder
    const cardBorderStrong = curatedPalette?.borderStrong ?? fallbackBorderStrong
    const cardShadow = curatedPalette?.shadow ?? fallbackShadow
    document.documentElement.style.setProperty('--pitch-nav-bg', navBg)
    document.documentElement.style.setProperty('--pitch-nav-text', navText)
    document.documentElement.style.setProperty('--pitch-nav-text-dim', navTextDim)
    document.documentElement.style.setProperty('--pitch-nav-accent-soft', navAccentSoft)
    document.documentElement.style.setProperty('--pitch-nav-accent-hover', navAccentHover)
    document.documentElement.style.setProperty('--pitch-surface-bg', surfaceBg)
    document.documentElement.style.setProperty('--pitch-surface-text', surfaceText)
    document.documentElement.style.setProperty('--pitch-surface-text-dim', surfaceTextDim)
    document.documentElement.style.setProperty('--pitch-border', borderColor)
    document.documentElement.style.setProperty('--pitch-input-bg', inputBg)
    document.documentElement.style.setProperty('--pitch-input-text', inputText)
    document.documentElement.style.setProperty('--pitch-input-placeholder', inputPlaceholder)
    const appBg = mixColors(surfaceBg, activeProfile.tokens.accent, preferDark ? 0.12 : 0.2)
    document.documentElement.style.setProperty('--pitch-app-bg', appBg)
    const accentSoft = mixColors(activeProfile.tokens.surfaceBg, activeProfile.tokens.accent, 0.15)
    document.documentElement.style.setProperty('--pitch-accent', activeProfile.tokens.accent)
    document.documentElement.style.setProperty('--pitch-accent-strong', accentStrong)
    document.documentElement.style.setProperty('--pitch-accent-soft', accentSoft)
    document.documentElement.style.setProperty('--pitch-selected', activeProfile.tokens.selected)
    document.documentElement.style.setProperty('--pitch-success', activeProfile.tokens.success)
    document.documentElement.style.setProperty('--pitch-info', activeProfile.tokens.info)
    document.documentElement.style.setProperty('--pitch-card-bg', cardBase)
    document.documentElement.style.setProperty('--pitch-card-bg-strong', cardElevated)
    document.documentElement.style.setProperty('--pitch-card-bg-subtle', cardSubtle)
    document.documentElement.style.setProperty('--pitch-card-hero-start', cardHeroStart)
    document.documentElement.style.setProperty('--pitch-card-hero-end', cardHeroEnd)
    document.documentElement.style.setProperty('--pitch-card-border', cardBorder)
    document.documentElement.style.setProperty('--pitch-card-border-strong', cardBorderStrong)
    document.documentElement.style.setProperty('--pitch-card-shadow', cardShadow)
    document.documentElement.style.setProperty(
      '--pitch-window-gradient',
      activeProfile.useGradient
        ? `linear-gradient(135deg, ${activeProfile.tokens.navBg}, ${activeProfile.tokens.selected})`
        : 'none'
    )
  }, [activeProfile, resolvedScheme])

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MantineProvider theme={theme} forceColorScheme={resolvedScheme}>
          <ModalsProvider>
            <Notifications />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </I18nProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export { ColorSchemeScript }
