'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ColorMode = 'light' | 'dark' | 'system'

export type ThemeTokens = {
  navBg: string
  surfaceBg: string
  accent: string
  selected: string
  success: string
  info: string
}

export type ThemeProfile = {
  id: string
  name: string
  isCustom: boolean
  tokens: ThemeTokens
  useGradient?: boolean
}

type AppearanceState = {
  colorMode: ColorMode
  activeProfileId: string
  profiles: ThemeProfile[]
  customDraft: ThemeTokens
  customDraftGradient: boolean
  setColorMode: (mode: ColorMode) => void
  setActiveProfile: (id: string) => void
  createProfileFromDraft: (name: string) => void
  deleteProfile: (id: string) => void
  updateCustomDraft: (partial: Partial<ThemeTokens>) => void
  setCustomDraftGradient: (value: boolean) => void
  randomizeCustomDraft: () => void
}

const DEFAULT_PROFILES: ThemeProfile[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    isCustom: false,
    tokens: {
      navBg: '#0f172a',
      surfaceBg: '#f1f3f5',
      accent: '#228be6',
      selected: '#4c6ef5',
      success: '#2f9e44',
      info: '#15aabf',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    isCustom: false,
    tokens: {
      navBg: '#2b1b17',
      surfaceBg: '#fff4e6',
      accent: '#f76707',
      selected: '#f03e3e',
      success: '#e8590c',
      info: '#fab005',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    isCustom: false,
    tokens: {
      navBg: '#14291f',
      surfaceBg: '#f3f6f4',
      accent: '#2f9e44',
      selected: '#37b24d',
      success: '#2b8a3e',
      info: '#1c7ed6',
    },
  },
]

const DEFAULT_PROFILE_IDS = new Set(DEFAULT_PROFILES.map((profile) => profile.id))

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `theme-${Date.now()}`
}

const randomInRange = (min: number, max: number) => min + Math.random() * (max - min)

const hslToHex = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
  } else if (h >= 120 && h < 180) {
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (value: number) => {
    const channel = Math.round((value + m) * 255)
    return channel.toString(16).padStart(2, '0')
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const randomThemeTokens = (): ThemeTokens => {
  const baseHue = randomInRange(0, 360)
  const accent = hslToHex(baseHue, randomInRange(0.55, 0.75), randomInRange(0.45, 0.55))
  const selected = hslToHex(
    (baseHue + randomInRange(10, 25)) % 360,
    randomInRange(0.55, 0.75),
    randomInRange(0.45, 0.6)
  )
  const success = hslToHex(randomInRange(110, 150), randomInRange(0.45, 0.7), 0.45)
  const info = hslToHex(randomInRange(180, 210), randomInRange(0.45, 0.7), 0.5)
  const navBg = hslToHex(baseHue, randomInRange(0.25, 0.35), 0.16)
  const surfaceBg = hslToHex(baseHue, 0.2, 0.96)

  return { navBg, surfaceBg, accent, selected, success, info }
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      colorMode: 'system',
      profiles: DEFAULT_PROFILES,
      activeProfileId: DEFAULT_PROFILES[0]?.id ?? 'ocean',
      customDraft: DEFAULT_PROFILES[0]?.tokens ?? randomThemeTokens(),
      customDraftGradient: false,
      setColorMode: (mode) => set({ colorMode: mode }),
      setActiveProfile: (id) => {
        const profile = get().profiles.find((item) => item.id === id)
        if (!profile) {
          return
        }
        set({
          activeProfileId: id,
          customDraft: profile.tokens,
          customDraftGradient: profile.useGradient ?? false,
        })
      },
      createProfileFromDraft: (name) => {
        const state = get()
        const id = createId()
        const trimmed = name.trim() || 'Custom theme'
        const newProfile: ThemeProfile = {
          id,
          name: trimmed,
          isCustom: true,
          tokens: state.customDraft,
          useGradient: state.customDraftGradient,
        }
        set({
          profiles: [...state.profiles, newProfile],
          activeProfileId: id,
        })
      },
      deleteProfile: (id) =>
        set((state) => {
          const target = state.profiles.find((profile) => profile.id === id)
          if (!target || !target.isCustom) {
            return state
          }
          const nextProfiles = state.profiles.filter((profile) => profile.id !== id)
          const fallback =
            nextProfiles.find((profile) => profile.isCustom !== true) ?? nextProfiles[0] ?? target
          return {
            profiles: nextProfiles,
            activeProfileId: state.activeProfileId === id ? fallback.id : state.activeProfileId,
          }
        }),
      updateCustomDraft: (partial) =>
        set((state) => ({ customDraft: { ...state.customDraft, ...partial } })),
      setCustomDraftGradient: (value) => set({ customDraftGradient: value }),
      randomizeCustomDraft: () =>
        set({
          customDraft: randomThemeTokens(),
          customDraftGradient: Math.random() > 0.5,
        }),
    }),
    {
      name: 'pitch-appearance',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        colorMode: state.colorMode,
        activeProfileId: state.activeProfileId,
        profiles: state.profiles,
        customDraft: state.customDraft,
        customDraftGradient: state.customDraftGradient,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }
        const nextProfiles = state.profiles?.length ? state.profiles : DEFAULT_PROFILES
        const nextActive =
          nextProfiles.find((profile) => profile.id === state.activeProfileId)?.id ??
          nextProfiles[0]?.id ??
          DEFAULT_PROFILES[0]?.id ??
          'ocean'
        const activeProfile =
          nextProfiles.find((profile) => profile.id === nextActive) ?? DEFAULT_PROFILES[0]

        state.profiles = nextProfiles
        state.activeProfileId = nextActive
        if (!state.customDraft) {
          state.customDraft = activeProfile.tokens
        }
        if (state.customDraftGradient === undefined) {
          state.customDraftGradient = activeProfile.useGradient ?? false
        }
      },
    }
  )
)

export const isDefaultProfileId = (id: string) => DEFAULT_PROFILE_IDS.has(id)
