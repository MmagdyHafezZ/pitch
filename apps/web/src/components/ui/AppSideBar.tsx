'use client'

import { Box, Stack, NavLink, Text, Divider, rem, Group } from '@mantine/core'
import { Calendar } from '@mantine/dates'
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
import { Dispatch, SetStateAction } from 'react'
import dayjs from 'dayjs'
import { useAuth } from '@/features/auth'

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
  { icon: IconUsers, label: 'Organization' },
  { icon: IconChartBar, label: 'Analytics' },
  { icon: IconUserCog, label: 'User Management' },
]

const DEFAULT_SECONDARY: SidebarLink[] = [
  { icon: IconHelp, label: 'Support' },
  { icon: IconSettings, label: 'Settings' },
  { icon: IconDoorEnter, label: 'Logout' },
]
function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  return dayjs(d).add(diff, 'day').startOf('day').toDate()
}

function endOfWeek(d: Date) {
  return dayjs(startOfWeek(d)).add(6, 'day').endOf('day').toDate()
}

function isInThisWeek(date: string, anchor: Date) {
  const s = startOfWeek(anchor)
  const e = endOfWeek(anchor)
  return (
    (dayjs(date).isAfter(s) && dayjs(date).isBefore(e)) ||
    dayjs(date).isSame(s) ||
    dayjs(date).isSame(e)
  )
}
function Brand() {
  return (
    <Group gap="xs" align="center" px="xs" pt="xs" pb="sm">
      <Text fw={700} size="xl" style={{ letterSpacing: 0.5, color: 'var(--mantine-color-blue-6)' }}>
        PITCH
      </Text>
    </Group>
  )
}

export function AppSidebar({
  active,
  setActive,
  selectedDate,
  setSelectedDate,
  mainLinks = DEFAULT_MAIN,
  secondaryLinks = DEFAULT_SECONDARY,
}: Props) {
  const { logout } = useAuth()
  return (
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
          padding: rem(10),
          display: 'flex',
          flexDirection: 'column',
          gap: rem(8),
          width: '100%',
          height: '100%',
        }}
      >
        <Brand />

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
                  '&[data-active]': {
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
            mx="auto"
            style={{
              background: 'var(--mantine-color-dark-7)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <Calendar
              hideOutsideDates
              firstDayOfWeek={1}
              getDayProps={(date) => {
                const isToday = dayjs(date).isSame(dayjs(), 'day')
                return { selected: isToday }
              }}
              styles={{
                calendarHeader: { padding: rem(6) },
                calendarHeaderLevel: { fontSize: rem(12), fontWeight: 600 },
                weekday: { fontSize: rem(10), fontWeight: 600 },
                month: { padding: rem(6) },
                day: {
                  height: rem(26),
                  fontSize: rem(12),
                  fontWeight: 600,
                  borderRadius: rem(8),
                  '&[data-selected]': {
                    background: 'var(--mantine-color-blue-6)',
                    color: 'white',
                  },
                  '&:hover': { background: 'rgba(255,255,255,0.05)' },
                },
              }}
            />
          </Box>
        </Stack>

        <Divider my="md" color="dark.6" />

        <Stack gap={6} mt="auto">
          {secondaryLinks.map(({ icon: Icon, label }) => (
            <NavLink
              key={label}
              onClick={async () => {
                if (label === 'Logout') {
                  await logout()
                } else {
                  setActive(label)
                }
              }}
              leftSection={<Icon size={18} />}
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
  )
}
