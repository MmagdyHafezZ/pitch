'use client'

import {
  Stack,
  Card,
  Group,
  Text,
  Badge,
  Button,
  Avatar,
  Tooltip,
  Center,
  Loader,
  ActionIcon,
} from '@mantine/core'
import {
  IconCalendarEvent,
  IconBrandGoogle,
  IconBrandWindows,
  IconVideo,
  IconMapPin,
  IconUsers,
  IconArrowRight,
} from '@tabler/icons-react'
import type { CalendarEvent } from '../types/calendar.types'

interface CalendarEventListProps {
  events: CalendarEvent[]
  loading?: boolean
  onCreateSession?: (event: CalendarEvent) => void
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function ProviderIcon({ provider }: { provider: 'google' | 'microsoft' }) {
  return provider === 'google' ? (
    <Tooltip label="Google Calendar">
      <IconBrandGoogle size={14} color="var(--mantine-color-red-6)" />
    </Tooltip>
  ) : (
    <Tooltip label="Outlook">
      <IconBrandWindows size={14} color="var(--mantine-color-blue-6)" />
    </Tooltip>
  )
}

export function CalendarEventList({ events, loading, onCreateSession }: CalendarEventListProps) {
  if (loading) {
    return (
      <Center h={200}>
        <Loader size="sm" />
      </Center>
    )
  }

  if (events.length === 0) {
    return (
      <Center h={200}>
        <Stack align="center" gap="xs">
          <IconCalendarEvent size={40} stroke={1} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" size="sm">
            No upcoming meetings found
          </Text>
        </Stack>
      </Center>
    )
  }

  let lastDate = ''

  return (
    <Stack gap="xs">
      {events.map((event) => {
        const date = formatDate(event.startTime)
        const showDateDivider = date !== lastDate
        lastDate = date

        return (
          <Stack key={event.id} gap="xs">
            {showDateDivider && (
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" mt="sm">
                {date}
              </Text>
            )}
            <Card withBorder radius="md" p="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" align="center">
                    <ProviderIcon provider={event.provider} />
                    <Text fw={500} truncate>
                      {event.title}
                    </Text>
                    {event.status === 'tentative' && (
                      <Badge size="xs" color="yellow" variant="light">
                        Tentative
                      </Badge>
                    )}
                    {event.status === 'cancelled' && (
                      <Badge size="xs" color="red" variant="light">
                        Cancelled
                      </Badge>
                    )}
                  </Group>

                  <Group gap="xs" c="dimmed">
                    <Text size="xs">
                      {formatTime(event.startTime)} – {formatTime(event.endTime)}
                    </Text>
                    {event.location && (
                      <>
                        <Text size="xs">·</Text>
                        <Group gap={4}>
                          <IconMapPin size={12} />
                          <Text size="xs" truncate maw={150}>
                            {event.location}
                          </Text>
                        </Group>
                      </>
                    )}
                    {event.attendees.length > 0 && (
                      <>
                        <Text size="xs">·</Text>
                        <Group gap={4}>
                          <IconUsers size={12} />
                          <Text size="xs">{event.attendees.length} attendees</Text>
                        </Group>
                      </>
                    )}
                  </Group>
                </Stack>

                <Group gap="xs" wrap="nowrap">
                  {event.meetingUrl && (
                    <Tooltip label="Join meeting">
                      <ActionIcon
                        component="a"
                        href={event.meetingUrl}
                        target="_blank"
                        size="sm"
                        variant="light"
                        color="blue"
                      >
                        <IconVideo size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {onCreateSession && event.status !== 'cancelled' && (
                    <Button
                      size="xs"
                      variant="light"
                      rightSection={<IconArrowRight size={12} />}
                      onClick={() => onCreateSession(event)}
                    >
                      Practice
                    </Button>
                  )}
                </Group>
              </Group>
            </Card>
          </Stack>
        )
      })}
    </Stack>
  )
}
