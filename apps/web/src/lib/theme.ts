'use client'

import { createTheme } from '@mantine/core'
import { generateColors } from '@mantine/colors-generator'

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  neutral: string
  dark: string
}

export interface ThemeProfile {
  id: string
  name: string
  description?: string
  isCustom: boolean
  colors: ThemeColors
}

export const DEFAULT_THEME_PROFILES: ThemeProfile[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool blues with a deep navy base.',
    isCustom: false,
    colors: {
      primary: '#228be6',
      secondary: '#4c6ef5',
      accent: '#15aabf',
      neutral: '#f1f3f5',
      dark: '#0f172a',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm oranges and reds with a cozy dark.',
    isCustom: false,
    colors: {
      primary: '#f76707',
      secondary: '#f03e3e',
      accent: '#f59f00',
      neutral: '#fff4e6',
      dark: '#2b1b17',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Earthy greens with balanced neutrals.',
    isCustom: false,
    colors: {
      primary: '#2f9e44',
      secondary: '#37b24d',
      accent: '#1c7ed6',
      neutral: '#f3f6f4',
      dark: '#14291f',
    },
  },
]

export const DEFAULT_PROFILE_IDS = new Set(DEFAULT_THEME_PROFILES.map((profile) => profile.id))

export const isDefaultProfileId = (id: string) => DEFAULT_PROFILE_IDS.has(id)

const baseTheme = createTheme({
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
      vars: (_theme, props) => ({
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

export const buildMantineTheme = (profile: ThemeProfile) =>
  createTheme({
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      brand: generateColors(profile.colors.primary),
      secondary: generateColors(profile.colors.secondary),
      accent: generateColors(profile.colors.accent),
      neutral: generateColors(profile.colors.neutral),
      dark: generateColors(profile.colors.dark),
      gray: generateColors(profile.colors.neutral),
    },
    primaryColor: 'brand',
  })
