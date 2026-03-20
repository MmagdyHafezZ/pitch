'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Badge,
  Skeleton,
  Button,
  SimpleGrid,
  Timeline,
  ThemeIcon,
  Divider,
  Code,
  ScrollArea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconMessage,
  IconRobot,
  IconClock,
  IconUser,
  IconDeviceDesktopAnalytics,
  IconPlayerPlay,
} from '@tabler/icons-react'
import { api } from '@/lib/client'

type TimelineEvent = {
  id: string
  type: string
  role?: string
  content?: string
  text?: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [assessment, setAssessment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      try {
        const [sessionData, timelineData] = await Promise.all([
          api.sessions.getById(id),
          api.sessions.timeline(id, 200).catch(() => []),
        ])
        setSession(sessionData)
        setTimeline(Array.isArray(timelineData) ? timelineData : (timelineData?.events ?? []))

        try {
          const latest = await api.assessments.getLatestForSession(id)
          setAssessment(latest)
        } catch {
          // no assessment
        }
      } catch {
        notifications.show({ title: 'Error', message: 'Failed to load session', color: 'red' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (loading) {
    return (
      <Stack gap="lg">
        <Skeleton height={40} />
        <SimpleGrid cols={3}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </SimpleGrid>
        <Skeleton height={300} />
      </Stack>
    )
  }

  if (!session) {
    return (
      <Stack align="center" p="xl">
        <Text c="dimmed">Session not found.</Text>
        <Button variant="subtle" onClick={() => router.push('/admin/sessions')}>
          Back to Sessions
        </Button>
      </Stack>
    )
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: 'green',
      ended: 'gray',
      paused: 'yellow',
    }
    return map[s] ?? 'blue'
  }

  const durationMs = session.endedAt
    ? new Date(session.endedAt).getTime() - new Date(session.createdAt).getTime()
    : Date.now() - new Date(session.createdAt).getTime()
  const durationMins = Math.round(durationMs / 60000)

  const scoreBreakdown = assessment?.scoreBreakdown ?? assessment?.report?.scoreBreakdown

  return (
    <Stack gap="lg">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/admin/sessions')}
        >
          Back
        </Button>
      </Group>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} fw={700}>
            {session.name || 'Untitled Session'}
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            ID: {session.id}
          </Text>
        </div>
        <Badge color={statusColor(session.status)} variant="filled" size="lg">
          {session.status}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="blue" size="lg">
              <IconUser size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                User ID
              </Text>
              <Text size="sm" fw={500} lineClamp={1}>
                {session.userId}
              </Text>
            </div>
          </Group>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="violet" size="lg">
              <IconDeviceDesktopAnalytics size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Type
              </Text>
              <Text size="sm" fw={500} tt="capitalize">
                {session.type}
              </Text>
            </div>
          </Group>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="teal" size="lg">
              <IconClock size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Duration
              </Text>
              <Text size="sm" fw={500}>
                {durationMins < 60
                  ? `${durationMins}m`
                  : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`}
              </Text>
            </div>
          </Group>
        </Card>

        <Card withBorder radius="md" p="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="orange" size="lg">
              <IconPlayerPlay size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Created
              </Text>
              <Text size="sm" fw={500}>
                {new Date(session.createdAt).toLocaleString()}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {(session.scenario || session.persona) && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {session.scenario && (
            <Card withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                Scenario
              </Text>
              <Text size="sm" fw={500}>
                {session.scenario.name ?? session.scenarioId}
              </Text>
              {session.scenario.description && (
                <Text size="xs" c="dimmed" mt={4} lineClamp={3}>
                  {session.scenario.description}
                </Text>
              )}
            </Card>
          )}
          {session.persona && (
            <Card withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
                Persona
              </Text>
              <Text size="sm" fw={500}>
                {session.persona.name ?? session.personaId}
              </Text>
            </Card>
          )}
        </SimpleGrid>
      )}

      {assessment && (
        <Card withBorder radius="md" p="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="md">
            Assessment Results
          </Text>
          {assessment.totalScore != null && (
            <Group mb="md">
              <Text size="xl" fw={700}>
                Score: {assessment.totalScore}
              </Text>
            </Group>
          )}
          {scoreBreakdown && (
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              {Object.entries(scoreBreakdown).map(([key, value]) => (
                <Card key={key} withBorder radius="sm" p="sm">
                  <Text size="xs" c="dimmed" tt="capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                  <Text size="lg" fw={700}>
                    {String(value)}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Card>
      )}

      <Card withBorder radius="md" p="lg">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="md">
          Session Timeline ({timeline.length} events)
        </Text>
        {timeline.length === 0 ? (
          <Text c="dimmed" size="sm">
            No timeline events recorded for this session.
          </Text>
        ) : (
          <ScrollArea h={500}>
            <Timeline active={timeline.length - 1} bulletSize={24} lineWidth={2}>
              {timeline.map((event, idx) => {
                const isUser = event.role === 'user'
                const isAssistant = event.role === 'assistant'
                const content = event.content || event.text || ''

                return (
                  <Timeline.Item
                    key={event.id || idx}
                    bullet={
                      isUser ? (
                        <IconUser size={12} />
                      ) : isAssistant ? (
                        <IconRobot size={12} />
                      ) : (
                        <IconMessage size={12} />
                      )
                    }
                    title={
                      <Group gap="xs">
                        <Text size="sm" fw={500} tt="capitalize">
                          {event.role ?? event.type ?? 'event'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </Text>
                      </Group>
                    }
                  >
                    {content && (
                      <Text size="sm" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
                        {content}
                      </Text>
                    )}
                  </Timeline.Item>
                )
              })}
            </Timeline>
          </ScrollArea>
        )}
      </Card>

      {session.sessionConfig && (
        <Card withBorder radius="md" p="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="md">
            Session Configuration
          </Text>
          <Code block>{JSON.stringify(session.sessionConfig, null, 2)}</Code>
        </Card>
      )}
    </Stack>
  )
}
