'use client'

import { Box, Stack, NavLink, Text, Divider, rem, Group } from '@mantine/core'
import {
  IconHome,
  IconCalendar,
  IconChartBar,
  IconUserCog,
  IconHelp,
  IconSettings,
  IconTrophy,
  IconShield,
} from '@tabler/icons-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekCalendar } from '@/components/ui/WeekCalendar'
import { CoinQuotaWidget } from '@/components/ui/CoinQuotaWidget'
import { SettingsModal } from './SettingsModal'
import classes from './AppSideBar.module.css'
import { useI18n } from '@/features/i18n'
import { useAdminStore } from '@/app/admin/stores/admin.store'

export type SidebarLink = {
  icon: React.ComponentType<{ size?: number }>
  label: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config' | 'Challenges'
}

type Props = {
  active: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config' | 'Challenges'
  setActive: Dispatch<
    SetStateAction<
      'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config' | 'Challenges'
    >
  >
  selectedDate: Date | null
  setSelectedDate: Dispatch<SetStateAction<Date | null>>
  showTeamConfig?: boolean
  mainLinks?: SidebarLink[]
  secondaryLinks?: SidebarLink[]
  onNavigate?: () => void
  teamId?: string | null
}

const DEFAULT_MAIN: SidebarLink[] = [
  { icon: IconHome, label: 'Home' },
  { icon: IconCalendar, label: 'Sessions' },
  { icon: IconChartBar, label: 'Analytics' },
  { icon: IconTrophy, label: 'Challenges' },
  { icon: IconUserCog, label: 'Team Config' },
]

export function AppSidebar({
  active,
  setActive,
  selectedDate,
  setSelectedDate,
  showTeamConfig = true,
  mainLinks = DEFAULT_MAIN,
  onNavigate,
  teamId,
}: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [settingsOpened, setSettingsOpened] = useState(false)
  const { isAdmin, check } = useAdminStore()

  useEffect(() => {
    check()
  }, [check])

  const resolvedMainLinks = showTeamConfig
    ? mainLinks
    : mainLinks.filter((link) => link.label !== 'Team Config')

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
            {resolvedMainLinks.map(({ icon: Icon, label }) => (
              <NavLink
                key={label}
                active={active === label}
                onClick={() => {
                  setActive(label)
                  router.push(`/studio/${label.toLowerCase().replace(/\s+/g, '-')}`)
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
            ))}
            <Box mt="auto" pt="lg" mx="0" pb={10} style={{ width: '100%' }}>
              
            {isAdmin === true && (
              <>
                <Divider my="xs" color="var(--pitch-nav-text-dim)" />
                <NavLink
                  onClick={() => {
                    router.push('/admin')
                    onNavigate?.()
                  }}
                  leftSection={<IconShield size={18} />}
                  label={
                    <Text size="sm" className={classes.navLabel}>
                      Admin
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
              </>
            )}
            <Box
                style={{
                  background: 'var(--pitch-nav-bg, var(--mantine-color-nav-9))',
                  borderRadius: 12,
                  border: '1px solid var(--pitch-nav-text-dim)',
                  overflow: 'hidden',
                }}
              >
                <WeekCalendar value={selectedDate} onChange={(date) => setSelectedDate(date)} />
              </Box>
              <CoinQuotaWidget teamId={teamId} />
          </Stack>
        </Box>
      </Box>
    </>
  )
}
