'use client'

import {
  Box,
  Group,
  TextInput,
  ActionIcon,
  Text,
  rem,
  UnstyledButton,
  Button,
  Modal,
  Select,
  Stack,
  Paper,
  Badge,
  ScrollArea,
  Divider,
  Indicator,
  Loader,
  useMantineColorScheme,
} from '@mantine/core'
import { IconSearch, IconBell, IconUser, IconHelp, IconMenu2, IconX } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { ReactNode, useMemo, useState } from 'react'
import { SettingsModal } from './SettingsModal'
import { useMediaQuery } from '@mantine/hooks'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth'
import { useTour } from '@/features/onboarding'
import type { TourScreen } from '@/features/onboarding'
import { useI18n } from '@/features/i18n'

type NotificationItem = {
  id: string
  title: string
  message: string
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  sourceType: 'SYSTEM' | 'USER'
  sourceUserId?: string
  metadata?: Record<string, unknown>
  readAt?: string | null
  createdAt: string
}

export type HeaderProps = {
  value?: string
  onChange?: (v: string) => void
  date?: Date
  gutter?: number
  searchPlaceholder?: string
  rightSlot?: ReactNode
  teamName?: string
  currentPage?: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Challenges' | 'Settings'
  selectedTab?: string
  onTabChange?: (tab: string) => void
  onToggleMobileNav?: () => void
  mobileNavOpened?: boolean
}

type PageKey = 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Challenges' | 'Settings'
type ActionBarProps = {
  actionButtons?: ReactNode
  leadingAction?: ReactNode
  enableSearch?: boolean
  searchPlaceholder?: string
  availableTabs?: string[]
  selectedTab?: string
  onTabChange?: (tab: string) => void
  value?: string
  onChange?: (v: string) => void
  isCompact?: boolean
  translateTab?: (tab: string) => string
}

