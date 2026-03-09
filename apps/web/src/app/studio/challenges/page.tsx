'use client'

import {
  Stack,
  Group,
  Title,
  Text,
  Badge,
  Button,
  Card,
  SimpleGrid,
  Loader,
  Center,
  Box,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import {
  IconTrophy,
  IconClock,
  IconUsers,
  IconRefresh,
  IconSparkles,
  IconArrowRight,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useChallenges } from '@/features/challenges'
import { useTour } from '@/features/onboarding'
import { useAuth } from '@/features/auth'
import type {
  Challenge,
  ChallengeDetail,
  ChallengePeriod,
  ChallengeDifficulty,
} from '@/features/challenges'
import { useI18n } from '@/features/i18n'
import { api } from '@/lib/client'

const DIFFICULTY_COLOR: Record<ChallengeDifficulty, string> = {
  BEGINNER: 'green',
  INTERMEDIATE: 'blue',
  EXPERT: 'orange',
  MASTER: 'red',
}

function ChallengeCard({
  challenge,
  onAccept,
  accepting,
}: {
  challenge: Challenge
  onAccept: (challenge: Challenge) => void
  accepting: boolean
}) {
  const { timeLeft } = useChallenges()
  const hasParticipated = !!challenge.myParticipation
  const hasScore = challenge.myParticipation?.score != null
  const diffColor = DIFFICULTY_COLOR[challenge.difficulty]

  return (
    <Card
      data-tour-id="challenge-card"
      withBorder
      radius="md"
      padding={0}
      style={{
        background: 'var(--mantine-color-dark-7)',
        borderColor: hasParticipated
          ? `var(--mantine-color-${diffColor}-8)`
          : 'var(--mantine-color-dark-5)',
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hasParticipated
          ? `0 0 0 1px var(--mantine-color-${diffColor}-8), 0 4px 16px rgba(0,0,0,0.3)`
          : '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Difficulty accent bar */}
      <Box style={{ height: 3, background: `var(--mantine-color-${diffColor}-5)` }} />

      <Stack gap="sm" p="md" pt="sm">
        {/* Header row: difficulty + participation status */}
        <Group justify="space-between" wrap="nowrap">
          <Badge color={diffColor} variant="filled" radius="sm" size="sm">
            {challenge.difficulty}
          </Badge>
          {hasParticipated && (
            <Badge color={hasScore ? 'yellow' : diffColor} variant="dot" size="xs" radius="sm">
              {hasScore ? 'Completed' : 'In Progress'}
            </Badge>
          )}
        </Group>

        <Title order={5} c="white" lineClamp={2} style={{ lineHeight: 1.3 }}>
          {challenge.title}
        </Title>

        <Text size="xs" c="dimmed" lineClamp={3} style={{ lineHeight: 1.5 }}>
          {challenge.description}
        </Text>

        <Box>
          <Badge variant="outline" color="gray" radius="xl" size="xs">
            {challenge.topic}
          </Badge>
        </Box>

        <Group gap="sm" justify="space-between">
          <Group gap={4}>
            <IconClock size={13} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              {timeLeft(challenge.expiresAt)}
            </Text>
          </Group>
          <Group gap={4}>
            <IconUsers size={13} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              {challenge.participationCount}
            </Text>
          </Group>
          {hasScore && (
            <Group gap={4}>
              <IconTrophy size={13} color="var(--mantine-color-yellow-5)" />
              <Text size="xs" fw={700} c="yellow.4">
                {challenge.myParticipation!.score!.toFixed(1)}
              </Text>
            </Group>
          )}
        </Group>

        <Button
          size="xs"
          variant={hasScore ? 'light' : hasParticipated ? 'outline' : 'filled'}
          color={hasScore ? 'yellow' : hasParticipated ? diffColor : 'brand'}
          onClick={() => onAccept(challenge)}
          loading={accepting}
          fullWidth
          radius="md"
          rightSection={!accepting && !hasScore ? <IconArrowRight size={13} /> : undefined}
        >
          {hasScore ? 'View Result' : hasParticipated ? 'Continue' : 'Accept Challenge'}
        </Button>
      </Stack>
    </Card>
  )
}

export default function ChallengesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { startTour } = useTour()
  const { user } = useAuth()
  const { locale } = useI18n()
  const { challenges, loading, error, fetch, participate } = useChallenges()

  // Read filters from URL params (set by the top bar action bar)
  const periodParam = (searchParams.get('period') as ChallengePeriod) || undefined
  const difficultyParam = (searchParams.get('difficulty') as ChallengeDifficulty) || undefined

  const autoStartedTourKeyRef = useRef<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async (period: ChallengePeriod) => {
    setGenerating(true)
    try {
      await api.challenges.adminGenerate(period)
      await fetch(periodParam, difficultyParam)
    } catch (err) {
      console.error('Generation failed', err)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    void fetch(periodParam, difficultyParam)
  }, [periodParam, difficultyParam])

  useEffect(() => {
    const startTourParam = searchParams.get('startTour')
    const tourScreenParam = searchParams.get('tourScreen')
    const key = `${startTourParam ?? ''}:${tourScreenParam ?? ''}`

    if (autoStartedTourKeyRef.current === key) return

    if (startTourParam === 'challenges') {
      autoStartedTourKeyRef.current = key
      const timer = setTimeout(() => void startTour('challenges'), 800)
      return () => clearTimeout(timer)
    }

    if (startTourParam === 'full' && tourScreenParam === 'challenges') {
      autoStartedTourKeyRef.current = key
      const timer = setTimeout(() => void startTour('challenges', { mode: 'full' }), 800)
      return () => clearTimeout(timer)
    }
  }, [searchParams, startTour])

  const handleAccept = async (challenge: Challenge) => {
    // View result → go to session detail
    if (challenge.myParticipation?.score != null) {
      if (challenge.myParticipation.sessionId) {
        router.push(`/studio/sessions/${challenge.myParticipation.sessionId}`)
      }
      return
    }

    // Already has a session → resume it
    if (challenge.myParticipation?.sessionId) {
      router.push(`/session/${challenge.myParticipation.sessionId}`)
      return
    }

    if (!user?.id) return

    setAccepting(challenge.id)
    try {
      // Register participation first
      if (!challenge.myParticipation) {
        await participate(challenge.id)
      }

      // Fetch full challenge detail (scenarioPrompt + evaluatorPersonaPrompt)
      const detail = (await api.challenges.get(challenge.id)) as ChallengeDetail

      // Difficulty → numeric scale (1–10) for prompt intensity
      const difficultyNumeric: Record<ChallengeDifficulty, number> = {
        BEGINNER: 2,
        INTERMEDIATE: 4,
        EXPERT: 7,
        MASTER: 10,
      }

      // Difficulty → behavioral style (mirrors DIFFICULTY_CONTEXT in the generator)
      const difficultyStyle: Record<
        ChallengeDifficulty,
        {
          tone: string
          patienceLevel: string
          initiativeLevel: string
        }
      > = {
        BEGINNER: { tone: 'Warm', patienceLevel: 'High', initiativeLevel: 'Reactive' },
        INTERMEDIATE: { tone: 'Formal', patienceLevel: 'Medium', initiativeLevel: 'Balanced' },
        EXPERT: { tone: 'Analytical', patienceLevel: 'Low', initiativeLevel: 'Proactive' },
        MASTER: { tone: 'Blunt', patienceLevel: 'Low', initiativeLevel: 'Proactive' },
      }

      // Period → intended session length (mirrors PERIOD_CONTEXT in the generator)
      const periodDuration: Record<ChallengePeriod, number> = {
        DAILY: 5,
        WEEKLY: 15,
        MONTHLY: 30,
      }

      const style = difficultyStyle[challenge.difficulty]
      const sessionLocale = locale || 'en-US'

      const session = await api.sessions.create({
        orgId: user.id,
        // User snapshot — used by the LLM prompt builder to address the participant by name
        userSnapshot: {
          id: user.id,
          email: user.email,
          name: user.name,
          settings: { language: { locale: sessionLocale } },
        },
        name: challenge.title,
        type: 'text',
        tags: ['challenge', challenge.difficulty.toLowerCase(), challenge.period.toLowerCase()],
        language: sessionLocale,
        sessionConfig: {
          challengeId: challenge.id,
          multiTurnEnabled: true,
          // Scenario sub-object: populates [SCENARIO] block in the system prompt
          scenario: {
            topic: challenge.topic,
            objective: challenge.description,
            context: detail.scenarioPrompt,
          },
          // Custom instructions: systemPrompt = scenario brief, customPrompt = buyer persona
          systemPrompt: detail.scenarioPrompt,
          customPrompt: detail.evaluatorPersonaPrompt,
          // LLM
          llm: { provider: 'openai', model: 'gpt-4o-mini' },
          // Roles
          aiRole: 'Buyer / Evaluator',
          userRole: 'Sales Representative',
          // Style — derived from difficulty tier
          difficulty: difficultyNumeric[challenge.difficulty],
          tone: style.tone,
          patienceLevel: style.patienceLevel,
          initiativeLevel: style.initiativeLevel,
          speechRate: 'Conversational',
          responseLength: 'Balanced',
          accent: 'en',
          durationMinutes: periodDuration[challenge.period],
          // CRM — empty (challenges are not CRM-linked)
          crm: {
            provider: 'salesforce',
            connected: false,
            selections: { leads: [], accounts: [], contacts: [], opportunities: [] },
          },
        },
      })

      // Go directly to the live session player
      router.push(`/session/${(session as { id: string }).id}`)
    } catch (err) {
      console.error('Failed to start challenge session', err)
    } finally {
      setAccepting(null)
    }
  }

  const groupedByDifficulty = (
    ['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'] as ChallengeDifficulty[]
  ).reduce(
    (acc, diff) => {
      acc[diff] = challenges.filter((c) => c.difficulty === diff)
      return acc
    },
    {} as Record<ChallengeDifficulty, Challenge[]>
  )

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group data-tour-id="challenges-header" justify="space-between" align="center">
        <Group gap="sm">
          <IconTrophy size={28} color="var(--mantine-color-yellow-5)" />
          <Title order={2} c="white">
            Public Challenges
          </Title>
        </Group>
        <Group gap="xs">
          <Tooltip label="Refresh">
            <ActionIcon
              data-tour-id="challenges-refresh"
              variant="subtle"
              color="gray"
              onClick={() => void fetch(periodParam, difficultyParam)}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            size="xs"
            variant="light"
            color="yellow"
            leftSection={<IconSparkles size={14} />}
            loading={generating}
            onClick={() => void handleGenerate('DAILY')}
          >
            Generate Daily
          </Button>
        </Group>
      </Group>

      {/* Content */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : error ? (
        <Center p="xl">
          <Text c="red">{error}</Text>
        </Center>
      ) : challenges.length === 0 ? (
        <Center p="xl">
          <Stack align="center" gap="sm">
            <IconTrophy size={48} color="var(--mantine-color-dimmed)" />
            <Text c="dimmed">No active challenges right now. Check back soon!</Text>
          </Stack>
        </Center>
      ) : (
        <Stack data-tour-id="challenges-list" gap="xl">
          {(['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'] as ChallengeDifficulty[]).map(
            (diff) => {
              const group = groupedByDifficulty[diff]
              if (!group.length) return null

              return (
                <Box key={diff}>
                  <Group gap="sm" mb="md">
                    <Badge color={DIFFICULTY_COLOR[diff]} size="lg" variant="filled">
                      {diff}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {group.length} challenge{group.length !== 1 ? 's' : ''}
                    </Text>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
                    {group.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        onAccept={handleAccept}
                        accepting={accepting === challenge.id}
                      />
                    ))}
                  </SimpleGrid>
                </Box>
              )
            }
          )}
        </Stack>
      )}
    </Stack>
  )
}
