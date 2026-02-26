'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Box,
  Group,
  Stack,
  Text,
  TextInput,
  Select,
  Button,
  Avatar,
  ActionIcon,
  Tooltip,
  rem,
  Card,
  SimpleGrid,
  Divider,
  ScrollArea,
  Tabs,
  Checkbox,
  Popover,
  ColorPicker,
  Badge,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconUser,
  IconBell,
  IconMicrophone,
  IconPalette,
  IconWorld,
  IconBrowser,
  IconPlugConnected,
  IconUpload,
  IconX,
  IconTrash,
  IconPencil,
  IconShare2,
  IconDownload,
  IconSparkles,
} from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { useAuth } from '@/features/auth'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getCachedAvatarForUser, setCachedAvatarForUser } from '@/features/auth/utils/avatar-cache'
import { useCrm } from '@/features/crm'
import {
  getSavedCrmSessionConnections,
  removeSavedCrmSessionConnection,
  renameSavedCrmSessionConnection,
  type UserSettingsWithCrmPrefs,
} from '@/features/crm/utils/session-crm-preferences'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import { useAppearanceStore } from '@/lib/stores/appearance.store'
import type { ThemeProfile, ThemeTokens } from '@/lib/stores/appearance.store'
import { getReadableMutedColor, getReadableTextColor, mixColors } from '@/lib/colors/contrast'
import classes from './SettingsModal.module.css'
import inputClasses from './settingsInputs.module.css'

type SettingsSection =
  | 'Account'
  | 'Notifications'
  | 'Voice & Video'
  | 'Appearance'
  | 'Language'
  | 'Browser'
  | 'CRM'

type UserSettingsPayload = {
  account?: {
    timezone?: string
  }
  notifications?: {
    emailNotifications?: boolean
    desktopNotifications?: boolean
    productUpdates?: boolean
  }
  voiceVideo?: {
    preferredMicrophone?: string
    preferredSpeaker?: string
    noiseSuppression?: boolean
    echoCancellation?: boolean
    autoJoinMuted?: boolean
  }
  appearance?: {
    colorMode?: 'light' | 'dark' | 'system'
    activeProfileId?: string
    profiles?: ThemeProfile[]
    customDraft?: ThemeTokens
    customDraftGradient?: boolean
  }
  language?: {
    locale?: string
  }
  browser?: {
    openLinksInNewTab?: boolean
    compactMode?: boolean
    reduceMotion?: boolean
  }
  crm?: {
    name?: string | null
    provider?: string | null
    connected?: boolean
    providerEmail?: string | null
    lastSyncAt?: string | null
    autoSync?: boolean
    sessionDefaults?: {
      savedConnections?: unknown[]
    }
  }
}

type SavedCrmConnection = {
  id: string
  name: string
  provider: string
  providerEmail?: string | null
  connected?: boolean
  lastSyncAt?: string | null
  autoSync?: boolean
  savedAt: string
}

type CrmSessionDefaults = NonNullable<UserSettingsPayload['crm']>['sessionDefaults']

const formatCrmConnectionName = (provider: string, providerEmail?: string | null) => {
  const providerLabel = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'CRM'
  return providerEmail ? `${providerLabel} (${providerEmail})` : providerLabel
}

const TIMEZONE_OPTIONS = [
  '(GMT-5:00) Eastern Time',
  '(GMT-6:00) Central Time',
  '(GMT-7:00) Mountain Time',
  '(GMT-8:00) Pacific Time',
]

const LANGUAGE_OPTIONS = ['English (US)', 'English (UK)', 'French', 'Spanish', 'German']

interface SettingsModalProps {
  opened: boolean
  onClose: () => void
}

const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024
const AVATAR_TARGET_SIZE = 512

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the selected image file.'))
    }
    img.src = url
  })

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress image in browser.'))
          return
        }
        resolve(blob)
      },
      type,
      quality
    )
  })

const drawCenteredSquareAvatar = (
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  size: number
) => {
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is not available for image processing.')
  }

  const sourceSize = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = Math.max(0, (img.naturalWidth - sourceSize) / 2)
  const sy = Math.max(0, (img.naturalHeight - sourceSize) / 2)

  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size)
}

const withExtension = (name: string, ext: string) => {
  const base = name.replace(/\.[^/.]+$/, '')
  return `${base}.${ext}`
}

