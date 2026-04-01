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
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBrain,
  IconCalendar,
  IconCheck,
  IconCoin,
  IconEdit,
  IconFile,
  IconInfoCircle,
  IconLink,
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
    null

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

  const topTraits = uniqueText([
    ...toTextArray(personaTraits.signatureTraits),
    ...toTextArray(counterpartProfile.signatureTraits),
  ]).slice(0, 5)

  return (
    <Stack gap="xl" className={classes.pageRoot}>
      {/* ═══ HERO ══════════════════════════════════════════════════════ */}
      <Card
        withBorder
        radius="xl"
        padding="xl"
        className={classes.heroCard}
        style={{
          background:
            'radial-gradient(ellipse at top right, rgba(57, 109, 241, 0.18), transparent 45%), linear-gradient(160deg, rgba(14, 20, 38, 0.99) 0%, rgba(8, 12, 26, 0.99) 100%)',
          borderColor: 'rgba(116, 151, 222, 0.18)',
          overflow: 'hidden',
        }}
      >
        <Stack gap="lg">
          {/* Nav + Actions */}
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
              {canModify && (
                <Button
                  size="sm"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconEdit size={15} />}
                  onClick={() => router.push(`/studio/sessions/${session.id}/edit`)}
                >
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="subtle"
                color="gray"
                leftSection={<IconLink size={15} />}
                visibleFrom="sm"
                onClick={() => setLtiEmbedOpen(true)}
              >
                Embed
              </Button>
              <Stack gap={3} align="center">
                <Button
                  size="sm"
                  variant="filled"
                  color="brand"
                  leftSection={<IconPlayerPlay size={15} />}
                  onClick={() => router.push(`/session/${session.id}`)}
                >
                  Launch
                </Button>
                {!coinEstimateLoading && coinEstimate && (
                  <Group gap={3}>
                    <IconCoin size={10} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed">
                      ~{coinEstimate.estimatedCoins} coins
                    </Text>
                  </Group>
                )}
              </Stack>
            </Group>
          </Group>

          {/* Title + meta */}
          <Stack gap="sm">
            <Group gap="xs" wrap="wrap">
              <Badge color={badgeColor} radius="md" variant="light" size="sm">
                {displayStatus}
              </Badge>
              <Badge color="blue" radius="md" variant="light" size="sm">
                {formatSessionType(session.type)}
              </Badge>
              {durationMinutes != null && (
                <Badge color="gray" radius="md" variant="light" size="sm">
                  {durationMinutes} min
                </Badge>
              )}
              <Badge color="grape" radius="md" variant="light" size="sm">
                {styleDifficulty}
              </Badge>
            </Group>

            <Title order={1} c="white" className={classes.heroTitle}>
              {displayName}
            </Title>

            {sessionSummary && (
              <Text
                size="sm"
                c="gray.4"
                style={{ lineHeight: 1.7, maxWidth: 680 }}
                className={classes.heroSummary}
              >
                {sessionSummary}
              </Text>
            )}

            <Group gap={6} wrap="wrap" align="center">
              <ThemeIcon size={18} color="gray" variant="transparent" radius="sm">
                <IconUser size={13} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                You play{' '}
                <Text span fw={600} c="gray.2">
                  {userRole}
                </Text>
                {' · '}AI plays{' '}
                <Text span fw={600} c="gray.2">
                  {personaName}
                </Text>{' '}
                as{' '}
                <Text span fw={600} c="gray.2">
                  {aiRole}
                </Text>
              </Text>
            </Group>
          </Stack>
        </Stack>
      </Card>

      {/* ═══ MAIN GRID ════════════════════════════════════════════════ */}
      <Grid gutter="xl" align="flex-start">
        {/* ── Left column ─────────────────────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="xl">
            {/* The Scenario */}
            <SurfaceCard
              title="The Scenario"
              subtitle={scenarioName}
              icon={
                <ThemeIcon size={30} color="blue" variant="light" radius="md">
                  <IconTag size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap="xl">
                {contextNarrative && (
                  <Text size="sm" c="gray.2" style={{ lineHeight: 1.8 }}>
                    {contextNarrative}
                  </Text>
                )}

                {/* Objective */}
                <Card
                  withBorder
                  radius="lg"
                  padding="lg"
                  style={{
                    background: 'rgba(18, 42, 78, 0.45)',
                    borderColor: 'rgba(72, 130, 240, 0.22)',
                  }}
                >
                  <Text
                    size="xs"
                    fw={700}
                    c="blue.3"
                    tt="uppercase"
                    style={{ letterSpacing: 0.9 }}
                    mb={8}
                  >
                    Your Objective
                  </Text>
                  <Text size="md" fw={600} c="white" style={{ lineHeight: 1.65 }}>
                    {objective}
                  </Text>
                </Card>

                {/* Success criteria */}
                {successCriteria.length > 0 && (
                  <Stack gap="xs">
                    <Text
                      size="xs"
                      fw={700}
                      c="teal.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                      mb={4}
                    >
                      What success looks like
                    </Text>
                    {successCriteria.slice(0, 3).map((item) => (
                      <Group key={item} gap="xs" align="flex-start" wrap="nowrap">
                        <ThemeIcon size={20} color="teal" variant="light" radius="xl" mt={1}>
                          <IconCheck size={11} />
                        </ThemeIcon>
                        <Text size="sm" c="gray.2" style={{ lineHeight: 1.6 }}>
                          {item}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}

                {/* Stakes */}
                {stakes.length > 0 && (
                  <Stack gap="xs">
                    <Text
                      size="xs"
                      fw={700}
                      c="orange.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                      mb={4}
                    >
                      What&apos;s at stake
                    </Text>
                    {stakes.slice(0, 2).map((item) => (
                      <Group key={item} gap="xs" align="flex-start" wrap="nowrap">
                        <ThemeIcon size={20} color="orange" variant="light" radius="xl" mt={1}>
                          <IconAlertCircle size={11} />
                        </ThemeIcon>
                        <Text size="sm" c="gray.2" style={{ lineHeight: 1.6 }}>
                          {item}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </SurfaceCard>

            {/* Your Counterpart */}
            <SurfaceCard
              title="Your Counterpart"
              subtitle={`${personaName}${counterpartLevel ? ` · ${counterpartLevel}` : ''}`}
              icon={
                <ThemeIcon size={30} color="violet" variant="light" radius="md">
                  <IconUser size={16} />
                </ThemeIcon>
              }
              aside={
                counterpartTone ? (
                  <Badge color="violet" variant="light" radius="md" size="sm">
                    {counterpartTone}
                  </Badge>
                ) : null
              }
            >
              <Stack gap="xl">
                {/* Role + personality */}
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="gray.3">
                    {counterpartRole}
                  </Text>
                  <Text size="sm" c="gray.2" style={{ lineHeight: 1.75 }}>
                    {counterpartPersonality ??
                      counterpartBackground ??
                      'A realistic AI persona configured for this scenario.'}
                  </Text>
                </Stack>

                {/* Signature traits */}
                {topTraits.length > 0 && (
                  <Stack gap={10}>
                    <Text
                      size="xs"
                      fw={700}
                      c="violet.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                    >
                      Expect them to
                    </Text>
                    <Group gap="xs" wrap="wrap">
                      {topTraits.map((trait) => (
                        <Badge key={trait} variant="light" color="violet" radius="md" size="md">
                          {trait}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                )}

                {/* Likely objections */}
                {likelyObjections.length > 0 && (
                  <Stack gap="xs">
                    <Text
                      size="xs"
                      fw={700}
                      c="orange.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                      mb={4}
                    >
                      Likely objections
                    </Text>
                    {likelyObjections.slice(0, 3).map((obj) => (
                      <Group key={obj} gap="xs" align="flex-start" wrap="nowrap">
                        <ThemeIcon size={20} color="orange" variant="light" radius="xl" mt={1}>
                          <IconAlertCircle size={11} />
                        </ThemeIcon>
                        <Text size="sm" c="gray.2" style={{ lineHeight: 1.6 }}>
                          {obj}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}

                {/* Persona metrics */}
                {counterpartMetrics.slice(0, 3).length > 0 && (
                  <Stack gap={12}>
                    <Text
                      size="xs"
                      fw={700}
                      c="violet.3"
                      tt="uppercase"
                      style={{ letterSpacing: 0.9 }}
                    >
                      Behavioral profile
                    </Text>
                    {counterpartMetrics.slice(0, 3).map((metric) => (
                      <Box key={metric.label}>
                        <Group justify="space-between" mb={5}>
                          <Text size="xs" c="dimmed">
                            {metric.label}
                          </Text>
                          <Text size="xs" c="dimmed" fw={500}>
                            {metric.value}%
                          </Text>
                        </Group>
                        <Progress value={metric.value} color="violet" radius="xl" size="sm" />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </SurfaceCard>

            {/* What to Expect — preparation notes */}
            {expectationPoints.length > 0 && (
              <SurfaceCard
                title="What to Expect"
                subtitle="Preparation notes for this session"
                icon={
                  <ThemeIcon size={30} color="cyan" variant="light" radius="md">
                    <IconInfoCircle size={16} />
                  </ThemeIcon>
                }
              >
                <Stack gap="sm">
                  {expectationPoints.map((point, i) => (
                    <Group key={point} gap="sm" align="flex-start" wrap="nowrap">
                      <ThemeIcon
                        size={22}
                        color="cyan"
                        variant="light"
                        radius="xl"
                        mt={1}
                        style={{ flexShrink: 0 }}
                      >
                        <Text size="xs" fw={800} c="cyan.3">
                          {i + 1}
                        </Text>
                      </ThemeIcon>
                      <Text size="sm" c="gray.2" style={{ lineHeight: 1.65 }}>
                        {point}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </SurfaceCard>
            )}
          </Stack>
        </Grid.Col>

        {/* ── Right column ────────────────────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="lg">
            {/* Session Details */}
            <SurfaceCard
              title="Session Details"
              icon={
                <ThemeIcon size={30} color="brand" variant="light" radius="md">
                  <IconRobot size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap="lg">
                {/* Format badges */}
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

                {/* Session cost */}
                {(coinEstimateLoading || coinEstimate) && (
                  <>
                    <Divider color="rgba(111, 140, 205, 0.1)" />
                    {coinEstimateLoading ? (
                      <Skeleton height={18} width={100} radius="sm" />
                    ) : coinEstimate ? (
                      <Group gap={6} align="center">
                        <IconCoin size={15} color="var(--mantine-color-yellow-5)" />
                        <Text size="sm" fw={600} c="yellow.4">
                          ~{coinEstimate.estimatedCoins} coins
                        </Text>
                        <Text size="xs" c="dimmed">
                          per session
                        </Text>
                      </Group>
                    ) : null}
                  </>
                )}

                <Divider color="rgba(111, 140, 205, 0.1)" />

                {/* AI settings */}
                <Stack gap={10}>
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
                    label="Style"
                    value={
                      <Text size="sm" c="white">
                        {multiTurnLabel}
                      </Text>
                    }
                  />
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
                  {(toText(llmConfig.model) || toText(llmConfig.provider)) && (
                    <DetailRow
                      label="Model"
                      value={
                        <Text size="sm" c="white">
                          {toText(llmConfig.model) ?? toText(llmConfig.provider)}
                        </Text>
                      }
                    />
                  )}
                </Stack>
              </Stack>
            </SurfaceCard>

            {/* Skill Focus */}
            {skillFocus.length > 0 && (
              <SurfaceCard
                title="Skill Focus"
                subtitle="Key areas to work on"
                icon={
                  <ThemeIcon size={30} color="indigo" variant="light" radius="md">
                    <IconBrain size={16} />
                  </ThemeIcon>
                }
              >
                <Stack gap="md">
                  {skillFocus.slice(0, 3).map((skill) => (
                    <Box
                      key={skill.label}
                      style={{
                        borderLeft: '2px solid rgba(129, 140, 248, 0.35)',
                        paddingLeft: 14,
                      }}
                    >
                      <Text size="sm" fw={600} c="indigo.3" mb={4}>
                        {skill.label}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
                        {skill.reason}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </SurfaceCard>
            )}

            {/* Context — only shown when there's something to display */}
            {(calendarEventStart ||
              calendarProvider ||
              supportAttachments.length > 0 ||
              tags.length > 0 ||
              session.crmContextId ||
              (toText(crmConfig.provider) && crmConfig.connected !== false)) && (
              <SurfaceCard
                title="Context"
                icon={
                  <ThemeIcon size={30} color="blue" variant="light" radius="md">
                    <IconCalendar size={16} />
                  </ThemeIcon>
                }
              >
                <Stack gap="lg">
                  {/* Calendar event */}
                  {(calendarEventStart || calendarProvider) && (
                    <Group gap="xs" align="flex-start" wrap="nowrap">
                      <ThemeIcon size={22} color="blue" variant="light" radius="md" mt={2}>
                        <IconCalendar size={12} />
                      </ThemeIcon>
                      <Stack gap={2}>
                        {calendarProvider && (
                          <Text size="xs" fw={600} c="blue.3">
                            {calendarProvider}
                          </Text>
                        )}
                        {calendarEventStart && (
                          <Text size="sm" c="gray.2">
                            {calendarEventStart}
                          </Text>
                        )}
                        {calendarAttendees.length > 0 && (
                          <Text size="xs" c="dimmed">
                            {calendarAttendees.join(', ')}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  )}

                  {/* CRM */}
                  {(session.crmContextId ||
                    (toText(crmConfig.provider) && crmConfig.connected !== false)) && (
                    <DetailRow
                      label="CRM"
                      value={
                        <Text size="sm" c="white">
                          {toText(crmConfig.provider) ?? toText(crmConfig.source) ?? 'Connected'}
                        </Text>
                      }
                    />
                  )}

                  {/* Documents */}
                  {supportAttachments.length > 0 && (
                    <Stack gap={6}>
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
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <Group gap="xs" wrap="wrap">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="outline" color="gray" radius="md" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Stack>
              </SurfaceCard>
            )}
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
