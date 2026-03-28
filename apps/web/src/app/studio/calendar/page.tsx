'use client'

import {
  Stack,
  Group,
  Title,
  Text,
  Tabs,
  Button,
  Select,
  Card,
  Badge,
  Center,
  Loader,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core'
import {
  IconCalendarEvent,
  IconSparkles,
  IconSettings,
  IconRefresh,
  IconCheck,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CalendarConnectCards } from '@/features/calendar/components/CalendarConnectCards'
import { CalendarEventList } from '@/features/calendar/components/CalendarEventList'
import { useCalendarStore } from '@/features/calendar/stores/calendar.store'
import { useCalendarEvents } from '@/features/calendar/hooks/useCalendarEvents'
import type { CalendarEvent } from '@/features/calendar/types/calendar.types'
import { useI18n } from '@/features/i18n'
import { api } from '@/lib/client'
import { notifications } from '@mantine/notifications'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTeams } from '@/features/teams/hooks/useTeams'

const LOOK_AHEAD_OPTIONS = [
  { value: '3', label: '3 days' },
  { value: '7', label: '1 week' },
  { value: '14', label: '2 weeks' },
  { value: '30', label: '1 month' },
]

export default function CalendarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const { user } = useAuth()
  const { activeTeamId } = useTeams()

  const tabParam = searchParams.get('tab')
  const connectedParam = searchParams.get('connected')
  const [activeTab, setActiveTab] = useState(tabParam ?? 'events')
  const [lookAheadDays, setLookAheadDays] = useState('7')

  const store = useCalendarStore()
  const {
    data: events,
    isLoading: eventsLoading,
    refetch,
  } = useCalendarEvents(parseInt(lookAheadDays))

  useEffect(() => {
    void store.fetchStatuses()
    void store.fetchSuggestions()
  }, [])

  useEffect(() => {
    if (connectedParam) {
      notifications.show({
        title: 'Calendar connected',
        message: `Your ${connectedParam === 'google' ? 'Google' : 'Outlook'} calendar has been connected successfully.`,
        color: 'green',
      })
      // Send the user back to home after a successful OAuth connection
      router.replace('/studio/home')
    }
    const errorParam = searchParams.get('error')
    if (errorParam) {
      notifications.show({
        title: 'Calendar connection failed',
        message: 'Could not connect your calendar. Please try again from Settings.',
        color: 'red',
      })
      router.replace('/studio/home')
    }
  }, [connectedParam, searchParams, router])

  const handleCreateSession = async (event: CalendarEvent) => {
    try {
      const orgId = activeTeamId || user?.id
      if (!orgId) {
        notifications.show({
          title: 'Missing workspace',
          message: 'Could not determine which workspace to save the session in.',
          color: 'red',
        })
        return
      }

      const session = await api.sessions.create({
        name: event.title,
        orgId,
        type: 'text',
        tags: ['calendar-generated'],
        sessionConfig: {
          calendarEventId: event.id,
          calendarProvider: event.provider,
          eventStartTime: event.startTime,
          attendees: event.attendees,
        },
      })
      notifications.show({
        title: 'Session created',
        message: `Practice session for "${event.title}" is ready.`,
        color: 'green',
      })
      router.push(`/studio/sessions/${(session as any).id}`)
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create session', color: 'red' })
    }
  }

  const googleConnected = store.googleStatus?.connected === true
  const microsoftConnected = store.microsoftStatus?.connected === true
  const anyConnected = googleConnected || microsoftConnected

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Title order={3}>Calendar</Title>
          <Text size="sm" c="dimmed">
            Sync your meetings and prepare with practice sessions
          </Text>
        </Stack>
        {anyConnected && (
          <Group gap="xs">
            {googleConnected && (
              <Badge color="red" variant="light" size="sm">
                Google
              </Badge>
            )}
            {microsoftConnected && (
              <Badge color="blue" variant="light" size="sm">
                Outlook
              </Badge>
            )}
            <Tooltip label="Refresh events">
              <ActionIcon variant="subtle" onClick={() => void refetch()}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {!anyConnected && (
        <Card withBorder radius="md" p="lg">
          <Stack align="center" gap="md">
            <IconCalendarEvent size={48} stroke={1} color="var(--mantine-color-dimmed)" />
            <Stack align="center" gap="xs">
              <Text fw={500}>Connect your calendar to get started</Text>
              <Text size="sm" c="dimmed" ta="center">
                PITCH will help you prepare for upcoming meetings with targeted practice sessions.
              </Text>
            </Stack>
            <CalendarConnectCards />
          </Stack>
        </Card>
      )}

      {anyConnected && (
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v ?? 'events')}>
          <Tabs.List>
            <Tabs.Tab value="events" leftSection={<IconCalendarEvent size={14} />}>
              Events
            </Tabs.Tab>
            <Tabs.Tab
              value="suggestions"
              leftSection={<IconSparkles size={14} />}
              rightSection={
                store.suggestions.length > 0 ? (
                  <Badge size="xs" circle>
                    {store.suggestions.length}
                  </Badge>
                ) : undefined
              }
            >
              Suggestions
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
              Settings
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="events" pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {events?.length ?? 0} upcoming meetings
                </Text>
                <Select
                  size="xs"
                  value={lookAheadDays}
                  onChange={(v) => setLookAheadDays(v ?? '7')}
                  data={LOOK_AHEAD_OPTIONS}
                  w={120}
                />
              </Group>
              <CalendarEventList
                events={events ?? []}
                loading={eventsLoading}
                onCreateSession={handleCreateSession}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="suggestions" pt="md">
            <SuggestionsTab suggestions={store.suggestions} store={store} />
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="md">
            <Stack gap="md">
              <Text fw={500}>Connected Calendars</Text>
              <CalendarConnectCards />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}

function SuggestionsTab({
  suggestions,
  store,
}: {
  suggestions: any[]
  store: {
    acceptSuggestion: (id: string) => Promise<void>
    dismissSuggestion: (id: string) => Promise<void>
  }
}) {
  const router = useRouter()

  if (suggestions.length === 0) {
    return (
      <Center h={200}>
        <Stack align="center" gap="xs">
          <IconSparkles size={40} stroke={1} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" size="sm">
            No suggestions right now. Check back after your next calendar sync.
          </Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack gap="sm">
      {suggestions.map((s) => (
        <Card key={s.id} withBorder radius="md" p="sm">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text fw={500}>{s.name}</Text>
              <Text size="xs" c="dimmed">
                Calendar-generated suggestion
              </Text>
            </Stack>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                color="green"
                leftSection={<IconCheck size={14} />}
                onClick={() => void store.acceptSuggestion(s.id)}
              >
                Accept
              </Button>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => void store.dismissSuggestion(s.id)}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  )
}
