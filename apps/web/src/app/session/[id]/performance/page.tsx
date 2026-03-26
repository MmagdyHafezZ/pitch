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
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

type TurnAnnotation = NonNullable<AssessmentReport['turnAnnotations']>[number]
type MoveGrade = 'brilliant' | 'good' | 'neutral' | 'miss' | 'inaccuracy' | 'mistake' | 'blunder'

const POLL_INTERVAL_MS = 2500

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
  lime: '#84cc16',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  orange: '#f59e0b',
  gray: '#94a3b8',
  slateGrid: '#334155',
  slateAxis: '#94a3b8',
}

const MOVE_GRADE_ORDER: MoveGrade[] = [
  'brilliant',
  'good',
  'neutral',
  'miss',
  'inaccuracy',
  'mistake',
  'blunder',
]

const MOVE_GRADE_META: Record<
  MoveGrade,
  {
    label: string
    notation: string
    badgeColor: string
    chartColor: string
    description: string
  }
> = {
  brilliant: {
    label: 'Brilliant Move',
    notation: '!!',
    badgeColor: 'lime',
    chartColor: CHART_COLORS.lime,
    description: 'High-impact response with strong relevance and execution.',
  },
  good: {
    label: 'Good Move',
    notation: '!',
    badgeColor: 'teal',
    chartColor: CHART_COLORS.teal,
    description: 'Solid response that advances the objective clearly.',
  },
  neutral: {
    label: 'Neutral Move',
    notation: '=',
    badgeColor: 'gray',
    chartColor: CHART_COLORS.gray,
    description: 'Acceptable move with limited impact on the outcome.',
  },
  miss: {
    label: 'Miss',
    notation: '?!',
    badgeColor: 'yellow',
    chartColor: CHART_COLORS.yellow,
    description: 'A key opportunity was available but not fully used.',
  },
  inaccuracy: {
    label: 'Inaccuracy',
    notation: '?!',
    badgeColor: 'orange',
    chartColor: CHART_COLORS.orange,
    description: 'Minor quality loss from vague or partially off-target wording.',
  },
  mistake: {
    label: 'Mistake',
    notation: '?',
    badgeColor: 'red',
    chartColor: CHART_COLORS.red,
    description: 'Clear quality drop that weakens persuasion or fit.',
  },
  blunder: {
    label: 'Blunder',
    notation: '??',
    badgeColor: 'red',
    chartColor: '#b91c1c',
    description: 'Severe move that materially hurts objective attainment.',
  },
}

const NEEDS_WORK_GRADES = new Set<MoveGrade>(['miss', 'inaccuracy', 'mistake', 'blunder'])

