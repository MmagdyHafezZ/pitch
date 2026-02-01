'use client'

import { Box, Group, TextInput, ActionIcon, Text, rem, UnstyledButton, Button } from '@mantine/core'
import { IconSearch, IconBell, IconUser } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { ReactNode, useMemo, useState } from 'react'
import { SettingsModal } from './SettingsModal'
import { useMediaQuery } from '@mantine/hooks'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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
          background: 'var(--mantine-color-dark-8)',
          border: '1px solid var(--mantine-color-dark-5)',
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
                background: isActive ? 'var(--mantine-color-blue-6)' : 'transparent',
                color: isActive ? 'white' : 'var(--mantine-color-gray-3)',
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
            background: 'var(--mantine-color-dark-7)',
            borderColor: 'var(--mantine-color-dark-4)',
            color: 'var(--mantine-color-gray-0)',
          },
          section: {
            color: 'var(--mantine-color-gray-4)',
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
  teamTab,
  onTeamTabChange,
}: {
  currentPage: PageKey | undefined
  value?: string
  onChange?: (v: string) => void
  isCompact?: boolean
  teamTab?: string
  onTeamTabChange?: (tab: string) => void
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
              color="blue"
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
      {
        const effectiveTeamTab = teamTab ?? tabsByPage.Teams
        const handleTeamsTabChange = (tab: string) => {
          handleTabChange(tab)
          onTeamTabChange?.(tab)
        }

        return (
          <ActionBar
            enableSearch={true}
            searchPlaceholder="Search teams"
            availableTabs={['All', 'My Teams']}
            selectedTab={effectiveTeamTab}
            onTabChange={handleTeamsTabChange}
            value={value}
            onChange={onChange}
            isCompact={isCompact}
          />
        )
      }
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
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isNarrow = useMediaQuery('(max-width: 520px)')
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const sessionQuery = useMemo(() => searchParams.get('q') ?? '', [searchParams])
  const teamTabQuery = useMemo(() => searchParams.get('teamTab'), [searchParams])
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
  const effectiveTeamTab =
    teamTabQuery === 'my' ? 'My Teams' : teamTabQuery === 'all' ? 'All' : undefined
  const handleTeamTabChange = (tab: string) => {
    if (currentPage !== 'Teams') return

    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'My Teams') {
      params.set('teamTab', 'my')
    } else {
      params.delete('teamTab')
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const actionArea = rightSlot ?? (
    <ActionConfig
      currentPage={currentPage}
      value={effectiveValue}
      onChange={effectiveOnChange}
      isCompact={isMobile}
      teamTab={effectiveTeamTab}
      onTeamTabChange={handleTeamTabChange}
    />
  )
  const showActionArea = Boolean(rightSlot || currentPage)

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Box
        style={{
          background: 'var(--mantine-color-dark-9)',
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
                c="var(--mantine-color-blue-4)"
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
                <Text size="xs" fw={700} c="gray.2">
                  {weekday}
                </Text>
                <Text size="xs" c="gray.5">
                  {shortDate}
                </Text>
              </Box>
            )}

            <ActionIcon
              aria-label="Notifications"
              size={isNarrow ? 26 : 28}
              radius="md"
              variant="default"
              styles={{
                root: {
                  background: 'white',
                  color: 'var(--mantine-color-dark-7)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                },
              }}
            >
              <IconBell size={16} />
            </ActionIcon>

            <ActionIcon
              aria-label="Account"
              size={isNarrow ? 26 : 28}
              radius="md"
              variant="default"
              onClick={() => setSettingsOpened(true)}
              styles={{
                root: {
                  background: 'white',
                  color: 'var(--mantine-color-dark-7)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
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
