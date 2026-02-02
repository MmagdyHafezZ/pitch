'use client'

import { ThemeProfile } from '@/lib/theme'
import { useThemeStore } from '@/lib/stores/theme.store'

export type ThemeProfilesState = {
  profiles: ThemeProfile[]
  activeProfileId: string
  deleteProfile: (id: string) => void
  setActiveProfile: (id: string) => void
}

export const useThemeProfilesStore = useThemeStore
