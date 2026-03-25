'use client'

import { Alert, Group, Text, Button, ActionIcon } from '@mantine/core'
import { IconCalendarEvent, IconArrowRight, IconX } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCalendarSuggestions } from '../hooks/useCalendarEvents'
import { useCalendarStore } from '../stores/calendar.store'

export function CalendarSuggestionsBanner() {
  const router = useRouter()
  const { data: suggestions } = useCalendarSuggestions()
  const { dismissSuggestion } = useCalendarStore()

  if (!suggestions || suggestions.length === 0) return null

  const first = suggestions[0]

  return (
    <Alert
      icon={<IconCalendarEvent size={16} />}
      color="blue"
      variant="light"
      radius="md"
      styles={{ root: { cursor: 'default' } }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="sm">
          <b>
            {suggestions.length} practice session
            {suggestions.length !== 1 ? 's' : ''} suggested
          </b>{' '}
          based on your upcoming meetings.
        </Text>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="light"
            color="blue"
            rightSection={<IconArrowRight size={12} />}
            onClick={() => router.push('/studio/calendar?tab=suggestions')}
          >
            Review
          </Button>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={() => dismissSuggestion(first.id)}
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Alert>
  )
}
