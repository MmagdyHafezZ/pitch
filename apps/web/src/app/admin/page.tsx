'use client'

import { useEffect, useState } from 'react'
import {
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Stack,
  ThemeIcon,
  RingProgress,
  Skeleton,
  Badge,
} from '@mantine/core'
import {
  IconUsers,
  IconUsersGroup,
  IconDeviceDesktopAnalytics,
  IconCreditCard,
  IconActivity,
  IconUserCheck,
} from '@tabler/icons-react'
import { api } from '@/lib/client'

type Stats = {
  totalUsers: number
  activeUsers: number
  totalTeams: number
  totalSessions: number
  activeSessions: number
  totalPlans: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [users, teams, sessions, plans] = await Promise.all([
          api.users.getAll().catch(() => []),
          api.teams.getAll().catch(() => []),
          api.sessions.getAll({ limit: 1000 }).catch(() => ({ sessions: [], total: 0 })),
          api.plans.getAll().catch(() => []),
        ])

        const userList = Array.isArray(users) ? users : []
        const teamList = Array.isArray(teams) ? teams : []
        const sessionData = sessions?.sessions ?? (Array.isArray(sessions) ? sessions : [])
        const planList = Array.isArray(plans) ? plans : []

        setStats({
          totalUsers: userList.length,
          activeUsers: userList.filter((u: any) => u.isActive !== false).length,
          totalTeams: teamList.length,
          totalSessions: sessionData.length,
          activeSessions: sessionData.filter((s: any) => s.status === 'active').length,
          totalPlans: planList.length,
        })
      } catch {
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          totalTeams: 0,
          totalSessions: 0,
          activeSessions: 0,
          totalPlans: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cards = stats
    ? [
        {
          title: 'Total Users',
          value: stats.totalUsers,
          subtitle: `${stats.activeUsers} active`,
          icon: IconUsers,
          color: 'blue',
          progress: stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0,
        },
        {
          title: 'Teams',
          value: stats.totalTeams,
          subtitle: 'organizations',
          icon: IconUsersGroup,
          color: 'teal',
          progress: 100,
        },
        {
          title: 'Sessions',
          value: stats.totalSessions,
          subtitle: `${stats.activeSessions} active`,
          icon: IconDeviceDesktopAnalytics,
          color: 'violet',
          progress:
            stats.totalSessions > 0 ? (stats.activeSessions / stats.totalSessions) * 100 : 0,
        },
        {
          title: 'Plans',
          value: stats.totalPlans,
          subtitle: 'configured',
          icon: IconCreditCard,
          color: 'orange',
          progress: 100,
        },
      ]
    : []

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={700}>
            Admin Dashboard
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            Platform overview and management
          </Text>
        </div>
        <Badge variant="dot" color="green" size="lg">
          System Online
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} withBorder radius="md" p="lg">
                <Skeleton height={80} />
              </Card>
            ))
          : cards.map((card) => (
              <Card key={card.title} withBorder radius="md" p="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {card.title}
                    </Text>
                    <Title order={2} mt={4}>
                      {card.value}
                    </Title>
                    <Text size="sm" c="dimmed" mt={2}>
                      {card.subtitle}
                    </Text>
                  </div>
                  <RingProgress
                    size={64}
                    thickness={6}
                    roundCaps
                    sections={[{ value: card.progress, color: card.color }]}
                    label={
                      <ThemeIcon size="lg" radius="xl" variant="light" color={card.color}>
                        <card.icon size={18} />
                      </ThemeIcon>
                    }
                  />
                </Group>
              </Card>
            ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" p="lg">
          <Group gap="sm" mb="md">
            <ThemeIcon size="md" variant="light" color="blue">
              <IconActivity size={16} />
            </ThemeIcon>
            <Text fw={600}>Quick Actions</Text>
          </Group>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Use the sidebar to navigate to Plans, Users, Teams, or Sessions management.
            </Text>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Group gap="sm" mb="md">
            <ThemeIcon size="md" variant="light" color="teal">
              <IconUserCheck size={16} />
            </ThemeIcon>
            <Text fw={600}>Platform Health</Text>
          </Group>
          <Stack gap="xs">
            {stats && (
              <>
                <Group justify="space-between">
                  <Text size="sm">User Activation Rate</Text>
                  <Text size="sm" fw={600}>
                    {stats.totalUsers > 0
                      ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%`
                      : 'N/A'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Active Sessions</Text>
                  <Text size="sm" fw={600}>
                    {stats.activeSessions}
                  </Text>
                </Group>
              </>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