const toGrade = (score: number) => {
  // Thresholds calibrated so that a majority-positive session scores B/A.
  // At 9 turns, all-PositiveExample (+2 each) normalises to ~75 % → A.
  if (score >= 73) return { letter: 'A', color: 'green' as const }
  if (score >= 60) return { letter: 'B', color: 'teal' as const }
  if (score >= 47) return { letter: 'C', color: 'yellow' as const }
  if (score >= 35) return { letter: 'D', color: 'orange' as const }
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

const getMoveGrade = (
  item: Pick<TurnAnnotation, 'label' | 'scoreDelta' | 'reasonSummary'>
): MoveGrade => {
  const delta = item.scoreDelta ?? 0
  const reason = `${item.label} ${item.reasonSummary ?? ''}`.toLowerCase()

  if (item.label === 'MissedOpportunity' || reason.includes('missed opportunity')) return 'miss'
  if (delta >= 2.2) return 'brilliant'
  if (delta >= 0.6) return 'good'
  if (delta <= -2.6) return 'blunder'
  if (delta <= -1.4) return 'mistake'
  if (delta < 0) return 'inaccuracy'
  if (item.label === 'NegativeExample' || item.label === 'ObjectiveNotMet') return 'mistake'
  if (item.label === 'PositiveExample' || item.label === 'ObjectiveMet') return 'good'
  if (item.label === 'InsightfulQuestion') return 'brilliant'
  return 'neutral'
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
  const [recalculating, setRecalculating] = useState(false)
  const [retaking, setRetaking] = useState(false)

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

  const annotationByTurnId = useMemo(() => {
    const map = new Map<string, TurnAnnotation>()
    turnAnnotations.forEach((item) => {
      map.set(item.turnId, item)
    })
    return map
  }, [turnAnnotations])

  const moveGradeCounts = useMemo(() => {
    const counts: Record<MoveGrade, number> = {
      brilliant: 0,
      good: 0,
      neutral: 0,
      miss: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    }
    turnAnnotations.forEach((item) => {
      const grade = getMoveGrade(item)
      counts[grade] += 1
    })
    return counts
  }, [turnAnnotations])

  const strongTurns = moveGradeCounts.brilliant + moveGradeCounts.good
  const needsWorkTurns =
    moveGradeCounts.miss +
    moveGradeCounts.inaccuracy +
    moveGradeCounts.mistake +
    moveGradeCounts.blunder

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

  const moveGradeSummaryData = useMemo(
    () =>
      MOVE_GRADE_ORDER.map((grade) => ({
        name: `${MOVE_GRADE_META[grade].notation} ${MOVE_GRADE_META[grade].label}`,
        value: moveGradeCounts[grade],
        color: MOVE_GRADE_META[grade].badgeColor,
      })).filter((item) => item.value > 0),
    [moveGradeCounts]
  )

  // Sum the actual scoreDelta per label type so the chart shows real score
  // contribution (+14 for 7 PositiveExamples) rather than a raw count (7).
  const breakdownChartData = useMemo(() => {
    const impactByLabel = new Map<string, number>()
    for (const item of turnAnnotations) {
      const delta = item.scoreDelta ?? 0
      impactByLabel.set(item.label, (impactByLabel.get(item.label) ?? 0) + delta)
    }
    if (impactByLabel.size === 0) {
      // No turn annotations yet — fall back to showing counts from scoreBreakdown
      return Object.entries(scoreBreakdown).map(([label, count]) => ({
        label: labelTitle(label),
        impact: Number(count),
      }))
    }
    return Array.from(impactByLabel.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, totalImpact]) => ({ label: labelTitle(label), impact: totalImpact }))
  }, [scoreBreakdown, turnAnnotations])

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
        if (NEEDS_WORK_GRADES.has(getMoveGrade(item))) return true
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

  const assessmentMode = (assessment?.mode ?? '').toLowerCase()
  const isWaitingForCompletedRunReport =
    assessment?.status === 'completed' &&
    Boolean(assessment?.runId) &&
    reportLoadedForRunId !== assessment.runId
  const isWaitingForFinalAssessment =
    !runIdFromQuery && assessment?.status === 'completed' && assessmentMode === 'live'
  const showAnalyticsLoadingScreen =
    !error &&
    (loading ||
      !assessment ||
      assessment.status === 'queued' ||
      assessment.status === 'running' ||
      isWaitingForCompletedRunReport ||
      isWaitingForFinalAssessment)

  const loadingTitle = useMemo(() => {
    if (!assessment || loading) return 'Preparing your analytics'
    if (assessment.status === 'queued') return 'Assessment queued'
    if (assessment.status === 'running') return 'Analyzing your performance'
    if (isWaitingForFinalAssessment) return 'Finalizing your full conversation review'
    if (assessment.status === 'completed') return 'Finalizing report details'
    return 'Preparing your analytics'
  }, [assessment, isWaitingForFinalAssessment, loading])

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
    if (isWaitingForFinalAssessment) {
      return 'Your live snapshot is ready, but the end-of-session assessment is still finishing so the full turn history and coaching stay consistent.'
    }
    if (assessment.status === 'completed') {
      return 'Run completed. Pulling full report artifacts from the backend.'
    }
    return 'Loading assessment data.'
  }, [assessment, isWaitingForFinalAssessment, loading])

  const signalMixData = useMemo(
    () =>
      MOVE_GRADE_ORDER.map((grade) => ({
        name: `${MOVE_GRADE_META[grade].notation} ${MOVE_GRADE_META[grade].label}`,
        value: moveGradeCounts[grade],
        color: MOVE_GRADE_META[grade].chartColor,
      })).filter((item) => item.value > 0),
    [moveGradeCounts]
  )

  // Per-turn data for the "Score per turn" bar chart.
  const turnScoreData = useMemo(
    () =>
      turnAnnotations.map((item, index) => {
        const moveGrade = getMoveGrade(item)
        return {
          turn: `T${index + 1}`,
          delta: item.scoreDelta ?? 0,
          label: labelTitle(item.label),
          moveLabel: `${MOVE_GRADE_META[moveGrade].notation} ${MOVE_GRADE_META[moveGrade].label}`,
          fill: MOVE_GRADE_META[moveGrade].chartColor,
        }
      }),
    [turnAnnotations]
  )

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

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true)
    setLoading(true)
    setReport(null)
    setReportLoadedForRunId(null)
    setAssessment(null)
    setError(null)
    try {
      const run = await api.assessments.run({
        sessionId,
        mode: 'final',
        forceRecalculate: true,
      })
      if (run?.runId) {
        const newRunId = run.runId as string
        setActiveRunId(newRunId)
        setHasRequestedLiveRun(false)
        // Persist the new runId in the URL so a page refresh lands on the same run
        window.history.replaceState(
          null,
          '',
          `/session/${sessionId}/performance?runId=${encodeURIComponent(newRunId)}`
        )
      }
    } catch {
      setError('Failed to start a new assessment run.')
      setLoading(false)
    } finally {
      setRecalculating(false)
    }
  }, [sessionId])

  const handleRetake = useCallback(async () => {
    setRetaking(true)
    setError(null)
    try {
      await api.sessions.restart(sessionId, {
        reason: 'restart_from_scratch',
      })
      router.push(`/session/${sessionId}?entry=retake`)
    } catch {
      setError('Failed to start a fresh iteration.')
    } finally {
      setRetaking(false)
    }
  }, [router, sessionId])

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
      <Stack gap="lg" w="100%" maw={1200} mx="auto">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group wrap="wrap" gap="xs">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push('/studio/sessions')}
            >
              Back to sessions
            </Button>
            <Title order={2} visibleFrom="sm">
              Session Analytics
            </Title>
            <Title order={4} hiddenFrom="sm">
              Session Analytics
            </Title>
          </Group>
          <Group wrap="wrap" gap="xs">
            <Button
              variant="default"
              leftSection={<IconHistory size={16} />}
              onClick={() => router.push('/studio/analytics')}
              visibleFrom="sm"
            >
              Past performances
            </Button>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconRefresh size={16} />}
              loading={retaking}
              onClick={() => void handleRetake()}
            >
              Retake session
            </Button>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={recalculating}
              onClick={() => void handleRecalculate()}
            >
              Recalculate
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
                        {evaluatedTurnCount} evaluated turns, {strongTurns} strong (
                        {moveGradeCounts.brilliant} brilliant), {needsWorkTurns} needs work
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
                    <Text fw={700}>Move grades</Text>
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
                    {moveGradeSummaryData.map((item) => (
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
                    <Text fw={700}>Score per turn</Text>
                    <ThemeIcon color="blue" variant="light" radius="xl">
                      <IconTargetArrow size={16} />
                    </ThemeIcon>
                  </Group>
                  {turnScoreData.length > 0 ? (
                    <Box style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer>
                        <RechartsBarChart data={turnScoreData} barCategoryGap="28%">
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.slateGrid} />
                          <XAxis
                            dataKey="turn"
                            tick={{ fill: CHART_COLORS.slateAxis, fontSize: 12 }}
                          />
                          <YAxis tick={{ fill: CHART_COLORS.slateAxis, fontSize: 12 }} />
                          <RechartsTooltip
                            formatter={(value: number, _name, item) => [
                              `${formatSigned(value)} pts`,
                              (item?.payload as { moveLabel?: string; label?: string })
                                ?.moveLabel ??
                                (item?.payload as { label?: string })?.label ??
                                '',
                            ]}
                            contentStyle={{
                              borderRadius: 10,
                              border: `1px solid ${CHART_COLORS.slateGrid}`,
                              backgroundColor: '#0f172a',
                            }}
                            labelStyle={{ color: '#e2e8f0' }}
                          />
                          <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                            {turnScoreData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Turn scores appear once annotations are available.
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

            <Tabs defaultValue="conversation" variant="pills" radius="md">
              <Tabs.List>
                <Tabs.Tab value="conversation" leftSection={<IconHistory size={14} />}>
                  Conversation
                </Tabs.Tab>
                <Tabs.Tab value="strengths" leftSection={<IconCircleCheck size={14} />}>
                  Strengths
                </Tabs.Tab>
                <Tabs.Tab value="plan" leftSection={<IconTargetArrow size={14} />}>
                  Improvement Plan
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="strengths" pt="md">
                <Card radius="lg" p="lg" withBorder>
                  {highlights.length > 0 ? (
                    <Stack gap="sm">
                      {highlights.map((item, index) => {
                        const moveGrade = getMoveGrade(item)
                        const moveMeta = MOVE_GRADE_META[moveGrade]
                        return (
                          <Paper
                            key={`strength-${item.turnId}-${index}`}
                            radius="md"
                            withBorder
                            p="sm"
                          >
                            <Group justify="space-between" mb={6}>
                              <Group gap="xs">
                                <Badge color={moveMeta.badgeColor} variant="light">
                                  {moveMeta.notation} {moveMeta.label}
                                </Badge>
                                <Badge color={LABEL_COLORS[item.label] ?? 'gray'} variant="outline">
                                  {labelTitle(item.label)}
                                </Badge>
                              </Group>
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
                        )
                      })}
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
                      {improvements.map((item, index) => {
                        const moveGrade = getMoveGrade(item)
                        const moveMeta = MOVE_GRADE_META[moveGrade]
                        return (
                          <Paper
                            key={`improve-${item.turnId}-${index}`}
                            radius="md"
                            withBorder
                            p="sm"
                          >
                            <Group justify="space-between" mb={6}>
                              <Group gap="xs">
                                <Badge color={moveMeta.badgeColor} variant="light">
                                  {moveMeta.notation} {moveMeta.label}
                                </Badge>
                                <Badge color={LABEL_COLORS[item.label] ?? 'gray'} variant="outline">
                                  {labelTitle(item.label)}
                                </Badge>
                              </Group>
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
                        )
                      })}
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
                        const annotation = annotationByTurnId.get(turn.turnId)
                        const moveGrade = annotation ? getMoveGrade(annotation) : null
                        const moveMeta = moveGrade ? MOVE_GRADE_META[moveGrade] : null
                        const roleLabel = isUser
                          ? 'You'
                          : turn.role === 'assistant'
                            ? 'AI'
                            : turn.role || 'Turn'
                        return (
                          <Paper key={`${turn.turnId}-${index}`} radius="md" withBorder p="sm">
                            <Group justify="space-between" mb={6}>
                              <Group gap="xs">
                                <Badge color={isUser ? 'blue' : 'teal'} variant="light">
                                  {roleLabel}
                                </Badge>
                                {isUser && moveMeta && (
                                  <Badge color={moveMeta.badgeColor} variant="light">
                                    {moveMeta.notation} {moveMeta.label}
                                  </Badge>
                                )}
                                {isUser && !moveMeta && (
                                  <Badge color="gray" variant="outline">
                                    Move Pending
                                  </Badge>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">
                                {turn.createdAt
                                  ? new Date(turn.createdAt).toLocaleTimeString()
                                  : `Turn ${index + 1}`}
                              </Text>
                            </Group>
                            {isUser && moveMeta && (
                              <Text size="xs" mb={6} c="dimmed">
                                {moveMeta.description}
                                {annotation?.reasonSummary
                                  ? ` • ${shorten(annotation.reasonSummary, 120)}`
                                  : ''}
                              </Text>
                            )}
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
