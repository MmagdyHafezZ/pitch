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
import { IconSearch, IconBell, IconUser, IconHelp, IconX } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { SettingsModal } from './SettingsModal'
import { useMediaQuery } from '@mantine/hooks'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth'
import { useTeamsStore } from '@/features/teams/stores/teams.store'
import { notifications } from '@mantine/notifications'
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

const getStudioAccessRequesterId = (notification: NotificationItem) => {
  if (notification.type !== 'STUDIO_ACCESS_REQUEST') return null

  if (typeof notification.metadata?.requesterUserId === 'string') {
    return notification.metadata.requesterUserId
  }

  return typeof notification.sourceUserId === 'string' ? notification.sourceUserId : null
}

const isTeamApprovalRequestNotification = (notification: NotificationItem) =>
  notification.type === 'team_approval_request'

const isCoinRefillRequestNotification = (notification: NotificationItem) =>
  notification.type === 'coin_refill_request'

const isCoinRefillDecisionNotification = (notification: NotificationItem) =>
  notification.type === 'coin_refill_decision'

const getCoinRefillRequesterId = (notification: NotificationItem) => {
  if (!isCoinRefillRequestNotification(notification)) return null

  if (typeof notification.metadata?.requesterUserId === 'string') {
    return notification.metadata.requesterUserId
  }

  return typeof notification.sourceUserId === 'string' ? notification.sourceUserId : null
}

export type HeaderProps = {
  value?: string
  onChange?: (v: string) => void
  date?: Date
  gutter?: number
  searchPlaceholder?: string
  rightSlot?: ReactNode
  teamName?: string
  currentPage?:
    | 'Home'
    | 'Sessions'
    | 'Teams'
    | 'Analytics'
    | 'Challenges'
    | 'Settings'
    | 'Subscription'
    | 'Admin'
  selectedTab?: string
  onTabChange?: (tab: string) => void
  onToggleMobileNav?: () => void
  mobileNavOpened?: boolean
}

