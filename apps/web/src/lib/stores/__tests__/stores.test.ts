import { act } from '@testing-library/react'
import { useAppearanceStore, isDefaultProfileId } from '../appearance.store'
import { useThemeStore } from '../theme.store'
import { useThemeProfilesStore } from '../themeProfiles.store'

describe('AppearanceStore', () => {
  beforeEach(() => {
    act(() => {
      useAppearanceStore.setState({
        colorMode: 'system',
        activeProfileId: 'ocean',
        profiles: useAppearanceStore.getState().profiles.filter((p) => !p.isCustom),
        customDraft: useAppearanceStore.getState().profiles[0]?.tokens,
        customDraftGradient: false,
      })
    })
  })

  describe('initial state', () => {
    it('has system as default color mode', () => {
      expect(useAppearanceStore.getState().colorMode).toBe('system')
    })

    it('has default profiles', () => {
      const profiles = useAppearanceStore.getState().profiles
      expect(profiles.length).toBeGreaterThanOrEqual(8)
      expect(profiles.some((p) => p.id === 'ocean')).toBe(true)
      expect(profiles.some((p) => p.id === 'sunset')).toBe(true)
      expect(profiles.some((p) => p.id === 'forest')).toBe(true)
    })

    it('ocean is the default active profile', () => {
      expect(useAppearanceStore.getState().activeProfileId).toBe('ocean')
    })
  })

  describe('setColorMode', () => {
    it('updates color mode to light', () => {
      act(() => useAppearanceStore.getState().setColorMode('light'))
      expect(useAppearanceStore.getState().colorMode).toBe('light')
    })

    it('updates color mode to dark', () => {
      act(() => useAppearanceStore.getState().setColorMode('dark'))
      expect(useAppearanceStore.getState().colorMode).toBe('dark')
    })
  })

  describe('setActiveProfile', () => {
    it('sets active profile and updates draft', () => {
      act(() => useAppearanceStore.getState().setActiveProfile('sunset'))
      const state = useAppearanceStore.getState()
      expect(state.activeProfileId).toBe('sunset')
      expect(state.customDraft.accent).toBe('#f76707')
    })

    it('does nothing for non-existent profile', () => {
      const before = useAppearanceStore.getState().activeProfileId
      act(() => useAppearanceStore.getState().setActiveProfile('nonexistent'))
      expect(useAppearanceStore.getState().activeProfileId).toBe(before)
    })
  })

  describe('createProfileFromDraft', () => {
    it('creates a custom profile from the current draft', () => {
      act(() => {
        useAppearanceStore.getState().updateCustomDraft({ accent: '#ff0000' })
        useAppearanceStore.getState().createProfileFromDraft('My Theme')
      })

      const state = useAppearanceStore.getState()
      const custom = state.profiles.find((p) => p.name === 'My Theme')
      expect(custom).toBeDefined()
      expect(custom!.isCustom).toBe(true)
      expect(custom!.tokens.accent).toBe('#ff0000')
      expect(state.activeProfileId).toBe(custom!.id)
    })

    it('uses default name for empty string', () => {
      act(() => useAppearanceStore.getState().createProfileFromDraft('  '))

      const state = useAppearanceStore.getState()
      const custom = state.profiles.find((p) => p.name === 'Custom theme')
      expect(custom).toBeDefined()
    })
  })

  describe('deleteProfile', () => {
    it('deletes custom profiles', () => {
      act(() => useAppearanceStore.getState().createProfileFromDraft('To Delete'))
      const newId = useAppearanceStore.getState().activeProfileId

      act(() => useAppearanceStore.getState().deleteProfile(newId))
      expect(useAppearanceStore.getState().profiles.find((p) => p.id === newId)).toBeUndefined()
    })

    it('does not delete default profiles', () => {
      const before = useAppearanceStore.getState().profiles.length
      act(() => useAppearanceStore.getState().deleteProfile('ocean'))
      expect(useAppearanceStore.getState().profiles.length).toBe(before)
    })

    it('falls back to a non-custom profile when deleting active custom profile', () => {
      act(() => useAppearanceStore.getState().createProfileFromDraft('Active Custom'))
      const customId = useAppearanceStore.getState().activeProfileId
      expect(customId).not.toBe('ocean')

      act(() => useAppearanceStore.getState().deleteProfile(customId))
      const state = useAppearanceStore.getState()
      expect(state.activeProfileId).not.toBe(customId)
      const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId)
      expect(activeProfile).toBeDefined()
    })

    it('does not change activeProfileId when deleting a non-active profile', () => {
      act(() => useAppearanceStore.getState().createProfileFromDraft('Other'))
      const otherId = useAppearanceStore.getState().activeProfileId

      act(() => useAppearanceStore.getState().setActiveProfile('ocean'))
      act(() => useAppearanceStore.getState().deleteProfile(otherId))

      expect(useAppearanceStore.getState().activeProfileId).toBe('ocean')
    })
  })

  describe('updateCustomDraft', () => {
    it('partially updates the draft', () => {
      act(() => useAppearanceStore.getState().updateCustomDraft({ accent: '#abcdef' }))
      expect(useAppearanceStore.getState().customDraft.accent).toBe('#abcdef')
    })
  })

  describe('setCustomDraftGradient', () => {
    it('sets gradient flag', () => {
      act(() => useAppearanceStore.getState().setCustomDraftGradient(true))
      expect(useAppearanceStore.getState().customDraftGradient).toBe(true)
    })
  })

  describe('randomizeCustomDraft', () => {
    it('produces new theme tokens', () => {
      const before = useAppearanceStore.getState().customDraft
      act(() => useAppearanceStore.getState().randomizeCustomDraft())
      const after = useAppearanceStore.getState().customDraft
      expect(after.navBg).toBeDefined()
      expect(after.surfaceBg).toBeDefined()
      expect(after.accent).toBeDefined()
      expect(typeof useAppearanceStore.getState().customDraftGradient).toBe('boolean')
    })
  })
})

