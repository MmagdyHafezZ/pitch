'use client'

import { Box, Stack, NavLink, Text, Divider, rem, Group } from '@mantine/core'
import {
  IconHome,
  IconCalendar,
  IconUsers,
  IconChartBar,
  IconUserCog,
  IconHelp,
  IconSettings,
  IconDoorExit,
  IconDoorEnter,
} from '@tabler/icons-react'
import { Dispatch, SetStateAction, useState } from 'react'
import dayjs from 'dayjs'
import { useAuth } from '@/features/auth'
import { WeekCalendar } from '@/components/ui/WeekCalendar'
import { SettingsModal } from './SettingsModal'

export type SidebarLink = { icon: React.ComponentType<{ size?: number }>; label: string }

type Props = {
  active: string
  setActive: Dispatch<SetStateAction<string>>
  selectedDate: Date | null
  setSelectedDate: Dispatch<SetStateAction<Date | null>>
  mainLinks?: SidebarLink[]
  secondaryLinks?: SidebarLink[]
}

const DEFAULT_MAIN: SidebarLink[] = [
  { icon: IconHome, label: 'Home' },
  { icon: IconCalendar, label: 'Sessions' },
  { icon: IconChartBar, label: 'Analytics' },
  { icon: IconUserCog, label: 'Team Config' },
]

const DEFAULT_SECONDARY: SidebarLink[] = [
  { icon: IconHelp, label: 'Support' },
  { icon: IconSettings, label: 'Settings' },
]

export function AppSidebar({
  active,
  setActive,
  selectedDate,
  setSelectedDate,
  mainLinks = DEFAULT_MAIN,
  secondaryLinks = DEFAULT_SECONDARY,
}: Props) {
  const [settingsOpened, setSettingsOpened] = useState(false)
  const { logout } = useAuth()

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
            background: 'var(--mantine-color-dark-8)',
            borderRadius: rem(16),
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
            {mainLinks.map(({ icon: Icon, label }) => (
              <NavLink
                key={label}
                active={active === label}
                onClick={() => setActive(label)}
                leftSection={<Icon size={18} />}
                href={`/${label.toLowerCase().replace(/\s+/g, '-')}`}
                label={
                  <Text size="sm" fw={active === label ? 700 : 600} style={{ fontSize: 14 }}>
                    {label}
                  </Text>
                }
                variant="subtle"
                styles={{
                  root: {
                    borderRadius: rem(10),
                    paddingTop: rem(8),
                    paddingBottom: rem(8),
                    paddingLeft: rem(10),
                    paddingRight: rem(8),
                    color: 'var(--mantine-color-gray-3)',
                    transition: 'background 120ms, color 120ms',
                    '&:hover': { background: 'rgba(255,255,255,0.04)' },
                    '&[dataActive="true"]': {
                      background: 'rgba(255,255,255,0.08)',
                      color: 'var(--mantine-color-blue-4)',
                    },
                  },
                  section: {
                    color:
                      active === label
                        ? 'var(--mantine-color-blue-4)'
                        : 'var(--mantine-color-gray-4)',
                  },
                  body: {
                    color: active === label ? 'var(--mantine-color-blue-4)' : 'inherit',
                  },
                  label: { fontSize: 14 },
                }}
              />
            ))}
            <Box
              mt="auto"
              pt="lg"
              mx="0" // was auto
              style={{
                width: '100%', // delete
                background: 'var(--mantine-color-dark-7)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <WeekCalendar value={selectedDate} onChange={(date) => setSelectedDate(date)} />
            </Box>
          </Stack>

          <Divider my="md" color="dark.6" />

          <Stack gap={6} mt="auto">
            {secondaryLinks.map(({ icon: Icon, label }) => (
              <NavLink
                key={label}
                leftSection={<Icon size={18} />}
                onClick={() => {
                  if (label === 'Settings') {
                    setSettingsOpened(true)
                  } else if (label === 'Logout') {
                    logout()
                  } else {
                    setActive(label)
                  }
                }}
                label={
                  <Text size="sm" fw={600} style={{ fontSize: 14 }}>
                    {label}
                  </Text>
                }
                variant="subtle"
                styles={{
                  root: {
                    borderRadius: rem(10),
                    paddingTop: rem(8),
                    paddingBottom: rem(8),
                    paddingLeft: rem(10),
                    paddingRight: rem(8),
                    color: 'var(--mantine-color-gray-4)',
                    '&:hover': { background: 'rgba(255,255,255,0.04)' },
                  },
                  section: { color: 'var(--mantine-color-gray-4)' },
                }}
              />
            ))}
          </Stack>
        </Box>
      </Box>
    </>
  )
}
