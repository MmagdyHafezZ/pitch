'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { BarChart } from '@mantine/charts'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBrain,
  IconCircleCheck,
  IconHistory,
  IconRefresh,
  IconTargetArrow,
  IconTrendingUp,
} from '@tabler/icons-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/client'

type AssessmentSummary = {
  totalScore?: number
  scoreBreakdown?: Record<string, number>
  narrativeSummary?: string
  coachTips?: Array<{ text: string; link?: string }>
}

type AssessmentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

type AssessmentRun = {
  runId: string
  status: AssessmentStatus
  mode?: string
  totalScore?: number
  createdAt?: string
  completedAt?: string | null
  summary?: AssessmentSummary
  progress?: { stage?: string; percent?: number }
}

type AssessmentReport = {
  totalScore?: number
  scoreBreakdown?: Record<string, number>
  summary?: {
    narrativeSummary?: string
    coachTips?: Array<{ text: string; link?: string }>
    objectiveMet?: boolean
  }
  turnAnnotations?: Array<{
    turnId: string
    role?: string
    text?: string
    label: string
    confidence?: number
    evidence?: string | null
    scoreDelta?: number
    reasonSummary?: string
    isFinal?: boolean
  }>
  chunks?: Array<{
    chunkIndex: number
    turnIds: string[]
    summary?: string
  }>
  conversationHistory?: Array<{
    turnId: string
    role?: string
    text?: string
    createdAt?: string
    iterationId?: string
    iterationNumber?: number
    isEvaluated?: boolean
  }>
}

const POLL_INTERVAL_MS = 2500
const POSITIVE_LABELS = new Set(['PositiveExample', 'ObjectiveMet', 'InsightfulQuestion'])
const NEGATIVE_LABELS = new Set(['NegativeExample', 'ObjectiveNotMet', 'MissedOpportunity'])

const LABEL_COPY: Record<string, string> = {
  PositiveExample: 'Positive Example',
  NegativeExample: 'Negative Example',
  Neutral: 'Neutral',
  ObjectiveMet: 'Objective Met',
  ObjectiveNotMet: 'Objective Not Met',
  InsightfulQuestion: 'Insightful Question',
  MissedOpportunity: 'Missed Opportunity',
}

const LABEL_COLORS: Record<string, string> = {
  PositiveExample: 'teal',
  NegativeExample: 'red',
  Neutral: 'gray',
  ObjectiveMet: 'green',
  ObjectiveNotMet: 'orange',
  InsightfulQuestion: 'blue',
  MissedOpportunity: 'pink',
}

const CHART_COLORS = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  teal: '#14b8a6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f59e0b',
  gray: '#94a3b8',
  slateGrid: '#334155',
  slateAxis: '#94a3b8',
}

const toGrade = (score: number) => {
  if (score >= 90) return { letter: 'A', color: 'green' as const }
  if (score >= 80) return { letter: 'B', color: 'teal' as const }
  if (score >= 70) return { letter: 'C', color: 'yellow' as const }
  if (score >= 60) return { letter: 'D', color: 'orange' as const }
  return { letter: 'F', color: 'red' as const }
}

const shorten = (value?: string | null, max = 150) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

const labelTitle = (value: string) => LABEL_COPY[value] ?? value

const formatSigned = (value: number) => {
  if (value > 0) return `+${value}`
  return `${value}`
}