describe('isDefaultProfileId', () => {
  it('returns true for default profile ids', () => {
    expect(isDefaultProfileId('ocean')).toBe(true)
    expect(isDefaultProfileId('sunset')).toBe(true)
    expect(isDefaultProfileId('forest')).toBe(true)
  })

  it('returns false for custom ids', () => {
    expect(isDefaultProfileId('custom-123')).toBe(false)
    expect(isDefaultProfileId('')).toBe(false)
  })
})

describe('ThemeStore', () => {
  beforeEach(() => {
    act(() => {
      useThemeStore.setState({
        colorMode: 'system',
        profiles: useThemeStore.getState().profiles,
        activeProfileId: useThemeStore.getState().profiles[0]?.id ?? 'ocean',
      })
    })
  })

  describe('initial state', () => {
    it('has system as default color mode', () => {
      expect(useThemeStore.getState().colorMode).toBe('system')
    })

    it('has default profiles', () => {
      expect(useThemeStore.getState().profiles.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('setColorMode', () => {
    it('updates color mode', () => {
      act(() => useThemeStore.getState().setColorMode('dark'))
      expect(useThemeStore.getState().colorMode).toBe('dark')
    })
  })

  describe('setActiveProfileId / setActiveProfile', () => {
    it('setActiveProfileId updates the id', () => {
      act(() => useThemeStore.getState().setActiveProfileId('sunset'))
      expect(useThemeStore.getState().activeProfileId).toBe('sunset')
    })

    it('setActiveProfile updates the id', () => {
      act(() => useThemeStore.getState().setActiveProfile('forest'))
      expect(useThemeStore.getState().activeProfileId).toBe('forest')
    })
  })

  describe('updateProfile', () => {
    it('updates profile name', () => {
      act(() => useThemeStore.getState().updateProfile('ocean', { name: 'Deep Ocean' }))
      const p = useThemeStore.getState().profiles.find((p) => p.id === 'ocean')
      expect(p?.name).toBe('Deep Ocean')
    })

    it('partially updates profile colors', () => {
      act(() => useThemeStore.getState().updateProfile('ocean', { colors: { primary: '#ff0000' } }))
      const p = useThemeStore.getState().profiles.find((p) => p.id === 'ocean')
      expect(p?.colors.primary).toBe('#ff0000')
      expect(p?.colors.secondary).toBeDefined()
    })
  })

  describe('createProfile', () => {
    it('creates a new custom profile and makes it active', () => {
      act(() => {
        useThemeStore.getState().createProfile({
          name: 'Custom',
          colors: {
            primary: '#111',
            secondary: '#222',
            accent: '#333',
            neutral: '#444',
            dark: '#555',
          },
        })
      })

      const state = useThemeStore.getState()
      const custom = state.profiles.find((p) => p.name === 'Custom')
      expect(custom).toBeDefined()
      expect(custom!.isCustom).toBe(true)
      expect(state.activeProfileId).toBe(custom!.id)
    })
  })

  describe('deleteProfile', () => {
    it('deletes a custom profile', () => {
      act(() => {
        useThemeStore.getState().createProfile({
          name: 'Temp',
          colors: {
            primary: '#111',
            secondary: '#222',
            accent: '#333',
            neutral: '#444',
            dark: '#555',
          },
        })
      })
      const tempId = useThemeStore.getState().activeProfileId

      act(() => useThemeStore.getState().deleteProfile(tempId))
      expect(useThemeStore.getState().profiles.find((p) => p.id === tempId)).toBeUndefined()
    })

    it('does not delete default profiles', () => {
      const before = useThemeStore.getState().profiles.length
      act(() => useThemeStore.getState().deleteProfile('ocean'))
      expect(useThemeStore.getState().profiles.length).toBe(before)
    })

    it('falls back active profile when deleting active custom', () => {
      act(() => {
        useThemeStore.getState().createProfile({
          name: 'Active',
          colors: {
            primary: '#111',
            secondary: '#222',
            accent: '#333',
            neutral: '#444',
            dark: '#555',
          },
        })
      })
      const activeId = useThemeStore.getState().activeProfileId

      act(() => useThemeStore.getState().deleteProfile(activeId))
      expect(useThemeStore.getState().activeProfileId).not.toBe(activeId)
    })
  })
})

describe('ThemeProfilesStore', () => {
  it('is the same store as useThemeStore', () => {
    expect(useThemeProfilesStore).toBe(useThemeStore)
  })
})
