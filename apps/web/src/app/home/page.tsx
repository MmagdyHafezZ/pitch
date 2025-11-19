'use client'

import {
  Card,
  Stack,
  Title,
  Group,
  Box,
  Button,
  Progress,
  SimpleGrid,
  ThemeIcon,
  Text,
} from '@mantine/core'
import { LineChart } from '@mantine/charts'
import { IconUsers, IconUsersGroup, IconBulb } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { TeamSideBar, TeamInfo } from '@/components/ui/TeamSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'

export default function DashboardHome() {
  const { logout } = useAuth()
  const router = useRouter()
  const [active, setActive] = useState('Home')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const teams: TeamInfo[] = [
    { id: 'sales', name: 'Sales Team' },
    { id: 'product', name: 'Product Team' },
  ] // Dummy data to simulate different teams

  const [activeTeamId, setActiveTeamId] = useState<string | null>(teams[0]?.id ?? null)
  const activeTeam = teams.find((t) => t.id === activeTeamId)

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const trend = useMemo(
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

  return (
    <AppLayout
      header={
        <AppTopBar
          onLogout={handleLogout}
          showSearch
          searchPlaceholder="Search"
          teamName={activeTeam?.name ?? 'PITCH'}
        />
      }
      navbar={
        <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
          {teams.length > 1 && (
            <TeamSideBar teams={teams} activeTeamId={activeTeamId} onSelectTeam={setActiveTeamId} />
          )}
          <AppSidebar
            active={active}
            setActive={setActive}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </Box>
      }
    >
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {/* Today’s Sessions */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={3}>Today’s Sessions</Title>
            <Group justify="space-between" wrap="nowrap">
              <Box>
                <Text size="sm" c="dimmed">
                  Next Session
                </Text>
                <Text fw={700}>Sales Pitch</Text>
              </Box>
              <Box ta="right">
                <Text size="sm" c="dimmed">
                  You completed
                </Text>
                <Text fw={700}>3 sessions this week!</Text>
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
              data={trend}
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
              <Text fw={700} ml="sm">
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
    </AppLayout>
  )
}
