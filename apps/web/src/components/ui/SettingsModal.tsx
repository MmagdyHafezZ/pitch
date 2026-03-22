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
} from '@tabler/icons-react'
import { CalendarConnectCards } from '@/features/calendar/components/CalendarConnectCards'
import { modals } from '@mantine/modals'
import { useMediaQuery } from '@mantine/hooks'
import { useAuth } from '@/features/auth'
import { useRouter } from 'next/navigation'
import { useAppearanceStore } from '@/lib/stores/appearance.store'
import { useI18n } from '@/features/i18n'
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

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { locale, setLocale, localeOptions, t, isSavingLocale, localeSaveError } = useI18n()
  const computedColorScheme = useComputedColorScheme('light')
  const isMobile = useMediaQuery('(max-width: 48em)')
  const isDark = computedColorScheme === 'dark'
  const [activeSection, setActiveSection] = useState<SettingsSection>('Account')
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [timezone, setTimezone] = useState('(GMT-5:00) Eastern Time')
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

  useEffect(() => {
    if (activeProfile) {
      setProfileName(activeProfile.name)
    }
  }, [activeProfile])

  useEffect(() => {
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
  }, [user?.name, user?.email])

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
              <SimpleGrid cols={3} spacing={rem(4)}>
                {sections.map((section) => {
                  const Icon = section.icon
                  const isActive = activeSection === section.label
                  const mobileLabel =
                    section.label === 'Account'
                      ? t('topbar.account')
                      : section.label === 'Notifications'
                        ? 'Alerts'
                        : section.label === 'Voice & Video'
                          ? 'Audio'
                          : section.label === 'Appearance'
                            ? 'Theme'
                            : section.label === 'Integrations'
                              ? 'Calendar'
                              : t('settings.language.title')
                  return (
                    <Box
                      key={section.label}
                      onClick={() => setActiveSection(section.label)}
                      style={{
                        padding: `${rem(10)} ${rem(4)}`,
                        borderRadius: rem(8),
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
                        textAlign: 'center',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <Stack gap={rem(4)} align="center">
                        <Box style={{ opacity: isActive ? 1 : 0.5, display: 'flex' }}>
                          <Icon size={20} color={navText} />
                        </Box>
                        <Text
                          c={navText}
                          size="xs"
                          fw={isActive ? 700 : 400}
                          lh={1.2}
                          ta="center"
                          style={{ opacity: isActive ? 1 : 0.6 }}
                        >
                          {mobileLabel}
                        </Text>
                      </Stack>
                    </Box>
                  )
                })}
                {/* Logout tile */}
                <Box
                  onClick={handleLogout}
                  style={{
                    padding: `${rem(10)} ${rem(4)}`,
                    borderRadius: rem(8),
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Stack gap={rem(4)} align="center">
                    <IconX size={20} color="rgba(255,100,100,0.85)" />
                    <Text c="rgba(255,100,100,0.85)" size="xs" fw={400} lh={1.2} ta="center">
                      {t('common.logout')}
                    </Text>
                  </Stack>
                </Box>
              </SimpleGrid>
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
                          {section.label === 'Account'
                            ? t('topbar.account')
                            : section.label === 'Notifications'
                              ? t('topbar.notifications')
                              : section.label === 'Voice & Video'
                                ? 'Voice & Video'
                                : section.label === 'Appearance'
                                  ? 'Appearance'
                                  : section.label === 'Integrations'
                                    ? 'Integrations'
                                    : t('settings.language.title')}
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
              padding: rem(isMobile ? 16 : 40),
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
    </Modal>
  )
}