const preprocessAvatarFile = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.')
  }

  const img = await loadImageFromFile(file)
  const canvas = document.createElement('canvas')
  const dimensionCandidates = [AVATAR_TARGET_SIZE, 384, 256]
  const qualityCandidates = [0.9, 0.82, 0.72, 0.6]
  let bestBlob: Blob | null = null
  let bestMime = 'image/webp'

  for (const size of dimensionCandidates) {
    drawCenteredSquareAvatar(img, canvas, size)

    for (const quality of qualityCandidates) {
      for (const mime of ['image/webp', 'image/jpeg']) {
        try {
          const blob = await canvasToBlob(canvas, mime, quality)
          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob
            bestMime = mime
          }
          if (blob.size <= MAX_AVATAR_UPLOAD_BYTES) {
            const ext = mime === 'image/webp' ? 'webp' : 'jpg'
            return new File([blob], withExtension(file.name, ext), {
              type: mime,
              lastModified: Date.now(),
            })
          }
        } catch {
          // Try fallback format/quality.
        }
      }
    }
  }

  if (bestBlob && bestBlob.size <= MAX_AVATAR_UPLOAD_BYTES) {
    const ext = bestMime === 'image/webp' ? 'webp' : 'jpg'
    return new File([bestBlob], withExtension(file.name, ext), {
      type: bestMime,
      lastModified: Date.now(),
    })
  }

  throw new Error(
    'Image is still too large after resizing/compression. Please choose a smaller image.'
  )
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { user, logout, deleteAccount } = useAuth()
  const [activeSection, setActiveSection] = useState<SettingsSection>('Account')
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatarSrc, setAvatarSrc] = useState<string | null>(user?.avatar ?? null)
  const [timezone, setTimezone] = useState('(GMT-5:00) Eastern Time')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [desktopNotifications, setDesktopNotifications] = useState(true)
  const [productUpdates, setProductUpdates] = useState(false)
  const [preferredMicrophone, setPreferredMicrophone] = useState('System default')
  const [preferredSpeaker, setPreferredSpeaker] = useState('System default')
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [autoJoinMuted, setAutoJoinMuted] = useState(false)
  const [language, setLanguage] = useState('English (US)')
  const [openLinksInNewTab, setOpenLinksInNewTab] = useState(true)
  const [compactMode, setCompactMode] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [crmAutoSync, setCrmAutoSync] = useState(true)
  const [crmProvider, setCrmProvider] = useState<string | null>('salesforce')
  const [crmConnections, setCrmConnections] = useState<SavedCrmConnection[]>([])
  const [crmConnectionName, setCrmConnectionName] = useState('')
  const [crmSessionDefaults, setCrmSessionDefaults] = useState<CrmSessionDefaults>(undefined)
  const [crmPresetNameDrafts, setCrmPresetNameDrafts] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    colorMode,
    setColorMode,
    profiles,
    activeProfileId,
    setActiveProfile,
    deleteProfile,
    customDraft,
    updateCustomDraft,
    randomizeCustomDraft,
    createProfileFromDraft,
    customDraftGradient,
    setCustomDraftGradient,
  } = useAppearanceStore()
  const {
    status: crmStatus,
    loadingStatus: crmStatusLoading,
    error: crmError,
    fetchStatus: fetchCrmStatus,
    connect: connectCrm,
  } = useCrm()

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [profiles, activeProfileId]
  )

  const appearanceBackground = activeProfile?.tokens.surfaceBg ?? 'var(--mantine-color-body)'
  const navBackground = activeProfile?.tokens.navBg ?? 'var(--mantine-color-dark-8)'
  const navText = useMemo(() => getReadableTextColor(navBackground), [navBackground])
  const tabsHoverBg = useMemo(
    () => mixColors(appearanceBackground, activeProfile?.tokens.accent ?? '#228be6', 0.12),
    [appearanceBackground, activeProfile?.tokens.accent]
  )
  const tabsHoverText = useMemo(() => getReadableTextColor(tabsHoverBg), [tabsHoverBg])
  const tabsActiveBg = useMemo(
    () => mixColors(appearanceBackground, activeProfile?.tokens.accent ?? '#228be6', 0.2),
    [appearanceBackground, activeProfile?.tokens.accent]
  )
  const tabsActiveText = useMemo(() => getReadableTextColor(tabsActiveBg), [tabsActiveBg])

  const settingsInputClassNames = {
    label: inputClasses.label,
    input: inputClasses.input,
    section: inputClasses.section,
    rightSection: inputClasses.rightSection,
  } as const

  const contentBackground = appearanceBackground

  const [profileName, setProfileName] = useState(activeProfile?.name ?? 'Custom theme')
  const [activeTab, setActiveTab] = useState<'profiles' | 'custom'>('profiles')
  const [activePicker, setActivePicker] = useState<keyof ThemeTokens | null>(null)
  const [draggingPicker, setDraggingPicker] = useState(false)

  useEffect(() => {
    if (activeProfile) {
      setProfileName(activeProfile.name)
    }
  }, [activeProfile])

  useEffect(() => {
    const handlePointerUp = () => setDraggingPicker(false)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [])

  const customRows: { key: keyof ThemeTokens; label: string; helper?: string }[] = [
    { key: 'navBg', label: 'System navigation' },
    { key: 'selected', label: 'Selected items' },
    { key: 'success', label: 'Presence indication' },
    { key: 'info', label: 'Notifications' },
    { key: 'surfaceBg', label: 'Surfaces' },
    { key: 'accent', label: 'Accent' },
  ]

  const sections: { icon: typeof IconUser; label: SettingsSection }[] = [
    { icon: IconUser, label: 'Account' },
    { icon: IconBell, label: 'Notifications' },
    { icon: IconMicrophone, label: 'Voice & Video' },
    { icon: IconPalette, label: 'Appearance' },
    { icon: IconWorld, label: 'Language' },
    { icon: IconBrowser, label: 'Browser' },
    { icon: IconPlugConnected, label: 'CRM' },
  ]

  const handleLogout = async () => {
    await logout()
    onClose()
    router.push('/')
  }

  const handleSave = async () => {
    if (!user?.id) {
      notifications.show({
        title: 'Unable to save',
        message: 'You must be signed in to save settings.',
        color: 'red',
      })
      return
    }

    const settingsPayload: UserSettingsPayload = {
      account: { timezone },
      notifications: {
        emailNotifications,
        desktopNotifications,
        productUpdates,
      },
      voiceVideo: {
        preferredMicrophone,
        preferredSpeaker,
        noiseSuppression,
        echoCancellation,
        autoJoinMuted,
      },
      appearance: {
        colorMode,
        activeProfileId,
        profiles,
        customDraft,
        customDraftGradient,
      },
      language: {
        locale: language,
      },
      browser: {
        openLinksInNewTab,
        compactMode,
        reduceMotion,
      },
      crm: {
        name: crmConnections[0]?.name ?? (crmConnectionName.trim() || null),
        provider: crmProvider,
        connected: crmStatus?.connected ?? false,
        providerEmail: crmStatus?.providerEmail ?? null,
        lastSyncAt: crmStatus?.lastSyncAt ?? null,
        autoSync: crmAutoSync,
        sessionDefaults: crmSessionDefaults,
      },
    }

    setIsSaving(true)
    try {
      await api.users.update(user.id, {
        name: name.trim() || user.name,
        email: email.trim() || user.email,
      })
      await api.users.updateMySettings(settingsPayload)

      const authStore = useAuthStore.getState()
      if (authStore.user) {
        authStore.setUser({
          ...authStore.user,
          name: name.trim() || authStore.user.name,
          email: email.trim() || authStore.user.email,
          avatar: avatarSrc ?? authStore.user.avatar ?? null,
        })
      }

      notifications.show({
        title: 'Settings saved',
        message: 'Your profile and preferences were saved to your account.',
        color: 'green',
      })
      onClose()
    } catch (error) {
      notifications.show({
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to save settings.',
        color: 'red',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConnectCrm = async () => {
    try {
      const response = await connectCrm()
      if (response?.authUrl) {
        window.open(response.authUrl, '_blank', 'noopener,noreferrer')
      }
    } catch {
      // errors are already stored in CRM store and shown in UI below
    }
  }

  const openConfirmDelete = (id: string, name: string) => {
    modals.openConfirmModal({
      title: 'Delete theme',
      children: `Delete theme "${name}"? This cannot be undone.`,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteProfile(id),
    })
  }

  const openDeleteAccountConfirm = () => {
    modals.openConfirmModal({
      title: 'Delete account',
      children:
        'Delete your account permanently? This action cannot be undone and will remove your access.',
      labels: { confirm: 'Delete account', cancel: 'Cancel' },
      confirmProps: { color: 'red', loading: isDeletingAccount },
      onConfirm: async () => {
        try {
          setIsDeletingAccount(true)
          await deleteAccount()
          notifications.show({
            title: 'Account deleted',
            message: 'Your account was deleted successfully.',
            color: 'green',
          })
          onClose()
        } catch (error) {
          notifications.show({
            title: 'Delete failed',
            message: error instanceof Error ? error.message : 'Failed to delete account.',
            color: 'red',
          })
        } finally {
          setIsDeletingAccount(false)
        }
      },
    })
  }

  useEffect(() => {
    if (!opened) {
      return
    }

    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setAvatarSrc(user?.avatar ?? getCachedAvatarForUser(user?.id) ?? null)
  }, [opened, user?.avatar, user?.email, user?.id, user?.name])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    if (user.avatar) {
      setCachedAvatarForUser(user.id, user.avatar)
      setAvatarSrc((current) => current ?? user.avatar ?? null)
      return
    }

    const cached = getCachedAvatarForUser(user.id)
    if (cached) {
      setAvatarSrc((current) => current ?? cached)
    }
  }, [user?.avatar, user?.id])

  const updateCachedAvatarState = (nextAvatar: string | null) => {
    if (user?.id) {
      setCachedAvatarForUser(user.id, nextAvatar)
    }
    setAvatarSrc(nextAvatar)
    const authStore = useAuthStore.getState()
    if (authStore.user && user?.id && authStore.user.id === user.id) {
      authStore.setUser({
        ...authStore.user,
        avatar: nextAvatar,
      })
    }
  }

  const handleAvatarFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || !user?.id) {
      return
    }

    setIsUploadingAvatar(true)
    try {
      const processedFile = await preprocessAvatarFile(file)
      const response = await api.users.updateMyAvatar({ file: processedFile })
      const nextAvatar =
        typeof response?.avatar === 'string'
          ? response.avatar
          : typeof response?.user?.avatar === 'string'
            ? response.user.avatar
            : null

      if (!nextAvatar) {
        throw new Error('Avatar upload succeeded but no avatar URL was returned.')
      }

      updateCachedAvatarState(nextAvatar)
      notifications.show({
        title: 'Profile picture updated',
        message:
          processedFile.size < file.size
            ? 'Your image was resized/compressed and saved as your profile picture.'
            : 'Your new profile picture has been saved.',
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload profile picture.',
        color: 'red',
      })
    } finally {
      setIsUploadingAvatar(false)
      try {
        input.value = ''
      } catch {
        // Input may be detached if the modal closed during upload.
      }
    }
  }

  useEffect(() => {
    if (!opened || !user?.id) {
      return
    }

    let cancelled = false

    const loadSettings = async () => {
      setIsLoadingSettings(true)
      try {
        const settings = (await api.users.getMySettings()) as UserSettingsPayload
        if (cancelled || !settings) return

        if (settings.account?.timezone) setTimezone(settings.account.timezone)

        if (settings.notifications) {
          setEmailNotifications(settings.notifications.emailNotifications ?? true)
          setDesktopNotifications(settings.notifications.desktopNotifications ?? true)
          setProductUpdates(settings.notifications.productUpdates ?? false)
        }

        if (settings.voiceVideo) {
          setPreferredMicrophone(settings.voiceVideo.preferredMicrophone ?? 'System default')
          setPreferredSpeaker(settings.voiceVideo.preferredSpeaker ?? 'System default')
          setNoiseSuppression(settings.voiceVideo.noiseSuppression ?? true)
          setEchoCancellation(settings.voiceVideo.echoCancellation ?? true)
          setAutoJoinMuted(settings.voiceVideo.autoJoinMuted ?? false)
        }

        if (settings.language?.locale) setLanguage(settings.language.locale)

        if (settings.browser) {
          setOpenLinksInNewTab(settings.browser.openLinksInNewTab ?? true)
          setCompactMode(settings.browser.compactMode ?? false)
          setReduceMotion(settings.browser.reduceMotion ?? false)
        }

        if (settings.crm) {
          setCrmProvider(settings.crm.provider ?? 'salesforce')
          setCrmAutoSync(settings.crm.autoSync ?? true)
          setCrmConnectionName(settings.crm.name ?? '')
          if (settings.crm.provider) {
            setCrmConnections([
              {
                id: `${settings.crm.provider}:${settings.crm.providerEmail ?? 'default'}`,
                name:
                  settings.crm.name?.trim() ||
                  formatCrmConnectionName(settings.crm.provider, settings.crm.providerEmail),
                provider: settings.crm.provider,
                providerEmail: settings.crm.providerEmail ?? null,
                connected: settings.crm.connected ?? false,
                lastSyncAt: settings.crm.lastSyncAt ?? null,
                autoSync: settings.crm.autoSync ?? true,
                savedAt: new Date().toISOString(),
              },
            ])
          } else {
            setCrmConnections([])
            setCrmConnectionName('')
          }
          setCrmSessionDefaults(settings.crm.sessionDefaults)
          const savedConnections = getSavedCrmSessionConnections(
            settings as UserSettingsWithCrmPrefs
          )
          setCrmPresetNameDrafts(
            Object.fromEntries(savedConnections.map((preset) => [preset.id, preset.label]))
          )
        }
        if (!settings.crm) {
          setCrmConnections([])
          setCrmConnectionName('')
        }

        const appearance = settings.appearance
        if (appearance && !cancelled) {
          useAppearanceStore.setState((state) => {
            const nextProfiles =
              Array.isArray(appearance.profiles) && appearance.profiles.length > 0
                ? (appearance.profiles as ThemeProfile[])
                : state.profiles
            const nextActiveProfileId =
              appearance.activeProfileId &&
              nextProfiles.some((profile) => profile.id === appearance.activeProfileId)
                ? appearance.activeProfileId
                : state.activeProfileId

            return {
              colorMode: appearance.colorMode ?? state.colorMode,
              profiles: nextProfiles,
              activeProfileId: nextActiveProfileId,
              customDraft: appearance.customDraft ?? state.customDraft,
              customDraftGradient: appearance.customDraftGradient ?? state.customDraftGradient,
            }
          })
        }
      } catch {
        // Missing settings is a valid first-run state; do not block modal.
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [opened, user?.id])

  const savedCrmPresets = useMemo(
    () =>
      getSavedCrmSessionConnections({
        crm: {
          sessionDefaults: crmSessionDefaults,
        },
      } as UserSettingsWithCrmPrefs),
    [crmSessionDefaults]
  )

  const updateCrmSessionDefaultsFromSettings = (nextSettings: UserSettingsWithCrmPrefs) => {
    setCrmSessionDefaults(nextSettings.crm?.sessionDefaults)
    const nextPresets = getSavedCrmSessionConnections(nextSettings)
    setCrmPresetNameDrafts(
      Object.fromEntries(nextPresets.map((preset) => [preset.id, preset.label]))
    )
  }

  const handleRenameCrmPresetDraft = (presetId: string, label: string) => {
    setCrmPresetNameDrafts((current) => ({
      ...current,
      [presetId]: label,
    }))
  }

  const handleApplyCrmPresetRename = (presetId: string) => {
    const nextSettings = renameSavedCrmSessionConnection(
      {
        crm: {
          sessionDefaults: crmSessionDefaults,
        },
      } as UserSettingsWithCrmPrefs,
      presetId,
      crmPresetNameDrafts[presetId] ?? ''
    )

    updateCrmSessionDefaultsFromSettings(nextSettings)
  }

  const handleRemoveCrmPreset = (presetId: string) => {
    const nextSettings = removeSavedCrmSessionConnection(
      {
        crm: {
          sessionDefaults: crmSessionDefaults,
        },
      } as UserSettingsWithCrmPrefs,
      presetId
    )

    updateCrmSessionDefaultsFromSettings(nextSettings)
  }

  const handleSaveCurrentCrmConnection = () => {
    if (!crmProvider) {
      notifications.show({
        title: 'No CRM provider selected',
        message: 'Choose a CRM provider before saving a CRM connection.',
        color: 'red',
      })
      return
    }

    const providerEmail = crmStatus?.providerEmail ?? null
    const nextConnection: SavedCrmConnection = {
      id:
        globalThis.crypto?.randomUUID?.() ??
        `${crmProvider}:${providerEmail ?? 'default'}:${Date.now()}`,
      name: crmConnectionName.trim() || formatCrmConnectionName(crmProvider, providerEmail),
      provider: crmProvider,
      providerEmail,
      connected: crmStatus?.connected ?? false,
      lastSyncAt: crmStatus?.lastSyncAt ?? null,
      autoSync: crmAutoSync,
      savedAt: new Date().toISOString(),
    }

    setCrmConnections([nextConnection])
    setCrmConnectionName('')
    notifications.show({
      title: 'CRM connection saved',
      message: 'This CRM connection is now saved in your account settings.',
      color: 'green',
    })
  }

  const handleRenameCrmConnection = (id: string, name: string) => {
    setCrmConnections((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, name } : entry))
    )
  }

  const handleRemoveCrmConnection = (id: string) => {
    setCrmConnections((current) => current.filter((entry) => entry.id !== id))
  }

  useEffect(() => {
    if (!opened || activeSection !== 'CRM') {
      return
    }
    void fetchCrmStatus()
  }, [opened, activeSection, fetchCrmStatus])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="800px"
      padding={0}
      withCloseButton={false}
      styles={{
        body: { padding: 0, height: 'min(80vh, 720px)' },
        content: { borderRadius: rem(12), overflow: 'hidden', backgroundColor: contentBackground },
      }}
    >
      <Group align="stretch" gap={0} wrap="nowrap" style={{ height: '100%', minHeight: 0 }}>
        {/* Left Sidebar */}
        <Box
          style={{
            width: 280,
            backgroundColor: navBackground,
            padding: rem(24),
            position: 'relative',
          }}
        >
          <ActionIcon
            variant="subtle"
            color="white"
            size="lg"
            onClick={onClose}
            style={{ position: 'absolute', top: 16, left: 16 }}
          >
            <IconX size={20} />
          </ActionIcon>

          <Stack gap="xs" mt={rem(40)}>
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <Box
                  key={section.label}
                  onClick={() => setActiveSection(section.label)}
                  style={{
                    padding: `${rem(12)} ${rem(16)}`,
                    borderRadius: rem(8),
                    cursor: 'pointer',
                    backgroundColor:
                      activeSection === section.label ? 'rgba(255,255,255,0.1)' : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Group gap="sm">
                    <Icon size={20} color={navText} />
                    <Text c={navText} size="sm" fw={500}>
                      {section.label}
                    </Text>
                  </Group>
                </Box>
              )
            })}
          </Stack>

          {/* Logout Button */}
          <Box
            onClick={handleLogout}
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              right: 24,
              padding: `${rem(12)} ${rem(16)}`,
              borderRadius: rem(8),
              cursor: 'pointer',
              backgroundColor: 'rgba(255,255,255,0.05)',
              transition: 'background-color 0.2s',
            }}
          >
            <Group gap="sm">
              <IconX size={20} color={navText} />
              <Text c={navText} size="sm" fw={500}>
                Logout
              </Text>
            </Group>
          </Box>
        </Box>

        {/* Right Content */}
        <ScrollArea style={{ flex: 1, height: '100%' }}>
          <Box
            style={{
              padding: rem(40),
              backgroundColor: contentBackground,
              minHeight: '100%',
              color: 'var(--pitch-surface-text)',
            }}
          >
            {isLoadingSettings && (
              <Text size="sm" mb="md" c="var(--pitch-surface-text-dim)">
                Loading saved settings...
              </Text>
            )}

            {activeSection === 'Account' && (
              <Stack gap="xl">
                <Group justify="space-between" align="start">
                  <Group gap="lg">
                    <Avatar size={100} radius="xl" color="brand" src={avatarSrc ?? undefined}>
                      {name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Text size="xl" fw={600} mb="xs" c="var(--pitch-surface-text)">
                        Account
                      </Text>
                      <input
                        ref={avatarFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        hidden
                        onChange={(event) => void handleAvatarFileSelected(event)}
                      />
                      <Button
                        leftSection={<IconUpload size={16} />}
                        variant="light"
                        size="xs"
                        loading={isUploadingAvatar}
                        onClick={() => avatarFileInputRef.current?.click()}
                      >
                        {avatarSrc ? 'Change' : 'Upload'}
                      </Button>
                    </Box>
                  </Group>
                </Group>

                <TextInput
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  size="md"
                  classNames={settingsInputClassNames}
                />

                <TextInput
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  size="md"
                  classNames={settingsInputClassNames}
                />

                <TextInput
                  label="Password"
                  type="password"
                  value="***************"
                  size="md"
                  readOnly
                  classNames={settingsInputClassNames}
                />

                <Select
                  label="Time Zone"
                  value={timezone}
                  onChange={(val) => setTimezone(val || '')}
                  data={TIMEZONE_OPTIONS}
                  size="md"
                  classNames={settingsInputClassNames}
                />

                <Group justify="space-between" mt="xl">
                  <Text
                    size="sm"
                    c="var(--pitch-accent-strong)"
                    style={{ cursor: 'pointer' }}
                    onClick={openDeleteAccountConfirm}
                  >
                    Delete Account
                  </Text>
                  <Button onClick={() => void handleSave()} size="md" loading={isSaving}>
                    Save
                  </Button>
                </Group>
              </Stack>
            )}

            {activeSection === 'Notifications' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  Notifications
                </Text>
                <Checkbox
                  label="Email notifications"
                  checked={emailNotifications}
                  onChange={(event) => setEmailNotifications(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Desktop notifications"
                  checked={desktopNotifications}
                  onChange={(event) => setDesktopNotifications(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Product updates"
                  checked={productUpdates}
                  onChange={(event) => setProductUpdates(event.currentTarget.checked)}
                />
                <Group justify="flex-end" mt="sm">
                  <Button onClick={() => void handleSave()} loading={isSaving}>
                    Save
                  </Button>
                </Group>
              </Stack>
            )}

            {activeSection === 'Voice & Video' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  Voice & Video
                </Text>
                <Select
                  label="Preferred microphone"
                  value={preferredMicrophone}
                  onChange={(value) => setPreferredMicrophone(value || 'System default')}
                  data={['System default', 'Built-in Mic', 'USB Headset']}
                  classNames={settingsInputClassNames}
                />
                <Select
                  label="Preferred speaker"
                  value={preferredSpeaker}
                  onChange={(value) => setPreferredSpeaker(value || 'System default')}
                  data={['System default', 'Built-in Speakers', 'Bluetooth Headset']}
                  classNames={settingsInputClassNames}
                />
                <Checkbox
                  label="Noise suppression"
                  checked={noiseSuppression}
                  onChange={(event) => setNoiseSuppression(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Echo cancellation"
                  checked={echoCancellation}
                  onChange={(event) => setEchoCancellation(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Join calls muted by default"
                  checked={autoJoinMuted}
                  onChange={(event) => setAutoJoinMuted(event.currentTarget.checked)}
                />
                <Group justify="flex-end" mt="sm">
                  <Button onClick={() => void handleSave()} loading={isSaving}>
                    Save
                  </Button>
                </Group>
              </Stack>
            )}

            {activeSection === 'Appearance' && (
              <Stack gap="lg" style={{ color: 'var(--pitch-surface-text)' }}>
                <Stack gap={6}>
                  <Text size="xl" fw={600} c="var(--pitch-surface-text)">
                    Color Mode
                  </Text>
                  <Text size="sm" c="var(--pitch-surface-text-dim)">
                    Choose if PITCH’s appearance should be light or dark, or follow your device’s
                    settings.
                  </Text>
                </Stack>

                <Group gap="xs">
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <Button
                      key={mode}
                      radius="xl"
                      size="sm"
                      variant={colorMode === mode ? 'filled' : 'outline'}
                      onClick={() => setColorMode(mode)}
                      style={{
                        borderColor: 'var(--pitch-accent-strong)',
                        backgroundColor:
                          colorMode === mode ? 'var(--pitch-accent-strong)' : 'transparent',
                        color:
                          colorMode === mode
                            ? 'var(--mantine-color-white)'
                            : 'var(--pitch-surface-text)',
                      }}
                    >
                      {mode[0].toUpperCase() + mode.slice(1)}
                    </Button>
                  ))}
                </Group>

                <Divider />

                <Tabs
                  value={activeTab}
                  onChange={(value) => setActiveTab(value as typeof activeTab)}
                  classNames={{ tab: classes.appearanceTab }}
                  style={{
                    ['--tab-hover-bg' as string]: tabsHoverBg,
                    ['--tab-hover-text' as string]: tabsHoverText,
                    ['--tab-active-bg' as string]: tabsActiveBg,
                    ['--tab-active-text' as string]: tabsActiveText,
                  }}
                >
                  <Tabs.List>
                    <Tabs.Tab value="profiles">Theme profiles</Tabs.Tab>
                    <Tabs.Tab value="custom">Custom theme</Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="profiles" pt="md">
                    <SimpleGrid cols={2} spacing="sm">
                      {profiles.map((profile) => {
                        const surface = profile.tokens.surfaceBg
                        const profileText = getReadableTextColor(surface)
                        const profileMuted = getReadableMutedColor(surface)
                        const hoverBg = mixColors(surface, profile.tokens.accent, 0.12)
                        const hoverText = getReadableTextColor(hoverBg)
                        const hoverMuted = getReadableMutedColor(hoverBg)
                        return (
                          <Card
                            key={profile.id}
                            withBorder
                            padding="sm"
                            radius="md"
                            onClick={() => setActiveProfile(profile.id)}
                            className={classes.themeCard}
                            style={{
                              cursor: 'pointer',
                              borderColor:
                                profile.id === activeProfileId
                                  ? 'var(--pitch-accent-strong)'
                                  : 'var(--mantine-color-default-border)',
                              backgroundColor: surface,
                              color: profileText,
                              ['--card-bg' as string]: surface,
                              ['--card-text' as string]: profileText,
                              ['--card-muted' as string]: profileMuted,
                              ['--card-hover-bg' as string]: hoverBg,
                              ['--card-hover-text' as string]: hoverText,
                              ['--card-hover-muted' as string]: hoverMuted,
                            }}
                          >
                            {profile.isCustom && (
                              <Tooltip label="Delete theme">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  className={classes.deleteButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openConfirmDelete(profile.id, profile.name)
                                  }}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            <Group justify="space-between" align="center">
                              <Group gap="sm">
                                <Box
                                  style={{
                                    width: rem(18),
                                    height: rem(18),
                                    borderRadius: '50%',
                                    backgroundColor: profile.tokens.accent,
                                    border: '1px solid rgba(0,0,0,0.08)',
                                  }}
                                />
                                <Text size="sm" fw={600} c="var(--card-text)">
                                  {profile.name}
                                </Text>
                              </Group>
                              {profile.id === activeProfileId && (
                                <Text size="xs" c="var(--card-muted)" fw={600}>
                                  Active
                                </Text>
                              )}
                            </Group>
                          </Card>
                        )
                      })}
                    </SimpleGrid>
                  </Tabs.Panel>

                  <Tabs.Panel value="custom" pt="md">
                    <Group gap="xs">
                      <Tooltip label="Coming soon">
                        <span>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconShare2 size={14} />}
                            disabled
                          >
                            Share
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip label="Coming soon">
                        <span>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconDownload size={14} />}
                            disabled
                          >
                            Import
                          </Button>
                        </span>
                      </Tooltip>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconSparkles size={14} />}
                        onClick={randomizeCustomDraft}
                      >
                        Surprise me
                      </Button>
                    </Group>

                    <Stack gap="sm" mt="md">
                      {customRows.map((row) => (
                        <Box
                          key={row.key}
                          style={{
                            padding: rem(12),
                            borderRadius: rem(12),
                            border: '1px solid var(--mantine-color-default-border)',
                            backgroundColor: 'var(--pitch-surface-bg)',
                          }}
                        >
                          <Group justify="space-between" align="center">
                            <Group gap="sm">
                              <Box
                                style={{
                                  width: rem(28),
                                  height: rem(28),
                                  borderRadius: '50%',
                                  backgroundColor: customDraft[row.key],
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              />
                              <Box>
                                <Text size="sm" fw={600} c="var(--mantine-color-text)">
                                  {row.label}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {customDraft[row.key].toUpperCase()}
                                </Text>
                              </Box>
                            </Group>
                            <Popover
                              position="bottom-end"
                              withArrow
                              shadow="md"
                              opened={activePicker === row.key}
                              onChange={(opened) => {
                                if (!opened && draggingPicker) {
                                  return
                                }
                                setActivePicker(opened ? row.key : null)
                              }}
                              closeOnClickOutside={!draggingPicker}
                              withinPortal
                              trapFocus={false}
                              zIndex={400}
                            >
                              <Popover.Target>
                                <ActionIcon
                                  variant="subtle"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setActivePicker(activePicker === row.key ? null : row.key)
                                  }}
                                >
                                  <IconPencil size={16} />
                                </ActionIcon>
                              </Popover.Target>
                              <Popover.Dropdown
                                onMouseDown={(event) => event.stopPropagation()}
                                onPointerDown={(event) => {
                                  event.stopPropagation()
                                  setDraggingPicker(true)
                                }}
                              >
                                <TextInput
                                  label={row.label}
                                  value={customDraft[row.key]}
                                  onChange={(event) =>
                                    updateCustomDraft({
                                      [row.key]: event.currentTarget.value,
                                    } as Partial<ThemeTokens>)
                                  }
                                  classNames={settingsInputClassNames}
                                />
                                <ColorPicker
                                  mt="sm"
                                  format="hex"
                                  value={customDraft[row.key]}
                                  onChange={(value) =>
                                    updateCustomDraft({ [row.key]: value } as Partial<ThemeTokens>)
                                  }
                                  onChangeEnd={() => setDraggingPicker(false)}
                                />
                              </Popover.Dropdown>
                            </Popover>
                          </Group>
                        </Box>
                      ))}
                    </Stack>

                    <Checkbox
                      mt="md"
                      label="Window gradient"
                      checked={customDraftGradient}
                      onChange={(event) => setCustomDraftGradient(event.currentTarget.checked)}
                    />

                    <Divider my="md" />

                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="var(--pitch-surface-text)">
                        Save as profile
                      </Text>
                      <Group align="flex-end">
                        <TextInput
                          label="Profile name"
                          value={profileName}
                          onChange={(event) => setProfileName(event.currentTarget.value)}
                          size="sm"
                          classNames={settingsInputClassNames}
                        />
                        <Button
                          onClick={() => createProfileFromDraft(profileName)}
                          disabled={!profileName.trim()}
                        >
                          Save
                        </Button>
                      </Group>
                    </Stack>
                  </Tabs.Panel>
                </Tabs>

                <Group justify="flex-end">
                  <Button onClick={() => void handleSave()} loading={isSaving}>
                    Save appearance
                  </Button>
                </Group>
              </Stack>
            )}

            {activeSection === 'Language' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  Language
                </Text>
                <Select
                  label="Application language"
                  value={language}
                  onChange={(value) => setLanguage(value || 'English (US)')}
                  data={LANGUAGE_OPTIONS}
                  classNames={settingsInputClassNames}
                />
                <Group justify="flex-end" mt="sm">
                  <Button onClick={() => void handleSave()} loading={isSaving}>
                    Save
                  </Button>
                </Group>
              </Stack>
            )}

            {activeSection === 'Browser' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  Browser
                </Text>
                <Checkbox
                  label="Open PITCH links in a new tab"
                  checked={openLinksInNewTab}
                  onChange={(event) => setOpenLinksInNewTab(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Compact layout mode"
                  checked={compactMode}
                  onChange={(event) => setCompactMode(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Reduce motion"
                  checked={reduceMotion}
                  onChange={(event) => setReduceMotion(event.currentTarget.checked)}
                />
                <Group justify="flex-end" mt="sm">
                  <Button onClick={() => void handleSave()} loading={isSaving}>
                    Save
                  </Button>
                </Group>
              </Stack>
            )}

            {activeSection === 'CRM' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  CRM
                </Text>
                <Select
                  label="CRM provider"
                  value={crmProvider}
                  onChange={(value) => setCrmProvider(value)}
                  data={[{ value: 'salesforce', label: 'Salesforce' }]}
                  classNames={settingsInputClassNames}
                />
                <Checkbox
                  label="Auto-sync CRM selections"
                  checked={crmAutoSync}
                  onChange={(event) => setCrmAutoSync(event.currentTarget.checked)}
                />
                <Card withBorder radius="md" padding="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Text fw={600}>Saved CRM connections</Text>
                      <Badge variant="light">{crmConnections.length}</Badge>
                    </Group>
                    <Group align="end" wrap="nowrap">
                      <TextInput
                        label="CRM name"
                        placeholder="e.g. RevOps Salesforce"
                        value={crmConnectionName}
                        onChange={(event) => setCrmConnectionName(event.currentTarget.value)}
                        style={{ flex: 1 }}
                        classNames={settingsInputClassNames}
                      />
                      <Button
                        variant="light"
                        onClick={handleSaveCurrentCrmConnection}
                        disabled={!crmProvider}
                      >
                        Save current CRM
                      </Button>
                    </Group>
                    <Text size="xs" c="var(--pitch-surface-text-dim)">
                      Saves the current CRM provider/account to your account settings for reuse.
                    </Text>
                    {crmConnections.length === 0 ? (
                      <Text size="sm" c="var(--pitch-surface-text-dim)">
                        No saved CRM connections yet.
                      </Text>
                    ) : (
                      crmConnections.map((connection) => (
                        <Stack key={connection.id} gap={6}>
                          <Group align="end" wrap="nowrap">
                            <TextInput
                              label="Name"
                              value={connection.name}
                              onChange={(event) =>
                                handleRenameCrmConnection(connection.id, event.currentTarget.value)
                              }
                              style={{ flex: 1 }}
                              classNames={settingsInputClassNames}
                            />
                            <Tooltip label="Remove saved CRM">
                              <ActionIcon
                                variant="light"
                                color="red"
                                onClick={() => handleRemoveCrmConnection(connection.id)}
                                aria-label={`Remove ${connection.name}`}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                          <Group gap="xs">
                            <Badge variant="outline">{connection.provider}</Badge>
                            {connection.providerEmail && (
                              <Badge variant="light">{connection.providerEmail}</Badge>
                            )}
                            <Badge color={connection.connected ? 'green' : 'gray'} variant="light">
                              {connection.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </Group>
                        </Stack>
                      ))
                    )}
                  </Stack>
                </Card>
                <Card withBorder radius="md" padding="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Text fw={600}>Saved CRM session presets</Text>
                      <Badge variant="light">{savedCrmPresets.length}</Badge>
                    </Group>
                    {savedCrmPresets.length === 0 ? (
                      <Text size="sm" c="var(--pitch-surface-text-dim)">
                        No saved CRM presets yet. Save one from the session CRM step.
                      </Text>
                    ) : (
                      savedCrmPresets.map((preset) => (
                        <Group key={preset.id} align="end" wrap="nowrap">
                          <TextInput
                            label="Preset name"
                            value={crmPresetNameDrafts[preset.id] ?? preset.label}
                            onChange={(event) =>
                              handleRenameCrmPresetDraft(preset.id, event.currentTarget.value)
                            }
                            style={{ flex: 1 }}
                            classNames={settingsInputClassNames}
                          />
                          <Tooltip label="Apply name">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => handleApplyCrmPresetRename(preset.id)}
                              aria-label={`Rename ${preset.label}`}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remove preset">
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleRemoveCrmPreset(preset.id)}
                              aria-label={`Remove ${preset.label}`}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Card>
                <Card withBorder radius="md" padding="md">
                  <Stack gap={4}>
                    <Text fw={600}>Connection status</Text>
                    <Text size="sm" c="var(--pitch-surface-text-dim)">
                      {crmStatusLoading
                        ? 'Checking CRM connection...'
                        : crmStatus?.connected
                          ? `Connected${crmStatus.providerEmail ? ` as ${crmStatus.providerEmail}` : ''}`
                          : 'Not connected'}
                    </Text>
                    {crmStatus?.lastSyncAt && (
                      <Text size="xs" c="var(--pitch-surface-text-dim)">
                        Last sync: {new Date(crmStatus.lastSyncAt).toLocaleString()}
                      </Text>
                    )}
                    {crmError && (
                      <Text size="xs" c="red">
                        {crmError}
                      </Text>
                    )}
                  </Stack>
                </Card>
                <Group justify="space-between" mt="sm">
                  <Button
                    variant="light"
                    onClick={() => void fetchCrmStatus(true)}
                    loading={crmStatusLoading}
                  >
                    Refresh status
                  </Button>
                  <Group>
                    <Button variant="default" onClick={() => void handleSave()} loading={isSaving}>
                      Save
                    </Button>
                    <Button onClick={() => void handleConnectCrm()}>
                      {crmStatus?.connected ? 'Reconnect' : 'Connect'}
                    </Button>
                  </Group>
                </Group>
              </Stack>
            )}
          </Box>
        </ScrollArea>
      </Group>
    </Modal>
  )
}
