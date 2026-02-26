'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { LineChart } from '@mantine/charts'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarStats,
  IconFlame,
  IconRocket,
  IconTarget,
  IconTrophy,
  IconUsersGroup,
} from '@tabler/icons-react'
import { useAuth } from '@/features/auth'
import { useTeams, type Team } from '@/features/teams'
import type { Session } from '@/features/sessions'
import { api } from '@/lib/client'

type TeamSessionStats = {
  team: Team
  totalSessions: number
  completedSessions: number
  weeklySessions: number
}

type ActivityCell = {
  date: Date
  key: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

type ActivityMapData = {
  weeks: ActivityCell[][]
  byDay: Map<string, number>
  maxCount: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const HEATMAP_WEEKS = 24
const WEEKLY_GOAL = 5

const activityCellColor: Record<ActivityCell['level'], string> = {
  0: 'rgba(148, 163, 184, 0.14)',
  1: 'rgba(16, 185, 129, 0.28)',
  2: 'rgba(16, 185, 129, 0.45)',
  3: 'rgba(16, 185, 129, 0.65)',
  4: 'rgba(16, 185, 129, 0.9)',
}

const toDayKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfDay = (date: Date) => {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

const daysBetween = (a: Date, b: Date) => {
  const delta = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.round(delta / DAY_MS)
}

const getActivityDate = (session: Session) => {
  const raw = session.endedAt || session.createdAt
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const extractSessions = (payload: unknown): Session[] => {
  if (!payload || typeof payload !== 'object') return []
  const sessions = (payload as { sessions?: unknown }).sessions
  return Array.isArray(sessions) ? (sessions as Session[]) : []
}

const buildHeatmap = (sessions: Session[], weeks = HEATMAP_WEEKS): ActivityMapData => {
  const byDay = new Map<string, number>()

  sessions.forEach((session) => {
    const activityDate = getActivityDate(session)
    if (!activityDate) return
    const key = toDayKey(activityDate)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  })

  const today = startOfDay(new Date())
  const totalDays = weeks * 7
  const firstDay = new Date(today)
  firstDay.setDate(today.getDate() - (totalDays - 1))

  let maxCount = 0
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(firstDay)
    date.setDate(firstDay.getDate() + i)
    const count = byDay.get(toDayKey(date)) ?? 0
    if (count > maxCount) maxCount = count
  }

  const weeksGrid: ActivityCell[][] = []
  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const column: ActivityCell[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dayOffset = weekIndex * 7 + dayIndex
      const date = new Date(firstDay)
      date.setDate(firstDay.getDate() + dayOffset)
      const key = toDayKey(date)
      const count = byDay.get(key) ?? 0
      let level: ActivityCell['level'] = 0
      if (count > 0 && maxCount > 0) {
        level = Math.max(1, Math.ceil((count / maxCount) * 4)) as ActivityCell['level']
      }
      column.push({ date, key, count, level })
    }
    weeksGrid.push(column)
  }

  return { weeks: weeksGrid, byDay, maxCount }
}

const computeStreaks = (countsByDay: Map<string, number>) => {
  const activeDays = Array.from(countsByDay.entries())
    .filter(([, count]) => count > 0)
    .map(([key]) => startOfDay(new Date(`${key}T00:00:00`)))
    .sort((a, b) => a.getTime() - b.getTime())

  if (activeDays.length === 0) {
    return { current: 0, longest: 0 }
  }

  let longest = 1
  let rolling = 1
  for (let i = 1; i < activeDays.length; i += 1) {
    const diff = daysBetween(activeDays[i - 1], activeDays[i])
    if (diff === 1) {
      rolling += 1
      longest = Math.max(longest, rolling)
    } else if (diff > 1) {
      rolling = 1
    }
  }

  let current = 0
  let cursor = startOfDay(new Date())
  if (!countsByDay.get(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while ((countsByDay.get(toDayKey(cursor)) ?? 0) > 0) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return { current, longest }
}

const buildWeeklyTrend = (sessions: Session[], weeks = 8) => {
  const today = startOfDay(new Date())
  const rows: Array<{ week: string; sessions: number; completed: number }> = []

  for (let weekOffset = weeks - 1; weekOffset >= 0; weekOffset -= 1) {
    const periodEnd = new Date(today)
    periodEnd.setDate(today.getDate() - weekOffset * 7)
    const periodStart = new Date(periodEnd)
    periodStart.setDate(periodEnd.getDate() - 6)

    let started = 0
    let completed = 0

    sessions.forEach((session) => {
      const createdAt = new Date(session.createdAt)
      if (
        !Number.isNaN(createdAt.getTime()) &&
        createdAt >= periodStart &&
        createdAt <= periodEnd
      ) {
        started += 1
      }

      if (session.status === 'ended') {
        const endedAt = session.endedAt ? new Date(session.endedAt) : createdAt
        if (!Number.isNaN(endedAt.getTime()) && endedAt >= periodStart && endedAt <= periodEnd) {
          completed += 1
        }
      }
    })

    rows.push({
      week: `${periodStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      sessions: started,
      completed,
    })
  }

  return rows
}

export default function DashboardHome() {
  const router = useRouter()
  const { user } = useAuth()
  const { teams, fetchUserTeams } = useTeams()

  const [userSessions, setUserSessions] = useState<Session[]>([])
  const [teamSessionMap, setTeamSessionMap] = useState<Record<string, Session[]>>({})
  const [loadingUserSessions, setLoadingUserSessions] = useState(true)
  const [loadingTeamSessions, setLoadingTeamSessions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const teamIdsKey = useMemo(
    () =>
      teams
        .map((team) => team.id)
        .sort()
        .join(','),
    [teams]
  )

  useEffect(() => {
    if (teams.length === 0) {
      void fetchUserTeams()
    }
  }, [teams.length, fetchUserTeams])

  useEffect(() => {
    let active = true

    const loadUserSessions = async () => {
      if (!user?.id) {
        if (active) {
          setUserSessions([])
          setLoadingUserSessions(false)
        }
        return
      }

      setLoadingUserSessions(true)
      setError(null)

      try {
        const response = await api.sessions.getAll({
          userId: user.id,
          limit: 400,
          offset: 0,
        })
        if (active) {
          setUserSessions(extractSessions(response))
        }
      } catch {
        if (active) {
          setError('Failed to load your session metrics.')
          setUserSessions([])
        }
      } finally {
        if (active) {
          setLoadingUserSessions(false)
        }
      }
    }

    void loadUserSessions()

    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    let active = true

    const loadTeamSessions = async () => {
      if (teams.length === 0) {
        if (active) {
          setTeamSessionMap({})
          setLoadingTeamSessions(false)
        }
        return
      }

      setLoadingTeamSessions(true)

      try {
        const entries = await Promise.all(
          teams.map(async (team) => {
            try {
              const response = await api.sessions.getAll({
                orgId: team.id,
                limit: 400,
                offset: 0,
              })
              return [team.id, extractSessions(response)] as const
            } catch {
              return [team.id, [] as Session[]] as const
            }
          })
        )

        if (active) {
          setTeamSessionMap(Object.fromEntries(entries))
        }
      } finally {
        if (active) {
          setLoadingTeamSessions(false)
        }
      }
    }

    void loadTeamSessions()

    return () => {
      active = false
    }
  }, [teamIdsKey, teams])

  const loading = loadingUserSessions || loadingTeamSessions

  const now = useMemo(() => new Date(), [])
  const sevenDaysAgo = useMemo(() => {
    const day = new Date(now)
    day.setDate(now.getDate() - 6)
    return startOfDay(day)
  }, [now])

  const endedSessions = useMemo(
    () => userSessions.filter((session) => session.status === 'ended'),
    [userSessions]
  )
  const activeSessions = useMemo(
    () => userSessions.filter((session) => session.status !== 'ended'),
    [userSessions]
  )

  const sessionsThisWeek = useMemo(
    () =>
      userSessions.filter((session) => {
        const createdAt = new Date(session.createdAt)
        return !Number.isNaN(createdAt.getTime()) && createdAt >= sevenDaysAgo
      }).length,
    [sevenDaysAgo, userSessions]
  )

  const completedThisWeek = useMemo(
    () =>
      endedSessions.filter((session) => {
        const endedAt = new Date(session.endedAt || session.updatedAt || session.createdAt)
        return !Number.isNaN(endedAt.getTime()) && endedAt >= sevenDaysAgo
      }).length,
    [endedSessions, sevenDaysAgo]
  )

  const completionRate = useMemo(() => {
    if (!userSessions.length) return 0
    return Math.round((endedSessions.length / userSessions.length) * 100)
  }, [endedSessions.length, userSessions.length])

  const weeklyGoalProgress = Math.min(100, Math.round((sessionsThisWeek / WEEKLY_GOAL) * 100))

  const latestSession = useMemo(() => {
    if (!userSessions.length) return null
    return [...userSessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
  }, [userSessions])

  const heatmapData = useMemo(() => buildHeatmap(endedSessions), [endedSessions])
  const streaks = useMemo(() => computeStreaks(heatmapData.byDay), [heatmapData.byDay])
  const weeklyTrend = useMemo(() => buildWeeklyTrend(userSessions), [userSessions])

  const teamStats = useMemo<TeamSessionStats[]>(() => {
    return teams
      .map((team) => {
        const sessions = teamSessionMap[team.id] ?? []
        const completed = sessions.filter((session) => session.status === 'ended').length
        const weekly = sessions.filter((session) => {
          const createdAt = new Date(session.createdAt)
          return !Number.isNaN(createdAt.getTime()) && createdAt >= sevenDaysAgo
        }).length

        return {
          team,
          totalSessions: sessions.length,
          completedSessions: completed,
          weeklySessions: weekly,
        }
      })
      .sort((a, b) => b.totalSessions - a.totalSessions)
  }, [teamSessionMap, teams, sevenDaysAgo])

  const welcomeName = user?.name?.trim().split(' ')[0] || 'there'

  const monthLabels = useMemo(() => {
    return heatmapData.weeks
      .map((week, index) => {
        const first = week[0]
        if (!first) return null
        const month = first.date.toLocaleDateString(undefined, { month: 'short' })
        const previous = index > 0 ? heatmapData.weeks[index - 1]?.[0] : null
        const previousMonth = previous?.date.toLocaleDateString(undefined, { month: 'short' })
        if (index === 0 || month !== previousMonth) {
          return { index, label: month }
        }
        return null
      })
      .filter((item): item is { index: number; label: string } => Boolean(item))
  }, [heatmapData.weeks])

  const recentSessions = useMemo(
    () =>
      [...userSessions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
    [userSessions]
  )

  return (
    <Stack gap="lg">
      <Card
        withBorder
        radius="lg"
        p="lg"
        style={{
          background:
            'linear-gradient(120deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 118, 110, 0.92) 100%)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Title order={2} c="white">
              Welcome back, {welcomeName}
            </Title>
            <Text size="sm" style={{ opacity: 0.85 }}>
              Track your momentum, streaks, and team-level session activity in one place.
            </Text>
            <Group gap="xs" mt="xs">
              <Badge color="teal" variant="light">
                {sessionsThisWeek} sessions this week
              </Badge>
              <Badge color="blue" variant="light">
                {teams.length} teams
              </Badge>
              <Badge color="orange" variant="light">
                {streaks.current}-day streak
              </Badge>
            </Group>
          </Stack>
          <Group>
            <Button
              variant="white"
              color="dark"
              rightSection={<IconArrowRight size={16} />}
              onClick={() => router.push('/studio/sessions/create')}
            >
              Start session
            </Button>
            <Button variant="light" color="gray" onClick={() => router.push('/studio/sessions')}>
              View sessions
            </Button>
          </Group>
        </Group>
      </Card>

      {error && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="Dashboard data issue"
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" mb={6}>
                <Text size="sm" c="dimmed">
                  Total sessions
                </Text>
                <ThemeIcon color="blue" variant="light" radius="xl">
                  <IconCalendarStats size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="2rem" style={{ lineHeight: 1 }}>
                {userSessions.length}
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                {activeSessions.length} active, {endedSessions.length} completed
              </Text>
            </Card>

            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" mb={6}>
                <Text size="sm" c="dimmed">
                  Weekly completions
                </Text>
                <ThemeIcon color="teal" variant="light" radius="xl">
                  <IconRocket size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="2rem" style={{ lineHeight: 1 }}>
                {completedThisWeek}
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                {sessionsThisWeek} sessions started in last 7 days
              </Text>
            </Card>

            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" mb={6}>
                <Text size="sm" c="dimmed">
                  Completion rate
                </Text>
                <ThemeIcon color="grape" variant="light" radius="xl">
                  <IconTrophy size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="2rem" style={{ lineHeight: 1 }}>
                {completionRate}%
              </Text>
              <Progress value={completionRate} color="grape" mt="sm" />
            </Card>

            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" mb={6}>
                <Text size="sm" c="dimmed">
                  Current streak
                </Text>
                <ThemeIcon color="orange" variant="light" radius="xl">
                  <IconFlame size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={800} size="2rem" style={{ lineHeight: 1 }}>
                {streaks.current} days
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                Longest streak: {streaks.longest} days
              </Text>
            </Card>
          </SimpleGrid>

          <Grid gutter="md">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Card withBorder radius="lg" p="lg" h="100%">
                <Group justify="space-between" mb="sm">
                  <Stack gap={2}>
                    <Text fw={700}>Practice activity map</Text>
                    <Text size="xs" c="dimmed">
                      GitHub-style view of your completed session activity ({HEATMAP_WEEKS} weeks)
                    </Text>
                  </Stack>
                  <Group gap={8}>
                    <Badge color="orange" variant="light">
                      {streaks.current}-day streak
                    </Badge>
                    <Badge color="green" variant="light">
                      Peak {heatmapData.maxCount}/day
                    </Badge>
                  </Group>
                </Group>

                <Box mt="sm">
                  <Group justify="space-between" mb={8}>
                    {monthLabels.map((label) => (
                      <Text key={`${label.label}-${label.index}`} size="xs" c="dimmed">
                        {label.label}
                      </Text>
                    ))}
                  </Group>
                  <Group align="flex-start" wrap="nowrap" gap="xs">
                    <Stack gap={2} mt={6}>
                      {['Sun', '', 'Tue', '', 'Thu', '', 'Sat'].map((dayLabel, index) => (
                        <Text key={`${dayLabel}-${index}`} size="xs" c="dimmed" h={12}>
                          {dayLabel}
                        </Text>
                      ))}
                    </Stack>
                    <Group gap={2} align="flex-start" wrap="nowrap">
                      {heatmapData.weeks.map((week, weekIndex) => (
                        <Stack key={`week-${weekIndex}`} gap={2}>
                          {week.map((cell) => (
                            <Box
                              key={cell.key}
                              title={`${cell.date.toLocaleDateString()}: ${cell.count} completed session${cell.count === 1 ? '' : 's'}`}
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                backgroundColor: activityCellColor[cell.level],
                                border:
                                  cell.level === 0
                                    ? '1px solid rgba(148, 163, 184, 0.22)'
                                    : '1px solid rgba(5, 150, 105, 0.45)',
                              }}
                            />
                          ))}
                        </Stack>
                      ))}
                    </Group>
                  </Group>
                </Box>

                <Divider my="sm" />
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Goal progress this week
                  </Text>
                  <Text size="xs" fw={600}>
                    {sessionsThisWeek}/{WEEKLY_GOAL}
                  </Text>
                </Group>
                <Progress value={weeklyGoalProgress} color="teal" mt={6} />
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Card withBorder radius="lg" p="lg" h="100%">
                <Group justify="space-between" mb="sm">
                  <Text fw={700}>Team snapshot</Text>
                  <ThemeIcon color="blue" variant="light" radius="xl">
                    <IconUsersGroup size={16} />
                  </ThemeIcon>
                </Group>
                {teamStats.length === 0 ? (
                  <Stack gap="sm">
                    <Text size="sm" c="dimmed">
                      You are not connected to any team yet.
                    </Text>
                    <Button variant="light" onClick={() => router.push('/studio/team-config')}>
                      Create or join a team
                    </Button>
                  </Stack>
                ) : (
                  <Stack gap="sm">
                    {teamStats.slice(0, 4).map((item) => {
                      const activeMembers =
                        item.team.memberships?.filter((member) => member.isActive !== false)
                          .length ?? null

                      return (
                        <Card key={item.team.id} withBorder radius="md" p="sm">
                          <Group justify="space-between" mb={4}>
                            <Text fw={600} size="sm">
                              {item.team.name}
                            </Text>
                            <Badge color="teal" variant="light">
                              {item.totalSessions}
                            </Badge>
                          </Group>
                          <Group gap="xs" wrap="wrap">
                            <Badge color="gray" variant="outline">
                              {item.weeklySessions} this week
                            </Badge>
                            <Badge color="gray" variant="outline">
                              {item.completedSessions} completed
                            </Badge>
                            {activeMembers !== null && (
                              <Badge color="gray" variant="outline">
                                {activeMembers} members
                              </Badge>
                            )}
                          </Group>
                        </Card>
                      )
                    })}
                    <Button variant="subtle" onClick={() => router.push('/studio/team-config')}>
                      Manage teams
                    </Button>
                  </Stack>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Card withBorder radius="lg" p="lg">
                <Group justify="space-between" mb="sm">
                  <Text fw={700}>Session momentum</Text>
                  <Badge color="cyan" variant="light">
                    Last 8 weeks
                  </Badge>
                </Group>
                <LineChart
                  h={260}
                  data={weeklyTrend}
                  dataKey="week"
                  series={[
                    { name: 'sessions', color: 'blue' },
                    { name: 'completed', color: 'teal' },
                  ]}
                  gridAxis="y"
                  tickLine="none"
                  curveType="natural"
                />
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Card withBorder radius="lg" p="lg">
                <Group justify="space-between" mb="sm">
                  <Text fw={700}>Recent sessions</Text>
                  <ThemeIcon color="grape" variant="light" radius="xl">
                    <IconTarget size={16} />
                  </ThemeIcon>
                </Group>

                {recentSessions.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No sessions yet. Start one to unlock personalized analytics.
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {recentSessions.map((session) => (
                      <Card
                        key={session.id}
                        withBorder
                        radius="md"
                        p="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/session/${session.id}/performance`)}
                      >
                        <Group justify="space-between">
                          <Text fw={600} size="sm">
                            {session.name?.trim() || `Session ${session.id.slice(0, 8)}`}
                          </Text>
                          <Badge
                            color={session.status === 'ended' ? 'green' : 'blue'}
                            variant="light"
                          >
                            {session.status}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                          {new Date(session.createdAt).toLocaleString()}
                        </Text>
                      </Card>
                    ))}
                  </Stack>
                )}

                <Divider my="sm" />
                <Button
                  fullWidth
                  variant="light"
                  rightSection={<IconArrowRight size={16} />}
                  onClick={() => router.push('/studio/sessions')}
                >
                  Open all sessions
                </Button>

                {latestSession && (
                  <Text size="xs" c="dimmed" mt="sm">
                    Latest: {latestSession.name?.trim() || latestSession.id.slice(0, 8)}
                  </Text>
                )}
              </Card>
            </Grid.Col>
          </Grid>
        </>
      )}
    </Stack>
  )
}
