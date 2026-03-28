'use client'

import { useEffect, useMemo, useState } from 'react'
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
  useComputedColorScheme,
  Alert,
  PinInput,
} from '@mantine/core'
import {
  IconUser,
  IconBell,
  IconMicrophone,
  IconPalette,
  IconWorld,
  IconUpload,
  IconX,
  IconTrash,
  IconPencil,
  IconShare2,
  IconDownload,
  IconSparkles,
  IconCalendarEvent,
  IconAlertCircle,
  IconChevronDown,
  IconLogout2,
} from '@tabler/icons-react'
import { CalendarConnectCards } from '@/features/calendar/components/CalendarConnectCards'
import { modals } from '@mantine/modals'
import { useMediaQuery } from '@mantine/hooks'
import { useAuth, useAuthStore } from '@/features/auth'
import { useRouter } from 'next/navigation'
import { useAppearanceStore } from '@/lib/stores/appearance.store'
import { useI18n } from '@/features/i18n'
import { api } from '@/lib/client'
import type { ThemeTokens } from '@/lib/stores/appearance.store'
import { getReadableMutedColor, getReadableTextColor, mixColors } from '@/lib/colors/contrast'
import classes from './SettingsModal.module.css'
import inputClasses from './settingsInputs.module.css'

type SettingsSection =
  | 'Account'
  | 'Notifications'
  | 'Voice & Video'
  | 'Appearance'
  | 'Language'
  | 'Integrations'

interface SettingsModalProps {
  opened: boolean
  onClose: () => void
}

type PhoneVerificationState = {
  verified: boolean
  phoneNumber?: string | null
  verifiedAt?: string | Date | null
  pendingPhoneNumber?: string | null
  pendingExpiresAt?: string | Date | null
  resendAvailableAt?: string | Date | null
  remainingAttempts?: number
  remainingSends?: number
}

const PHONE_COUNTRY_OPTIONS = [
  { value: '+1', label: 'Canada / US (+1)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+49', label: 'Germany (+49)' },
  { value: '+34', label: 'Spain (+34)' },
  { value: '+39', label: 'Italy (+39)' },
  { value: '+31', label: 'Netherlands (+31)' },
  { value: '+52', label: 'Mexico (+52)' },
  { value: '+55', label: 'Brazil (+55)' },
  { value: '+91', label: 'India (+91)' },
  { value: '+81', label: 'Japan (+81)' },
  { value: '+82', label: 'South Korea (+82)' },
  { value: '+65', label: 'Singapore (+65)' },
]

