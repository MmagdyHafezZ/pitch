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
  Stack,
  Paper,
  Badge,
  ScrollArea,
  Divider,
  Indicator,
  Loader,
} from '@mantine/core'
import { IconSearch, IconBell, IconUser } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { ReactNode, useMemo, useState } from 'react'
import { SettingsModal } from './SettingsModal'
import { useMediaQuery } from '@mantine/hooks'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth'

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
  currentPage?: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings'
}

type PageKey = 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings'
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

  const tabs =
    availableTabs.length > 0 ? (
      <Box
        role="tablist"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))`,
          alignItems: 'center',
          maxWidth: rem(300),
          marginRight: 'auto',
          marginLeft: 'auto',
          gap: rem(6),
          padding: rem(4),
          borderRadius: rem(999),
          background: 'var(--pitch-nav-accent-soft)',
          border: '1px solid var(--pitch-nav-text-dim)',
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
                padding: `${rem(isCompact ? 6 : 8)} ${rem(isCompact ? 10 : 14)}`,
                borderRadius: rem(999),
                background: isActive ? 'var(--pitch-accent-strong)' : 'transparent',
                color: isActive ? 'var(--mantine-color-white)' : 'var(--pitch-nav-text-dim)',
                fontWeight: isActive ? 700 : 600,
                fontSize: isCompact ? rem(12) : rem(13),
                lineHeight: 1,
                whiteSpace: 'nowrap',
                width: '100%',
                textAlign: 'center',
                transition: 'background 150ms ease, color 150ms ease',
              }}
            >
              {tab}
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
  const searchWidth = isCompact ? rem(180) : rem(320)
  const searchInput = enableSearch ? (
    <Box style={{ width: searchWidth, flexShrink: 0 }}>
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

  return (
    <Group justify="space-between" align="center" w="100%" wrap="nowrap">
      {actions}
      {searchInput}
    </Group>
  )
}

function ActionConfig({
  currentPage,
  value,
  onChange,
  isCompact,
}: {
  currentPage: PageKey | undefined
  value?: string
  onChange?: (v: string) => void
  isCompact?: boolean
}) {
  const router = useRouter()
  const [tabsByPage, setTabsByPage] = useState<Record<PageKey, string>>({
    Home: 'All',
    Sessions: 'Created by you',
    Teams: 'All',
    Analytics: 'Overview',
    Settings: '',
  })

  const handleTabChange = (tab: string) => {
    if (!currentPage) return
    setTabsByPage((prev) => ({ ...prev, [currentPage]: tab }))
  }

  switch (currentPage) {
    case 'Home':
      return (
        <ActionBar
          enableSearch={false}
          searchPlaceholder="Search"
          availableTabs={['All', 'Favorites', 'Archived']}
          selectedTab={tabsByPage.Home}
          onTabChange={handleTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
        />
      )
    case 'Sessions':
      return (
        <ActionBar
          enableSearch={true}
          searchPlaceholder="Search sessions"
          availableTabs={['Created', 'Assigned', 'All']}
          selectedTab={tabsByPage.Sessions}
          onTabChange={handleTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
          leadingAction={
            <Button
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
              Create Session
            </Button>
          }
        />
      )
    case 'Teams':
      return (
        <ActionBar
          enableSearch={true}
          searchPlaceholder="Search teams"
          availableTabs={['All', 'My Teams']}
          selectedTab={tabsByPage.Teams}
          onTabChange={handleTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
        />
      )
    case 'Analytics':
      return (
        <ActionBar
          enableSearch={true}
          searchPlaceholder="Search analytics"
          availableTabs={['Overview', 'Details']}
          selectedTab={tabsByPage.Analytics}
          onTabChange={handleTabChange}
          value={value}
          onChange={onChange}
          isCompact={isCompact}
        />
      )
    case 'Settings':
      return (
        <ActionBar
          enableSearch={false}
          searchPlaceholder="Search settings"
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
}: HeaderProps) {
  const weekday = useMemo(() => dayjs(date).format('dddd'), [date])
  const shortDate = useMemo(() => dayjs(date).format('MMM D, YYYY'), [date])
  const [settingsOpened, setSettingsOpened] = useState(false)
  const [notificationsOpened, setNotificationsOpened] = useState(false)
  const router = useRouter()
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
    />
  )
  const showActionArea = Boolean(rightSlot || currentPage)

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Modal
        opened={notificationsOpened}
        onClose={() => setNotificationsOpened(false)}
        title="Notifications"
        centered
        size="lg"
        styles={{
          title: { fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {unreadCount} unread
            </Text>
            <Button
              size="xs"
              variant="light"
              disabled={!currentUser?.id || unreadCount === 0}
              loading={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              Mark all as read
            </Button>
          </Group>
          <Divider />
          {notificationsQuery.isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : notifications.length === 0 ? (
            <Text size="sm" c="dimmed">
              No notifications yet.
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
          paddingBlock: rem(isMobile ? 6 : 4),
          display: 'flex',
          alignItems: 'center',
          gap: rem(10),
        }}
      >
        <Group justify="space-between" align="center" w="100%" wrap="nowrap">
          <Group align="center" style={{ minWidth: 0 }}>
            {teamName && (
              <Text
                px={rem(isMobile ? 16 : 32)}
                size={rem(isMobile ? 22 : 28)}
                fw={700}
                c="var(--pitch-accent-strong)"
                style={{ whiteSpace: 'nowrap' }}
              >
                P.I.T.C.H
              </Text>
            )}
          </Group>

          {showActionArea && <Box style={{ flex: 1, minWidth: 0 }}>{actionArea}</Box>}

          <Group align="center" gap={isNarrow ? 8 : 12}>
            {!isNarrow && (
              <Box ta="right" lh={1}>
                <Text size="xs" fw={700} c="var(--pitch-nav-text)">
                  {weekday}
                </Text>
                <Text size="xs" c="var(--pitch-nav-text-dim)">
                  {shortDate}
                </Text>
              </Box>
            )}

            <Indicator
              disabled={unreadCount === 0}
              label={unreadCount > 99 ? '99+' : unreadCount}
              size={16}
              color="red"
              offset={6}
            >
              <ActionIcon
                aria-label="Notifications"
                size={isNarrow ? 26 : 28}
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
              aria-label="Account"
              size={isNarrow ? 26 : 28}
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
        </Group>
      </Box>
    </>
  )
}
