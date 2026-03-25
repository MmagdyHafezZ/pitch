'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Pagination,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core'
import { BarChart, DonutChart, LineChart } from '@mantine/charts'
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBrain,
  IconChartBar,
  IconChartLine,
  IconExternalLink,
  IconFlame,
  IconSearch,
  IconSelector,
  IconSortAscending,
  IconSortDescending,
  IconTrendingUp,
  IconTrophy,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react'
import { useAuth } from '@/features/auth'
import { useTour } from '@/features/onboarding'
import { useTeams } from '@/features/teams'
import type { Team } from '@/features/teams'
import { api } from '@/lib/client'

// ── Types ──────────────────────────────────────────────────────────────────

type DashboardSession = {
  id: string
  name: string | null
  type: string
  status: string
  createdAt: string
  endedAt: string | null
  runId: string | null
  totalScore: number | null
  scoreBreakdown: Record<string, number> | null
}

type MemberData = {
  userId: string
  name: string
  email: string
  sessions: DashboardSession[]
}

type SortKey = 'date' | 'score' | 'name' | 'type'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 10

// ── Helpers ────────────────────────────────────────────────────────────────

const toMonthKey = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(-2)}`
}

type MonthEntry = { scores: number[]; firstDate: number }

const computeMonthlyTrend = (sessions: DashboardSession[]) => {
  const byMonth = new Map<string, MonthEntry>()
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.endedAt ?? a.createdAt).getTime() - new Date(b.endedAt ?? b.createdAt).getTime()
  )
  for (const s of sorted) {
    if (s.totalScore === null) continue
    const dateStr = s.endedAt ?? s.createdAt
    const key = toMonthKey(dateStr)
    const existing = byMonth.get(key)
    if (existing) {
      existing.scores.push(s.totalScore)
    } else {
      byMonth.set(key, { scores: [s.totalScore], firstDate: new Date(dateStr).getTime() })
    }
  }
  return [...byMonth.entries()]
    .sort(([, a], [, b]) => a.firstDate - b.firstDate)
    .map(([month, { scores }]) => ({
      month,
      avgScore: Math.round((scores.reduce((acc, v) => acc + v, 0) / scores.length) * 10) / 10,
      sessions: scores.length,
    }))
}

const computeCompetencyAverages = (sessions: DashboardSession[]) => {
  const byComp = new Map<string, number[]>()
  for (const s of sessions) {
    if (!s.scoreBreakdown) continue
    for (const [k, v] of Object.entries(s.scoreBreakdown)) {
      const arr = byComp.get(k) ?? []
      arr.push(v)
      byComp.set(k, arr)
    }
  }
  return [...byComp.entries()]
    .map(([label, vals]) => ({
      label,
      avg: Math.round((vals.reduce((acc, v) => acc + v, 0) / vals.length) * 10) / 10,
    }))
    .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg))
    .slice(0, 8)
}

const TYPE_COLORS: Record<string, string> = {
  voice: 'cyan',
  video: 'blue',
  text: 'grape',
  phone: 'orange',
}

const themedCardStyle = {
  background: `linear-gradient(
    180deg,
    var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))) 0%,
    color-mix(in srgb, var(--pitch-card-bg-strong, var(--pitch-card-bg, var(--pitch-surface-bg))) 84%, transparent) 100%
  )`,
  border: '1px solid var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
  boxShadow: `0 10px 24px color-mix(
    in srgb,
    var(--pitch-card-shadow, var(--pitch-surface-bg, #000)) 16%,
    transparent
  )`,
}

const elevatedCardStyle = {
  ...themedCardStyle,
  boxShadow: `0 14px 30px color-mix(
    in srgb,
    var(--pitch-card-shadow, var(--pitch-accent-strong)) 18%,
    transparent
  )`,
}

const animatedCardStyle = (delay: string, revealed: boolean) =>
  revealed ? { ...themedCardStyle, animationDelay: delay } : { ...themedCardStyle, opacity: 0 }

const themedIconStyle = {
  background:
    'var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))))',
  color: 'var(--pitch-accent-strong)',
  border:
    '1px solid var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
}

const computeSessionTypeData = (sessions: DashboardSession[]) => {
  const byType = new Map<string, number>()
  for (const s of sessions) {
    byType.set(s.type, (byType.get(s.type) ?? 0) + 1)
  }
  return [...byType.entries()].map(([name, value]) => ({
    name,
    value,
    color: TYPE_COLORS[name] ?? 'gray',
  }))
}

const scoredOnly = (sessions: DashboardSession[]) =>
  sessions.filter((s): s is DashboardSession & { totalScore: number } => s.totalScore !== null)

const calcAvgScore = (sessions: DashboardSession[]): number | null => {
  const scored = scoredOnly(sessions)
  if (!scored.length) return null
  return Math.round((scored.reduce((acc, s) => acc + s.totalScore, 0) / scored.length) * 10) / 10
}

const calcBestScore = (sessions: DashboardSession[]): number | null => {
  const scored = scoredOnly(sessions)
  if (!scored.length) return null
  return Math.max(...scored.map((s) => s.totalScore))
}

const isThisMonth = (dateStr: string) => {
  const now = new Date()
  const d = new Date(dateStr)
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

const managerTeams = (teams: Team[], userId: string) =>
  teams.filter((t) => {
    const membership = t.memberships?.find((m) => m.userId === userId)
    return membership?.role === 'OWNER' || membership?.role === 'ADMIN'
  })

// ── Skeleton loaders ───────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} radius="lg" p="lg" withBorder style={themedCardStyle}>
          <Skeleton height={12} width="60%" mb={12} />
          <Skeleton height={36} width="45%" mb={8} />
          <Skeleton height={8} width="80%" />
        </Card>
      ))}
    </SimpleGrid>
  )
}

function ChartSkeleton({ h = 240 }: { h?: number }) {
  return (
    <Card radius="lg" p="lg" withBorder style={themedCardStyle}>
      <Skeleton height={14} width="40%" mb={16} />
      <Skeleton height={h} />
    </Card>
  )
}

// ── SortableHeader ─────────────────────────────────────────────────────────

function SortableHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const isActive = currentKey === sortKey
  return (
    <UnstyledButton
      onClick={() => onSort(sortKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 600,
        fontSize: 13,
        color: isActive ? 'var(--pitch-accent-strong)' : 'var(--mantine-color-dimmed)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
      {isActive ? (
        dir === 'asc' ? (
          <IconSortAscending size={14} />
        ) : (
          <IconSortDescending size={14} />
        )
      ) : (
        <IconSelector size={14} style={{ opacity: 0.4 }} />
      )}
    </UnstyledButton>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { startTour } = useTour()
  const { teams, fetchUserTeams } = useTeams()
  const autoStartedTourKeyRef = useRef<string | null>(null)

  // Tab is driven by URL (?tab=Personal|Team)
  const activeTab = searchParams.get('tab') ?? 'Personal'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<DashboardSession[]>([])

  const [teamMemberData, setTeamMemberData] = useState<MemberData[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)

  const [revealed, setRevealed] = useState(false)

  // Session history table state
  const [tableQuery, setTableQuery] = useState('')
  const [tableTypeFilter, setTableTypeFilter] = useState<string | null>(null)
  const [tableStatusFilter, setTableStatusFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tablePage, setTablePage] = useState(1)

  useEffect(() => {
    const startTourParam = searchParams.get('startTour')
    const tourScreenParam = searchParams.get('tourScreen')
    const key = `${startTourParam ?? ''}:${tourScreenParam ?? ''}`

    if (autoStartedTourKeyRef.current === key) {
      return
    }

    if (startTourParam === 'analytics') {
      const timer = setTimeout(() => {
        autoStartedTourKeyRef.current = key
        void startTour('analytics')
      }, 800)
      return () => clearTimeout(timer)
    }

    if (startTourParam === 'full' && tourScreenParam === 'analytics') {
      const timer = setTimeout(() => {
        autoStartedTourKeyRef.current = key
        void startTour('analytics', { mode: 'full' })
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [searchParams, startTour])

  useEffect(() => {
    void fetchUserTeams()
  }, [fetchUserTeams])

  const managedTeams = useMemo(
    () => (user?.id ? managerTeams(teams ?? [], user.id) : []),
    [teams, user?.id]
  )
  const isManager = managedTeams.length > 0

  // Load personal dashboard
  useEffect(() => {
    let active = true
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    api.analytics
      .getDashboard(user.id)
      .then((data) => {
        if (active) {
          setSessions(data.sessions)
          setTimeout(() => setRevealed(true), 50)
        }
      })
      .catch(() => {
        if (active) setError('Unable to load your analytics. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.id])

  // Load team member data lazily when Team tab is selected
  const loadTeamData = useCallback(async () => {
    if (teamLoaded || !isManager || !user?.id) return

    const memberMap = new Map<string, { name: string; email: string }>()
    for (const team of managedTeams) {
      for (const m of team.memberships ?? []) {
        if (m.userId !== user.id && m.user) {
          memberMap.set(m.userId, { name: m.user.name, email: m.user.email })
        }
      }
    }

    if (!memberMap.size) {
      setTeamLoaded(true)
      return
    }

    setTeamLoading(true)
    const results = await Promise.all(
      [...memberMap.entries()].map(async ([userId, meta]) => {
        try {
          const data = await api.analytics.getDashboard(userId)
          return { userId, name: meta.name, email: meta.email, sessions: data.sessions }
        } catch {
          return { userId, name: meta.name, email: meta.email, sessions: [] }
        }
      })
    )
    setTeamMemberData(results)
    setTeamLoading(false)
    setTeamLoaded(true)
  }, [teamLoaded, isManager, managedTeams, user?.id])

  useEffect(() => {
    if (activeTab === 'Team') void loadTeamData()
  }, [activeTab, loadTeamData])

  // ── Personal computed values ─────────────────────────────────────────────

  const monthlyTrend = useMemo(() => computeMonthlyTrend(sessions), [sessions])
  const competencyData = useMemo(() => computeCompetencyAverages(sessions), [sessions])
  const sessionTypeData = useMemo(() => computeSessionTypeData(sessions), [sessions])
  const myAvgScore = useMemo(() => calcAvgScore(sessions), [sessions])
  const myBestScore = useMemo(() => calcBestScore(sessions), [sessions])
  const scoredCount = useMemo(() => scoredOnly(sessions).length, [sessions])
  const sessionsThisMonth = useMemo(
    () => sessions.filter((s) => isThisMonth(s.endedAt ?? s.createdAt)).length,
    [sessions]
  )

  // ── Team computed values ─────────────────────────────────────────────────

  const teamLeaderboard = useMemo(
    () =>
      teamMemberData
        .map((m) => ({
          name: m.name.split(' ')[0] ?? m.name,
          fullName: m.name,
          avgScore: calcAvgScore(m.sessions) ?? 0,
          sessions: m.sessions.length,
        }))
        .filter((m) => m.avgScore > 0)
        .sort((a, b) => b.avgScore - a.avgScore),
    [teamMemberData]
  )

  const teamAvgScore = useMemo(() => {
    const all = teamMemberData.flatMap((m) => m.sessions)
    return calcAvgScore(all)
  }, [teamMemberData])

  const teamTotalSessions = useMemo(
    () => teamMemberData.reduce((acc, m) => acc + m.sessions.length, 0),
    [teamMemberData]
  )

  // ── Session history: filter + sort ───────────────────────────────────────

  const sessionTypes = useMemo(() => [...new Set(sessions.map((s) => s.type))].sort(), [sessions])

  const filteredSessions = useMemo(() => {
    let list = [...sessions]

    // Text search
    const q = tableQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((s) => {
        const name = (s.name ?? '').toLowerCase()
        return name.includes(q) || s.id.toLowerCase().includes(q)
      })
    }

    // Type filter
    if (tableTypeFilter) {
      list = list.filter((s) => s.type === tableTypeFilter)
    }

    // Status filter
    if (tableStatusFilter) {
      list = list.filter((s) => s.status === tableStatusFilter)
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'date':
          cmp =
            new Date(a.endedAt ?? a.createdAt).getTime() -
            new Date(b.endedAt ?? b.createdAt).getTime()
          break
        case 'score':
          cmp = (a.totalScore ?? -Infinity) - (b.totalScore ?? -Infinity)
          break
        case 'name':
          cmp = (a.name ?? a.id).localeCompare(b.name ?? b.id)
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [sessions, tableQuery, tableTypeFilter, tableStatusFilter, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setTablePage(1)
  }

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setTablePage(1)
  }, [tableQuery, tableTypeFilter, tableStatusFilter])

  // ── KPI items ────────────────────────────────────────────────────────────

  const kpiItems = [
    {
      label: 'Total sessions',
      value: sessions.length,
      sub: `${scoredCount} assessed`,
      icon: IconChartBar,
      color: 'blue',
      progress: Math.min(100, (sessions.length / 20) * 100),
    },
    {
      label: 'Avg score',
      value: myAvgScore ?? '—',
      sub: `${scoredCount} scored sessions`,
      icon: IconBrain,
      color: 'cyan',
      progress:
        myAvgScore !== null ? Math.min(100, Math.max(0, ((myAvgScore + 20) / 40) * 100)) : 0,
    },
    {
      label: 'Best score',
      value: myBestScore ?? '—',
      sub: 'Personal best',
      icon: IconTrophy,
      color: 'teal',
      progress:
        myBestScore !== null ? Math.min(100, Math.max(0, ((myBestScore + 20) / 40) * 100)) : 0,
    },
    {
      label: 'This month',
      value: sessionsThisMonth,
      sub: 'Sessions completed',
      icon: IconFlame,
      color: 'orange',
      progress: Math.min(100, (sessionsThisMonth / 10) * 100),
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes analyticsSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .analytics-reveal {
          animation: analyticsSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }
      `}</style>

      <Box p={{ base: 'md', sm: 'xl' }} style={{ minHeight: '100vh' }}>
        <Stack data-tour-id="analytics-dashboard" gap="lg">
          {error && (
            <Alert
              color="red"
              variant="light"
              radius="lg"
              icon={<IconAlertTriangle size={16} />}
              title="Load failed"
            >
              {error}
            </Alert>
          )}

          {/* ══════════════════════════════════════════════════
              PERSONAL TAB
          ══════════════════════════════════════════════════ */}
          {activeTab === 'Personal' && (
            <>
              {loading ? (
                <Stack gap="lg">
                  <KpiSkeleton />
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <ChartSkeleton h={260} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <ChartSkeleton h={260} />
                    </Grid.Col>
                  </Grid>
                  <ChartSkeleton h={220} />
                </Stack>
              ) : sessions.length === 0 ? (
                <Card withBorder radius="xl" p="xl" style={elevatedCardStyle}>
                  <Stack align="center" gap="md" py="xl">
                    <ThemeIcon size={64} radius="xl" style={themedIconStyle}>
                      <IconChartBar size={30} />
                    </ThemeIcon>
                    <Stack align="center" gap={4}>
                      <Text fw={700} size="xl">
                        No sessions found
                      </Text>
                      <Text size="sm" c="dimmed" ta="center" maw={380}>
                        Complete a practice session and it will automatically appear here with
                        detailed analytics.
                      </Text>
                    </Stack>
                      <Button
                        variant="light"
                        size="md"
                        color="brand"
                        onClick={() => router.push('/studio/sessions')}
                      >
                      Go to sessions
                    </Button>
                  </Stack>
                </Card>
              ) : (
                <Stack gap="lg">
                  {/* KPI cards */}
                  <SimpleGrid data-tour-id="analytics-kpis" cols={{ base: 2, sm: 4 }} spacing="md">
                    {kpiItems.map((item, i) => (
                      <Card
                        key={item.label}
                        radius="lg"
                        p="lg"
                        withBorder
                        className={revealed ? 'analytics-reveal' : undefined}
                        style={animatedCardStyle(`${i * 70}ms`, revealed)}
                      >
                        <Group justify="space-between" mb={8}>
                          <Text c="dimmed" size="xs" fw={500} tt="uppercase">
                            {item.label}
                          </Text>
                          <ThemeIcon color={item.color} variant="light" radius="xl" size="sm">
                            <item.icon size={13} />
                          </ThemeIcon>
                        </Group>
                        <Text fw={900} size="2rem" lh={1} mb={6}>
                          {item.value}
                        </Text>
                        <Text size="xs" c="dimmed" mb={10}>
                          {item.sub}
                        </Text>
                        <Progress value={item.progress} size="xs" radius="xl" color={item.color} />
                      </Card>
                    ))}
                  </SimpleGrid>

                  {/* Score trend + Session types */}
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <Card
                        data-tour-id="analytics-score-trend"
                        radius="lg"
                        p="lg"
                        withBorder
                        h="100%"
                        className={revealed ? 'analytics-reveal' : undefined}
                        style={animatedCardStyle('280ms', revealed)}
                      >
                        <Group justify="space-between" mb="md">
                          <Stack gap={2}>
                            <Text fw={700}>Score trend</Text>
                            <Text size="xs" c="dimmed">
                              Average score per month
                            </Text>
                          </Stack>
                          <Badge color="cyan" variant="light" radius="xl">
                            {monthlyTrend.length} month
                            {monthlyTrend.length !== 1 ? 's' : ''}
                          </Badge>
                        </Group>
                        {monthlyTrend.length >= 2 ? (
                          <LineChart
                            h={260}
                            data={monthlyTrend}
                            dataKey="month"
                            series={[{ name: 'avgScore', color: 'cyan.5', label: 'Avg score' }]}
                            withDots
                            withPointLabels
                            tickLine="none"
                            gridAxis="y"
                            curveType="monotone"
                            strokeWidth={2.5}
                            valueFormatter={(v) => `${Number(v)}`}
                            tooltipProps={{ wrapperStyle: { minWidth: 120 } }}
                          />
                        ) : (
                          <Center h={260}>
                            <Stack align="center" gap={6}>
                              <ThemeIcon size={40} radius="xl" color="cyan" variant="light">
                                <IconTrendingUp size={18} />
                              </ThemeIcon>
                              <Text size="sm" c="dimmed" ta="center" maw={260}>
                                {monthlyTrend.length === 1
                                  ? 'Keep going — trend appears across multiple months.'
                                  : 'No scored sessions yet.'}
                              </Text>
                            </Stack>
                          </Center>
                        )}
                      </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Card
                        data-tour-id="analytics-session-types"
                        radius="lg"
                        p="lg"
                        withBorder
                        h="100%"
                        className={revealed ? 'analytics-reveal' : undefined}
                        style={animatedCardStyle('350ms', revealed)}
                      >
                        <Stack gap={2} mb="md">
                          <Text fw={700}>Session types</Text>
                          <Text size="xs" c="dimmed">
                            How you practice
                          </Text>
                        </Stack>
                        {sessionTypeData.length > 0 ? (
                          <>
                            <DonutChart
                              data={sessionTypeData}
                              thickness={22}
                              size={180}
                              h={200}
                              chartLabel={`${sessions.length} total`}
                              tooltipDataSource="segment"
                            />
                            <Divider my="sm" />
                            <Stack gap={6}>
                              {sessionTypeData.map((item) => (
                                <Group key={item.name} justify="space-between">
                                  <Group gap={6}>
                                    <Box
                                      w={8}
                                      h={8}
                                      style={{
                                        borderRadius: '50%',
                                        background: `var(--mantine-color-${item.color}-5)`,
                                      }}
                                    />
                                    <Text size="sm" tt="capitalize">
                                      {item.name}
                                    </Text>
                                  </Group>
                                  <Badge size="xs" color={item.color} variant="light">
                                    {item.value}
                                  </Badge>
                                </Group>
                              ))}
                            </Stack>
                          </>
                        ) : (
                          <Center h={200}>
                            <Text size="sm" c="dimmed">
                              No data yet.
                            </Text>
                          </Center>
                        )}
                      </Card>
                    </Grid.Col>
                  </Grid>

                  {/* Competency breakdown */}
                  {competencyData.length > 0 && (
                    <Card
                      data-tour-id="analytics-competencies"
                      radius="lg"
                      p="lg"
                      withBorder
                      className={revealed ? 'analytics-reveal' : undefined}
                      style={animatedCardStyle('420ms', revealed)}
                    >
                      <Group justify="space-between" mb="md">
                        <Stack gap={2}>
                          <Text fw={700}>Competency breakdown</Text>
                          <Text size="xs" c="dimmed">
                            Average score impact per skill — across all assessed sessions
                          </Text>
                        </Stack>
                        <Badge color="violet" variant="light" radius="xl">
                          {competencyData.length} skills
                        </Badge>
                      </Group>
                      <BarChart
                        h={240}
                        data={competencyData}
                        dataKey="label"
                        series={[{ name: 'avg', color: 'violet.5', label: 'Avg delta' }]}
                        withLegend={false}
                        tickLine="none"
                        gridAxis="y"
                        valueFormatter={(v) => {
                          const n = Number(v)
                          return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
                        }}
                        referenceLines={[{ y: 0, color: 'gray.5', label: 'Baseline' }]}
                      />
                    </Card>
                  )}

                  {/* ── Session history table ── */}
                  <Card
                    data-tour-id="analytics-history"
                    radius="lg"
                    p="lg"
                    withBorder
                    className={revealed ? 'analytics-reveal' : undefined}
                    style={animatedCardStyle('490ms', revealed)}
                  >
                    {/* Header */}
                    <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                      <Stack gap={2}>
                        <Text fw={700}>Session history</Text>
                        <Text size="xs" c="dimmed">
                          {filteredSessions.length} of {sessions.length} sessions
                          {filteredSessions.length > PAGE_SIZE &&
                            ` · page ${tablePage} of ${Math.ceil(filteredSessions.length / PAGE_SIZE)}`}
                        </Text>
                      </Stack>

                      {/* Controls */}
                      <Group gap="sm" wrap="wrap">
                        <TextInput
                          size="xs"
                          placeholder="Search sessions…"
                          leftSection={<IconSearch size={13} />}
                          value={tableQuery}
                          onChange={(e) => setTableQuery(e.currentTarget.value)}
                          style={{ width: 180 }}
                          styles={{
                            input: {
                              borderRadius: 8,
                            },
                          }}
                        />
                        <Select
                          size="xs"
                          placeholder="All types"
                          clearable
                          value={tableTypeFilter}
                          onChange={setTableTypeFilter}
                          data={sessionTypes.map((t) => ({
                            value: t,
                            label: t.charAt(0).toUpperCase() + t.slice(1),
                          }))}
                          style={{ width: 120 }}
                          styles={{ input: { borderRadius: 8 } }}
                        />
                        <Select
                          size="xs"
                          placeholder="All statuses"
                          clearable
                          value={tableStatusFilter}
                          onChange={setTableStatusFilter}
                          data={[
                            { value: 'active', label: 'Active' },
                            { value: 'ended', label: 'Ended' },
                          ]}
                          style={{ width: 130 }}
                          styles={{ input: { borderRadius: 8 } }}
                        />
                      </Group>
                    </Group>

                    {filteredSessions.length === 0 ? (
                      <Box py="xl" ta="center">
                        <Text size="sm" c="dimmed">
                          No sessions match your filters.
                        </Text>
                      </Box>
                    ) : (
                      <Box style={{ overflowX: 'auto' }}>
                        <Table
                          striped
                          highlightOnHover
                          withColumnBorders={false}
                          style={{ minWidth: 580 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th style={{ width: '35%' }}>
                                <SortableHeader
                                  label="Session"
                                  sortKey="name"
                                  currentKey={sortKey}
                                  dir={sortDir}
                                  onSort={handleSort}
                                />
                              </Table.Th>
                              <Table.Th>
                                <SortableHeader
                                  label="Type"
                                  sortKey="type"
                                  currentKey={sortKey}
                                  dir={sortDir}
                                  onSort={handleSort}
                                />
                              </Table.Th>
                              <Table.Th>
                                <SortableHeader
                                  label="Date"
                                  sortKey="date"
                                  currentKey={sortKey}
                                  dir={sortDir}
                                  onSort={handleSort}
                                />
                              </Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th>
                                <SortableHeader
                                  label="Score"
                                  sortKey="score"
                                  currentKey={sortKey}
                                  dir={sortDir}
                                  onSort={handleSort}
                                />
                              </Table.Th>
                              <Table.Th />
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {filteredSessions
                              .slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)
                              .map((session) => {
                                const name =
                                  session.name?.trim() || `Session ${session.id.slice(0, 8)}`
                                const date = new Date(
                                  session.endedAt ?? session.createdAt
                                ).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                                return (
                                  <Table.Tr key={session.id}>
                                    <Table.Td>
                                      <Text size="sm" fw={500} lineClamp={1} maw={240}>
                                        {name}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Badge
                                        size="sm"
                                        variant="dot"
                                        color={TYPE_COLORS[session.type] ?? 'gray'}
                                        tt="capitalize"
                                      >
                                        {session.type}
                                      </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                                        {date}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Badge
                                        size="xs"
                                        variant="light"
                                        color={session.status === 'ended' ? 'green' : 'blue'}
                                      >
                                        {session.status}
                                      </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                      {session.totalScore !== null ? (
                                        <Text
                                          size="sm"
                                          fw={700}
                                          c="teal"
                                          style={{ whiteSpace: 'nowrap' }}
                                        >
                                          {session.totalScore > 0 ? '+' : ''}
                                          {session.totalScore}
                                        </Text>
                                      ) : (
                                        <Text size="sm" c="dimmed">
                                          —
                                        </Text>
                                      )}
                                    </Table.Td>
                                    <Table.Td>
                                      <Button
                                        size="xs"
                                        variant="subtle"
                                        rightSection={<IconExternalLink size={11} />}
                                        onClick={() => {
                                          const q = session.runId
                                            ? `?runId=${encodeURIComponent(session.runId)}`
                                            : ''
                                          router.push(`/session/${session.id}/performance${q}`)
                                        }}
                                      >
                                        View
                                      </Button>
                                    </Table.Td>
                                  </Table.Tr>
                                )
                              })}
                          </Table.Tbody>
                        </Table>
                        {Math.ceil(filteredSessions.length / PAGE_SIZE) > 1 && (
                          <Group justify="center" mt="md">
                            <Pagination
                              total={Math.ceil(filteredSessions.length / PAGE_SIZE)}
                              value={tablePage}
                              onChange={setTablePage}
                              size="sm"
                              radius="md"
                            />
                          </Group>
                        )}
                      </Box>
                    )}
                  </Card>
                </Stack>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════
              TEAM TAB
          ══════════════════════════════════════════════════ */}
          {activeTab === 'Team' && (
            <>
              {!isManager ? (
                <Card withBorder radius="xl" p="xl" style={elevatedCardStyle}>
                  <Stack align="center" gap="md" py="xl">
                    <ThemeIcon size={64} radius="xl" color="violet" variant="light">
                      <IconUsers size={30} />
                    </ThemeIcon>
                    <Text fw={700} size="xl">
                      Team analytics
                    </Text>
                    <Text size="sm" c="dimmed" ta="center" maw={380}>
                      You need to be a team owner or admin to view team analytics.
                    </Text>
                  </Stack>
                </Card>
              ) : teamLoading ? (
                <Stack gap="lg">
                  <KpiSkeleton />
                  <ChartSkeleton h={260} />
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {[0, 1, 2].map((i) => (
                      <ChartSkeleton key={i} h={160} />
                    ))}
                  </SimpleGrid>
                </Stack>
              ) : teamLoaded && teamMemberData.length === 0 ? (
                <Card withBorder radius="xl" p="xl" style={elevatedCardStyle}>
                  <Stack align="center" gap="md" py="xl">
                    <ThemeIcon size={64} radius="xl" color="violet" variant="light">
                      <IconUsers size={30} />
                    </ThemeIcon>
                    <Text fw={700} size="xl">
                      No team members found
                    </Text>
                    <Text size="sm" c="dimmed" ta="center" maw={380}>
                      Add members to your team to see their performance insights here.
                    </Text>
                  </Stack>
                </Card>
              ) : teamLoaded ? (
                <Stack gap="lg">
                  {/* Team KPI cards */}
                  <SimpleGrid
                    data-tour-id="analytics-team-kpis"
                    cols={{ base: 2, sm: 4 }}
                    spacing="md"
                  >
                    {[
                      {
                        label: 'Members',
                        value: teamMemberData.length,
                        sub: 'In your teams',
                        icon: IconUsers,
                        color: 'violet',
                        progress: Math.min(100, (teamMemberData.length / 10) * 100),
                      },
                      {
                        label: 'Team avg score',
                        value: teamAvgScore ?? '—',
                        sub: 'Across all members',
                        icon: IconBrain,
                        color: 'cyan',
                        progress:
                          teamAvgScore !== null
                            ? Math.min(100, Math.max(0, ((teamAvgScore + 20) / 40) * 100))
                            : 0,
                      },
                      {
                        label: 'Top performer',
                        value: teamLeaderboard[0]?.name ?? '—',
                        sub: teamLeaderboard[0]
                          ? `Avg: ${teamLeaderboard[0].avgScore}`
                          : 'No scores yet',
                        icon: IconTrophy,
                        color: 'teal',
                        progress: teamLeaderboard[0]
                          ? Math.min(
                              100,
                              Math.max(0, ((teamLeaderboard[0].avgScore + 20) / 40) * 100)
                            )
                          : 0,
                      },
                      {
                        label: 'Total sessions',
                        value: teamTotalSessions,
                        sub: 'Across all members',
                        icon: IconChartBar,
                        color: 'orange',
                        progress: Math.min(100, (teamTotalSessions / 50) * 100),
                      },
                    ].map((item, i) => (
                      <Card
                        key={item.label}
                        radius="lg"
                        p="lg"
                        withBorder
                        className="analytics-reveal"
                        style={{ ...themedCardStyle, animationDelay: `${i * 70}ms` }}
                      >
                        <Group justify="space-between" mb={8}>
                          <Text c="dimmed" size="xs" fw={500} tt="uppercase">
                            {item.label}
                          </Text>
                          <ThemeIcon color={item.color} variant="light" radius="xl" size="sm">
                            <item.icon size={13} />
                          </ThemeIcon>
                        </Group>
                        <Text fw={900} size="1.7rem" lh={1} mb={6} lineClamp={1}>
                          {item.value}
                        </Text>
                        <Text size="xs" c="dimmed" mb={10}>
                          {item.sub}
                        </Text>
                        <Progress value={item.progress} size="xs" radius="xl" color={item.color} />
                      </Card>
                    ))}
                  </SimpleGrid>

                  {/* Team leaderboard */}
                  {teamLeaderboard.length > 0 && (
                    <Card
                      data-tour-id="analytics-team-leaderboard"
                      radius="lg"
                      p="lg"
                      withBorder
                      style={themedCardStyle}
                    >
                      <Group justify="space-between" mb="md">
                        <Stack gap={2}>
                          <Text fw={700}>Team leaderboard</Text>
                          <Text size="xs" c="dimmed">
                            Average score — higher is better
                          </Text>
                        </Stack>
                        <Badge color="teal" variant="light" radius="xl">
                          {teamLeaderboard.length} member
                          {teamLeaderboard.length !== 1 ? 's' : ''}
                        </Badge>
                      </Group>
                      <BarChart
                        h={260}
                        data={teamLeaderboard}
                        dataKey="name"
                        series={[{ name: 'avgScore', color: 'teal.5', label: 'Avg score' }]}
                        withLegend={false}
                        tickLine="none"
                        gridAxis="y"
                        valueFormatter={(v) => `${Number(v)}`}
                        referenceLines={
                          teamAvgScore !== null
                            ? [{ y: teamAvgScore, color: 'orange.5', label: 'Team avg' }]
                            : undefined
                        }
                      />
                    </Card>
                  )}

                  {/* Member detail cards */}
                  <SimpleGrid
                    data-tour-id="analytics-team-members"
                    cols={{ base: 1, sm: 2, lg: 3 }}
                    spacing="md"
                  >
                    {teamMemberData.map((member) => {
                      const memberAvg = calcAvgScore(member.sessions)
                      const memberBest = calcBestScore(member.sessions)
                      const recentSessions = member.sessions.slice(0, 3)
                      return (
                        <Card key={member.userId} withBorder radius="lg" p="lg" style={themedCardStyle}>
                          <Stack gap="sm">
                            <Group justify="space-between" align="flex-start">
                              <Stack gap={2}>
                                <Text fw={700}>{member.name}</Text>
                                <Text size="xs" c="dimmed">
                                  {member.email}
                                </Text>
                              </Stack>
                              <ThemeIcon color="blue" variant="light" radius="xl" style={themedIconStyle}>
                                <IconUserCheck size={16} />
                              </ThemeIcon>
                            </Group>

                            <SimpleGrid cols={3} spacing="xs">
                              <div>
                                <Text size="xs" c="dimmed">
                                  Sessions
                                </Text>
                                <Text fw={800} size="xl">
                                  {member.sessions.length}
                                </Text>
                              </div>
                              <div>
                                <Text size="xs" c="dimmed">
                                  Avg
                                </Text>
                                <Text
                                  fw={800}
                                  size="xl"
                                  c={memberAvg !== null ? 'teal' : undefined}
                                >
                                  {memberAvg ?? '—'}
                                </Text>
                              </div>
                              <div>
                                <Text size="xs" c="dimmed">
                                  Best
                                </Text>
                                <Text
                                  fw={800}
                                  size="xl"
                                  c={memberBest !== null ? 'cyan' : undefined}
                                >
                                  {memberBest ?? '—'}
                                </Text>
                              </div>
                            </SimpleGrid>

                            {memberAvg !== null && (
                              <Progress
                                value={Math.min(100, Math.max(0, ((memberAvg + 20) / 40) * 100))}
                                size="xs"
                                radius="xl"
                                color="teal"
                              />
                            )}

                            <Divider />

                            {recentSessions.length > 0 ? (
                              <Stack gap={6}>
                                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                                  Recent
                                </Text>
                                {recentSessions.map((s) => (
                                  <Group key={s.id} justify="space-between" gap="xs">
                                    <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                                      {s.name?.trim() || `Session ${s.id.slice(0, 6)}`}
                                    </Text>
                                    <Group gap={4} wrap="nowrap">
                                      {s.totalScore !== null && (
                                        <Badge size="xs" variant="light" color="teal">
                                          {s.totalScore > 0 ? '+' : ''}
                                          {s.totalScore}
                                        </Badge>
                                      )}
                                      <Button
                                        size="xs"
                                        variant="subtle"
                                        p={0}
                                        h="auto"
                                        color="brand"
                                        onClick={() => {
                                          const q = s.runId
                                            ? `?runId=${encodeURIComponent(s.runId)}`
                                            : ''
                                          router.push(`/session/${s.id}/performance${q}`)
                                        }}
                                      >
                                        <IconArrowUpRight size={13} />
                                      </Button>
                                    </Group>
                                  </Group>
                                ))}
                              </Stack>
                            ) : (
                              <Text size="xs" c="dimmed">
                                No sessions yet.
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      )
                    })}
                  </SimpleGrid>
                </Stack>
              ) : null}
            </>
          )}
        </Stack>
      </Box>
    </>
  )
}
