'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Paper, Text, Group, Button, ActionIcon, Stack, Box, ThemeIcon } from '@mantine/core'
import { IconCalendarEvent, IconX, IconSparkles } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'
import type { CalendarEvent } from '@/features/calendar/types/calendar.types'
import { useCalendarStore } from '@/features/calendar/stores/calendar.store'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTeams } from '@/features/teams/hooks/useTeams'

const DISMISS_KEY = (eventId: string) => `proactive_nudge_dismissed_${eventId}`
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function isDismissed(eventId: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY(eventId))
    if (!raw) return false
    const until = parseInt(raw, 10)
    return Date.now() < until
  } catch {
    return false
  }
}

function dismiss(eventId: string) {
  try {
    localStorage.setItem(DISMISS_KEY(eventId), String(Date.now() + DISMISS_TTL_MS))
  } catch {}
}

function formatRelativeDay(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / 86400_000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'

  return d.toLocaleDateString([], { weekday: 'long' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ProactiveCalendarNudge() {
  const router = useRouter()
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const { googleStatus, microsoftStatus } = useCalendarStore()
  const { user } = useAuth()
  const { activeTeamId } = useTeams()

  const anyCalendarConnected =
    googleStatus?.connected === true || microsoftStatus?.connected === true

  useEffect(() => {
    if (!anyCalendarConnected) return

    void (async () => {
      try {
        const events = (await api.calendar.upcoming(3)) as CalendarEvent[]
        const soonest = events.find(
          (e) => !e.isAllDay && e.status !== 'cancelled' && !isDismissed(e.id)
        )
        if (soonest) {
          setEvent(soonest)
          // Small delay so page layout settles before nudge appears
          setTimeout(() => setVisible(true), 1500)
        }
      } catch {
        // Calendar not connected or API error — silently skip
      }
    })()
  }, [anyCalendarConnected])

  if (!visible || !event) return null

  const handleDismiss = () => {
    dismiss(event.id)
    setVisible(false)
  }

  const handleCreateSession = async () => {
    setCreating(true)
    try {
      const orgId = activeTeamId || user?.id
      if (!orgId) {
        notifications.show({
          title: 'Missing workspace',
          message: 'Could not determine which workspace to save the session in.',
          color: 'red',
        })
        setCreating(false)
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
      dismiss(event.id)
      setVisible(false)
      notifications.show({
        title: 'Session created',
        message: `Practice session for "${event.title}" is ready.`,
        color: 'green',
      })
      router.push(`/studio/sessions/${(session as any).id}`)
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create session', color: 'red' })
      setCreating(false)
    }
  }

  const relDay = formatRelativeDay(event.startTime)
  const time = formatTime(event.startTime)

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 100,
        right: 24,
        zIndex: 300,
        maxWidth: 340,
        animation: 'nudge-slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <style>{`
        @keyframes nudge-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Speech-bubble tail */}
      <Box
        style={{
          position: 'absolute',
          bottom: -8,
          right: 28,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid var(--mantine-color-default-border)',
        }}
      />

      <Paper withBorder shadow="md" radius="lg" p="md">
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon
            size={36}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'blue' }}
          >
            <IconSparkles size={18} />
          </ThemeIcon>

          <Stack gap={6} style={{ flex: 1 }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="sm" fw={600} lh={1.3}>
                Heads up!
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={handleDismiss}
                style={{ marginTop: -2, marginRight: -4 }}
              >
                <IconX size={12} />
              </ActionIcon>
            </Group>

            <Group gap={6} align="center">
              <IconCalendarEvent size={13} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                <b>{event.title}</b> is {relDay} at {time}
              </Text>
            </Group>

            <Text size="xs" c="dimmed" lh={1.4}>
              Want me to set up a practice session so you&apos;re ready?
            </Text>

            <Group gap="xs" mt={4}>
              <Button
                size="xs"
                variant="gradient"
                gradient={{ from: 'violet', to: 'blue' }}
                loading={creating}
                onClick={() => void handleCreateSession()}
              >
                Yes, let&apos;s prepare
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={handleDismiss}>
                Not now
              </Button>
            </Group>
          </Stack>
        </Group>
      </Paper>
    </Box>
  )
}