function ActionBar({
  actionButtons,
  leadingAction,
  enableSearch = true,
  searchPlaceholder = 'Search',
  availableTabs = [],
  selectedTab,
  onTabChange,
  value,
  onChange,
  isCompact = false,
  translateTab,
}: ActionBarProps) {
  const [localTab, setLocalTab] = useState(selectedTab ?? availableTabs[0] ?? '')
  const activeTab = selectedTab ?? localTab
  const leftAction = leadingAction ?? actionButtons

  const handleTabSelect = (tab: string) => {
    if (!selectedTab) {
      setLocalTab(tab)
    }
    onTabChange?.(tab)
  }

  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const tabs =
    availableTabs.length > 0 ? (
      <Box
        role="tablist"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))`,
          alignItems: 'center',
          maxWidth: isCompact ? '100%' : rem(280),
          marginRight: 'auto',
          marginLeft: 'auto',
          gap: rem(3),
          padding: rem(3),
          borderRadius: rem(999),
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
          boxShadow: isDark
            ? '0 0 0 1px rgba(255,255,255,0.08) inset'
            : '0 0 0 1px rgba(0,0,0,0.10) inset',
          backdropFilter: 'blur(12px)',
          width: '100%',
        }}
      >
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab
          return (
            <UnstyledButton
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabSelect(tab)}
              style={{
                padding: `${rem(isCompact ? 5 : 7)} ${rem(isCompact ? 10 : 14)}`,
                borderRadius: rem(999),
                background: isActive
                  ? isDark
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(255,255,255,0.90)'
                  : 'transparent',
                boxShadow: isActive
                  ? isDark
                    ? '0 1px 3px rgba(0,0,0,0.4)'
                    : '0 1px 4px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)'
                  : 'none',
                color: isActive
                  ? isDark
                    ? 'var(--mantine-color-white)'
                    : 'var(--pitch-nav-bg, #1a1b2e)'
                  : isDark
                    ? 'rgba(255,255,255,0.45)'
                    : 'rgba(0,0,0,0.45)',
                fontWeight: isActive ? 700 : 500,
                fontSize: isCompact ? rem(11) : rem(12.5),
                lineHeight: 1,
                letterSpacing: isActive ? '-0.01em' : '0',
                whiteSpace: 'nowrap',
                width: '100%',
                textAlign: 'center',
                transition: 'all 160ms cubic-bezier(0.25,0.46,0.45,0.94)',
              }}
            >
              {translateTab?.(tab) ?? tab}
            </UnstyledButton>
          )
        })}
      </Box>
    ) : null

  const actions = leftAction ? (
    <Group gap={rem(8)} wrap="nowrap" style={{ flexShrink: 0 }}>
      {leftAction}
    </Group>
  ) : null

  const inputProps = value !== undefined ? { value } : {}
  const searchWidth = isCompact ? '100%' : rem(320)
  const searchInput = enableSearch ? (
    <Box style={{ width: searchWidth, flexShrink: isCompact ? 1 : 0 }}>
      <TextInput
        {...inputProps}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        placeholder={searchPlaceholder}
        leftSection={<IconSearch size={16} />}
        w="100%"
        size={isCompact ? 'sm' : 'md'}
        styles={{
          input: {
            background: 'var(--pitch-nav-accent-soft)',
            borderColor: 'var(--pitch-nav-text-dim)',
            color: 'var(--pitch-nav-text)',
            '&::placeholder': {
              color: 'var(--pitch-nav-text-dim)',
            },
          },
          section: {
            color: 'var(--pitch-nav-text-dim)',
          },
        }}
      />
    </Box>
  ) : null

  if (tabs) {
    if (isCompact) {
      return (
        <Stack gap={rem(8)} w="100%">
          {actions ? <Box>{actions}</Box> : null}
          <Box style={{ minWidth: 0, width: '100%' }}>{tabs}</Box>
          {searchInput ? <Box>{searchInput}</Box> : null}
        </Stack>
      )
    }

    const columns = [actions ? 'auto' : null, '1fr', searchInput ? 'auto' : null]
      .filter(Boolean)
      .join(' ')

    return (
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          alignItems: 'center',
          gap: rem(12),
          width: '100%',
        }}
      >
        {actions ? <Box>{actions}</Box> : null}
        <Box style={{ minWidth: 0, width: '100%' }}>{tabs}</Box>
        {searchInput ? <Box>{searchInput}</Box> : null}
      </Box>
    )
  }

  if (isCompact) {
    return (
      <Stack gap={rem(8)} w="100%">
        {actions}
        {searchInput}
      </Stack>
    )
  }

  return (
    <Group justify="space-between" align="center" w="100%" wrap="nowrap">
      {actions}
      {searchInput}
    </Group>
  )
}

function ChallengesActionBar({
  selectedTab,
  onTabChange,
  isCompact,
}: {
  selectedTab?: string
  onTabChange?: (tab: string) => void
  isCompact?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const difficulty = searchParams.get('difficulty') ?? 'ALL'

  const handleDifficultyChange = (val: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val && val !== 'ALL') {
      params.set('difficulty', val)
    } else {
      params.delete('difficulty')
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <ActionBar
      enableSearch={false}
      availableTabs={['All', 'Daily', 'Weekly', 'Monthly']}
      selectedTab={selectedTab}
      onTabChange={onTabChange}
      isCompact={isCompact}
      leadingAction={
        <Select
          size="sm"
          value={difficulty}
          onChange={handleDifficultyChange}
          data={[
            { value: 'ALL', label: 'All Levels' },
            { value: 'BEGINNER', label: 'Beginner' },
            { value: 'INTERMEDIATE', label: 'Intermediate' },
            { value: 'EXPERT', label: 'Expert' },
            { value: 'MASTER', label: 'Master' },
          ]}
          w={rem(140)}
          allowDeselect={false}
          styles={{
            input: {
              background: 'var(--pitch-nav-accent-soft)',
              color: 'var(--pitch-nav-text)',
              borderColor: 'var(--pitch-nav-text-dim)',
            },
            section: { color: 'var(--pitch-nav-text-dim)' },
            dropdown: { background: 'var(--pitch-surface-bg)' },
            option: { color: 'var(--pitch-surface-text)' },
          }}
        />
      }
    />
  )
}

function ActionConfig({
  currentPage,
  value,
  onChange,
  isCompact,
  selectedTab,
  onTabChange,
}: {
  currentPage: PageKey | undefined
  value?: string
  onChange?: (v: string) => void
  isCompact?: boolean
  selectedTab?: string
  onTabChange?: (tab: string) => void
}) {
  const router = useRouter()
  const { t } = useI18n()

  const tabLabels: Record<string, string> = {
    All: t('tabs.all'),
    Favorites: t('tabs.favorites'),
    Archived: t('tabs.archived'),
    Created: t('tabs.created'),
    Shared: t('tabs.shared'),
    'My Teams': t('tabs.myTeams'),
    Personal: t('tabs.personal'),
    Team: t('tabs.team'),
  }

  switch (currentPage) {
    case 'Home':
      return (
        <ActionBar
          enableSearch={false}
          searchPlaceholder={t('common.search')}
          availableTabs={['All', 'Favorites', 'Archived']}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
          translateTab={(tab) => tabLabels[tab] ?? tab}
        />
      )
    case 'Sessions':
      return (
        <ActionBar
          enableSearch={true}
          searchPlaceholder={t('topbar.searchSessions')}
          availableTabs={['All', 'Created', 'Shared']}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
          translateTab={(tab) => tabLabels[tab] ?? tab}
          leadingAction={
            <Button
              data-tour-id="sessions-create-btn"
              size={isCompact ? 'sm' : 'md'}
              variant="light"
              color="brand"
              radius="md"
              onClick={() => router.push('/studio/sessions/create')}
              styles={{
                root: {
                  whiteSpace: 'nowrap',
                },
              }}
            >
              {t('topbar.createSession')}
            </Button>
          }
        />
      )
    case 'Teams':
      return (
        <ActionBar
          enableSearch={true}
          searchPlaceholder={t('topbar.searchTeams')}
          availableTabs={['All', 'My Teams']}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
          translateTab={(tab) => tabLabels[tab] ?? tab}
        />
      )
    case 'Analytics':
      return (
        <ActionBar
          enableSearch={false}
          availableTabs={['Personal', 'Team']}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          isCompact={isCompact}
          translateTab={(tab) => tabLabels[tab] ?? tab}
        />
      )
    case 'Challenges':
      return (
        <ChallengesActionBar
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          isCompact={isCompact}
        />
      )
    case 'Settings':
      return (
        <ActionBar
          enableSearch={false}
          searchPlaceholder={t('topbar.searchSettings')}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
        />
      )
    default:
      return null
  }
}

export function AppTopBar({
  value,
  onChange,
  date = new Date(),
  rightSlot,
  searchPlaceholder = 'Search',
  teamName,
  currentPage,
  selectedTab,
  onTabChange,
  onToggleMobileNav,
  mobileNavOpened = false,
}: HeaderProps) {
  const { t, locale, setLocale, localeOptions } = useI18n()
  const weekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
    [date, locale]
  )
  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date),
    [date, locale]
  )
  const [settingsOpened, setSettingsOpened] = useState(false)
  const [notificationsOpened, setNotificationsOpened] = useState(false)
  const router = useRouter()
  const { startTour } = useTour()

  const pageToTourScreen: Partial<Record<PageKey, TourScreen>> = {
    Home: 'home',
    Sessions: 'sessions',
    Challenges: 'challenges',
    Analytics: 'analytics',
    Teams: 'team-config',
  }
  const tourScreen = currentPage ? pageToTourScreen[currentPage] : undefined
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isNarrow = useMediaQuery('(max-width: 520px)')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const sessionQuery = useMemo(() => searchParams.get('q') ?? '', [searchParams])
  const handleSessionSearch = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.trim()) {
      params.set('q', next)
    } else {
      params.delete('q')
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }
  const effectiveValue = value ?? (currentPage === 'Sessions' ? sessionQuery : undefined)
  const effectiveOnChange =
    onChange ?? (currentPage === 'Sessions' ? handleSessionSearch : undefined)

  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unread-count', currentUser?.id],
    queryFn: () => api.notifications.unreadCount(currentUser!.id),
    enabled: !!currentUser?.id,
    refetchInterval: 60_000,
  })

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list', currentUser?.id],
    queryFn: () =>
      api.notifications.list({
        recipientUserId: currentUser!.id,
        skip: 0,
        limit: 20,
      }),
    enabled: notificationsOpened && !!currentUser?.id,
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) =>
      api.notifications.markRead({
        notificationIds,
        recipientUserId: currentUser?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(currentUser!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const unreadCount = unreadCountQuery.data?.count ?? 0
  const notifications = (notificationsQuery.data?.data ?? []) as NotificationItem[]
  const severityColor = (severity: NotificationItem['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'red'
      case 'WARNING':
        return 'yellow'
      default:
        return 'blue'
    }
  }

  const actionArea = rightSlot ?? (
    <ActionConfig
      currentPage={currentPage}
      value={effectiveValue}
      onChange={effectiveOnChange}
      isCompact={isMobile}
      selectedTab={selectedTab}
      onTabChange={onTabChange}
    />
  )
  const showActionArea = Boolean(rightSlot || currentPage)
  const actionIconSize = isMobile ? 24 : isNarrow ? 26 : 28
  const showLanguageSelect = !isMobile
  const languageSelectWidth = isMobile ? 104 : isNarrow ? 92 : 140
  const utilityControls = (
    <Group align="center" gap={isNarrow ? 8 : 12} wrap="nowrap">
      {onToggleMobileNav && isMobile && (
        <ActionIcon
          aria-label={mobileNavOpened ? 'Close navigation menu' : 'Open navigation menu'}
          size={actionIconSize}
          radius="md"
          variant="default"
          onClick={onToggleMobileNav}
          styles={{
            root: {
              background: 'var(--pitch-nav-accent-soft)',
              color: 'var(--pitch-nav-text)',
              boxShadow: '0 0 0 1px var(--pitch-nav-text-dim)',
            },
          }}
        >
          {mobileNavOpened ? <IconX size={16} /> : <IconMenu2 size={16} />}
        </ActionIcon>
      )}

      {!isMobile && !isNarrow && (
        <Box ta="right" lh={1}>
          <Text size="xs" fw={700} c="var(--pitch-nav-text)">
            {weekday}
          </Text>
          <Text size="xs" c="var(--pitch-nav-text-dim)">
            {shortDate}
          </Text>
        </Box>
      )}

      {tourScreen && (
        <ActionIcon
          aria-label={t('topbar.startTour')}
          size={actionIconSize}
          radius="md"
          variant="default"
          onClick={() => startTour(tourScreen)}
          styles={{
            root: {
              background: 'var(--pitch-nav-accent-soft)',
              color: 'var(--pitch-nav-text)',
              boxShadow: '0 0 0 1px var(--pitch-nav-text-dim)',
            },
          }}
        >
          <IconHelp size={16} />
        </ActionIcon>
      )}

      {showLanguageSelect && (
        <Select
          data-i18n-skip="true"
          aria-label={t('settings.language.platformLabel')}
          size={isNarrow ? 'xs' : 'sm'}
          w={languageSelectWidth}
          value={locale}
          onChange={(value) => {
            if (value) {
              setLocale(value)
            }
          }}
          allowDeselect={false}
          data={localeOptions.map((option) => ({
            value: option.value,
            label: option.nativeLabel,
          }))}
          styles={{
            input: {
              background: 'var(--pitch-nav-accent-soft)',
              color: 'var(--pitch-nav-text)',
              borderColor: 'var(--pitch-nav-text-dim)',
            },
            section: {
              color: 'var(--pitch-nav-text-dim)',
            },
            dropdown: {
              background: 'var(--pitch-surface-bg)',
            },
            option: {
              color: 'var(--pitch-surface-text)',
            },
          }}
        />
      )}

      <Indicator
        disabled={unreadCount === 0}
        label={unreadCount > 99 ? '99+' : unreadCount}
        size={16}
        color="red"
        offset={6}
      >
        <ActionIcon
          aria-label={t('topbar.notifications')}
          size={actionIconSize}
          radius="md"
          variant="default"
          onClick={() => setNotificationsOpened(true)}
          styles={{
            root: {
              background: 'var(--pitch-nav-accent-soft)',
              color: 'var(--pitch-nav-text)',
              boxShadow: '0 0 0 1px var(--pitch-nav-text-dim)',
            },
          }}
        >
          <IconBell size={16} />
        </ActionIcon>
      </Indicator>

      <ActionIcon
        aria-label={t('topbar.account')}
        size={actionIconSize}
        radius="md"
        variant="default"
        onClick={() => setSettingsOpened(true)}
        styles={{
          root: {
            background: 'var(--pitch-nav-accent-soft)',
            color: 'var(--pitch-nav-text)',
            boxShadow: '0 0 0 1px var(--pitch-nav-text-dim)',
            cursor: 'pointer',
          },
        }}
      >
        <IconUser size={16} />
      </ActionIcon>
    </Group>
  )

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Modal
        opened={notificationsOpened}
        onClose={() => setNotificationsOpened(false)}
        title={t('topbar.notifications')}
        centered
        size="lg"
        styles={{
          title: { fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {t('topbar.unreadCount', { count: unreadCount })}
            </Text>
            <Button
              size="xs"
              variant="light"
              disabled={!currentUser?.id || unreadCount === 0}
              loading={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              {t('topbar.markAllRead')}
            </Button>
          </Group>
          <Divider />
          {notificationsQuery.isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : notifications.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('topbar.noNotifications')}
            </Text>
          ) : (
            <ScrollArea h={360}>
              <Stack gap="sm">
                {notifications.map((notification) => {
                  const isUnread = !notification.readAt
                  return (
                    <Paper
                      key={notification.id}
                      withBorder
                      p="sm"
                      radius="md"
                      onClick={() =>
                        isUnread ? markReadMutation.mutate([notification.id]) : undefined
                      }
                      style={{
                        cursor: isUnread ? 'pointer' : 'default',
                        background: isUnread
                          ? 'color-mix(in srgb, var(--pitch-surface-bg) 85%, var(--pitch-accent) 15%)'
                          : 'var(--pitch-surface-bg)',
                      }}
                    >
                      <Group justify="space-between" align="center">
                        <Text fw={600} size="sm">
                          {notification.title}
                        </Text>
                        <Badge color={severityColor(notification.severity)} variant="light">
                          {notification.severity}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed" mt={4}>
                        {notification.message}
                      </Text>
                      <Text size="xs" c="gray.5" mt={6}>
                        {dayjs(notification.createdAt).format('MMM D, YYYY HH:mm')}
                      </Text>
                    </Paper>
                  )
                })}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>
      <Box
        style={{
          background: 'var(--pitch-nav-bg, var(--mantine-color-nav-9))',
          borderBottomLeftRadius: 0,
          height: '100%',
          paddingInline: rem(isMobile ? 12 : 16),
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : 0,
          paddingBlock: rem(isMobile ? 6 : 4),
          display: 'flex',
          alignItems: 'center',
          gap: rem(10),
          overflowX: 'hidden',
        }}
      >
        {isMobile ? (
          <Stack gap={rem(8)} w="100%">
            <Group justify="space-between" align="center" w="100%" wrap="nowrap">
              <Group align="center" style={{ minWidth: 0 }}>
                <Text
                  px={rem(isNarrow ? 4 : 10)}
                  size={rem(isNarrow ? 20 : 22)}
                  fw={700}
                  c="var(--pitch-accent-strong)"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  P.I.T.C.H.
                </Text>
              </Group>

              {utilityControls}
            </Group>

            {showActionArea && <Box style={{ width: '100%', minWidth: 0 }}>{actionArea}</Box>}
          </Stack>
        ) : (
          <Group justify="space-between" align="center" w="100%" wrap="nowrap">
            <Group align="center" style={{ minWidth: 0 }}>
              <Text
                px={rem(32)}
                size={rem(28)}
                fw={700}
                c="var(--pitch-accent-strong)"
                style={{ whiteSpace: 'nowrap' }}
              >
                P.I.T.C.H.
              </Text>
            </Group>

            {showActionArea && <Box style={{ flex: 1, minWidth: 0 }}>{actionArea}</Box>}
            {utilityControls}
          </Group>
        )}
      </Box>
    </>
  )
}
