'use client'

import { MantineProvider, ColorSchemeScript, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './client'
import { useEffect, useMemo, useState } from 'react'
import { generateColors } from '@mantine/colors-generator'
import { useAppearanceStore } from '@/lib/stores/appearance.store'
import {
  getAccentStrong,
  getReadableMutedColor,
  getReadableTextColor,
  isLightColor,
  mixColors,
} from '@/lib/colors/contrast'

// Import Mantine CSS
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
interface ProvidersProps {
  children: React.ReactNode
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
          styles: {
            root: {
              '&[data-variant="filled"]': {
                backgroundColor: 'var(--pitch-accent)',
                color: 'var(--mantine-color-white)',
              },
              '&[data-variant="filled"]:hover': {
                backgroundColor: 'var(--pitch-accent-strong)',
              },
            },
          },
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
    const navBg = activeProfile.tokens.navBg
    const navText = getReadableTextColor(navBg)
    const navTextDim = getReadableMutedColor(navBg)
    const surfaceBg = activeProfile.tokens.surfaceBg
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
    const appBg = mixColors(activeProfile.tokens.surfaceBg, activeProfile.tokens.accent, 0.2)
    document.documentElement.style.setProperty('--pitch-app-bg', appBg)
    const accentSoft = mixColors(activeProfile.tokens.surfaceBg, activeProfile.tokens.accent, 0.15)
    document.documentElement.style.setProperty('--pitch-accent', activeProfile.tokens.accent)
    document.documentElement.style.setProperty('--pitch-accent-strong', accentStrong)
    document.documentElement.style.setProperty('--pitch-accent-soft', accentSoft)
    document.documentElement.style.setProperty('--pitch-selected', activeProfile.tokens.selected)
    document.documentElement.style.setProperty('--pitch-success', activeProfile.tokens.success)
    document.documentElement.style.setProperty('--pitch-info', activeProfile.tokens.info)
    document.documentElement.style.setProperty(
      '--pitch-window-gradient',
      activeProfile.useGradient
        ? `linear-gradient(135deg, ${activeProfile.tokens.navBg}, ${activeProfile.tokens.selected})`
        : 'none'
    )
  }, [activeProfile, resolvedScheme])

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} forceColorScheme={resolvedScheme}>
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export { ColorSchemeScript }
