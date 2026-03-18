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
  useMantineTheme,
  UnstyledButton,
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
  IconChevronDown,
} from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { useAuth } from '@/features/auth'
import { useRouter } from 'next/navigation'
import { useAppearanceStore } from '@/lib/stores/appearance.store'
import type { ThemeTokens } from '@/lib/stores/appearance.store'
import { getReadableMutedColor, getReadableTextColor, mixColors } from '@/lib/colors/contrast'
import { useMediaQuery } from '@mantine/hooks'
import classes from './SettingsModal.module.css'
import inputClasses from './settingsInputs.module.css'

type SettingsSection = 'Account' | 'Notifications' | 'Voice & Video' | 'Appearance' | 'Language'

interface SettingsModalProps {
  opened: boolean
  onClose: () => void
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const theme = useMantineTheme()
  const computedColorScheme = useComputedColorScheme('light')
  const isDark = computedColorScheme === 'dark'
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`)
  const [activeSection, setActiveSection] = useState<SettingsSection>('Account')
  const [name, setName] = useState(user?.name || 'John Doe')
  const [email, setEmail] = useState(user?.email || 'john.doe@ibm.com')
  const [timezone, setTimezone] = useState('(GMT-5:00) Eastern Time')
  const [platformLanguage, setPlatformLanguage] = useState('English')
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
  const [mobileSectionsOpened, setMobileSectionsOpened] = useState(false)

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
  ]

  const handleLogout = async () => {
    await logout()
    onClose()
    router.push('/')
  }

  const handleSave = () => {
    onClose()
  }

  const activeSectionMeta =
    sections.find((section) => section.label === activeSection) ?? sections[0]

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
      fullScreen={isMobile}
      padding={0}
      withCloseButton={false}
      styles={{
        body: { padding: 0, height: isMobile ? '100vh' : 'min(80vh, 720px)' },
        content: {
          borderRadius: isMobile ? 0 : rem(12),
          overflow: 'hidden',
          backgroundColor: contentBackground,
          height: isMobile ? '100vh' : undefined,
        },
      }}
    >
      <Group
        align="stretch"
        gap={0}
        wrap={isMobile ? 'wrap' : 'nowrap'}
        style={{
          height: '100%',
          minHeight: 0,
          flexWrap: isMobile ? 'nowrap' : undefined,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        {/* Sidebar / Mobile Nav */}
        <Box
          style={{
            width: isMobile ? '100%' : 280,
            flexShrink: 0,
            backgroundColor: navBackground,
            padding: rem(isMobile ? 14 : 24),
            position: 'relative',
            borderBottom: isMobile ? '1px solid rgba(255,255,255,0.08)' : undefined,
          }}
        >
            <Group justify="space-between" align="center" mb={isMobile ? 'sm' : 0}>
              <Text c={navText} fw={700} size={isMobile ? 'md' : 'sm'}>
                Settings
              </Text>
              <ActionIcon variant="subtle" color="white" size="lg" onClick={onClose}>
                <IconX size={20} />
              </ActionIcon>
            </Group>

          {isMobile ? (
            <Popover
              width="target"
              position="bottom-start"
              withArrow
              shadow="md"
              opened={mobileSectionsOpened}
              onChange={setMobileSectionsOpened}
            >
              <Popover.Target>
                <UnstyledButton
                  onClick={() => setMobileSectionsOpened((opened) => !opened)}
                  style={{
                    width: '100%',
                    padding: `${rem(10)} ${rem(12)}`,
                    borderRadius: rem(16),
                    border: '1px solid rgba(255,255,255,0.1)',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Box
                        style={{
                          width: rem(34),
                          height: rem(34),
                          borderRadius: rem(11),
                          display: 'grid',
                          placeItems: 'center',
                          background: 'rgba(255,255,255,0.08)',
                          color: navText,
                          flexShrink: 0,
                        }}
                      >
                        <activeSectionMeta.icon size={16} />
                      </Box>
                      <Stack gap={0} style={{ minWidth: 0 }}>
                        <Text size="xs" c={navText} style={{ opacity: 0.65, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Current Section
                        </Text>
                        <Text c={navText} fw={700} size="sm" truncate="end">
                          {activeSectionMeta.label}
                        </Text>
                      </Stack>
                    </Group>
                    <Box
                      style={{
                        width: rem(28),
                        height: rem(28),
                        borderRadius: rem(999),
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(255,255,255,0.08)',
                        color: navText,
                        flexShrink: 0,
                      }}
                    >
                      <IconChevronDown size={16} />
                    </Box>
                  </Group>
                </UnstyledButton>
              </Popover.Target>

              <Popover.Dropdown
                style={{
                  background: navBackground,
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: rem(18),
                  padding: rem(8),
                }}
              >
                <Stack gap={6}>
                  {sections.map((section) => {
                    const isActive = section.label === activeSection
                    const Icon = section.icon
                    return (
                      <UnstyledButton
                        key={section.label}
                        onClick={() => {
                          setActiveSection(section.label)
                          setMobileSectionsOpened(false)
                        }}
                        style={{
                          width: '100%',
                          padding: `${rem(10)} ${rem(12)}`,
                          borderRadius: rem(14),
                          background: isActive
                            ? 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.08))'
                            : 'transparent',
                          border: isActive
                            ? '1px solid rgba(255,255,255,0.12)'
                            : '1px solid transparent',
                        }}
                      >
                        <Group gap="sm" wrap="nowrap">
                          <Box
                            style={{
                              width: rem(32),
                              height: rem(32),
                              borderRadius: rem(10),
                              display: 'grid',
                              placeItems: 'center',
                              background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                              color: navText,
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={15} />
                          </Box>
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Text c={navText} fw={700} size="sm">
                              {section.label}
                            </Text>
                            <Text size="xs" c={navText} style={{ opacity: 0.66 }}>
                              {section.label === 'Appearance'
                                ? 'Theme, profiles, and color mode'
                                : section.label === 'Account'
                                  ? 'Profile details and security'
                                  : `${section.label} preferences`}
                            </Text>
                          </Stack>
                        </Group>
                      </UnstyledButton>
                    )
                  })}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          ) : (
            <>
              <Stack gap="xs" mt={rem(24)}>
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
            </>
          )}
        </Box>

        {/* Right Content */}
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <Box
            style={{
              minHeight: isMobile ? 'calc(100vh - 88px)' : '100%',
            }}
          >
          <Box
            style={{
              padding: rem(isMobile ? 18 : 40),
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
                <Group justify="space-between" align="start" wrap={isMobile ? 'wrap' : 'nowrap'}>
                  <Group gap="lg" wrap={isMobile ? 'wrap' : 'nowrap'}>
                    <Avatar size={isMobile ? 72 : 100} radius="xl" color="brand">
                      {name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Text size="xl" fw={600} mb="xs" c="var(--pitch-surface-text)">
                        Account
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

                <Group justify="space-between" mt="xl" wrap="wrap">
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
                  <Button onClick={handleSave} size="md" fullWidth={isMobile}>
                    Save
                  </Button>
                </Group>

                {isMobile ? (
                  <Button variant="subtle" color="red" onClick={() => void handleLogout()} fullWidth>
                    Logout
                  </Button>
                ) : null}
              </Stack>
            )}

            {activeSection === 'Notifications' && (
              <Stack gap="md">
                <Text size="xl" fw={600} mb="md" c="var(--pitch-surface-text)">
                  Notifications
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
                    Choose if PITCH?s appearance should be light or dark, or follow your device?s
                    settings.
                  </Text>
                </Stack>

                <Group gap="xs" wrap="wrap">
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
                    <Group gap="xs" wrap="wrap">
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
                          <Group justify="space-between" align="center" wrap="wrap">
                            <Group gap="sm" wrap="nowrap">
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
                      <Group align="flex-end" wrap="wrap">
                        <TextInput
                          label="Profile name"
                          value={profileName}
                          onChange={(event) => setProfileName(event.currentTarget.value)}
                          size="sm"
                          classNames={settingsInputClassNames}
                          style={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}
                        />
                        <Button
                          onClick={() => createProfileFromDraft(profileName)}
                          disabled={!profileName.trim()}
                          fullWidth={isMobile}
                        >
                          Save
                        </Button>
                      </Group>
                    </Stack>
                  </Tabs.Panel>
                </Tabs>
              </Stack>
            )}

            {activeSection === 'Language' && (
              <Stack gap="lg">
                <Text size="xl" fw={600} mb="xs" c="var(--pitch-surface-text)">
                  Language
                </Text>
                <Text c="var(--pitch-surface-text-dim)">
                  Choose the language used across PITCH and as the default for new training
                  sessions.
                </Text>
                <Select
                  label="Platform language"
                  value={platformLanguage}
                  onChange={(value) => setPlatformLanguage(value || 'English')}
                  data={['English']}
                  allowDeselect={false}
                  size="md"
                  classNames={settingsInputClassNames}
                />
                <Text size="sm" c="var(--pitch-surface-text-dim)">
                  This language will be used by default.
                </Text>
                <Group justify="flex-end">
                  <Button onClick={handleSave} size="md" fullWidth={isMobile}>
                    Save
                  </Button>
                </Group>
              </Stack>
            )}
          </Box>
          </Box>
        </ScrollArea>
      </Group>
    </Modal>
  )
}
