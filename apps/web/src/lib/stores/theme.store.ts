'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_THEME_PROFILES, ThemeColors, ThemeProfile, isDefaultProfileId } from '@/lib/theme'

export type ColorMode = 'light' | 'dark' | 'system'

interface ThemeStore {
  colorMode: ColorMode
  profiles: ThemeProfile[]
  activeProfileId: string
  setColorMode: (mode: ColorMode) => void
  setActiveProfileId: (id: string) => void
  setActiveProfile: (id: string) => void
  updateProfile: (id: string, updates: { name?: string; colors?: Partial<ThemeColors> }) => void
  createProfile: (profile: { name: string; colors: ThemeColors }) => void
  deleteProfile: (id: string) => void
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `theme-${Date.now()}`
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      colorMode: 'system',
      profiles: DEFAULT_THEME_PROFILES,
      activeProfileId: DEFAULT_THEME_PROFILES[0]?.id ?? 'default',
      setColorMode: (mode) => set({ colorMode: mode }),
      setActiveProfileId: (id) => set({ activeProfileId: id }),
      setActiveProfile: (id) => set({ activeProfileId: id }),
      updateProfile: (id, updates) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id
              ? {
                  ...profile,
                  name: updates.name ?? profile.name,
                  colors: { ...profile.colors, ...(updates.colors ?? {}) },
                }
              : profile
          ),
        })),
      createProfile: (profile) =>
        set((state) => {
          const id = createId()
          return {
            profiles: [...state.profiles, { id, isCustom: true, ...profile }],
            activeProfileId: id,
          }
        }),
      deleteProfile: (id) =>
        set((state) => {
          const target = state.profiles.find((profile) => profile.id === id)
          const isDeletable = target && (target.isCustom === true || !isDefaultProfileId(target.id))
          if (!target || !isDeletable) {
            return state
          }

          const nextProfiles = state.profiles.filter((profile) => profile.id !== id)
          const fallback =
            nextProfiles.find((profile) => profile.isCustom !== true) ?? nextProfiles[0] ?? target
          const nextActive = state.activeProfileId === id ? fallback.id : state.activeProfileId

          return {
            profiles: nextProfiles,
            activeProfileId: nextActive,
          }
        }),
    }),
    {
      name: 'pitch-theme',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