type PageKey =
  | 'Home'
  | 'Sessions'
  | 'Teams'
  | 'Analytics'
  | 'Challenges'
  | 'Settings'
  | 'Subscription'
  | 'Admin'
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
  const [uncontrolledSearchValue, setUncontrolledSearchValue] = useState(value ?? '')
  const activeTab = selectedTab ?? localTab
  const leftAction = leadingAction ?? actionButtons
  const isSearchValueControlled = value !== undefined
  const searchValue = isSearchValueControlled ? value : uncontrolledSearchValue

  useEffect(() => {
    if (value !== undefined) {
      setUncontrolledSearchValue(value)
    }
  }, [value])

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

  const searchWidth = isCompact ? '100%' : rem(320)
  const searchInput = enableSearch ? (
    <Box style={{ width: searchWidth, flexShrink: isCompact ? 1 : 0 }}>
      <TextInput
        value={searchValue}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          if (!isSearchValueControlled) {
            setUncontrolledSearchValue(nextValue)
          }
          onChange?.(nextValue)
        }}
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
          data-tour-id="challenges-filters"
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
  const pathname = usePathname()
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
    case 'Sessions': {
      // On individual session pages (/studio/sessions/[id] or /studio/scenarios/...)
      // the list header controls are irrelevant — hide them.
      const isSessionDetail =
        /^\/studio\/sessions\/[^/]+/.test(pathname ?? '') ||
        /^\/studio\/scenarios\/[^/]+/.test(pathname ?? '')
      if (isSessionDetail) return null
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
    }
    case 'Teams':
      // On /studio/team-config the stepper/tabs live in the page itself — no top bar controls needed.
      if (pathname?.startsWith('/studio/team-config')) return null
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
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null)
  const [acceptingInviteIds, setAcceptingInviteIds] = useState<string[]>([])
  const [acceptedInviteIds, setAcceptedInviteIds] = useState<string[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { startTour } = useTour()

  useEffect(() => {
    const handler = () => setSettingsOpened(true)
    window.addEventListener('pitch:open-settings', handler)
    return () => window.removeEventListener('pitch:open-settings', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const screen = (e as CustomEvent<{ screen: string }>).detail?.screen
      if (screen) startTour(screen as Parameters<typeof startTour>[0])
    }
    window.addEventListener('pitch:start-tour', handler)
    return () => window.removeEventListener('pitch:start-tour', handler)
  }, [startTour])

  const pageToTourScreen: Partial<Record<PageKey, TourScreen>> = {
    Home: 'home',
    Sessions: 'sessions',
    Challenges: 'challenges',
    Analytics: 'analytics',
    Teams: 'team-config',
  }
  const tourScreen: TourScreen | undefined = pathname.startsWith('/studio/sessions/create')
    ? 'create-session'
    : currentPage
      ? pageToTourScreen[currentPage]
      : undefined
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isNarrow = useMediaQuery('(max-width: 520px)')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const storedTeams = useTeamsStore((state) => state.teams)
  const surfacedCoinDecisionIdsRef = useRef<Set<string>>(new Set())
  const teams = useMemo(() => storedTeams ?? [], [storedTeams])
  const canAcceptTeamInviteDirectly =
    currentUser?.hasStudioAccess === true || currentUser?.isSystemAdmin === true
  const refreshUserTeams = useTeamsStore((state) => state.fetchUserTeams)
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
    refetchInterval: 15_000,
  })

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list', currentUser?.id],
    queryFn: () =>
      api.notifications.list({
        recipientUserId: currentUser!.id,
        unreadOnly: true,
        skip: 0,
        limit: 20,
      }),
    enabled: !!currentUser?.id,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) =>
      api.notifications.markRead({
        notificationIds,
        recipientUserId: currentUser?.id,
      }),
    onSuccess: (_result, notificationIds) => {
      const unreadCountKey = ['notifications', 'unread-count', currentUser?.id]
      const notificationsListKey = ['notifications', 'list', currentUser?.id]

      queryClient.setQueryData<{ count: number } | undefined>(unreadCountKey, (previous) => {
        if (!previous) return previous
        return { ...previous, count: Math.max(0, previous.count - notificationIds.length) }
      })
      queryClient.setQueryData<{ data: NotificationItem[] } | undefined>(
        notificationsListKey,
        (previous) => {
          if (!previous?.data) return previous
          return {
            ...previous,
            data: previous.data.filter((item) => !notificationIds.includes(item.id)),
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('No authenticated user found')
      }

      const pageSize = 100
      let skip = 0
      const unreadIds: string[] = []

      while (true) {
        const unread = await api.notifications.list({
          recipientUserId: currentUser.id,
          unreadOnly: true,
          skip,
          limit: pageSize,
        })

        const pageIds = (unread?.data ?? [])
          .map((item: NotificationItem) => item.id)
          .filter((id: string | undefined): id is string => Boolean(id))

        if (pageIds.length === 0) break
        unreadIds.push(...pageIds)
        if (pageIds.length < pageSize) break
        skip += pageSize
      }

      if (unreadIds.length > 0) {
        await api.notifications.markRead({
          notificationIds: unreadIds,
          recipientUserId: currentUser.id,
        })
      }

      return api.notifications.markAllRead(currentUser.id)
    },
    onSuccess: () => {
      const unreadCountKey = ['notifications', 'unread-count', currentUser?.id]
      const notificationsListKey = ['notifications', 'list', currentUser?.id]

      queryClient.setQueryData<{ count: number } | undefined>(unreadCountKey, (previous) => {
        if (!previous) return { count: 0 }
        return { ...previous, count: 0 }
      })
      queryClient.setQueryData<{ data: NotificationItem[] } | undefined>(
        notificationsListKey,
        (previous) => {
          if (!previous?.data) return previous
          return {
            ...previous,
            data: [],
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Failed to mark notifications as read',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'red',
      })
    },
  })

  const acceptTeamInviteMutation = useMutation({
    mutationFn: (payload: { teamId: string; notificationId: string }) =>
      api.teams.acceptInvite(payload.teamId),
    onSuccess: async (_result, payload) => {
      setAcceptedInviteIds((previous) =>
        previous.includes(payload.notificationId) ? previous : [...previous, payload.notificationId]
      )

      const unreadCountKey = ['notifications', 'unread-count', currentUser?.id]
      const notificationsListKey = ['notifications', 'list', currentUser?.id]

      queryClient.setQueryData<{ count: number } | undefined>(unreadCountKey, (previous) => {
        if (!previous) return previous
        return { ...previous, count: Math.max(0, previous.count - 1) }
      })
      queryClient.setQueryData<{ data: NotificationItem[] } | undefined>(
        notificationsListKey,
        (previous) => {
          if (!previous?.data) return previous
          return {
            ...previous,
            data: previous.data.filter((item) => item.id !== payload.notificationId),
          }
        }
      )

      await markReadMutation.mutateAsync([payload.notificationId])
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      await refreshUserTeams()
      notifications.show({
        title: 'Invitation accepted',
        message: 'You are now a member of the team.',
        color: 'teal',
      })
    },
    onError: async (error, payload) => {
      try {
        await refreshUserTeams()
        const joinedTeam = useTeamsStore.getState().teams.find((team) => team.id === payload.teamId)
        const hasJoined =
          !!currentUser?.id &&
          !!joinedTeam?.memberships?.some(
            (membership) => membership.userId === currentUser.id && membership.isActive !== false
          )

        if (hasJoined) {
          setAcceptedInviteIds((previous) =>
            previous.includes(payload.notificationId)
              ? previous
              : [...previous, payload.notificationId]
          )
          markReadMutation.mutate([payload.notificationId])
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          notifications.show({
            title: 'Invitation accepted',
            message: 'You are now a member of the team.',
            color: 'teal',
          })
          return
        }
      } catch {}

      notifications.show({
        title: 'Failed to accept invitation',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'red',
      })
    },
  })

  const unreadCount = unreadCountQuery.data?.count ?? 0
  const notificationItems = (notificationsQuery.data?.data ?? []) as NotificationItem[]

  useEffect(() => {
    if (!currentUser?.id) {
      surfacedCoinDecisionIdsRef.current.clear()
      return
    }

    const newDecisionNotifications = notificationItems.filter(
      (notification) =>
        isCoinRefillDecisionNotification(notification) &&
        !surfacedCoinDecisionIdsRef.current.has(notification.id)
    )
    if (newDecisionNotifications.length === 0) {
      return
    }

    newDecisionNotifications.forEach((notification) => {
      surfacedCoinDecisionIdsRef.current.add(notification.id)
      notifications.show({
        title: notification.title,
        message: notification.message,
        color: notification.metadata?.decision === 'denied' ? 'yellow' : 'teal',
      })
    })

    queryClient.invalidateQueries({ queryKey: ['coins', 'my-balance'] })
    queryClient.invalidateQueries({ queryKey: ['coins', 'my-refill-request'] })
  }, [currentUser?.id, notificationItems, queryClient])

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
  const closeNotificationsModal = () => {
    setNotificationsOpened(false)
    setSelectedNotification(null)
  }
  const closeNotificationDetails = () => setSelectedNotification(null)

  const markNotificationAsRead = async (notificationId: string) => {
    await markReadMutation.mutateAsync([notificationId])
  }

  const handleNotificationAction = async (notification: NotificationItem) => {
    const teamId =
      notification.type === 'TEAM_INVITE' && typeof notification.metadata?.teamId === 'string'
        ? notification.metadata.teamId
        : null
    const studioAccessRequesterId = getStudioAccessRequesterId(notification)
    const coinRefillRequesterId = getCoinRefillRequesterId(notification)
    const decision =
      notification.type === 'STUDIO_ACCESS_REVIEWED' &&
      typeof notification.metadata?.decision === 'string'
        ? notification.metadata.decision
        : null

    if (teamId) {
      if (!canAcceptTeamInviteDirectly) {
        closeNotificationsModal()
        router.push('/access/request')
        return
      }

      if (acceptedInviteIds.includes(notification.id)) return

      setAcceptingInviteIds((previous) =>
        previous.includes(notification.id) ? previous : [...previous, notification.id]
      )

      acceptTeamInviteMutation.mutate(
        {
          teamId,
          notificationId: notification.id,
        },
        {
          onSettled: () => {
            setAcceptingInviteIds((previous) => previous.filter((id) => id !== notification.id))
            setSelectedNotification(null)
          },
        }
      )
      return
    }

    if (!notification.readAt) {
      await markNotificationAsRead(notification.id)
    }

    if (notification.type === 'STUDIO_ACCESS_REQUEST') {
      const params = new URLSearchParams()
      if (studioAccessRequesterId) {
        params.set('userId', studioAccessRequesterId)
      }
      params.set('panel', 'access')

      closeNotificationsModal()
      router.push(`/studio/admin/users?${params.toString()}`)
      return
    }

    if (isTeamApprovalRequestNotification(notification)) {
      closeNotificationsModal()
      router.push('/studio/admin/teams/requests')
      return
    }

    if (notification.type === 'STUDIO_ACCESS_REVIEWED') {
      closeNotificationsModal()
      router.push(decision === 'denied' ? '/access/request' : '/studio/home')
      return
    }

    if (notification.type === 'plan_change_request') {
      closeNotificationsModal()
      router.push('/studio/admin/plans/requests')
      return
    }

    if (isCoinRefillRequestNotification(notification)) {
      const params = new URLSearchParams()
      if (coinRefillRequesterId) {
        params.set('userId', coinRefillRequesterId)
        params.set('panel', 'topup')
      }

      closeNotificationsModal()
      router.push(
        params.toString() ? `/studio/admin/users?${params.toString()}` : '/studio/admin/users'
      )
      return
    }

    if (notification.type === 'plan_change_decision') {
      closeNotificationsModal()
      router.push('/studio/subscription')
      return
    }

    if (isCoinRefillDecisionNotification(notification)) {
      closeNotificationsModal()
      router.push('/studio/subscription')
      return
    }

    setSelectedNotification(null)
  }

  const selectedNotificationMetadata = useMemo(() => {
    if (!selectedNotification?.metadata) return []

    const metadata = selectedNotification.metadata
    const entries: Array<{ label: string; value: string }> = []

    if (typeof metadata.teamName === 'string') {
      entries.push({ label: 'Team', value: metadata.teamName })
    }
    if (typeof metadata.requesterEmail === 'string') {
      entries.push({ label: 'Requester', value: metadata.requesterEmail })
    }
    if (typeof metadata.reviewedByEmail === 'string') {
      entries.push({ label: 'Reviewed by', value: metadata.reviewedByEmail })
    }
    if (typeof metadata.decision === 'string') {
      entries.push({ label: 'Decision', value: metadata.decision })
    }
    if (typeof metadata.role === 'string') {
      entries.push({
        label: 'Role',
        value: metadata.role === 'MEMBER' ? 'Regular user' : metadata.role,
      })
    }
    if (typeof metadata.quota === 'number') {
      entries.push({ label: 'Quota', value: `${metadata.quota} coins` })
    }
    if (typeof metadata.requestedCoins === 'number') {
      entries.push({
        label: 'Requested',
        value: `${metadata.requestedCoins.toLocaleString()} credits`,
      })
    }
    if (typeof metadata.approvedCoins === 'number') {
      entries.push({
        label: 'Approved',
        value: `${metadata.approvedCoins.toLocaleString()} credits`,
      })
    }
    if (typeof metadata.teamId === 'string') {
      entries.push({ label: 'Team', value: metadata.teamId })
    }
    if (typeof metadata.reviewedBy === 'string') {
      entries.push({ label: 'Reviewed by', value: metadata.reviewedBy })
    }

    return entries
  }, [selectedNotification])

  const selectedNotificationAction = useMemo(() => {
    if (!selectedNotification) return null

    const teamId =
      selectedNotification.type === 'TEAM_INVITE' &&
      typeof selectedNotification.metadata?.teamId === 'string'
        ? selectedNotification.metadata.teamId
        : null
    const isAccepted = acceptedInviteIds.includes(selectedNotification.id)
    const isAccepting = acceptingInviteIds.includes(selectedNotification.id)
    const isAlreadyTeamMember =
      !!teamId &&
      !!currentUser?.id &&
      !!teams
        .find((team) => team.id === teamId)
        ?.memberships?.some(
          (membership) => membership.userId === currentUser.id && membership.isActive !== false
        )
    const studioAccessRequesterId = getStudioAccessRequesterId(selectedNotification)
    const coinRefillRequesterId = getCoinRefillRequesterId(selectedNotification)

    if (teamId) {
      return {
        label:
          isAccepted || isAlreadyTeamMember
            ? 'Accepted'
            : canAcceptTeamInviteDirectly
              ? 'Accept invitation'
              : 'Request access',
        disabled: isAccepted || isAlreadyTeamMember,
        loading: isAccepting,
      }
    }

    if (selectedNotification.type === 'STUDIO_ACCESS_REQUEST') {
      return {
        label: studioAccessRequesterId ? 'Open requester' : 'Open access review',
        disabled: false,
        loading: false,
      }
    }

    if (isTeamApprovalRequestNotification(selectedNotification)) {
      return {
        label: 'Open team reviews',
        disabled: false,
        loading: false,
      }
    }

    if (selectedNotification.type === 'STUDIO_ACCESS_REVIEWED') {
      return {
        label:
          selectedNotification.metadata?.decision === 'denied'
            ? 'View access status'
            : 'Open Studio',
        disabled: false,
        loading: false,
      }
    }

    if (selectedNotification.type === 'plan_change_request') {
      return {
        label: 'Open plan reviews',
        disabled: false,
        loading: false,
      }
    }

    if (isCoinRefillRequestNotification(selectedNotification)) {
      return {
        label: coinRefillRequesterId ? 'Open requester' : 'Open top-up reviews',
        disabled: false,
        loading: false,
      }
    }

    if (selectedNotification.type === 'plan_change_decision') {
      return {
        label: 'Open subscription',
        disabled: false,
        loading: false,
      }
    }

    if (isCoinRefillDecisionNotification(selectedNotification)) {
      return {
        label: 'Open subscription',
        disabled: false,
        loading: false,
      }
    }

    return {
      label: selectedNotification.readAt ? 'Close' : 'Mark as read',
      disabled: false,
      loading: markReadMutation.isPending,
    }
  }, [
    acceptedInviteIds,
    acceptingInviteIds,
    canAcceptTeamInviteDirectly,
    currentUser?.id,
    markReadMutation.isPending,
    selectedNotification,
    teams,
  ])

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
  const notificationModalStyles = {
    content: {
      background:
        'linear-gradient(180deg, var(--pitch-card-bg, var(--pitch-surface-bg)) 0%, color-mix(in srgb, var(--pitch-card-bg-strong, var(--pitch-card-bg, var(--pitch-surface-bg))) 82%, transparent) 100%)',
      border: '1px solid var(--pitch-card-border, var(--pitch-border))',
      boxShadow:
        '0 18px 40px color-mix(in srgb, var(--pitch-card-shadow, var(--pitch-surface-bg, #000)) 18%, transparent)',
    },
    header: {
      background: 'transparent',
      borderBottom:
        '1px solid color-mix(in srgb, var(--pitch-card-border, var(--pitch-border)) 72%, transparent)',
      paddingBottom: rem(14),
      marginBottom: rem(4),
    },
    title: {
      fontWeight: 700,
      color: 'var(--pitch-surface-text)',
    },
    close: {
      color: 'var(--pitch-surface-text-dim)',
    },
  } as const
  const notificationCardStyle = {
    cursor: 'pointer',
    background:
      'linear-gradient(180deg, var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg))) 0%, color-mix(in srgb, var(--pitch-card-bg, var(--pitch-surface-bg)) 92%, transparent) 100%)',
    border: '1px solid var(--pitch-card-border, var(--pitch-border))',
    boxShadow:
      '0 12px 28px color-mix(in srgb, var(--pitch-card-shadow, var(--pitch-surface-bg, #000)) 12%, transparent)',
  } as const
  const unreadNotificationCardStyle = {
    ...notificationCardStyle,
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg))) 88%, var(--pitch-accent) 12%) 0%, color-mix(in srgb, var(--pitch-card-bg, var(--pitch-surface-bg)) 86%, var(--pitch-accent) 14%) 100%)',
    border:
      '1px solid var(--pitch-card-border-strong, var(--pitch-card-border, var(--pitch-border)))',
  } as const
  const notificationMetaStyle = {
    color: 'var(--pitch-surface-text-dim)',
  } as const
  const notificationChipStyle = {
    background:
      'var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))))',
    color: 'var(--pitch-surface-text)',
    border:
      '1px solid var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
  } as const
  const notificationIconButtonStyles = {
    root: {
      background:
        'var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))))',
      color: 'var(--pitch-surface-text-dim)',
      border:
        '1px solid var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
    },
  } as const
  const mobileNavButton =
    onToggleMobileNav && isMobile ? (
      <ActionIcon
        aria-label={mobileNavOpened ? 'Close navigation menu' : 'Open navigation menu'}
        size="auto"
        p={0}
        variant="transparent"
        onClick={onToggleMobileNav}
        styles={{
          root: {
            color: 'var(--pitch-nav-text)',
            background: 'transparent',
            boxShadow: 'none',
            minWidth: 'unset',
            minHeight: 'unset',
          },
        }}
      >
        {mobileNavOpened ? (
          <IconX size={15} stroke={2.25} />
        ) : (
          <Box
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Box
              style={{
                height: 2,
                width: 14,
                borderRadius: 999,
                background: 'currentColor',
              }}
            />
            <Box
              style={{
                height: 2,
                width: 10,
                borderRadius: 999,
                background: 'currentColor',
              }}
            />
            <Box
              style={{
                height: 2,
                width: 14,
                borderRadius: 999,
                background: 'currentColor',
              }}
            />
          </Box>
        )}
      </ActionIcon>
    ) : null
  const utilityControls = (
    <Group data-tour-id="app-topbar-controls" align="center" gap={isNarrow ? 8 : 12} wrap="nowrap">
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
        inline
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
        onClose={closeNotificationsModal}
        title={t('topbar.notifications')}
        centered
        size="lg"
        styles={notificationModalStyles}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" style={notificationMetaStyle}>
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
          ) : notificationItems.length === 0 ? (
            <Paper withBorder radius="lg" p="lg" style={notificationCardStyle}>
              <Stack gap={6}>
                <Text fw={700} c="var(--pitch-surface-text)">
                  Inbox clear
                </Text>
                <Text size="sm" style={notificationMetaStyle}>
                  {t('topbar.noNotifications')}
                </Text>
              </Stack>
            </Paper>
          ) : (
            <ScrollArea h={360}>
              <Stack gap="sm">
                {notificationItems.map((notification) => {
                  const isUnread = !notification.readAt
                  const isClearingNotification =
                    markReadMutation.isPending &&
                    (markReadMutation.variables?.includes(notification.id) ?? false)
                  const teamId =
                    notification.type === 'TEAM_INVITE' &&
                    typeof notification.metadata?.teamId === 'string'
                      ? notification.metadata.teamId
                      : null
                  const isAccepting = acceptingInviteIds.includes(notification.id)
                  const isAccepted = acceptedInviteIds.includes(notification.id)
                  const isAlreadyTeamMember =
                    !!teamId &&
                    !!currentUser?.id &&
                    !!teams
                      .find((team) => team.id === teamId)
                      ?.memberships?.some(
                        (membership) =>
                          membership.userId === currentUser.id && membership.isActive !== false
                      )
                  const disableAcceptButton = isAccepting || isAccepted || isAlreadyTeamMember
                  const teamInviteActionLabel =
                    isAccepted || isAlreadyTeamMember
                      ? 'Accepted'
                      : canAcceptTeamInviteDirectly
                        ? 'Accept invitation'
                        : 'Request access'
                  return (
                    <Paper
                      key={notification.id}
                      withBorder
                      p="md"
                      radius="lg"
                      onClick={() => {
                        if (
                          notification.type === 'STUDIO_ACCESS_REQUEST' ||
                          isTeamApprovalRequestNotification(notification) ||
                          isCoinRefillRequestNotification(notification) ||
                          isCoinRefillDecisionNotification(notification)
                        ) {
                          void handleNotificationAction(notification)
                          return
                        }

                        setSelectedNotification(notification)
                      }}
                      style={isUnread ? unreadNotificationCardStyle : notificationCardStyle}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={8} wrap="wrap">
                            {isUnread && (
                              <Badge variant="light" style={notificationChipStyle}>
                                New
                              </Badge>
                            )}
                            <Badge color={severityColor(notification.severity)} variant="light">
                              {notification.severity}
                            </Badge>
                          </Group>
                          <Text fw={700} size="sm" c="var(--pitch-surface-text)">
                            {notification.title}
                          </Text>
                        </Stack>
                        <Group gap={6} align="center" wrap="nowrap">
                          <Text size="xs" style={notificationMetaStyle}>
                            {dayjs(notification.createdAt).format('MMM D, YYYY HH:mm')}
                          </Text>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            aria-label="Clear notification"
                            disabled={isClearingNotification}
                            styles={notificationIconButtonStyles}
                            onClick={(event) => {
                              event.stopPropagation()
                              markReadMutation.mutate([notification.id])
                            }}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                      <Text size="sm" mt={8} style={{ ...notificationMetaStyle, lineHeight: 1.6 }}>
                        {notification.message}
                      </Text>
                      {teamId ? (
                        <Group mt="md" justify="space-between" align="center" wrap="wrap">
                          <Badge variant="light" style={notificationChipStyle}>
                            Team invite
                          </Badge>
                          <Button
                            size="xs"
                            variant="light"
                            loading={isAccepting}
                            disabled={disableAcceptButton}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (disableAcceptButton) return
                              void handleNotificationAction(notification)
                            }}
                          >
                            {teamInviteActionLabel}
                          </Button>
                        </Group>
                      ) : null}
                    </Paper>
                  )
                })}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>
      <Modal
        opened={!!selectedNotification}
        onClose={closeNotificationDetails}
        title={selectedNotification?.title ?? 'Notification details'}
        centered
        size="md"
        styles={notificationModalStyles}
      >
        {selectedNotification ? (
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap={8} wrap="wrap">
                <Badge color={severityColor(selectedNotification.severity)} variant="light">
                  {selectedNotification.severity}
                </Badge>
                {!selectedNotification.readAt && (
                  <Badge variant="light" style={notificationChipStyle}>
                    Unread
                  </Badge>
                )}
              </Group>
              <Text size="xs" style={notificationMetaStyle}>
                {dayjs(selectedNotification.createdAt).format('MMM D, YYYY HH:mm')}
              </Text>
            </Group>

            <Paper withBorder radius="lg" p="lg" style={notificationCardStyle}>
              <Text size="sm" c="var(--pitch-surface-text)" style={{ lineHeight: 1.7 }}>
                {selectedNotification.message}
              </Text>
            </Paper>

            {selectedNotificationMetadata.length > 0 ? (
              <Paper withBorder radius="lg" p="lg" style={notificationCardStyle}>
                <Stack gap={10}>
                  {selectedNotificationMetadata.map((item) => (
                    <Group key={`${item.label}-${item.value}`} justify="space-between" gap="sm">
                      <Text size="xs" tt="uppercase" fw={700} style={notificationMetaStyle}>
                        {item.label}
                      </Text>
                      <Text size="sm" fw={600} c="var(--pitch-surface-text)">
                        {item.value}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={closeNotificationDetails}>
                Close
              </Button>
              {selectedNotificationAction ? (
                <Button
                  loading={selectedNotificationAction.loading}
                  disabled={selectedNotificationAction.disabled}
                  onClick={() => void handleNotificationAction(selectedNotification)}
                >
                  {selectedNotificationAction.label}
                </Button>
              ) : null}
            </Group>
          </Stack>
        ) : null}
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
              <Group align="center" gap={rem(4)} style={{ minWidth: 0 }}>
                {mobileNavButton}
                <Text
                  px={rem(isNarrow ? 2 : 6)}
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
