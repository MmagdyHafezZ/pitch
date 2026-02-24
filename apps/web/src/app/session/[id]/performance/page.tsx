'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  Badge,
  Progress,
  Divider,
} from '@mantine/core'
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react'
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
}

const POLL_INTERVAL_MS = 2500
const POSITIVE_LABELS = new Set(['PositiveExample', 'ObjectiveMet', 'InsightfulQuestion'])
const NEGATIVE_LABELS = new Set(['NegativeExample', 'ObjectiveNotMet', 'MissedOpportunity'])

const toGrade = (score: number) => {
  if (score >= 90) return { letter: 'A', color: 'green' as const }
  if (score >= 80) return { letter: 'B', color: 'teal' as const }
  if (score >= 70) return { letter: 'C', color: 'yellow' as const }
  if (score >= 60) return { letter: 'D', color: 'orange' as const }
  return { letter: 'F', color: 'red' as const }
}

const shorten = (value?: string | null, max = 160) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

const buildRecommendation = (item: {
  label: string
  reasonSummary?: string
  scoreDelta?: number
}) => {
  const reason = `${item.reasonSummary ?? ''} ${item.label}`.toLowerCase()
  if (reason.includes('question')) {
    return 'Answer the latest question directly in the first sentence, then add one concrete supporting detail.'
  }
  if (reason.includes('specific') || reason.includes('detail') || reason.includes('vague')) {
    return 'Replace broad claims with specifics: include one number, one timeline, or one implementation step.'
  }
  if (reason.includes('objective') || reason.includes('fit')) {
    return 'Connect your response to the stated objective, then close with a clear next action.'
  }
  if (reason.includes('compliance') || reason.includes('security')) {
    return 'Name the compliance/security control explicitly and who owns it in rollout.'
  }
  if ((item.scoreDelta ?? 0) <= 0) {
    return 'Use a tight structure: direct answer, proof point, and one focused follow-up question.'
  }
  return 'Keep this pattern: concise response with clear relevance to stakeholder concerns.'
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

  const score = assessment?.summary?.totalScore ?? assessment?.totalScore
  const scoreBreakdown = assessment?.summary?.scoreBreakdown ?? {}
  const coachTips = assessment?.summary?.coachTips ?? []
  const turnAnnotations = useMemo(() => report?.turnAnnotations ?? [], [report?.turnAnnotations])
  const chunkSummaries = (report?.chunks ?? []).filter((chunk) => Boolean(chunk.summary))
  const evaluatedTurnCount = turnAnnotations.length

  const normalizedScore = useMemo(() => {
    if (!evaluatedTurnCount) return null
    const rawScore = score ?? 0
    const maxPerTurn = 4
    const minPossible = -maxPerTurn * evaluatedTurnCount
    const maxPossible = maxPerTurn * evaluatedTurnCount
    const normalized = ((rawScore - minPossible) / Math.max(1, maxPossible - minPossible)) * 100
    return Math.max(0, Math.min(100, normalized))
  }, [evaluatedTurnCount, score])

  const grade = normalizedScore === null ? null : toGrade(normalizedScore)

  const highlights = useMemo(() => {
    return [...turnAnnotations]
      .sort((a, b) => {
        const aDelta = a.scoreDelta ?? 0
        const bDelta = b.scoreDelta ?? 0
        if (aDelta !== bDelta) {
          return aDelta - bDelta
        }
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      })
      .slice(0, 8)
  }, [turnAnnotations])

  const strengths = useMemo(() => {
    return [...turnAnnotations]
      .filter((item) => POSITIVE_LABELS.has(item.label) || (item.scoreDelta ?? 0) > 0)
      .sort((a, b) => (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0))
      .slice(0, 5)
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
      .slice(0, 5)
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
      if (status && ['completed', 'failed', 'cancelled'].includes(status)) {
        return true
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        setAssessment(
          (prev) =>
            prev ??
            ({
              runId: activeRunId || 'pending',
              status: 'queued',
            } as AssessmentRun)
        )
        setLoading(false)
      } else {
        setError('Unable to load assessment results.')
        setLoading(false)
        return true
      }
    }

    return false
  }, [activeRunId, loadReport, reportLoadedForRunId, sessionId])

  useEffect(() => {
    if (runIdFromQuery) {
      setActiveRunId(runIdFromQuery)
      return
    }

    let cancelled = false
    const requestFinalRun = async () => {
      try {
        const run = await api.assessments.run({
          sessionId,
          mode: 'final',
        })
        if (!cancelled && run?.runId) {
          setActiveRunId(run.runId as string)
        }
      } catch {
        // Fallback to latest-completed polling if final run request fails.
      }
    }

    void requestFinalRun()
    return () => {
      cancelled = true
    }
  }, [runIdFromQuery, sessionId])

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
    <Box p="xl" style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-dark-9)' }}>
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/studio/sessions')}
          >
            Back to sessions
          </Button>
          <Title order={2} c="white">
            Session Performance
          </Title>
        </Group>
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

      <Paper radius="lg" p="xl" withBorder style={{ backgroundColor: 'white' }}>
        <Stack gap="lg">
          <Group justify="space-between">
            <Group>
              <Text fw={600}>Assessment status</Text>
              <Badge color={assessment?.status === 'completed' ? 'green' : 'blue'}>
                {statusLabel}
              </Badge>
            </Group>
            {assessment?.progress?.percent !== undefined && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  {assessment.progress.stage ?? 'Processing'}
                </Text>
                <Progress value={assessment.progress.percent} w={140} />
              </Group>
            )}
          </Group>

          {loading && (
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Generating your performance summary...
              </Text>
            </Group>
          )}

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          {!loading && assessment?.status === 'completed' && (
            <>
              <Divider />
              <Group>
                <Text fw={600}>Overall score</Text>
                <Text size="lg" fw={700}>
                  {score ?? '—'}
                </Text>
              </Group>

              {grade && (
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <Text fw={600}>Grading indicator</Text>
                    <Badge color={grade.color} size="lg">
                      {grade.letter}
                    </Badge>
                  </Group>
                  <Progress value={normalizedScore ?? 0} color={grade.color} mb={6} />
                  <Text size="xs" c="dimmed">
                    {Math.round(normalizedScore ?? 0)}/100 normalized from {evaluatedTurnCount}{' '}
                    evaluated turns
                  </Text>
                </Paper>
              )}

              {Object.keys(scoreBreakdown).length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Score breakdown</Text>
                  {Object.entries(scoreBreakdown).map(([label, value]) => (
                    <Group key={label} justify="space-between">
                      <Text size="sm">{label}</Text>
                      <Text size="sm" fw={600}>
                        {value}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}

              {assessment.summary?.narrativeSummary && (
                <Stack gap="xs">
                  <Text fw={600}>Narrative summary</Text>
                  <Text size="sm" c="dimmed">
                    {assessment.summary.narrativeSummary}
                  </Text>
                </Stack>
              )}

              {coachTips.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Coach tips</Text>
                  {coachTips.map((tip, index) => (
                    <Text key={`${tip.text}-${index}`} size="sm">
                      • {tip.text}
                    </Text>
                  ))}
                </Stack>
              )}

              {strengths.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>What you did well</Text>
                  {strengths.map((item, index) => (
                    <Paper key={`strength-${item.turnId}-${index}`} withBorder p="sm" radius="md">
                      <Group justify="space-between" mb={6}>
                        <Badge color="teal">{item.label}</Badge>
                        <Text size="xs" c="dimmed">
                          Turn {item.turnId.slice(0, 8)}
                        </Text>
                      </Group>
                      {(item.text || item.evidence) && (
                        <Text size="sm" mb={4}>
                          <Text span fw={600}>
                            What you said:
                          </Text>{' '}
                          {shorten(item.evidence || item.text)}
                        </Text>
                      )}
                      {item.reasonSummary && (
                        <Text size="sm" c="dimmed">
                          Why it worked: {item.reasonSummary}
                        </Text>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}

              {improvements.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Needs improvement</Text>
                  {improvements.map((item, index) => (
                    <Paper key={`improve-${item.turnId}-${index}`} withBorder p="sm" radius="md">
                      <Group justify="space-between" mb={6}>
                        <Badge color={(item.scoreDelta ?? 0) < 0 ? 'red' : 'orange'}>
                          {item.label}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          Turn {item.turnId.slice(0, 8)}
                        </Text>
                      </Group>
                      {(item.text || item.evidence) && (
                        <Text size="sm" mb={4}>
                          <Text span fw={600}>
                            What you said:
                          </Text>{' '}
                          {shorten(item.evidence || item.text)}
                        </Text>
                      )}
                      {item.reasonSummary && (
                        <Text size="sm" c="dimmed" mb={4}>
                          Why it missed: {item.reasonSummary}
                        </Text>
                      )}
                      <Text size="sm" mb={2}>
                        <Text span fw={600}>
                          Try this instead:
                        </Text>{' '}
                        {buildRecommendation(item)}
                      </Text>
                      {(item.evidence || item.text) && (
                        <Text size="xs" c="dimmed">
                          Avoid saying it this way without support: “
                          {shorten(item.evidence || item.text, 120)}”
                        </Text>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}

              {highlights.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Turn highlights</Text>
                  {highlights.map((item, index) => (
                    <Paper
                      key={`${item.turnId}-${item.label}-${index}`}
                      withBorder
                      p="sm"
                      radius="md"
                    >
                      <Group justify="space-between" mb={6}>
                        <Badge color={(item.scoreDelta ?? 0) < 0 ? 'red' : 'teal'}>
                          {item.label}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          Turn {item.turnId.slice(0, 8)}
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
                      {item.evidence && (
                        <Text size="xs" c="dimmed">
                          Evidence: “{item.evidence}”
                        </Text>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}

              {chunkSummaries.length > 0 && (
                <Stack gap="xs">
                  <Text fw={600}>Chunk summaries</Text>
                  {chunkSummaries.map((chunk) => (
                    <Text key={`chunk-${chunk.chunkIndex}`} size="sm" c="dimmed">
                      {chunk.summary}
                    </Text>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}
