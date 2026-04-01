'use client'

import {
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
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconBrain,
  IconCalendar,
  IconCalendarEvent,
  IconCoin,
  IconEdit,
  IconFile,
  IconInfoCircle,
  IconLink,
  IconMicrophone,
  IconPlayerPlay,
  IconRobot,
  IconTag,
  IconUser,
} from '@tabler/icons-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LtiEmbedModal } from '@/components/ui/LtiEmbedModal'
import { useAuth } from '@/features/auth'
import type { Session, SessionConfigData } from '@/features/sessions'
import { useSessionCoinEstimate } from '@/features/coins/hooks/useCoinsBalance'
import {
  normalizeScenarioConfig,
  alignPitchRolePair,
} from '@/features/scenarios/utils/scenario-editor'
import { api } from '@/lib/client'
import classes from './session-detail.module.css'

type PersonaTraits = Record<string, unknown> & {
  role?: string
  level?: string
  personality?: string
  background?: string
  tone?: string
  patience?: string
  communicationStyle?: string
  voiceProfile?: string
  signatureTraits?: string[]
  highlights?: string[]
  objections?: string[]
  triggers?: string[]
  hotButtons?: string[]
  metrics?: Record<string, number> | Array<{ label: string; value: number }>
  voice?: {
    provider?: string
    voiceName?: string
    language?: string
    model?: string
  }
}

type SkillFocus = {
  label: string
  reason: string
}

type SignalCardProps = {
  label: string
  value: string
  description?: string | null
  icon: ReactNode
}

type InsightListProps = {
  title: string
  items: string[]
  empty: string
  color?: string
}

const statusColor: Record<string, string> = {
  active: 'brand',
  ended: 'green',
}

const typeLabel: Record<string, string> = {
  text: 'Text simulation',
  voice: 'Voice simulation',
  video: 'Video simulation',
  phone: 'Phone simulation',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const toTextArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter((item): item is string => Boolean(item))
  }

  const single = toText(value)
  return single ? [single] : []
}

const uniqueText = (items: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const next: string[] = []

  for (const item of items) {
    if (!item) continue
    const normalized = item.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(normalized)
  }

  return next
}

const formatDateTime = (value?: string | null): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const toLabel = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatSessionType = (value?: string | null) => {
  if (!value) return 'Simulation'
  return typeLabel[value.toLowerCase()] ?? toLabel(value)
}

const formatDifficulty = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 3) return 'Warm-up'
    if (value <= 6) return 'Focused'
    if (value <= 8) return 'Challenging'
    return 'Elite'
  }

  const text = toText(value)
  return text ? toLabel(text) : null
}

const formatMetricLabel = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())

const clampMetric = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const normalizePersonaMetrics = (traits: PersonaTraits) => {
  if (!traits.metrics) return []

  if (Array.isArray(traits.metrics)) {
    return traits.metrics
      .filter((metric) => Number.isFinite(metric?.value))
      .map((metric) => ({
        label: metric.label,
        value: clampMetric(metric.value),
      }))
  }

  if (!isRecord(traits.metrics)) return []

  return Object.entries(traits.metrics)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([label, value]) => ({
      label: formatMetricLabel(label),
      value: clampMetric(value as number),
    }))
}

const getVoiceProfile = (traits: PersonaTraits) => {
  if (toText(traits.voiceProfile)) return toText(traits.voiceProfile)
  if (isRecord(traits.voice)) {
    const provider = toText(traits.voice.provider)
    const voiceName = toText(traits.voice.voiceName)
    if (provider || voiceName) return `${provider ?? 'Voice'} / ${voiceName ?? 'Default'}`
  }
  return null
}

const sectionCardStyle = {
  background: 'linear-gradient(180deg, rgba(14, 20, 38, 0.96) 0%, rgba(9, 14, 29, 0.98) 100%)',
  borderColor: 'rgba(111, 140, 205, 0.16)',
  overflow: 'hidden',
} as const

function SurfaceCard({
  title,
  subtitle,
  icon,
  children,
  aside,
}: {
  title: string
  subtitle?: string
  icon: ReactNode
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <Card
      withBorder
      radius="xl"
      padding="xl"
      style={sectionCardStyle}
      className={classes.surfaceCard}
    >
      <Group
        justify="space-between"
        align="flex-start"
        gap="md"
        mb={subtitle ? 'xs' : 'md'}
        className={classes.surfaceHeader}
      >
        <Group gap="sm" align="center" className={classes.surfaceHeaderMain}>
          {icon}
          <Box>
            <Title order={4} c="white">
              {title}
            </Title>
            {subtitle ? (
              <Text size="sm" c="dimmed" mt={4} className={classes.surfaceSubtitle}>
                {subtitle}
              </Text>
            ) : null}
          </Box>
        </Group>
        {aside ? <Box className={classes.surfaceAside}>{aside}</Box> : null}
      </Group>
      {!subtitle ? null : <Divider color="rgba(111, 140, 205, 0.14)" my="md" />}
      {children}
    </Card>
  )
}