const DEFAULT_PHONE_COUNTRY_CODE = '+1'

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const splitPhoneNumber = (
    rawPhoneNumber: string | null | undefined
  ): { countryCode: string; localNumber: string } => {
    const normalized = rawPhoneNumber?.trim()
    if (!normalized) {
      return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, localNumber: '' }
    }

    const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`
    const digitsOnly = withPlus.replace(/[^\d+]/g, '')
    const sortedOptions = [...PHONE_COUNTRY_OPTIONS].sort(
      (left, right) => right.value.length - left.value.length
    )
    const match = sortedOptions.find((option) => digitsOnly.startsWith(option.value))

    if (!match) {
      return {
        countryCode: DEFAULT_PHONE_COUNTRY_CODE,
        localNumber: digitsOnly.replace(/^\+/, '').replace(/\D/g, ''),
      }
    }

    return {
      countryCode: match.value,
      localNumber: digitsOnly.slice(match.value.length).replace(/\D/g, ''),
    }
  }

  const router = useRouter()
  const { user, logout } = useAuth()
  const setUser = useAuthStore((state) => state.setUser)
  const { locale, setLocale, localeOptions, t, isSavingLocale, localeSaveError } = useI18n()
  const computedColorScheme = useComputedColorScheme('light')
  const isMobile = useMediaQuery('(max-width: 48em)')
  const isDark = computedColorScheme === 'dark'
  const [activeSection, setActiveSection] = useState<SettingsSection>('Account')
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [timezone, setTimezone] = useState('(GMT-5:00) Eastern Time')
  const initialPhoneParts = splitPhoneNumber(
    (user as { phoneNumber?: string | null } | null)?.phoneNumber ?? ''
  )
  const [phoneCountryCode, setPhoneCountryCode] = useState(initialPhoneParts.countryCode)
  const [phoneLocalNumber, setPhoneLocalNumber] = useState(initialPhoneParts.localNumber)
  const [phoneNumber, setPhoneNumber] = useState(
    (user as { phoneNumber?: string | null } | null)?.phoneNumber ?? ''
  )
  const [verificationCode, setVerificationCode] = useState('')
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationState | null>(null)
  const [phoneStatusLoading, setPhoneStatusLoading] = useState(false)
  const [phoneActionLoading, setPhoneActionLoading] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneOverlayOpened, setPhoneOverlayOpened] = useState(false)
  const [phoneOverlayStep, setPhoneOverlayStep] = useState<'number' | 'verify'>('number')
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

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [profiles, activeProfileId]
  )

  const appearanceBackground = isDark ? '#25262b' : (activeProfile?.tokens.surfaceBg ?? '#ffffff')
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
  const contentText = useMemo(() => getReadableTextColor(contentBackground), [contentBackground])
  const contentMuted = useMemo(() => getReadableMutedColor(contentBackground), [contentBackground])
  const inputBackground = useMemo(
    () => mixColors(contentBackground, contentText, 0.06),
    [contentBackground, contentText]
  )
  const inputBorder = useMemo(
    () => mixColors(contentBackground, contentText, 0.22),
    [contentBackground, contentText]
  )
  const inputPlaceholder = useMemo(
    () => mixColors(contentBackground, contentMuted, 0.72),
    [contentBackground, contentMuted]
  )

  const [profileName, setProfileName] = useState(activeProfile?.name ?? 'Custom theme')
  const [activeTab, setActiveTab] = useState<'profiles' | 'custom'>('profiles')
  const [activePicker, setActivePicker] = useState<keyof ThemeTokens | null>(null)
  const [draggingPicker, setDraggingPicker] = useState(false)

  const syncPhoneInputState = (rawPhoneNumber: string | null | undefined) => {
    const parts = splitPhoneNumber(rawPhoneNumber)
    setPhoneCountryCode(parts.countryCode)
    setPhoneLocalNumber(parts.localNumber)
    setPhoneNumber(rawPhoneNumber?.trim() ?? '')
  }

  const buildPhoneNumber = (countryCode: string, localNumber: string) => {
    const digits = localNumber.replace(/\D/g, '')
    return digits ? `${countryCode}${digits}` : ''
  }

  useEffect(() => {
    if (activeProfile) {
      setProfileName(activeProfile.name)
    }
  }, [activeProfile])

  useEffect(() => {
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    syncPhoneInputState((user as { phoneNumber?: string | null } | null)?.phoneNumber ?? '')
  }, [user?.name, user?.email, (user as { phoneNumber?: string | null } | null)?.phoneNumber])

  useEffect(() => {
    if (!opened) return

    let cancelled = false

    const loadPhoneVerification = async () => {
      setPhoneStatusLoading(true)
      setPhoneError(null)
      try {
        const status = (await api.users.getMyPhoneVerification()) as PhoneVerificationState
        if (cancelled) return
        setPhoneVerification(status)
        if (status.phoneNumber) {
          syncPhoneInputState(status.phoneNumber)
        } else if (status.pendingPhoneNumber) {
          syncPhoneInputState(status.pendingPhoneNumber)
        }
      } catch (error) {
        if (cancelled) return
        setPhoneError(
          error instanceof Error
            ? error.message
            : 'Unable to load your phone verification status right now.'
        )
      } finally {
        if (!cancelled) {
          setPhoneStatusLoading(false)
        }
      }
    }

    void loadPhoneVerification()

    return () => {
      cancelled = true
    }
  }, [opened])

  useEffect(() => {
    if (!opened) {
      setMobileSectionsOpened(false)
    }
  }, [opened])

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
    { icon: IconCalendarEvent, label: 'Integrations' },
  ]
  const [mobileSectionsOpened, setMobileSectionsOpened] = useState(false)

  const getSectionTitle = (section: SettingsSection) =>
    section === 'Account'
      ? t('topbar.account')
      : section === 'Notifications'
        ? t('topbar.notifications')
        : section === 'Voice & Video'
          ? 'Voice & Video'
          : section === 'Appearance'
            ? 'Appearance'
            : section === 'Integrations'
              ? 'Integrations'
              : t('settings.language.title')

  const getMobileSectionTitle = (section: SettingsSection) =>
    section === 'Account'
      ? t('topbar.account')
      : section === 'Notifications'
        ? 'Alerts'
        : section === 'Voice & Video'
          ? 'Audio'
          : section === 'Appearance'
            ? 'Theme'
            : section === 'Integrations'
              ? 'Calendar'
              : t('settings.language.title')

  const activeSectionConfig =
    sections.find((section) => section.label === activeSection) ?? sections[0]
  const ActiveSectionIcon = activeSectionConfig.icon

  const handleLogout = async () => {
    await logout()
    onClose()
    router.push('/')
  }

  const handleSave = () => {
    onClose()
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

  const isResendCoolingDown = useMemo(() => {
    const resendAvailableAt = phoneVerification?.resendAvailableAt
    if (!resendAvailableAt) return false
    return new Date(resendAvailableAt).getTime() > Date.now()
  }, [phoneVerification?.resendAvailableAt])

  const hasVerifiedPhone = Boolean(phoneVerification?.verified && phoneVerification.phoneNumber)
  const hasPendingPhone = Boolean(
    phoneVerification?.pendingPhoneNumber && !phoneVerification?.verified
  )
  const phoneStatusDescription = phoneStatusLoading
    ? 'Loading your phone setup...'
    : hasVerifiedPhone
      ? (phoneVerification?.phoneNumber ?? '')
      : hasPendingPhone
        ? `Code sent to ${phoneVerification?.pendingPhoneNumber}`
        : 'Add a mobile number to unlock phone-based sessions.'
  const phoneActionLabel = hasVerifiedPhone
    ? 'Change number'
    : hasPendingPhone
      ? 'Finish setup'
      : 'Add number'

  const openPhoneOverlay = () => {
    setPhoneError(null)
    setPhoneOverlayStep(hasPendingPhone ? 'verify' : 'number')
    setPhoneOverlayOpened(true)
  }

  const closePhoneOverlay = () => {
    setPhoneOverlayOpened(false)
    setPhoneError(null)
    if (!hasPendingPhone) {
      setVerificationCode('')
    }
  }

  const handlePhoneCountryCodeChange = (value: string | null) => {
    const nextCountryCode = value ?? DEFAULT_PHONE_COUNTRY_CODE
    setPhoneCountryCode(nextCountryCode)
    setPhoneNumber(buildPhoneNumber(nextCountryCode, phoneLocalNumber))
  }

  const handlePhoneLocalNumberChange = (value: string) => {
    if (value.trim().startsWith('+')) {
      const parts = splitPhoneNumber(value)
      setPhoneCountryCode(parts.countryCode)
      setPhoneLocalNumber(parts.localNumber)
      setPhoneNumber(buildPhoneNumber(parts.countryCode, parts.localNumber))
      return
    }

    const digits = value.replace(/\D/g, '')
    setPhoneLocalNumber(digits)
    setPhoneNumber(buildPhoneNumber(phoneCountryCode, digits))
  }

  const handleRequestPhoneVerification = async () => {
    const nextPhoneNumber = phoneNumber.trim()
    if (!nextPhoneNumber) {
      setPhoneError('Enter the mobile number you want to verify.')
      return
    }

    setPhoneActionLoading(true)
    setPhoneError(null)
    try {
      const status = (await api.users.requestPhoneVerification({
        phoneNumber: nextPhoneNumber,
      })) as PhoneVerificationState
      setPhoneVerification(status)
      setVerificationCode('')
      setPhoneOverlayStep('verify')
    } catch (error) {
      setPhoneError(
        error instanceof Error ? error.message : 'Unable to send the verification code right now.'
      )
    } finally {
      setPhoneActionLoading(false)
    }
  }

  const handleResendPhoneVerification = async () => {
    setPhoneActionLoading(true)
    setPhoneError(null)
    try {
      const status = (await api.users.resendPhoneVerification()) as PhoneVerificationState
      setPhoneVerification(status)
      setVerificationCode('')
    } catch (error) {
      setPhoneError(
        error instanceof Error ? error.message : 'Unable to resend the verification code right now.'
      )
    } finally {
      setPhoneActionLoading(false)
    }
  }

  const handleVerifyPhoneCode = async () => {
    const code = verificationCode.trim()
    if (!code) {
      setPhoneError('Enter the verification code from the text message.')
      return
    }

    setPhoneActionLoading(true)
    setPhoneError(null)
    try {
      const status = (await api.users.verifyPhoneVerification({ code })) as PhoneVerificationState
      setPhoneVerification(status)
      setVerificationCode('')
      if (status.phoneNumber) {
        syncPhoneInputState(status.phoneNumber)
        if (user) {
          setUser({
            ...user,
            phoneNumber: status.phoneNumber,
            phoneVerifiedAt:
              typeof status.verifiedAt === 'string'
                ? status.verifiedAt
                : (status.verifiedAt?.toISOString?.() ?? null),
          } as typeof user)
        }
      }
      setPhoneOverlayOpened(false)
      setPhoneOverlayStep('number')
    } catch (error) {
      setPhoneError(
        error instanceof Error ? error.message : 'Unable to verify that code right now.'
      )
    } finally {
      setPhoneActionLoading(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={isMobile ? '100%' : '800px'}
      padding={0}
      withCloseButton={false}
      styles={{
        body: { padding: 0, height: isMobile ? 'calc(100dvh - 28px)' : 'min(80vh, 720px)' },
        content: {
          borderRadius: rem(isMobile ? 10 : 12),
          overflow: 'hidden',
          backgroundColor: contentBackground,
        },
      }}
    >
      <Group
        align="stretch"
        gap={0}
        wrap="nowrap"
        style={{ height: '100%', minHeight: 0, flexDirection: isMobile ? 'column' : 'row' }}
      >
        {/* Left Sidebar */}
        <Box
          style={{
            width: isMobile ? '100%' : 280,
            flexShrink: 0,
            backgroundColor: navBackground,
            padding: isMobile ? `${rem(8)} ${rem(12)}` : rem(24),
            position: 'relative',
            borderBottom: isMobile ? `1px solid ${inputBorder}` : undefined,
          }}
        >
          {isMobile ? (
            /* Mobile: icon grid nav — no scrolling, 3×2 grid */
            <Box py={rem(8)} px={rem(12)} style={{ position: 'relative' }}>
              <Group justify="flex-end" mb={rem(6)}>
                <ActionIcon variant="subtle" size="sm" onClick={onClose}>
                  <IconX size={16} color={navText} />
                </ActionIcon>
              </Group>
              <Stack gap={rem(10)}>
                <Popover
                  opened={mobileSectionsOpened}
                  onChange={setMobileSectionsOpened}
                  position="bottom"
                  withArrow
                  shadow="md"
                  withinPortal={false}
                  width="target"
                >
                  <Popover.Target>
                    <Box
                      onClick={() => setMobileSectionsOpened((current) => !current)}
                      style={{
                        cursor: 'pointer',
                        borderRadius: rem(14),
                        padding: `${rem(10)} ${rem(12)}`,
                        background: `linear-gradient(
                          180deg,
                          color-mix(in srgb, ${navBackground} 92%, white 8%),
                          color-mix(in srgb, ${navBackground} 84%, ${tabsActiveBg} 16%)
                        )`,
                        border: `1px solid ${mixColors(navBackground, navText, 0.18)}`,
                        boxShadow: `0 10px 24px ${mixColors(navBackground, '#000000', 0.28)}`,
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="sm">
                        <Group gap="sm" wrap="nowrap">
                          <Box
                            style={{
                              width: rem(36),
                              height: rem(36),
                              borderRadius: rem(10),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: tabsActiveBg,
                              color: tabsActiveText,
                              flexShrink: 0,
                            }}
                          >
                            <ActiveSectionIcon size={18} />
                          </Box>
                          <Stack gap={0}>
                            <Text
                              size="xs"
                              fw={700}
                              c={navText}
                              style={{ letterSpacing: '0.04em' }}
                            >
                              SETTINGS
                            </Text>
                            <Text size="sm" fw={600} c={navText}>
                              {getMobileSectionTitle(activeSection)}
                            </Text>
                          </Stack>
                        </Group>
                        <IconChevronDown
                          size={18}
                          color={navText}
                          style={{
                            transform: mobileSectionsOpened ? 'rotate(180deg)' : undefined,
                            transition: 'transform 160ms ease',
                            flexShrink: 0,
                          }}
                        />
                      </Group>
                    </Box>
                  </Popover.Target>

                  <Popover.Dropdown
                    p={rem(8)}
                    style={{
                      background: contentBackground,
                      border: `1px solid ${inputBorder}`,
                      borderRadius: rem(16),
                    }}
                  >
                    <Stack gap={rem(4)}>
                      {sections.map((section) => {
                        const Icon = section.icon
                        const isActive = activeSection === section.label

                        return (
                          <Box
                            key={section.label}
                            onClick={() => {
                              setActiveSection(section.label)
                              setMobileSectionsOpened(false)
                            }}
                            style={{
                              cursor: 'pointer',
                              borderRadius: rem(12),
                              padding: `${rem(10)} ${rem(12)}`,
                              background: isActive ? tabsActiveBg : 'transparent',
                              border: `1px solid ${
                                isActive
                                  ? mixColors(tabsActiveBg, tabsActiveText, 0.18)
                                  : 'transparent'
                              }`,
                              transition: 'background 150ms ease, border-color 150ms ease',
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap" gap="sm">
                              <Group gap="sm" wrap="nowrap">
                                <Box
                                  style={{
                                    width: rem(32),
                                    height: rem(32),
                                    borderRadius: rem(10),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isActive ? tabsHoverBg : inputBackground,
                                    color: isActive ? tabsActiveText : contentText,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Icon size={17} />
                                </Box>
                                <Stack gap={0}>
                                  <Text size="sm" fw={600} c={contentText}>
                                    {getSectionTitle(section.label)}
                                  </Text>
                                  <Text size="xs" c={contentMuted}>
                                    {getMobileSectionTitle(section.label)}
                                  </Text>
                                </Stack>
                              </Group>
                              {isActive && (
                                <Text size="xs" fw={700} c={contentMuted}>
                                  Open
                                </Text>
                              )}
                            </Group>
                          </Box>
                        )
                      })}
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              </Stack>
            </Box>
          ) : (
            /* Desktop: vertical sidebar */
            <>
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
                          {getSectionTitle(section.label)}
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
                    {t('common.logout')}
                  </Text>
                </Group>
              </Box>
            </>
          )}
        </Box>

        {/* Right Content */}
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <Box
            style={{
              paddingTop: rem(isMobile ? 16 : 40),
              paddingRight: rem(isMobile ? 16 : 40),
              paddingLeft: rem(isMobile ? 16 : 40),
              paddingBottom: isMobile
                ? `calc(${rem(96)} + env(safe-area-inset-bottom, 0px))`
                : rem(40),
              backgroundColor: contentBackground,
              minHeight: '100%',
              color: contentText,
              ['--pitch-surface-text' as string]: contentText,
              ['--pitch-surface-text-dim' as string]: contentMuted,
              ['--pitch-input-bg' as string]: inputBackground,
              ['--pitch-input-text' as string]: contentText,
              ['--pitch-input-placeholder' as string]: inputPlaceholder,
              ['--pitch-border' as string]: inputBorder,
            }}
          >
            {activeSection === 'Account' && (
              <Stack gap="xl">
                <Group justify="space-between" align="start">
                  <Group gap="lg">
                    <Avatar size={100} radius="xl" color="brand">
                      {name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Text size="xl" fw={600} mb="xs" c="var(--pitch-surface-text)">
                        {t('topbar.account')}
                      </Text>
                      <Button leftSection={<IconUpload size={16} />} variant="light" size="xs">
                        Upload
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

                <Box>
                  <Text
                    size="sm"
                    fw={500}
                    mb={8}
                    c="var(--pitch-surface-text-dim)"
                    className={inputClasses.label}
                  >
                    Phone number
                  </Text>
                  <Box className={classes.phoneField}>
                    <Group justify="space-between" align="center" wrap="wrap" gap="md">
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text fw={500} c="var(--pitch-surface-text)">
                          {hasVerifiedPhone
                            ? phoneVerification?.phoneNumber
                            : hasPendingPhone
                              ? 'Verification pending'
                              : 'Not connected'}
                        </Text>
                        <Text size="sm" c="var(--pitch-surface-text-dim)" mt={4}>
                          {hasVerifiedPhone
                            ? 'Connected for phone-based sessions.'
                            : hasPendingPhone
                              ? phoneStatusDescription
                              : 'Add a mobile number for phone-based sessions.'}
                        </Text>
                      </Box>

                      <Button
                        onClick={openPhoneOverlay}
                        variant="subtle"
                        size="sm"
                        loading={phoneStatusLoading}
                      >
                        {phoneActionLabel}
                      </Button>
                    </Group>
                  </Box>
                </Box>

                <Select
                  label="Time Zone"
                  value={timezone}
                  onChange={(val) => setTimezone(val || '')}
                  data={[
                    '(GMT-5:00) Eastern Time',
                    '(GMT-6:00) Central Time',
                    '(GMT-7:00) Mountain Time',
                    '(GMT-8:00) Pacific Time',
                  ]}
                  size="md"
                  classNames={settingsInputClassNames}
                />

                <Group justify="space-between" mt="xl">
                  <Text
                    size="sm"
                    c="var(--pitch-accent-strong)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      /* TODO: Implement delete account */
                    }}
                  >
                    Delete Account
                  </Text>
                  <Button onClick={handleSave} size="md">
                    {t('common.save')}
                  </Button>
                </Group>

                {isMobile && (
                  <Box
                    onClick={handleLogout}
                    style={{
                      cursor: 'pointer',
                      borderRadius: rem(12),
                      padding: `${rem(12)} ${rem(14)}`,
                      border: `1px solid ${mixColors(contentBackground, '#ff6b6b', 0.28)}`,
                      background: mixColors(contentBackground, '#ff6b6b', 0.08),
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <Box
                          style={{
                            width: rem(34),
                            height: rem(34),
                            borderRadius: rem(10),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: mixColors(contentBackground, '#ff6b6b', 0.14),
                            color: '#ff8787',
                            flexShrink: 0,
                          }}
                        >
                          <IconLogout2 size={17} />
                        </Box>
                        <Stack gap={0}>
                          <Text size="sm" fw={600} c="var(--pitch-surface-text)">
                            {t('common.logout')}
                          </Text>
                        </Stack>
                      </Group>
                    </Group>
                  </Box>
                )}
              </Stack>
            )}

            {activeSection === 'Notifications' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  {t('topbar.notifications')}
                </Text>
                <Text c="var(--pitch-surface-text-dim)">Notification settings coming soon...</Text>
              </Stack>
            )}

            {activeSection === 'Voice & Video' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  Voice & Video
                </Text>
                <Text c="var(--pitch-surface-text-dim)">Voice & Video settings coming soon...</Text>
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
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
                            backgroundColor: 'var(--pitch-input-bg)',
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
                                <Text size="sm" fw={600} c="var(--pitch-surface-text)">
                                  {row.label}
                                </Text>
                                <Text size="xs" c="var(--pitch-surface-text-dim)">
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
              </Stack>
            )}

            {activeSection === 'Integrations' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="xs" c="var(--pitch-surface-text)">
                  Integrations
                </Text>
                <Text size="sm" c="var(--pitch-surface-text-dim)" mb="sm">
                  Connect your work calendars so PITCH can read upcoming meetings and suggest
                  tailored practice sessions.
                </Text>
                <CalendarConnectCards />
              </Stack>
            )}

            {activeSection === 'Language' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  {t('settings.language.title')}
                </Text>
                <Text c="var(--pitch-surface-text-dim)">{t('settings.language.description')}</Text>
                <Select
                  data-i18n-skip="true"
                  label={t('settings.language.platformLabel')}
                  value={locale}
                  onChange={(value) => {
                    if (value) {
                      setLocale(value)
                    }
                  }}
                  data={localeOptions.map((option) => ({
                    value: option.value,
                    label: `${option.nativeLabel} (${option.value})`,
                  }))}
                  allowDeselect={false}
                  classNames={settingsInputClassNames}
                />
                <Text size="sm" c="var(--pitch-surface-text-dim)">
                  {t('settings.language.defaultSessionDescription')}
                </Text>
                <Text size="sm" c={localeSaveError ? 'red' : 'var(--pitch-surface-text-dim)'}>
                  {localeSaveError ??
                    (isSavingLocale ? t('settings.language.saving') : t('settings.language.saved'))}
                </Text>
              </Stack>
            )}
          </Box>
        </ScrollArea>
      </Group>

      <Modal
        opened={phoneOverlayOpened}
        onClose={closePhoneOverlay}
        centered
        withCloseButton
        title={phoneOverlayStep === 'number' ? 'Add phone number' : 'Verify phone number'}
        size="sm"
        styles={{
          content: {
            backgroundColor: contentBackground,
          },
          header: {
            backgroundColor: contentBackground,
          },
        }}
      >
        <Stack
          gap="lg"
          style={{
            color: contentText,
            ['--pitch-surface-text' as string]: contentText,
            ['--pitch-surface-text-dim' as string]: contentMuted,
            ['--pitch-input-bg' as string]: inputBackground,
            ['--pitch-input-text' as string]: contentText,
            ['--pitch-input-placeholder' as string]: inputPlaceholder,
            ['--pitch-border' as string]: inputBorder,
          }}
        >
          {phoneOverlayStep === 'number' ? (
            <>
              <Box>
                <Text fw={600} c="var(--pitch-surface-text)">
                  Add a mobile number
                </Text>
                <Text size="sm" c="var(--pitch-surface-text-dim)" mt={4}>
                  We&apos;ll text you a 6-digit verification code right away.
                </Text>
              </Box>

              <Box>
                <Text
                  size="sm"
                  fw={500}
                  mb={8}
                  c="var(--pitch-surface-text-dim)"
                  className={inputClasses.label}
                >
                  Mobile number
                </Text>
                <Group gap="sm" wrap="nowrap" align="flex-end">
                  <Select
                    aria-label="Country code"
                    data={PHONE_COUNTRY_OPTIONS}
                    value={phoneCountryCode}
                    onChange={handlePhoneCountryCodeChange}
                    allowDeselect={false}
                    size="md"
                    w={190}
                    classNames={settingsInputClassNames}
                  />
                  <TextInput
                    aria-label="Phone number"
                    placeholder="555 123 4567"
                    value={phoneLocalNumber}
                    onChange={(event) => handlePhoneLocalNumberChange(event.currentTarget.value)}
                    size="md"
                    classNames={settingsInputClassNames}
                    style={{ flex: 1 }}
                  />
                </Group>
              </Box>

              {phoneError && (
                <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />} radius="md">
                  {phoneError}
                </Alert>
              )}

              <Group justify="space-between">
                <Button variant="subtle" onClick={closePhoneOverlay}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleRequestPhoneVerification()}
                  loading={phoneActionLoading}
                >
                  Confirm
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Box>
                <Text fw={600} c="var(--pitch-surface-text)">
                  Please enter verification code below
                </Text>
                <Text size="sm" c="var(--pitch-surface-text-dim)" mt={4}>
                  {phoneVerification?.pendingPhoneNumber
                    ? `We sent a code to ${phoneVerification.pendingPhoneNumber}.`
                    : 'Enter the 6-digit code we just sent.'}
                </Text>
              </Box>

              <PinInput
                data-testid="phone-code-input"
                length={6}
                type="number"
                oneTimeCode
                size="lg"
                value={verificationCode}
                onChange={setVerificationCode}
                styles={{
                  root: { justifyContent: 'space-between', gap: rem(10) },
                  input: {
                    width: rem(48),
                    height: rem(56),
                    borderRadius: rem(14),
                    border: '1px solid var(--pitch-border)',
                    backgroundColor: 'var(--pitch-input-bg)',
                    color: 'var(--pitch-input-text)',
                    fontSize: rem(22),
                    fontWeight: 700,
                  },
                }}
              />

              {typeof phoneVerification?.remainingAttempts === 'number' && (
                <Text size="sm" c="var(--pitch-surface-text-dim)">
                  {phoneVerification.remainingAttempts} attempt
                  {phoneVerification.remainingAttempts === 1 ? '' : 's'} remaining
                </Text>
              )}

              {phoneError && (
                <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />} radius="md">
                  {phoneError}
                </Alert>
              )}

              <Group justify="space-between" align="center">
                <Button
                  variant="subtle"
                  onClick={() => void handleResendPhoneVerification()}
                  loading={phoneActionLoading}
                  disabled={
                    isResendCoolingDown ||
                    (typeof phoneVerification?.remainingSends === 'number' &&
                      phoneVerification.remainingSends <= 0)
                  }
                >
                  {isResendCoolingDown ? 'Wait to resend' : 'Resend code'}
                </Button>
                <Button
                  onClick={() => void handleVerifyPhoneCode()}
                  loading={phoneActionLoading}
                  disabled={verificationCode.trim().length !== 6}
                >
                  Verify code
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Modal>
  )
}