const percent = (value: number, total: number) => {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

const buildRecommendation = (item: {
  label: string
  reasonSummary?: string
  scoreDelta?: number
}) => {
  const reason = `${item.reasonSummary ?? ''} ${item.label}`.toLowerCase()
  if (reason.includes('question')) {
    return 'Answer the question directly first, then add one concrete supporting detail.'
  }
  if (reason.includes('specific') || reason.includes('detail') || reason.includes('vague')) {
    return 'Replace broad statements with a number, timeline, or implementation step.'
  }
  if (reason.includes('objective') || reason.includes('fit')) {
    return 'Connect your response to the objective, then close with a clear next action.'
  }
  if (reason.includes('security') || reason.includes('compliance')) {
    return 'State the exact control, risk owner, and practical rollout responsibility.'
  }
  if ((item.scoreDelta ?? 0) <= 0) {
    return 'Use a tighter structure: answer, evidence, and one focused follow-up.'
  }
  return 'Keep this pattern: concise response with explicit relevance to stakeholder goals.'
}

export default function SessionPerformancePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params.id as string
  const runIdFromQuery = searchParams.get('runId')

  const [assessment, setAssessment] = useState<AssessmentRun | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(runIdFromQuery)
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [reportLoadedForRunId, setReportLoadedForRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasRequestedLiveRun, setHasRequestedLiveRun] = useState(false)

  const rawScore = assessment?.summary?.totalScore ?? report?.totalScore ?? assessment?.totalScore
  const score = typeof rawScore === 'number' ? rawScore : null
  const scoreBreakdown = useMemo(
    () => assessment?.summary?.scoreBreakdown ?? report?.scoreBreakdown ?? {},
    [assessment?.summary?.scoreBreakdown, report?.scoreBreakdown]
  )
  const coachTips = assessment?.summary?.coachTips ?? report?.summary?.coachTips ?? []
  const narrativeSummary =
    assessment?.summary?.narrativeSummary ?? report?.summary?.narrativeSummary
  const objectiveMet = report?.summary?.objectiveMet
  const turnAnnotations = useMemo(() => report?.turnAnnotations ?? [], [report?.turnAnnotations])
  const chunkSummaries = (report?.chunks ?? []).filter((chunk) => Boolean(chunk.summary))
  const conversationHistory = useMemo(
    () => report?.conversationHistory ?? [],
    [report?.conversationHistory]
  )
  const evaluatedTurnCount = turnAnnotations.length

  const normalizedScore = useMemo(() => {
    if (!evaluatedTurnCount || score === null) return null
    const maxPerTurn = 4
    const minPossible = -maxPerTurn * evaluatedTurnCount
    const maxPossible = maxPerTurn * evaluatedTurnCount
    const normalized = ((score - minPossible) / Math.max(1, maxPossible - minPossible)) * 100
    return Math.max(0, Math.min(100, normalized))
  }, [evaluatedTurnCount, score])

  const grade = normalizedScore === null ? null : toGrade(normalizedScore)

  const positiveTurns = useMemo(
    () =>
      turnAnnotations.filter(
        (item) => POSITIVE_LABELS.has(item.label) || (item.scoreDelta ?? 0) > 0
      ).length,
    [turnAnnotations]
  )

  const negativeTurns = useMemo(
    () =>
      turnAnnotations.filter(
        (item) => NEGATIVE_LABELS.has(item.label) || (item.scoreDelta ?? 0) < 0
      ).length,
    [turnAnnotations]
  )

  const neutralTurns = Math.max(0, evaluatedTurnCount - positiveTurns - negativeTurns)

  const avgConfidence = useMemo(() => {
    const samples = turnAnnotations
      .map((item) => item.confidence)
      .filter((value): value is number => typeof value === 'number')
    if (!samples.length) return null
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
    return Math.round(average * 100)
  }, [turnAnnotations])

  const totalDelta = useMemo(
    () => turnAnnotations.reduce((sum, item) => sum + (item.scoreDelta ?? 0), 0),
    [turnAnnotations]
  )

  const labelCountData = useMemo(() => {
    const counts = new Map<string, number>()
    turnAnnotations.forEach((item) => {
      counts.set(item.label, (counts.get(item.label) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        name: labelTitle(label),
        value,
        color: LABEL_COLORS[label] ?? 'blue',
      }))
  }, [turnAnnotations])

  const breakdownChartData = useMemo(
    () =>
      Object.entries(scoreBreakdown).map(([label, value]) => ({
        label: labelTitle(label),
        impact: Number(value),
      })),
    [scoreBreakdown]
  )

  const highlights = useMemo(() => {
    return [...turnAnnotations]
      .sort((a, b) => {
        const aDelta = a.scoreDelta ?? 0
        const bDelta = b.scoreDelta ?? 0
        if (aDelta !== bDelta) return bDelta - aDelta
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      })
      .slice(0, 4)
  }, [turnAnnotations])

  const improvements = useMemo(() => {
    return [...turnAnnotations]
      .filter((item) => {
        if (NEGATIVE_LABELS.has(item.label)) return true
        if ((item.scoreDelta ?? 0) < 0) return true
        return item.label === 'Neutral' && Boolean(item.reasonSummary || item.evidence || item.text)
      })
      .sort((a, b) => {
        const aDelta = a.scoreDelta ?? 0
        const bDelta = b.scoreDelta ?? 0
        if (aDelta !== bDelta) return aDelta - bDelta
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      })
      .slice(0, 4)
  }, [turnAnnotations])

  const statusLabel = useMemo(() => {
    if (!assessment) return 'Preparing'
    switch (assessment.status) {
      case 'queued':
        return 'Queued'
      case 'running':
        return 'Running'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return assessment.status ?? 'Unknown'
    }
  }, [assessment])

  const showAnalyticsLoadingScreen =
    !error &&
    (loading || !assessment || assessment.status === 'queued' || assessment.status === 'running')

  const loadingTitle = useMemo(() => {
    if (!assessment || loading) return 'Preparing your analytics'
    if (assessment.status === 'queued') return 'Assessment queued'
    if (assessment.status === 'running') return 'Analyzing your performance'
    if (assessment.status === 'completed') return 'Finalizing report details'
    return 'Preparing your analytics'
  }, [assessment, loading])

  const loadingDescription = useMemo(() => {
    if (!assessment || loading) {
      return 'Connecting to the assessment service and loading your latest run.'
    }
    if (assessment.status === 'queued') {
      return 'Your session was submitted successfully. Processing will begin shortly.'
    }
    if (assessment.status === 'running') {
      return 'Scoring conversation turns, confidence signals, and coaching insights.'
    }
    if (assessment.status === 'completed') {
      return 'Run completed. Pulling full report artifacts from the backend.'
    }
    return 'Loading assessment data.'
  }, [assessment, loading])

  const signalMixData = useMemo(
    () =>
      [
        { name: 'Strong', value: positiveTurns, color: CHART_COLORS.teal },
        { name: 'Neutral', value: neutralTurns, color: CHART_COLORS.gray },
        { name: 'Needs work', value: negativeTurns, color: CHART_COLORS.red },
      ].filter((item) => item.value > 0),
    [negativeTurns, neutralTurns, positiveTurns]
  )

  const radarData = useMemo(() => {
    const entries = Object.entries(scoreBreakdown).map(([label, value]) => ({
      competency: labelTitle(label),
      value: Number(value),
      absValue: Math.abs(Number(value)),
    }))
    if (entries.length === 0) return []
    const maxAbs = Math.max(...entries.map((entry) => entry.absValue), 1)
    return entries.map((entry) => ({
      ...entry,
      normalized: Math.round((entry.absValue / maxAbs) * 100),
    }))
  }, [scoreBreakdown])

  const momentumData = useMemo(() => {
    let cumulative = 0
    return turnAnnotations.map((item, index) => {
      cumulative += item.scoreDelta ?? 0
      return {
        turn: `T${index + 1}`,
        confidence: Math.round((item.confidence ?? 0) * 100),
        cumulative,
        delta: item.scoreDelta ?? 0,
      }
    })
  }, [turnAnnotations])

  const loadReport = useCallback(async (runId: string) => {
    try {
      const reportResponse = await api.assessments.getReport(runId)
      setReport((reportResponse?.report as AssessmentReport | undefined) ?? null)
      setReportLoadedForRunId(runId)
    } catch {
      setReport(null)
      setReportLoadedForRunId(runId)
    }
  }, [])

  const pollAssessment = useCallback(async () => {
    try {
      setError(null)
      let result: AssessmentRun | null = null

      if (activeRunId) {
        result = await api.assessments.getRunStatus(activeRunId)
      } else {
        result = await api.assessments.getLatestForSession(sessionId)
      }

      if (result) {
        setAssessment(result)
        if (!activeRunId && result.runId) {
          setActiveRunId(result.runId)
        }
        if (
          result.status === 'completed' &&
          result.runId &&
          reportLoadedForRunId !== result.runId
        ) {
          await loadReport(result.runId)
        }
      }

      setLoading(false)
      const status = result?.status
      if (status === 'completed') {
        const mode = (result?.mode ?? '').toLowerCase()
        if (!runIdFromQuery && mode === 'live') {
          setActiveRunId(null)
          return false
        }
        return true
      }
      if (status && ['failed', 'cancelled'].includes(status)) {
        if (!runIdFromQuery && activeRunId) {
          setActiveRunId(null)
          return false
        }
        return true
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        if (!activeRunId && !hasRequestedLiveRun) {
          try {
            const run = await api.assessments.run({
              sessionId,
              mode: 'live',
            })
            if (run?.runId) {
              setActiveRunId(run.runId as string)
              setHasRequestedLiveRun(true)
            }
          } catch {
            // Keep polling for eventual backend-generated runs.
          }
        }
        setAssessment((prev) => prev ?? null)
        setLoading(true)
      } else {
        setError('Unable to load assessment results.')
        setLoading(false)
        return true
      }
    }

    return false
  }, [
    activeRunId,
    hasRequestedLiveRun,
    loadReport,
    reportLoadedForRunId,
    runIdFromQuery,
    sessionId,
  ])

  useEffect(() => {
    if (runIdFromQuery) {
      setActiveRunId(runIdFromQuery)
    }
  }, [runIdFromQuery])

  useEffect(() => {
    let active = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const schedule = async () => {
      if (!active) return
      const done = await pollAssessment()
      if (!done && active) {
        timeoutId = setTimeout(schedule, POLL_INTERVAL_MS)
      }
    }

    void schedule()

    return () => {
      active = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [pollAssessment])

  return (
    <Box
      p={{ base: 'md', sm: 'xl' }}
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.14) 0, transparent 36%), radial-gradient(circle at 100% 20%, rgba(16, 185, 129, 0.12) 0, transparent 30%), var(--pitch-app-bg)',
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push('/studio/sessions')}
            >
              Back to sessions
            </Button>
            <Title order={2}>Session Analytics</Title>
          </Group>
          <Group>
            <Button
              variant="default"
              leftSection={<IconHistory size={16} />}
              onClick={() => router.push('/studio/analytics')}
            >
              Past performances
            </Button>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                setLoading(true)
                setReport(null)
                setReportLoadedForRunId(null)
                void pollAssessment()
              }}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        <Paper
          radius="lg"
          p="lg"
          withBorder
          style={{
            background:
              'linear-gradient(115deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.95) 52%, rgba(17, 94, 89, 0.9) 100%)',
            color: 'white',
          }}
        >
          <Group justify="space-between" align="flex-start">
            <Stack gap={6}>
              <Text fw={700} size="xl">
                Performance Overview
              </Text>
              <Text size="sm" style={{ opacity: 0.84 }}>
                Detailed quality signals, score dynamics, and practical coaching from your session.
              </Text>
            </Stack>
            <Group gap="xs" align="center">
              <Badge color={assessment?.status === 'completed' ? 'green' : 'blue'}>
                {statusLabel}
              </Badge>
              {assessment?.mode && (
                <Badge color={assessment.mode === 'live' ? 'cyan' : 'violet'} variant="light">
                  {assessment.mode === 'live' ? 'Live assessment' : 'Final assessment'}
                </Badge>
              )}
              {assessment?.progress?.percent !== undefined && (
                <Group gap="xs">
                  <Text size="sm" style={{ opacity: 0.85 }}>
                    {assessment.progress.stage ?? 'Processing'}
                  </Text>
                  <Progress value={assessment.progress.percent} w={150} color="cyan" />
                </Group>
              )}
            </Group>
          </Group>

          {loading && (
            <Group gap="sm" mt="md">
              <Loader size="sm" color="white" />
              <Text size="sm" style={{ opacity: 0.85 }}>
                Generating your session analytics...
              </Text>
            </Group>
          )}
        </Paper>

        {error && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
            title="Failed to load analytics"
          >
            {error}
          </Alert>
        )}

        {showAnalyticsLoadingScreen && (
          <Card radius="lg" p="xl" withBorder>
            <Stack gap="md" align="center" ta="center">
              <ThemeIcon radius="xl" size={56} color="cyan" variant="light">
                <IconBrain size={28} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={3}>{loadingTitle}</Title>
                <Text size="sm" c="dimmed" maw={540}>
                  {loadingDescription}
                </Text>
              </Stack>
              <Loader size="md" />
              <Group gap="xs">
                <Badge color="blue" variant="light">
                  {assessment?.progress?.stage ?? 'processing'}
                </Badge>
                {assessment?.runId && (
                  <Badge color="gray" variant="outline">
                    Run {assessment.runId.slice(0, 10)}
                  </Badge>
                )}
              </Group>
              <Progress
                value={
                  assessment?.progress?.percent ??
                  (assessment?.status === 'queued'
                    ? 20
                    : assessment?.status === 'running'
                      ? 65
                      : 85)
                }
                w="100%"
                maw={560}
                color="cyan"
                radius="xl"
              />
            </Stack>
          </Card>
        )}

        {!showAnalyticsLoadingScreen && assessment?.status === 'completed' && (
          <Stack gap="lg">
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card
                  radius="lg"
                  p="lg"
                  withBorder
                  style={{
                    background:
                      'linear-gradient(120deg, rgba(17,24,39,0.95) 0%, rgba(30,41,59,0.92) 45%, rgba(8,47,73,0.9) 100%)',
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4}>
                      <Text c="dimmed" size="sm">
                        Overall performance score
                      </Text>
                      <Group gap="xs" align="flex-end">
                        <Text fw={900} size="3rem" c="white" style={{ lineHeight: 1 }}>
                          {score ?? '—'}
                        </Text>
                        <Badge color={grade?.color ?? 'gray'} variant="light" size="lg">
                          Grade {grade?.letter ?? '—'}
                        </Badge>
                      </Group>
                      <Text size="sm" c="gray.3">
                        {evaluatedTurnCount} evaluated turns, {positiveTurns} strong,{' '}
                        {negativeTurns} needs work
                      </Text>
                    </Stack>
                    <RingProgress
                      size={130}
                      thickness={14}
                      roundCaps
                      sections={[
                        {
                          value: normalizedScore ?? 0,
                          color:
                            grade?.color === 'green'
                              ? 'green'
                              : grade?.color === 'teal'
                                ? 'teal'
                                : grade?.color === 'yellow'
                                  ? 'yellow'
                                  : grade?.color === 'orange'
                                    ? 'orange'
                                    : 'red',
                        },
                      ]}
                      label={
                        <Stack gap={0} align="center">
                          <Text size="lg" fw={700} c="white">
                            {normalizedScore !== null ? `${Math.round(normalizedScore)}%` : '—'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            normalized
                          </Text>
                        </Stack>
                      }
                    />
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <SimpleGrid cols={{ base: 2, md: 1 }} spacing="md">
                  <Card radius="lg" p="md" withBorder>
                    <Group justify="space-between" mb={4}>
                      <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                        Avg confidence
                      </Text>
                      <ThemeIcon color="cyan" variant="light" radius="xl" size="sm">
                        <IconBrain size={14} />
                      </ThemeIcon>
                    </Group>
                    <Text fw={800} size="xl">
                      {avgConfidence !== null ? `${avgConfidence}%` : '—'}
                    </Text>
                  </Card>
                  <Card radius="lg" p="md" withBorder>
                    <Group justify="space-between" mb={4}>
                      <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                        Net momentum
                      </Text>
                      <ThemeIcon
                        color={totalDelta >= 0 ? 'teal' : 'red'}
                        variant="light"
                        radius="xl"
                        size="sm"
                      >
                        <IconTrendingUp size={14} />
                      </ThemeIcon>
                    </Group>
                    <Text fw={800} size="xl">
                      {formatSigned(totalDelta)}
                    </Text>
                  </Card>
                </SimpleGrid>
              </Grid.Col>
            </Grid>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card radius="lg" p="lg" withBorder h="100%">
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>Score impact by competency</Text>
                    <Badge color={totalDelta >= 0 ? 'teal' : 'red'} variant="light">
                      Net {formatSigned(totalDelta)}
                    </Badge>
                  </Group>
                  {breakdownChartData.length > 0 ? (
                    <BarChart
                      h={270}
                      data={breakdownChartData}
                      dataKey="label"
                      series={[{ name: 'impact', color: 'blue' }]}
                      valueFormatter={(value) => formatSigned(Number(value))}
                      withLegend={false}
                      tickLine="none"
                      gridAxis="y"
                    />
                  ) : (
                    <Text size="sm" c="dimmed">
                      No score breakdown available for this run.
                    </Text>
                  )}
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card radius="lg" p="lg" withBorder h="100%">
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>Signal mix</Text>
                    <Badge color="gray" variant="light">
                      {evaluatedTurnCount} turns
                    </Badge>
                  </Group>
                  {signalMixData.length > 0 ? (
                    <Box style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={signalMixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={80}
                            paddingAngle={4}
                          >
                            {signalMixData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: number) => [`${value} turns`, 'Count']}
                            contentStyle={{
                              borderRadius: 10,
                              border: `1px solid ${CHART_COLORS.slateGrid}`,
                              backgroundColor: '#0f172a',
                            }}
                            labelStyle={{ color: '#e2e8f0' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Turn-level signal mix is not available yet.
                    </Text>
                  )}
                  <Divider my="sm" />
                  <Stack gap={8}>
                    {labelCountData.slice(0, 5).map((item) => (
                      <Group key={item.name} justify="space-between">
                        <Text size="sm">{item.name}</Text>
                        <Badge color={item.color} variant="light">
                          {item.value}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card radius="lg" p="lg" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>Competency profile</Text>
                    <ThemeIcon color="blue" variant="light" radius="xl">
                      <IconTargetArrow size={16} />
                    </ThemeIcon>
                  </Group>
                  {radarData.length > 0 ? (
                    <Box style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke={CHART_COLORS.slateGrid} />
                          <PolarAngleAxis
                            dataKey="competency"
                            tick={{ fill: CHART_COLORS.slateAxis, fontSize: 12 }}
                          />
                          <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />
                          <Radar
                            name="Normalized impact"
                            dataKey="normalized"
                            stroke={CHART_COLORS.cyan}
                            fill={CHART_COLORS.cyan}
                            fillOpacity={0.28}
                          />
                          <RechartsTooltip
                            formatter={(value: number, _name, item) => {
                              const raw = (item?.payload as { value?: number })?.value
                              return [`${value}% (raw ${formatSigned(Number(raw ?? 0))})`, 'Impact']
                            }}
                            contentStyle={{
                              borderRadius: 10,
                              border: `1px solid ${CHART_COLORS.slateGrid}`,
                              backgroundColor: '#0f172a',
                            }}
                            labelStyle={{ color: '#e2e8f0' }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No competency profile available for this run.
                    </Text>
                  )}
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card radius="lg" p="lg" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>Turn momentum</Text>
                    <ThemeIcon color="teal" variant="light" radius="xl">
                      <IconTrendingUp size={16} />
                    </ThemeIcon>
                  </Group>
                  {momentumData.length > 0 ? (
                    <Box style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <AreaChart data={momentumData}>
                          <defs>
                            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.45} />
                              <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.slateGrid} />
                          <XAxis
                            dataKey="turn"
                            tick={{ fill: CHART_COLORS.slateAxis, fontSize: 12 }}
                          />
                          <YAxis tick={{ fill: CHART_COLORS.slateAxis, fontSize: 12 }} />
                          <RechartsTooltip
                            contentStyle={{
                              borderRadius: 10,
                              border: `1px solid ${CHART_COLORS.slateGrid}`,
                              backgroundColor: '#0f172a',
                            }}
                            labelStyle={{ color: '#e2e8f0' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="confidence"
                            stroke={CHART_COLORS.cyan}
                            fill="url(#confidenceGradient)"
                            strokeWidth={2}
                            name="Confidence %"
                          />
                          <Area
                            type="monotone"
                            dataKey="cumulative"
                            stroke={CHART_COLORS.teal}
                            fillOpacity={0}
                            strokeWidth={2}
                            name="Cumulative score"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Momentum analytics appear once turn-level annotations are available.
                    </Text>
                  )}
                </Card>
              </Grid.Col>
            </Grid>

            <Tabs defaultValue="strengths" variant="pills" radius="md">
              <Tabs.List>
                <Tabs.Tab value="strengths" leftSection={<IconCircleCheck size={14} />}>
                  Strengths
                </Tabs.Tab>
                <Tabs.Tab value="plan" leftSection={<IconTargetArrow size={14} />}>
                  Improvement Plan
                </Tabs.Tab>
                <Tabs.Tab value="conversation" leftSection={<IconHistory size={14} />}>
                  Conversation
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="strengths" pt="md">
                <Card radius="lg" p="lg" withBorder>
                  {highlights.length > 0 ? (
                    <Stack gap="sm">
                      {highlights.map((item, index) => (
                        <Paper
                          key={`strength-${item.turnId}-${index}`}
                          radius="md"
                          withBorder
                          p="sm"
                        >
                          <Group justify="space-between" mb={6}>
                            <Badge color={LABEL_COLORS[item.label] ?? 'teal'} variant="light">
                              {labelTitle(item.label)}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {(item.scoreDelta ?? 0) >= 0 ? '+' : ''}
                              {item.scoreDelta ?? 0}
                              {typeof item.confidence === 'number'
                                ? ` • ${Math.round(item.confidence * 100)}%`
                                : ''}
                            </Text>
                          </Group>
                          {item.reasonSummary && (
                            <Text size="sm" mb={4}>
                              {item.reasonSummary}
                            </Text>
                          )}
                          {(item.evidence || item.text) && (
                            <Text size="xs" c="dimmed">
                              {shorten(item.evidence || item.text)}
                            </Text>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Strength highlights will appear when detailed labels are available.
                    </Text>
                  )}
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="plan" pt="md">
                <Card radius="lg" p="lg" withBorder>
                  {improvements.length > 0 ? (
                    <Stack gap="sm">
                      {improvements.map((item, index) => (
                        <Paper
                          key={`improve-${item.turnId}-${index}`}
                          radius="md"
                          withBorder
                          p="sm"
                        >
                          <Group justify="space-between" mb={6}>
                            <Badge
                              color={(item.scoreDelta ?? 0) < 0 ? 'red' : 'orange'}
                              variant="light"
                            >
                              {labelTitle(item.label)}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {(item.scoreDelta ?? 0) >= 0 ? '+' : ''}
                              {item.scoreDelta ?? 0}
                            </Text>
                          </Group>
                          {item.reasonSummary && (
                            <Text size="sm" mb={4}>
                              {item.reasonSummary}
                            </Text>
                          )}
                          <Text size="sm" fw={600}>
                            Try this:
                          </Text>
                          <Text size="sm" c="dimmed">
                            {buildRecommendation(item)}
                          </Text>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No major improvement gaps identified in this run.
                    </Text>
                  )}
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="conversation" pt="md">
                <Card radius="lg" p="lg" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>Conversation history</Text>
                    <Badge color="gray" variant="light">
                      {conversationHistory.length} turns
                    </Badge>
                  </Group>
                  {conversationHistory.length > 0 ? (
                    <Stack gap="sm">
                      {conversationHistory.map((turn, index) => {
                        const isUser = turn.role === 'user'
                        const roleLabel = isUser
                          ? 'You'
                          : turn.role === 'assistant'
                            ? 'AI'
                            : turn.role || 'Turn'
                        return (
                          <Paper key={`${turn.turnId}-${index}`} radius="md" withBorder p="sm">
                            <Group justify="space-between" mb={6}>
                              <Badge color={isUser ? 'blue' : 'teal'} variant="light">
                                {roleLabel}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {turn.createdAt
                                  ? new Date(turn.createdAt).toLocaleTimeString()
                                  : `Turn ${index + 1}`}
                              </Text>
                            </Group>
                            <Text size="sm" c="dimmed">
                              {turn.text?.trim() ? turn.text : 'No text captured for this turn.'}
                            </Text>
                          </Paper>
                        )
                      })}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Full turn-by-turn conversation history is not available for this run yet.
                    </Text>
                  )}
                </Card>
              </Tabs.Panel>
            </Tabs>

            <Card radius="lg" p="lg" withBorder>
              <Group justify="space-between" mb="sm">
                <Text fw={700}>Narrative summary</Text>
                {objectiveMet !== undefined && (
                  <Badge color={objectiveMet ? 'teal' : 'orange'} variant="light">
                    Objective {objectiveMet ? 'met' : 'not met'}
                  </Badge>
                )}
              </Group>
              {narrativeSummary ? (
                <Text size="sm" c="dimmed" mb={coachTips.length > 0 ? 'md' : 0}>
                  {narrativeSummary}
                </Text>
              ) : (
                <Text size="sm" c="dimmed" mb={coachTips.length > 0 ? 'md' : 0}>
                  No narrative summary was returned for this session.
                </Text>
              )}
              {coachTips.length > 0 && (
                <Stack gap={6}>
                  <Text fw={600} size="sm">
                    Coach tips
                  </Text>
                  {coachTips.map((tip, index) => (
                    <Text key={`${tip.text}-${index}`} size="sm">
                      {index + 1}. {tip.text}
                    </Text>
                  ))}
                </Stack>
              )}
            </Card>

            {chunkSummaries.length > 0 && (
              <Card radius="lg" p="lg" withBorder>
                <Text fw={700} mb="sm">
                  Chunk summaries
                </Text>
                <Stack gap={8}>
                  {chunkSummaries.map((chunk) => (
                    <Text key={`chunk-${chunk.chunkIndex}`} size="sm" c="dimmed">
                      {chunk.summary}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        )}

        {!showAnalyticsLoadingScreen &&
          assessment &&
          (assessment.status === 'failed' || assessment.status === 'cancelled') && (
            <Alert
              color={assessment.status === 'failed' ? 'red' : 'yellow'}
              variant="light"
              icon={<IconAlertTriangle size={16} />}
              title={assessment.status === 'failed' ? 'Assessment failed' : 'Assessment cancelled'}
            >
              {assessment.status === 'failed'
                ? 'The analytics run did not complete. Please retry.'
                : 'This analytics run was cancelled before completion.'}
            </Alert>
          )}
      </Stack>
    </Box>
  )
}