function SignalCard({ label, value, description, icon }: SignalCardProps) {
  return (
    <Card
      withBorder
      radius="lg"
      padding="md"
      className={classes.signalCard}
      style={{
        background: 'rgba(12, 19, 36, 0.86)',
        borderColor: 'rgba(122, 156, 222, 0.18)',
      }}
    >
      <Group gap="xs" align="center" mb={8}>
        <ThemeIcon size={28} radius="md" variant="light" color="blue">
          {icon}
        </ThemeIcon>
        <Text size="xs" fw={700} c="blue.1" tt="uppercase" style={{ letterSpacing: 0.8 }}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={700} c="white" className={classes.signalValue}>
        {value}
      </Text>
      {description ? (
        <Text size="xs" c="dimmed" mt={8} className={classes.signalDescription}>
          {description}
        </Text>
      ) : null}
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box className={classes.detailRow}>
      <Text size="sm" c="dimmed" className={classes.detailLabel}>
        {label}
      </Text>
      <Box className={classes.detailValue}>{value}</Box>
    </Box>
  )
}

function InsightList({ title, items, empty, color = 'blue' }: InsightListProps) {
  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} c={`${color}.1`} tt="uppercase" style={{ letterSpacing: 0.8 }}>
        {title}
      </Text>
      {items.length > 0 ? (
        <Stack gap="xs">
          {items.map((item, index) => (
            <Group
              key={`${title}-${index}`}
              gap="sm"
              align="flex-start"
              wrap="nowrap"
              className={classes.insightItem}
            >
              <ThemeIcon size={20} radius="xl" variant="light" color={color}>
                <Text size="xs" fw={800}>
                  {index + 1}
                </Text>
              </ThemeIcon>
              <Text size="sm" c="gray.2" className={classes.insightText}>
                {item}
              </Text>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      )}
    </Stack>
  )
}

function SkillFocusCard({ skill }: { skill: SkillFocus }) {
  return (
    <Card
      withBorder
      radius="lg"
      padding="md"
      style={{
        background: 'rgba(12, 18, 33, 0.84)',
        borderColor: 'rgba(101, 140, 212, 0.16)',
      }}
    >
      <Text size="sm" fw={700} c="white" mb={6}>
        {skill.label}
      </Text>
      <Text size="sm" c="dimmed" style={{ lineHeight: 1.55 }}>
        {skill.reason}
      </Text>
    </Card>
  )
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ltiEmbedOpen, setLtiEmbedOpen] = useState(false)

  const _coinRaw = (session?.sessionConfig ?? {}) as Record<string, unknown>
  const _coinLlm = isRecord(_coinRaw.llm) ? (_coinRaw.llm as Record<string, unknown>) : {}
  const { data: coinEstimate, isLoading: coinEstimateLoading } = useSessionCoinEstimate({
    model: toText(_coinLlm.model) ?? undefined,
    provider: toText(_coinLlm.provider) ?? undefined,
    sessionType: session?.type ?? 'text',
    durationMinutes: toNumber(_coinRaw.durationMinutes) ?? undefined,
    enabled: session !== null,
  })

  useEffect(() => {
    if (!id) return

    setLoading(true)
    setError(null)

    api.sessions
      .getById(id)
      .then((data) => setSession(data as Session))
      .catch(() => setError('Failed to load session'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <Center p="xl" style={{ height: '60vh' }}>
        <Loader size="lg" />
      </Center>
    )
  }

  if (error || !session) {
    return (
      <Center p="xl" style={{ height: '60vh' }}>
        <Stack align="center" gap="md">
          <Text c="red">{error ?? 'Session not found'}</Text>
          <Button
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </Stack>
      </Center>
    )
  }

  const displayName = session.name?.trim() || `Session ${session.id.substring(0, 12)}`
  const displayStatus = typeof session.status === 'string' ? session.status : 'active'
  const badgeColor = statusColor[displayStatus] ?? 'gray'

  const rawConfig = (session.sessionConfig ?? {}) as Record<string, unknown>
  const config = rawConfig as SessionConfigData & Record<string, unknown>
  const embeddedScenario = isRecord(rawConfig.scenario) ? rawConfig.scenario : {}
  const counterpartProfile = isRecord(rawConfig.counterpartProfile)
    ? rawConfig.counterpartProfile
    : {}
  const llmConfig = isRecord(rawConfig.llm) ? rawConfig.llm : {}
  const voiceConfig = isRecord(rawConfig.voice) ? rawConfig.voice : {}
  const videoConfig = isRecord(rawConfig.video) ? rawConfig.video : {}
  const crmConfig = isRecord(rawConfig.crm) ? rawConfig.crm : {}
  const personaTraits = (
    isRecord(session.persona?.traits) ? session.persona?.traits : {}
  ) as PersonaTraits

  const normalizedScenario = normalizeScenarioConfig(
    isRecord(session.scenario?.config) ? session.scenario?.config : embeddedScenario,
    {
      objective: toText(rawConfig.objective) ?? undefined,
      background:
        toText(embeddedScenario.background) ??
        toText(embeddedScenario.context) ??
        toText(rawConfig.context) ??
        undefined,
      context:
        toText(embeddedScenario.context) ??
        toText(embeddedScenario.background) ??
        toText(rawConfig.context) ??
        undefined,
      language: session.language ?? toText(rawConfig.language) ?? undefined,
    }
  )

  const sessionSummary =
    toText(rawConfig.description) ??
    toText(session.scenario?.description) ??
    toText(embeddedScenario.description) ??
    'This session is configured and ready to launch.'

  const scenarioName =
    session.scenario?.name?.trim() ??
    toText(embeddedScenario.name) ??
    toText(embeddedScenario.topic) ??
    'Scenario not named yet'

  const scenarioDescription =
    session.scenario?.description?.trim() ?? toText(embeddedScenario.description) ?? sessionSummary

  const alignedRoles = alignPitchRolePair(
    toText(config.aiRole) ??
      toText(normalizedScenario.roles.assistant) ??
      toText(normalizedScenario.roles.ai) ??
      toText(personaTraits.role) ??
      undefined,
    toText(config.userRole) ??
      toText(normalizedScenario.roles.user) ??
      toText(normalizedScenario.roles.client) ??
      undefined
  )

  const objective =
    normalizedScenario.objective ||
    toText(rawConfig.objective) ||
    toText(embeddedScenario.objective) ||
    'Build confidence and advance the conversation to a clear next step.'

  const contextNarrative =
    normalizedScenario.background ||
    normalizedScenario.context ||
    toText(rawConfig.context) ||
    toText(embeddedScenario.background) ||
    null

  const aiRole =
    alignedRoles.aiRole ??
    toText(personaTraits.role) ??
    toText(normalizedScenario.roles.assistant) ??
    toText(normalizedScenario.roles.ai) ??
    'Counterpart'

  const userRole =
    alignedRoles.userRole ??
    toText(normalizedScenario.roles.user) ??
    toText(normalizedScenario.roles.client) ??
    'Seller'

  const personaName =
    session.persona?.name?.trim() ?? toText(counterpartProfile.name) ?? aiRole ?? 'AI counterpart'
  const counterpartRole = toText(personaTraits.role) ?? toText(counterpartProfile.role) ?? aiRole
  const counterpartLevel = toText(personaTraits.level) ?? toText(counterpartProfile.level)
  const counterpartPersonality =
    toText(personaTraits.personality) ?? toText(counterpartProfile.personality)
  const counterpartBackground =
    toText(personaTraits.background) ?? toText(counterpartProfile.background)
  const counterpartTone =
    toText(personaTraits.communicationStyle) ??
    toText(personaTraits.tone) ??
    toText(personaTraits.patience) ??
    toText(counterpartProfile.tone) ??
    null
  const counterpartVoice = getVoiceProfile(personaTraits)

  const successCriteria = uniqueText([
    ...normalizedScenario.successCriteria,
    ...toTextArray(embeddedScenario.successCriteria),
  ])
  const stakes = uniqueText([...normalizedScenario.stakes, ...toTextArray(embeddedScenario.stakes)])
  const constraints = uniqueText([
    ...normalizedScenario.constraints,
    ...toTextArray(embeddedScenario.constraints),
  ])
  const likelyObjections = uniqueText([
    ...toTextArray(embeddedScenario.likelyObjections),
    ...toTextArray(counterpartProfile.objections),
    ...toTextArray(personaTraits.objections),
    ...toTextArray(personaTraits.triggers),
    ...toTextArray(personaTraits.hotButtons),
  ])
  const signatureTraits = uniqueText([
    ...toTextArray(counterpartProfile.signatureTraits),
    ...toTextArray(personaTraits.signatureTraits),
    ...toTextArray(personaTraits.highlights),
  ])
  const counterpartMetrics = normalizePersonaMetrics(
    Object.keys(personaTraits).length > 0 ? personaTraits : counterpartProfile
  ).slice(0, 4)

  const styleDifficulty =
    formatDifficulty(config.difficulty) ??
    formatDifficulty(normalizedScenario.difficulty) ??
    'Balanced'
  const durationMinutes =
    toNumber(normalizedScenario.durationMinutes) ?? toNumber(rawConfig.durationMinutes)
  const multiTurnLabel =
    typeof config.multiTurnEnabled === 'boolean'
      ? config.multiTurnEnabled
        ? 'Adaptive back-and-forth'
        : 'Single-pass exchange'
      : 'Adaptive back-and-forth'
  const language =
    session.language ?? normalizedScenario.language ?? toText(rawConfig.language) ?? 'Default'

  const supportAttachments = Array.isArray(config.attachments)
    ? config.attachments
        .map((attachment) => toText(attachment.filename))
        .filter((item): item is string => Boolean(item))
    : []

  const tags = uniqueText([...session.tags, ...normalizedScenario.tags])

  const calendarProviderRaw = toText(rawConfig.calendarProvider)
  const calendarProvider =
    calendarProviderRaw === 'google'
      ? 'Google Calendar'
      : calendarProviderRaw === 'microsoft'
        ? 'Outlook / Microsoft 365'
        : calendarProviderRaw
  const calendarEventStart = formatDateTime(toText(rawConfig.eventStartTime))
  const calendarAttendees = Array.isArray(rawConfig.attendees)
    ? (rawConfig.attendees as Array<{ email?: string; name?: string }>)
        .map((attendee) => attendee.name ?? attendee.email ?? '')
        .filter(Boolean)
    : []

  const expectationPoints = uniqueText([
    durationMinutes
      ? `Plan for about ${durationMinutes} minutes in a ${formatSessionType(session.type).toLowerCase()}.`
      : `Expect a ${formatSessionType(session.type).toLowerCase()} with realistic pressure and follow-up.`,
    counterpartPersonality
      ? `${personaName} is likely to feel ${counterpartPersonality.replace(/\.$/, '').toLowerCase()}.`
      : null,
    likelyObjections[0]
      ? `Be ready for objections like ${likelyObjections.slice(0, 2).join(' and ')}.`
      : null,
    stakes[0] ? `The pressure point is ${stakes[0].replace(/\.$/, '').toLowerCase()}.` : null,
    successCriteria[0] ? `A strong outcome looks like: ${successCriteria[0]}.` : null,
    multiTurnLabel ? `The AI style is set up for ${multiTurnLabel.toLowerCase()}.` : null,
  ])

  const addSkill = (skills: SkillFocus[], label: string, reason: string, condition = true) => {
    if (!condition) return
    if (skills.some((skill) => skill.label === label)) return
    skills.push({ label, reason })
  }

  const combinedSignalText = [
    objective,
    scenarioDescription,
    contextNarrative,
    aiRole,
    userRole,
    ...stakes,
    ...constraints,
    ...likelyObjections,
    ...successCriteria,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const skillFocus: SkillFocus[] = []
  addSkill(
    skillFocus,
    'Discovery and diagnosis',
    'Use the early part of the conversation to uncover what matters most before you start pitching.',
    /discover|diagnos|qualif|understand|pain|need|challenge/.test(combinedSignalText)
  )
  addSkill(
    skillFocus,
    'Objection handling',
    'Expect pressure or skepticism. Answer directly, stay calm, and move back to value without sounding defensive.',
    likelyObjections.length > 0 ||
      /objection|skeptic|risk|concern|pushback/.test(combinedSignalText)
  )
  addSkill(
    skillFocus,
    'Value framing',
    'Tie every claim back to business impact, tradeoffs, or why the outcome matters right now.',
    /value|roi|budget|price|pricing|cost|procurement|commercial|business case/.test(
      combinedSignalText
    )
  )
  addSkill(
    skillFocus,
    'Executive communication',
    'Keep the message tight, outcome-oriented, and easy for senior stakeholders to follow quickly.',
    /executive|board|c-suite|vp|cio|cto|cfo|stakeholder/.test(combinedSignalText)
  )
  addSkill(
    skillFocus,
    'Technical credibility',
    'Back up your claims with specifics so the counterpart trusts the plan, not just the pitch.',
    /security|technical|integration|architecture|compliance|data|implementation/.test(
      combinedSignalText
    )
  )
  addSkill(
    skillFocus,
    'Closing and next-step control',
    'Do not let the conversation drift. Land on a clear decision, pilot, or next meeting.',
    /next step|close|decision|pilot|commitment|agreement|review scope|rollout/.test(
      combinedSignalText
    )
  )
  addSkill(
    skillFocus,
    session.type === 'text' ? 'Written clarity' : 'Verbal delivery',
    session.type === 'text'
      ? 'Make each message concise, structured, and purposeful so it reads like a strong sales response.'
      : 'Your pacing, confidence, and structure will matter as much as the content itself.',
    ['voice', 'video', 'phone', 'text'].includes(session.type)
  )
  if (skillFocus.length === 0) {
    skillFocus.push(
      {
        label: 'Conversational control',
        reason:
          'Guide the exchange with clear structure, relevant questions, and a confident next step.',
      },
      {
        label: 'Active listening',
        reason:
          'Pay close attention to what the counterpart values, then mirror it back in your response.',
      }
    )
  }

  const canModify = Boolean(user?.id && session.userId === user.id)

  const heroHighlights = [
    {
      label: 'Scenario',
      value: scenarioName,
      description: scenarioDescription,
      icon: <IconTag size={14} />,
    },
    {
      label: 'Counterpart',
      value: personaName,
      description:
        uniqueText([counterpartRole, counterpartPersonality])[0] ?? 'Configured AI persona',
      icon: <IconUser size={14} />,
    },
    {
      label: 'Goal',
      value: objective,
      description:
        successCriteria[0] ?? 'Focus on advancing the conversation to a credible next step.',
      icon: <IconInfoCircle size={14} />,
    },
    {
      label: 'Format',
      value: formatSessionType(session.type),
      description:
        durationMinutes != null
          ? `${durationMinutes} min • ${styleDifficulty} difficulty`
          : `${styleDifficulty} difficulty`,
      icon: <IconRobot size={14} />,
    },
  ]

  return (
    <Stack gap="xl" className={classes.pageRoot}>
      <Card
        withBorder
        radius="xl"
        padding="xl"
        className={classes.heroCard}
        style={{
          background:
            'radial-gradient(circle at top right, rgba(57, 109, 241, 0.2), transparent 34%), linear-gradient(135deg, rgba(12, 18, 35, 0.98) 0%, rgba(8, 13, 26, 0.98) 100%)',
          borderColor: 'rgba(116, 151, 222, 0.2)',
          overflow: 'hidden',
        }}
      >
        <Stack gap="lg">
          <Group
            justify="space-between"
            align="center"
            wrap="wrap"
            gap="sm"
            className={classes.heroTop}
          >
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push('/studio/sessions')}
            >
              Sessions
            </Button>

            <Group gap="xs" wrap="wrap" className={classes.headerActions}>
              <Button
                size="sm"
                variant="light"
                color="blue"
                leftSection={<IconEdit size={15} />}
                disabled={!canModify}
                title={!canModify ? 'Only the session owner can edit this session.' : undefined}
                onClick={() => {
                  if (!canModify) return
                  router.push(`/studio/sessions/${session.id}/edit`)
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="light"
                color="gray"
                leftSection={<IconLink size={15} />}
                visibleFrom="sm"
                onClick={() => setLtiEmbedOpen(true)}
              >
                Embed in LMS
              </Button>
              <Stack gap={2} align="center">
                <Button
                  size="sm"
                  variant="filled"
                  color="brand"
                  leftSection={<IconPlayerPlay size={15} />}
                  onClick={() => router.push(`/session/${session.id}`)}
                >
                  Launch
                </Button>
                {coinEstimate && !coinEstimateLoading && (
                  <Group gap={3}>
                    <IconCoin size={11} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed">
                      ~{coinEstimate.estimatedCoins} coins
                    </Text>
                  </Group>
                )}
              </Stack>
            </Group>
          </Group>

          <Stack gap="sm">
            <Group gap="xs" wrap="wrap">
              <Badge color={badgeColor} radius="md" variant="light">
                {displayStatus}
              </Badge>
              <Badge color="blue" radius="md" variant="light">
                {formatSessionType(session.type)}
              </Badge>
              <Badge color="grape" radius="md" variant="light">
                {styleDifficulty}
              </Badge>
              <Badge color="teal" radius="md" variant="light">
                {language}
              </Badge>
            </Group>

            <Title order={1} c="white" className={classes.heroTitle}>
              {displayName}
            </Title>

            <Text size="md" c="gray.3" className={classes.heroSummary}>
              {sessionSummary}
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
            {heroHighlights.map((item) => (
              <SignalCard
                key={item.label}
                label={item.label}
                value={item.value}
                description={item.description}
                icon={item.icon}
              />
            ))}
          </SimpleGrid>
        </Stack>
      </Card>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="lg">
            <SurfaceCard
              title="Scenario Brief"
              subtitle="The situation you are stepping into"
              icon={
                <ThemeIcon size={30} color="blue" variant="light" radius="md">
                  <IconTag size={16} />
                </ThemeIcon>
              }
              aside={
                <Group gap="xs" wrap="wrap">
                  {durationMinutes != null ? (
                    <Badge color="blue" variant="light" radius="md">
                      {durationMinutes} min
                    </Badge>
                  ) : null}
                  <Badge color="grape" variant="light" radius="md">
                    {styleDifficulty}
                  </Badge>
                </Group>
              }
            >
              <Stack gap="lg">
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="blue.1" tt="uppercase" style={{ letterSpacing: 0.8 }}>
                    Scenario
                  </Text>
                  <Title order={3} c="white">
                    {scenarioName}
                  </Title>
                  <Text size="sm" c="gray.2" style={{ lineHeight: 1.7 }}>
                    {scenarioDescription}
                  </Text>
                </Stack>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
                  <Box>
                    <Text
                      size="xs"
                      fw={700}
                      c="blue.1"
                      tt="uppercase"
                      style={{ letterSpacing: 0.8 }}
                      mb={8}
                    >
                      Objective
                    </Text>
                    <Text size="sm" c="white" style={{ lineHeight: 1.65 }}>
                      {objective}
                    </Text>
                  </Box>
                  <Box>
                    <Text
                      size="xs"
                      fw={700}
                      c="blue.1"
                      tt="uppercase"
                      style={{ letterSpacing: 0.8 }}
                      mb={8}
                    >
                      Context
                    </Text>
                    <Text size="sm" c="gray.2" style={{ lineHeight: 1.65 }}>
                      {contextNarrative ??
                        'No extra situational context was provided for this session.'}
                    </Text>
                  </Box>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg" verticalSpacing="lg">
                  <InsightList
                    title="Success Criteria"
                    items={successCriteria}
                    empty="No explicit success criteria were attached to this session."
                    color="teal"
                  />
                  <InsightList
                    title="Stakes"
                    items={stakes}
                    empty="No explicit pressure points were defined."
                    color="orange"
                  />
                  <InsightList
                    title="Constraints"
                    items={constraints}
                    empty="No hard constraints were supplied."
                    color="gray"
                  />
                </SimpleGrid>
              </Stack>
            </SurfaceCard>

            <SurfaceCard
              title="Counterpart Snapshot"
              subtitle="Who you are about to deal with"
              icon={
                <ThemeIcon size={30} color="violet" variant="light" radius="md">
                  <IconUser size={16} />
                </ThemeIcon>
              }
              aside={
                <Group gap="xs" wrap="wrap">
                  {counterpartLevel ? (
                    <Badge color="violet" variant="light" radius="md">
                      {counterpartLevel}
                    </Badge>
                  ) : null}
                  {counterpartVoice ? (
                    <Badge color="gray" variant="light" radius="md">
                      {counterpartVoice}
                    </Badge>
                  ) : null}
                </Group>
              }
            >
              <Stack gap="lg">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
                  <Card
                    withBorder
                    radius="lg"
                    padding="md"
                    style={{
                      background: 'rgba(14, 21, 39, 0.82)',
                      borderColor: 'rgba(119, 95, 216, 0.16)',
                    }}
                  >
                    <Text
                      size="xs"
                      fw={700}
                      c="violet.1"
                      tt="uppercase"
                      style={{ letterSpacing: 0.8 }}
                    >
                      Counterpart
                    </Text>
                    <Title order={4} c="white" mt={8}>
                      {personaName}
                    </Title>
                    <Text size="sm" c="dimmed" mt={6}>
                      {counterpartRole}
                    </Text>
                    <Text size="sm" c="gray.2" mt="sm" style={{ lineHeight: 1.65 }}>
                      {counterpartPersonality ??
                        counterpartBackground ??
                        'This AI persona is configured to behave like a realistic counterpart for the scenario.'}
                    </Text>
                  </Card>

                  <Card
                    withBorder
                    radius="lg"
                    padding="md"
                    style={{
                      background: 'rgba(14, 21, 39, 0.82)',
                      borderColor: 'rgba(87, 166, 209, 0.16)',
                    }}
                  >
                    <Text
                      size="xs"
                      fw={700}
                      c="blue.1"
                      tt="uppercase"
                      style={{ letterSpacing: 0.8 }}
                    >
                      Working Style
                    </Text>
                    <Stack gap="sm" mt="sm">
                      <DetailRow
                        label="Personality"
                        value={
                          <Text size="sm" c="white">
                            {counterpartPersonality ?? 'Adaptive'}
                          </Text>
                        }
                      />
                      <DetailRow
                        label="Background"
                        value={
                          <Text size="sm" c="gray.2">
                            {counterpartBackground ?? 'Not specified'}
                          </Text>
                        }
                      />
                      <DetailRow
                        label="Tone"
                        value={
                          <Text size="sm" c="gray.2">
                            {counterpartTone ?? 'Not specified'}
                          </Text>
                        }
                      />
                    </Stack>
                  </Card>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg" verticalSpacing="lg">
                  <InsightList
                    title="Likely Objections"
                    items={likelyObjections}
                    empty="No explicit objection set was attached to this persona."
                    color="orange"
                  />
                  <InsightList
                    title="Signature Traits"
                    items={signatureTraits}
                    empty="No signature trait list is attached to this persona."
                    color="violet"
                  />
                </SimpleGrid>

                {counterpartMetrics.length > 0 ? (
                  <Stack gap="sm">
                    <Text
                      size="xs"
                      fw={700}
                      c="blue.1"
                      tt="uppercase"
                      style={{ letterSpacing: 0.8 }}
                    >
                      Counterpart Tendencies
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
                      {counterpartMetrics.map((metric) => (
                        <Card
                          key={metric.label}
                          withBorder
                          radius="lg"
                          padding="sm"
                          style={{
                            background: 'rgba(11, 18, 34, 0.84)',
                            borderColor: 'rgba(90, 124, 190, 0.14)',
                          }}
                        >
                          <Group justify="space-between" mb={8}>
                            <Text size="sm" c="white" fw={600}>
                              {metric.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {metric.value}%
                            </Text>
                          </Group>
                          <Progress value={metric.value} color="blue" radius="xl" size="sm" />
                        </Card>
                      ))}
                    </SimpleGrid>
                  </Stack>
                ) : null}
              </Stack>
            </SurfaceCard>

            <SurfaceCard
              title="Goal and Skill Focus"
              subtitle="What good performance looks like in this session"
              icon={
                <ThemeIcon size={30} color="teal" variant="light" radius="md">
                  <IconInfoCircle size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap="lg">
                <Card
                  withBorder
                  radius="lg"
                  padding="lg"
                  style={{
                    background: 'rgba(12, 20, 37, 0.84)',
                    borderColor: 'rgba(72, 178, 136, 0.16)',
                  }}
                >
                  <Text size="xs" fw={700} c="teal.1" tt="uppercase" style={{ letterSpacing: 0.8 }}>
                    Primary Goal
                  </Text>
                  <Text size="lg" fw={700} c="white" mt={8}>
                    {objective}
                  </Text>
                  <Text size="sm" c="dimmed" mt="sm" style={{ lineHeight: 1.65 }}>
                    You are playing <strong>{userRole}</strong> and the AI is playing{' '}
                    <strong>{aiRole}</strong>. Use the session to make measurable progress toward
                    the objective, not just to keep the conversation going.
                  </Text>
                </Card>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" verticalSpacing="md">
                  {skillFocus.map((skill) => (
                    <SkillFocusCard key={skill.label} skill={skill} />
                  ))}
                </SimpleGrid>
              </Stack>
            </SurfaceCard>

            <SurfaceCard
              title="Conversation Map"
              subtitle="The likely rhythm of the simulation"
              icon={
                <ThemeIcon size={30} color="orange" variant="light" radius="md">
                  <IconCalendarEvent size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap="lg">
                {normalizedScenario.stages.length > 0 ? (
                  <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" verticalSpacing="md">
                    {normalizedScenario.stages.map((stage, index) => (
                      <Card
                        key={`${stage.title}-${index}`}
                        withBorder
                        radius="lg"
                        padding="md"
                        style={{
                          background: 'rgba(13, 20, 36, 0.82)',
                          borderColor: 'rgba(212, 142, 77, 0.18)',
                        }}
                      >
                        <Group gap="sm" align="center" mb={8}>
                          <ThemeIcon size={24} radius="xl" color="orange" variant="light">
                            <Text size="xs" fw={800}>
                              {index + 1}
                            </Text>
                          </ThemeIcon>
                          <Text size="sm" fw={700} c="white">
                            {stage.title}
                          </Text>
                        </Group>
                        <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                          {stage.goal}
                        </Text>
                      </Card>
                    ))}
                  </SimpleGrid>
                ) : null}

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" verticalSpacing="lg">
                  <InsightList
                    title="What To Expect"
                    items={expectationPoints}
                    empty="No extra expectation notes are available for this session."
                    color="blue"
                  />
                  <InsightList
                    title="Supporting Context"
                    items={supportAttachments}
                    empty="No supporting documents are attached to this session."
                    color="gray"
                  />
                </SimpleGrid>
              </Stack>
            </SurfaceCard>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="lg">
            {/* ── Session Setup ─────────────────────────────── */}
            <SurfaceCard
              title="Session Setup"
              subtitle="How the AI and delivery are configured"
              icon={
                <ThemeIcon size={30} color="brand" variant="light" radius="md">
                  <IconRobot size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap="xl">
                {/* Format chips */}
                <Box>
                  <Text
                    size="xs"
                    fw={700}
                    c="blue.3"
                    tt="uppercase"
                    style={{ letterSpacing: 0.9 }}
                    mb={10}
                  >
                    Format
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    <Badge size="md" variant="light" color="blue" radius="md">
                      {formatSessionType(session.type)}
                    </Badge>
                    {durationMinutes != null && (
                      <Badge size="md" variant="light" color="gray" radius="md">
                        {durationMinutes} min
                      </Badge>
                    )}
                    <Badge size="md" variant="light" color="grape" radius="md">
                      {styleDifficulty}
                    </Badge>
                    <Badge size="md" variant="light" color="teal" radius="md">
                      {language}
                    </Badge>
                  </Group>
                </Box>

                {/* Session cost */}
                {(coinEstimateLoading || coinEstimate) && (
                  <>
                    <Divider color="rgba(111, 140, 205, 0.1)" />
                    <Box>
                      <Text
                        size="xs"
                        fw={700}
                        c="blue.3"
                        tt="uppercase"
                        style={{ letterSpacing: 0.9 }}
                        mb={10}
                      >
                        Session Cost
                      </Text>
                      {coinEstimateLoading ? (
                        <Skeleton height={18} width={100} radius="sm" />
                      ) : coinEstimate ? (
                        <Group gap={6} align="center">
                          <IconCoin size={16} color="var(--mantine-color-yellow-5)" />
                          <Text size="sm" fw={700} c="yellow.4">
                            ~{coinEstimate.estimatedCoins} coins
                          </Text>
                          <Text size="xs" c="dimmed">
                            (~${coinEstimate.estimatedCostUsd.toFixed(3)})
                          </Text>
                        </Group>
                      ) : null}
                    </Box>
                  </>
                )}

                <Divider color="rgba(111, 140, 205, 0.1)" />

                {/* AI Behavior */}
                <Box>
                  <Group gap="xs" mb={12}>
                    <ThemeIcon size={18} color="violet" variant="light" radius="sm">
                      <IconBrain size={11} />
                    </ThemeIcon>
                    <Text
                      size="xs"
                      fw={700}
                      c="violet.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                    >
                      AI Behavior
                    </Text>
                  </Group>
                  <Stack gap={10}>
                    <DetailRow
                      label="Model"
                      value={
                        <Text size="sm" c="white">
                          {toText(llmConfig.model) ?? toText(llmConfig.provider) ?? 'Default'}
                        </Text>
                      }
                    />
                    <DetailRow
                      label="Style"
                      value={
                        <Text size="sm" c="white">
                          {multiTurnLabel}
                        </Text>
                      }
                    />
                    <DetailRow
                      label="Tone"
                      value={
                        <Text size="sm" c="white">
                          {toText(config.tone) ?? 'Adaptive'}
                        </Text>
                      }
                    />
                    <DetailRow
                      label="Patience"
                      value={
                        <Text size="sm" c="white">
                          {toText(config.patienceLevel) ?? 'Balanced'}
                        </Text>
                      }
                    />
                    <DetailRow
                      label="Initiative"
                      value={
                        <Text size="sm" c="white">
                          {toText(config.initiativeLevel) ?? 'Balanced'}
                        </Text>
                      }
                    />
                    <DetailRow
                      label="Speech pace"
                      value={
                        <Text size="sm" c="white">
                          {toText(config.speechRate) ?? 'Balanced'}
                        </Text>
                      }
                    />
                  </Stack>
                </Box>

                {/* Delivery — voice / video */}
                {(toText(voiceConfig.voice) ||
                  toText(voiceConfig.provider) ||
                  counterpartVoice ||
                  session.type === 'video') && (
                  <>
                    <Divider color="rgba(111, 140, 205, 0.1)" />
                    <Box>
                      <Group gap="xs" mb={12}>
                        <ThemeIcon size={18} color="cyan" variant="light" radius="sm">
                          <IconMicrophone size={11} />
                        </ThemeIcon>
                        <Text
                          size="xs"
                          fw={700}
                          c="cyan.3"
                          tt="uppercase"
                          style={{ letterSpacing: 0.9 }}
                        >
                          Delivery
                        </Text>
                      </Group>
                      <Stack gap={10}>
                        {(toText(voiceConfig.voice) ||
                          toText(voiceConfig.provider) ||
                          counterpartVoice) && (
                          <DetailRow
                            label="Voice"
                            value={
                              <Text size="sm" c="white">
                                {toText(voiceConfig.voice) ??
                                  toText(voiceConfig.provider) ??
                                  counterpartVoice}
                              </Text>
                            }
                          />
                        )}
                        {session.type === 'video' && (
                          <DetailRow
                            label="Video"
                            value={
                              <Text size="sm" c="white">
                                {toText(videoConfig.mode) ??
                                  toText(videoConfig.provider) ??
                                  'Configured'}
                              </Text>
                            }
                          />
                        )}
                      </Stack>
                    </Box>
                  </>
                )}
              </Stack>
            </SurfaceCard>

            {/* ── Context Sources ───────────────────────────── */}
            <SurfaceCard
              title="Context & Attachments"
              subtitle="Extra signals and documents attached to this session"
              icon={
                <ThemeIcon size={30} color="blue" variant="light" radius="md">
                  <IconCalendarEvent size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap="xl">
                {/* Calendar */}
                {(calendarProvider || calendarEventStart || calendarAttendees.length > 0) && (
                  <Box>
                    <Group gap="xs" mb={10}>
                      <ThemeIcon size={18} color="blue" variant="light" radius="sm">
                        <IconCalendar size={11} />
                      </ThemeIcon>
                      <Text
                        size="xs"
                        fw={700}
                        c="blue.3"
                        tt="uppercase"
                        style={{ letterSpacing: 0.9 }}
                      >
                        Calendar Event
                      </Text>
                    </Group>
                    <Stack gap={8}>
                      {calendarProvider && (
                        <DetailRow
                          label="Provider"
                          value={
                            <Text size="sm" c="gray.2">
                              {calendarProvider}
                            </Text>
                          }
                        />
                      )}
                      {calendarEventStart && (
                        <DetailRow
                          label="Starts"
                          value={
                            <Text size="sm" c="gray.2">
                              {calendarEventStart}
                            </Text>
                          }
                        />
                      )}
                      {calendarAttendees.length > 0 && (
                        <DetailRow
                          label="Attendees"
                          value={
                            <Text size="sm" c="gray.2">
                              {calendarAttendees.join(', ')}
                            </Text>
                          }
                        />
                      )}
                    </Stack>
                    <Divider color="rgba(111, 140, 205, 0.1)" mt="lg" />
                  </Box>
                )}

                {/* Attached documents */}
                {supportAttachments.length > 0 && (
                  <Box>
                    <Text
                      size="xs"
                      fw={700}
                      c="blue.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                      mb={10}
                    >
                      Documents
                    </Text>
                    <Stack gap={8}>
                      {supportAttachments.map((filename) => (
                        <Group key={filename} gap="xs" align="center" wrap="nowrap">
                          <ThemeIcon size={22} color="gray" variant="light" radius="md">
                            <IconFile size={12} />
                          </ThemeIcon>
                          <Text size="sm" c="gray.2" style={{ wordBreak: 'break-word', flex: 1 }}>
                            {filename}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* CRM — only show if connected or has a context ID */}
                {(session.crmContextId ||
                  (toText(crmConfig.provider) && crmConfig.connected !== false)) && (
                  <Box>
                    <Text
                      size="xs"
                      fw={700}
                      c="blue.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                      mb={10}
                    >
                      CRM
                    </Text>
                    <DetailRow
                      label="Source"
                      value={
                        <Text size="sm" c="white">
                          {toText(crmConfig.provider) ?? toText(crmConfig.source) ?? 'Connected'}
                        </Text>
                      }
                    />
                  </Box>
                )}

                {/* Tags */}
                <Box>
                  <Text
                    size="xs"
                    fw={700}
                    c="blue.3"
                    tt="uppercase"
                    style={{ letterSpacing: 0.9 }}
                    mb={10}
                  >
                    Tags
                  </Text>
                  {tags.length > 0 ? (
                    <Group gap="xs" wrap="wrap">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="outline" color="gray" radius="md">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No tags attached.
                    </Text>
                  )}
                </Box>
              </Stack>
            </SurfaceCard>
          </Stack>
        </Grid.Col>
      </Grid>

      <LtiEmbedModal
        opened={ltiEmbedOpen}
        onClose={() => setLtiEmbedOpen(false)}
        sessionId={session.id}
      />
    </Stack>
  )
}
