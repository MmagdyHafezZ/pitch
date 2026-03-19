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
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconEdit,
  IconInfoCircle,
  IconLanguage,
  IconLink,
  IconPlayerPlay,
  IconRobot,
  IconTag,
  IconUser,
} from '@tabler/icons-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { JsonViewer } from '@/components/ui/JsonViewer'
import { LtiEmbedModal } from '@/components/ui/LtiEmbedModal'
import { useAuth } from '@/features/auth'
import type { Session, SessionConfigData } from '@/features/sessions'
import { api } from '@/lib/client'

const statusColor: Record<string, string> = {
  active: 'brand',
  ended: 'green',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

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

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      style={{
        background: 'var(--mantine-color-dark-7)',
        borderColor: 'var(--mantine-color-dark-5)',
      }}
    >
      <Group gap="xs" mb="md">
        {icon}
        <Title order={5} c="white">
          {title}
        </Title>
      </Group>
      {children}
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null
  const displayValue =
    typeof value === 'object' ? (
      <JsonViewer data={value as Record<string, unknown>} />
    ) : (
      <Text size="sm" c="white">
        {String(value)}
      </Text>
    )

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <Text size="sm" c="dimmed" style={{ minWidth: 140, flexShrink: 0 }}>
        {label}
      </Text>
      <Box style={{ flex: 1 }}>{displayValue}</Box>
    </Group>
  )
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      style={{
        background: 'var(--mantine-color-dark-6)',
        borderColor: 'var(--mantine-color-dark-4)',
      }}
    >
      <Group gap="xs" mb={6}>
        <ThemeIcon size={22} variant="light" color="gray" radius="sm">
          {icon}
        </ThemeIcon>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={600} c="white">
        {value}
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
  const scenarioConfig = isRecord(rawConfig.scenario) ? rawConfig.scenario : {}
  const llmConfig = isRecord(rawConfig.llm) ? rawConfig.llm : {}
  const voiceConfig = isRecord(rawConfig.voice) ? rawConfig.voice : {}
  const videoConfig = isRecord(rawConfig.video) ? rawConfig.video : {}
  const crmConfig = isRecord(rawConfig.crm) ? rawConfig.crm : {}

  const sessionSummary =
    toText(rawConfig.description) ??
    toText(session.scenario?.description) ??
    'This session is configured and ready to launch.'
  const objective = toText(scenarioConfig.objective) ?? toText(rawConfig.objective)
  const aiRole = toText(config.aiRole)
  const userRole = toText(config.userRole)
  const language = session.language ?? toText(rawConfig.language) ?? 'Default'
  const multiTurn =
    typeof config.multiTurnEnabled === 'boolean'
      ? config.multiTurnEnabled
        ? 'Enabled'
        : 'Disabled'
      : null
  const canModify = Boolean(user?.id && session.userId === user.id)

  const overviewTiles: Array<{ label: string; value: string; icon: ReactNode }> = [
    { label: 'Status', value: displayStatus, icon: <IconInfoCircle size={14} /> },
    { label: 'Type', value: session.type, icon: <IconTag size={14} /> },
    { label: 'Language', value: language, icon: <IconLanguage size={14} /> },
    {
      label: 'Created',
      value: formatDateTime(session.createdAt) ?? 'Unknown',
      icon: <IconCalendar size={14} />,
    },
    {
      label: 'Updated',
      value: formatDateTime(session.updatedAt) ?? 'Unknown',
      icon: <IconClock size={14} />,
    },
  ]

  if (session.endedAt) {
    overviewTiles.push({
      label: 'Ended',
      value: formatDateTime(session.endedAt) ?? 'Unknown',
      icon: <IconClock size={14} />,
    })
  }

  const advancedEntries = Object.entries(rawConfig).filter(([key]) => {
    const hiddenKeys = new Set([
      'description',
      'aiRole',
      'userRole',
      'llm',
      'voice',
      'video',
      'scenario',
      'crm',
      'objective',
      'language',
    ])
    return !hiddenKeys.has(key)
  })

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/studio/sessions')}
            style={{ flexShrink: 0 }}
          >
            Sessions
          </Button>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
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
            <Button
              size="sm"
              variant="filled"
              color="brand"
              leftSection={<IconPlayerPlay size={15} />}
              onClick={() => router.push(`/session/${session.id}`)}
            >
              Launch
            </Button>
          </Group>
        </Group>

        <Group gap="sm" align="center" wrap="wrap">
          <Title
            order={2}
            c="white"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </Title>
          <Badge color={badgeColor} radius="sm" variant="light" style={{ flexShrink: 0 }}>
            {displayStatus}
          </Badge>
        </Group>

        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
          {session.id}
        </Text>
      </Stack>

      <Divider color="dark.5" />

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            <SectionCard
              title="Session Summary"
              icon={
                <ThemeIcon size={22} color="brand" variant="light" radius="sm">
                  <IconInfoCircle size={14} />
                </ThemeIcon>
              }
            >
              <Stack gap="md">
                <Text size="sm" c="white" style={{ lineHeight: 1.6 }}>
                  {sessionSummary}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="sm">
                  {overviewTiles.map((tile) => (
                    <StatTile
                      key={tile.label}
                      label={tile.label}
                      value={tile.value}
                      icon={tile.icon}
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            </SectionCard>

            <SectionCard
              title="Scenario, Persona, and Roles"
              icon={
                <ThemeIcon size={22} color="violet" variant="light" radius="sm">
                  <IconUser size={14} />
                </ThemeIcon>
              }
            >
              <Stack gap="xs">
                <DetailRow label="Scenario" value={session.scenario?.name ?? session.scenarioId} />
                <DetailRow label="Persona" value={session.persona?.name ?? session.personaId} />
                <DetailRow label="Your role" value={userRole} />
                <DetailRow label="AI role" value={aiRole} />
                <DetailRow label="Objective" value={objective} />
                <DetailRow label="Ended reason" value={session.endedReason} />
              </Stack>
            </SectionCard>

            <SectionCard
              title="AI and Delivery Settings"
              icon={
                <ThemeIcon size={22} color="orange" variant="light" radius="sm">
                  <IconRobot size={14} />
                </ThemeIcon>
              }
            >
              <Stack gap="xs">
                <DetailRow label="Multi-turn" value={multiTurn} />
                <DetailRow label="AI model provider" value={llmConfig.provider} />
                <DetailRow label="AI model" value={llmConfig.model} />
                <DetailRow label="Temperature" value={llmConfig.temperature} />
                <DetailRow label="Max tokens" value={llmConfig.maxTokens} />
                <DetailRow label="Voice provider" value={voiceConfig.provider} />
                <DetailRow label="Voice" value={voiceConfig.voice} />
                <DetailRow label="Video mode" value={videoConfig.mode} />
                <DetailRow label="Video provider" value={videoConfig.provider} />
              </Stack>
            </SectionCard>

            {advancedEntries.length > 0 && (
              <SectionCard
                title="Advanced Configuration"
                icon={
                  <ThemeIcon size={22} color="gray" variant="light" radius="sm">
                    <IconTag size={14} />
                  </ThemeIcon>
                }
              >
                <Stack gap="xs">
                  {advancedEntries.map(([key, value]) => (
                    <DetailRow key={key} label={toLabel(key)} value={value} />
                  ))}
                </Stack>
              </SectionCard>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <SectionCard
              title="Quick Facts"
              icon={
                <ThemeIcon size={22} color="brand" variant="light" radius="sm">
                  <IconInfoCircle size={14} />
                </ThemeIcon>
              }
            >
              <Stack gap="xs">
                <DetailRow label="Session ID" value={session.id} />
                <DetailRow label="Owner" value={session.userId} />
                <DetailRow label="Team / Org" value={session.orgId} />
                <DetailRow label="CRM Context" value={session.crmContextId} />
                <DetailRow label="CRM Source" value={crmConfig.provider ?? crmConfig.source} />
              </Stack>
            </SectionCard>

            <SectionCard
              title="Tags"
              icon={
                <ThemeIcon size={22} color="teal" variant="light" radius="sm">
                  <IconTag size={14} />
                </ThemeIcon>
              }
            >
              {session.tags.length > 0 ? (
                <Group gap="xs" wrap="wrap">
                  {session.tags.map((tag, index) => (
                    <Badge
                      key={`${tag}-${index}`}
                      variant="outline"
                      color="gray"
                      radius="md"
                      size="sm"
                    >
                      {tag}
                    </Badge>
                  ))}
                </Group>
              ) : (
                <Text size="sm" c="dimmed">
                  No tags for this session.
                </Text>
              )}
            </SectionCard>

            {(isRecord(session.userSnapshot) || isRecord(session.orgSnapshot)) && (
              <SectionCard
                title="Snapshots"
                icon={
                  <ThemeIcon size={22} color="gray" variant="light" radius="sm">
                    <IconUser size={14} />
                  </ThemeIcon>
                }
              >
                <Stack gap="sm">
                  {isRecord(session.userSnapshot) && (
                    <Box>
                      <Text size="sm" c="dimmed" mb={6}>
                        User snapshot
                      </Text>
                      <JsonViewer data={session.userSnapshot} />
                    </Box>
                  )}
                  {isRecord(session.orgSnapshot) && (
                    <Box>
                      <Text size="sm" c="dimmed" mb={6}>
                        Team snapshot
                      </Text>
                      <JsonViewer data={session.orgSnapshot} />
                    </Box>
                  )}
                </Stack>
              </SectionCard>
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
