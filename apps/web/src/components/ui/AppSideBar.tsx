'use client'

import { Box, Stack, NavLink, Text, Divider, rem, Group } from '@mantine/core'
import {
  IconHome,
  IconCalendar,
  IconChartBar,
  IconUserCog,
  IconHelp,
  IconSettings,
} from '@tabler/icons-react'
import { Dispatch, SetStateAction, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekCalendar } from '@/components/ui/WeekCalendar'
import { SettingsModal } from './SettingsModal'
import classes from './AppSideBar.module.css'
import { useI18n } from '@/features/i18n'

export type SidebarLink = {
  icon: React.ComponentType<{ size?: number }>
  label: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config'
}

type Props = {
  active: 'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config'
  setActive: Dispatch<
    SetStateAction<'Home' | 'Sessions' | 'Teams' | 'Analytics' | 'Settings' | 'Team Config'>
  >
  selectedDate: Date | null
  setSelectedDate: Dispatch<SetStateAction<Date | null>>
  showTeamConfig?: boolean
  mainLinks?: SidebarLink[]
  secondaryLinks?: SidebarLink[]
}

const DEFAULT_MAIN: SidebarLink[] = [
  { icon: IconHome, label: 'Home' },
  { icon: IconCalendar, label: 'Sessions' },
  { icon: IconChartBar, label: 'Analytics' },
  { icon: IconUserCog, label: 'Team Config' },
]

export function AppSidebar({
  active,
  setActive,
  selectedDate,
  setSelectedDate,
  showTeamConfig = true,
  mainLinks = DEFAULT_MAIN,
}: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [settingsOpened, setSettingsOpened] = useState(false)
  const resolvedMainLinks = showTeamConfig
    ? mainLinks
    : mainLinks.filter((link) => link.label !== 'Team Config')

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Box
        style={{
          height: '100%',
          width: '100%',
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
            <Box
              mt="auto"
              pt="lg"
              mx="0"
              pb={10}
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
          </Stack>
        </Box>
      </Box>
    </>
  )
}
