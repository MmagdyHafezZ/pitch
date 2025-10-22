'use client'

import {
  AppShell,
  Text,
  Group,
  Stack,
  Card,
  Button,
  Progress,
  SimpleGrid,
  ActionIcon,
  Title,
  Box,
  ThemeIcon,
  rem,
  TextInput,
  NavLink,
  Divider,
} from '@mantine/core'
import { Calendar } from '@mantine/dates'
import { LineChart } from '@mantine/charts'
import {
  IconHome,
  IconCalendar,
  IconUsers,
  IconChartBar,
  IconUserCog,
  IconSettings,
  IconHelp,
  IconSearch,
  IconBell,
  IconBulb,
  IconUsersGroup,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth'

export default function Dashboard() {
  const { logout } = useAuth()
  const router = useRouter()
  const [active, setActive] = useState('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const mockData = useMemo(
    () => [
      { month: 'Jan', sessions: 12 },
      { month: 'Feb', sessions: 19 },
      { month: 'Mar', sessions: 15 },
      { month: 'Apr', sessions: 25 },
      { month: 'May', sessions: 22 },
      { month: 'Jun', sessions: 18 },
    ],
    []
  )

  const mainLinks = [
    { icon: IconHome, label: 'Home' },
    { icon: IconCalendar, label: 'Sessions' },
    { icon: IconUsers, label: 'Organization' },
    { icon: IconChartBar, label: 'Analytics' },
    { icon: IconUserCog, label: 'User Management' },
  ]
  const secondaryLinks = [
    { icon: IconHelp, label: 'Support' },
    { icon: IconSettings, label: 'Settings' },
  ]

  return (
    <AppShell
      padding="md"
      header={{ height: 64 }}
      navbar={{ width: 280, breakpoint: 'sm' }}
      styles={{
        header: { backgroundColor: 'var(--mantine-color-dark-9)', borderBottom: 'none' },
        navbar: { backgroundColor: 'var(--mantine-color-dark-8)', borderRight: 'none' },
        main: { backgroundColor: 'var(--mantine-color-gray-0)' },
      }}
    >
      {/* TOP BAR */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {/* Logo wordmark */}
            <Text size="xl" fw={800} c="blue.4" style={{ letterSpacing: 0.2 }}>
              PITCH
            </Text>

            {/* Centered search bar */}
            <TextInput
              ml={rem(24)}
              placeholder="Search"
              leftSection={<IconSearch size={18} />}
              radius="xl"
              styles={{
                input: {
                  width: 'clamp(240px, 40vw, 520px)',
                  background: 'var(--mantine-color-dark-7)',
                  color: 'white',
                  border: '1px solid var(--mantine-color-dark-6)',
                },
              }}
            />
          </Group>

          <Group gap="md">
            {/* Right date and icons */}
            <Stack gap={0} align="end" pr="xs">
              <Text size="sm" c="gray.2">
                Wednesday
              </Text>
              <Text size="xs" c="gray.5">
                Oct 8, 2025
              </Text>
            </Stack>
            <ActionIcon variant="subtle" size="lg" color="gray.3">
              <IconBell size={20} />
            </ActionIcon>
            <Button variant="light" size="xs" onClick={handleLogout}>
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {/* LEFT SIDEBAR */}
      <AppShell.Navbar p="md">
        {/* Primary nav */}
        <Stack gap={4}>
          {mainLinks.map(({ icon: Icon, label }) => (
            <NavLink
              key={label}
              active={active === label}
              onClick={() => setActive(label)}
              label={<Text size="sm">{label}</Text>}
              leftSection={<Icon size={18} />}
              variant="light"
              styles={{
                root: {
                  borderRadius: rem(10),
                  color: 'var(--mantine-color-gray-2)',
                },
                label: { fontWeight: active === label ? 600 : 500 },
                section: { color: active === label ? 'var(--mantine-color-blue-4)' : 'inherit' },
                body: { color: active === label ? 'var(--mantine-color-blue-4)' : 'inherit' },
              }}
              color={active === label ? 'blue' : undefined}
            />
          ))}
        </Stack>

        {/* Mini calendar */}
        <Box mt="xl" p="xs" style={{ background: 'var(--mantine-color-dark-7)', borderRadius: 12 }}>
          <Calendar
            size="sm"
            value={selectedDate}
            onChange={setSelectedDate}
            hideOutsideDates
            weekendDays={[0, 6]}
            styles={{
              calendarHeader: { color: 'var(--mantine-color-gray-2)' },
              weekday: { color: 'var(--mantine-color-gray-4)' },
              day: { color: 'var(--mantine-color-gray-1)' },
            }}
          />
        </Box>

        <Divider my="md" color="dark.6" />

        {/* Secondary nav at bottom */}
        <Stack gap={6} mt="auto">
          {secondaryLinks.map(({ icon: Icon, label }) => (
            <NavLink
              key={label}
              label={<Text size="sm">{label}</Text>}
              leftSection={<Icon size={18} />}
              styles={{ root: { borderRadius: rem(10), color: 'var(--mantine-color-gray-3)' } }}
              variant="subtle"
            />
          ))}
        </Stack>
      </AppShell.Navbar>

      {/* MAIN CONTENT */}
      <AppShell.Main>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {/* Today's Sessions */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>Today’s Sessions</Title>
              <Group justify="space-between" wrap="nowrap">
                <Box>
                  <Text size="sm" c="dimmed">
                    Next Session
                  </Text>
                  <Text fw={600}>Sales Pitch</Text>
                </Box>
                <Box ta="right">
                  <Text size="sm" c="dimmed">
                    You completed
                  </Text>
                  <Text fw={600}>3 sessions this week!</Text>
                </Box>
              </Group>
              <Button fullWidth radius="md">
                Start New Session
              </Button>
            </Stack>
          </Card>

          {/* Organization */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md" align="center">
              <ThemeIcon size={48} variant="light" color="blue">
                <IconUsers size={26} />
              </ThemeIcon>
              <Title order={3}>Organization</Title>
              <Button variant="subtle" c="blue">
                View all
              </Button>
            </Stack>
          </Card>

          {/* Teams */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md" align="center">
              <ThemeIcon size={48} variant="light" color="blue">
                <IconUsersGroup size={26} />
              </ThemeIcon>
              <Title order={3}>Teams</Title>
              <Button variant="subtle" c="blue">
                View all
              </Button>
            </Stack>
          </Card>

          {/* Areas for Improvement */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>Areas for Improvement</Title>
              <Stack gap="xs">
                <Progress value={75} size="sm" color="gray" />
                <Progress value={60} size="sm" color="gray" />
                <Progress value={45} size="sm" color="gray" />
                <Progress value={80} size="sm" color="gray" />
              </Stack>
            </Stack>
          </Card>

          {/* Performance Metrics */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>Performance Metrics</Title>
              <LineChart
                h={160}
                data={mockData}
                dataKey="month"
                series={[{ name: 'sessions', color: 'blue.6' }]}
                curveType="linear"
                gridAxis="none"
              />
              <Box mt="xs">
                <Title order={4}>Top Strengths</Title>
                <Stack gap="xs" mt="xs">
                  <Progress value={85} size="sm" color="blue" />
                  <Progress value={70} size="sm" color="blue" />
                </Stack>
              </Box>
            </Stack>
          </Card>

          {/* Goals & Progress */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>Goals & Progress</Title>
              <Group justify="space-between" wrap="nowrap">
                <Progress value={75} size="lg" color="blue" style={{ flex: 1 }} />
                <Text fw={600} ml="sm">
                  75%
                </Text>
              </Group>
              <Stack gap="xs">
                <Progress value={45} size="sm" color="gray" />
                <Progress value={60} size="sm" color="gray" />
              </Stack>
            </Stack>
          </Card>

          {/* Next Milestones */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>Next Milestones</Title>
              <Stack gap="xs">
                <Progress value={30} size="sm" color="gray" />
                <Progress value={50} size="sm" color="gray" />
              </Stack>
            </Stack>
          </Card>

          {/* AI Insights */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <ThemeIcon size="lg" variant="light" color="yellow">
                  <IconBulb size={18} />
                </ThemeIcon>
                <Title order={3}>AI Insights</Title>
              </Group>
              <Text size="sm">Try focusing more on product benefits during your pitch</Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </AppShell.Main>
    </AppShell>
  )
}
