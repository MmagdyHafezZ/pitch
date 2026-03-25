'use client'

import { Box, Stack, NavLink, Text, rem } from '@mantine/core'
import {
  IconHome,
  IconCalendar,
  IconChartBar,
  IconUserCog,
  IconTrophy,
  IconShieldLock,
} from '@tabler/icons-react'
import { Dispatch, SetStateAction, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekCalendar } from '@/components/ui/WeekCalendar'
import { SettingsModal } from './SettingsModal'
import classes from './AppSideBar.module.css'
import { useI18n } from '@/features/i18n'

export type SidebarLink = {
  icon: React.ComponentType<{ size?: number }>
  label: string
  href?: string
}

type Props = {
  active: string
  setActive: Dispatch<SetStateAction<string>>
  selectedDate: Date | null
  setSelectedDate: Dispatch<SetStateAction<Date | null>>
  showTeamConfig?: boolean
  showAdmin?: boolean
  showCalendar?: boolean
  mainLinks?: SidebarLink[]
  secondaryLinks?: SidebarLink[]
  onNavigate?: () => void
}

const DEFAULT_MAIN: SidebarLink[] = [
  { icon: IconHome, label: 'Home', href: '/studio/home' },
  { icon: IconCalendar, label: 'Sessions', href: '/studio/sessions' },
  { icon: IconChartBar, label: 'Analytics', href: '/studio/analytics' },
  { icon: IconTrophy, label: 'Challenges', href: '/studio/challenges' },
  { icon: IconUserCog, label: 'Team Config', href: '/studio/team-config' },
  { icon: IconShieldLock, label: 'Admin', href: '/studio/admin' },
]

export function AppSidebar({
  active,
  setActive,
  selectedDate,
  setSelectedDate,
  showTeamConfig = true,
  showAdmin = false,
  showCalendar = true,
  mainLinks = DEFAULT_MAIN,
  secondaryLinks = [],
  onNavigate,
}: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [settingsOpened, setSettingsOpened] = useState(false)
  const resolvedMainLinks = mainLinks.filter((link) => {
    if (link.label === 'Team Config' && !showTeamConfig) {
      return false
    }
    if (link.label === 'Admin' && !showAdmin) {
      return false
    }
    return true
  })
  const resolvedSecondaryLinks = secondaryLinks
  const renderNavLink = ({ icon: Icon, label, href }: SidebarLink) => (
    <NavLink
      key={label}
      active={active === label}
      onClick={() => {
        setActive(label)
        router.push(href ?? `/studio/${label.toLowerCase().replace(/\s+/g, '-')}`)
        onNavigate?.()
      }}
      leftSection={<Icon size={18} />}
      label={
        <Text size="sm" className={classes.navLabel}>
          {label === 'Home'
            ? t('nav.home')
            : label === 'Sessions'
              ? t('nav.sessions')
              : label === 'Analytics'
                ? t('nav.analytics')
                : label === 'Team Config'
                  ? t('nav.teamConfig')
                  : label === 'Admin'
                    ? t('nav.admin')
                    : label === 'Challenges'
                      ? t('nav.challenges')
                      : label}
        </Text>
      }
      variant="subtle"
      classNames={{
        root: classes.navLink,
        section: classes.navSection,
        body: classes.navBody,
        label: classes.navLabel,
      }}
    />
  )

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Box
        data-tour-id="app-sidebar"
        style={{
          height: '100%',
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          background: 'transparent',
          display: 'flex',
        }}
      >
        <Box
          style={{
            background: 'var(--pitch-nav-bg, var(--mantine-color-nav-9))',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 0,
            padding: rem(10),
            display: 'flex',
            flexDirection: 'column',
            gap: rem(8),
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Stack gap={6} mt="xs" flex={1}>
            {resolvedMainLinks.map(renderNavLink)}
            {(showCalendar || resolvedSecondaryLinks.length > 0) && (
              <Stack gap={6} mt="auto" pt="lg" pb={10}>
                {showCalendar ? (
                  <Box
                    mx="0"
                    style={{
                      width: '100%',
                      background: 'var(--pitch-nav-bg, var(--mantine-color-nav-9))',
                      borderRadius: 12,
                      border: '1px solid var(--pitch-nav-text-dim)',
                      overflow: 'hidden',
                    }}
                  >
                    <WeekCalendar value={selectedDate} onChange={(date) => setSelectedDate(date)} />
                  </Box>
                ) : null}
                {resolvedSecondaryLinks.map(renderNavLink)}
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>
    </>
  )
}
