'use client'

import { Box, Title, Text, Stack, Button, Group } from '@mantine/core'
import { motion } from 'framer-motion'
import { CalendarConnectCards } from '@/features/calendar/components/CalendarConnectCards'
import { useCalendarStore } from '@/features/calendar/stores/calendar.store'
import { useEffect } from 'react'

interface ConnectCalendarStepProps {
  onNext: () => void
  onSkip: () => void
}

export function ConnectCalendarStep({ onNext, onSkip }: ConnectCalendarStepProps) {
  const { googleStatus, microsoftStatus, fetchStatuses } = useCalendarStore()

  useEffect(() => {
    void fetchStatuses()
  }, [fetchStatuses])

  const anyConnected = googleStatus?.connected === true || microsoftStatus?.connected === true

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <Stack gap="xl">
        <Box ta="center">
          <Title order={2} fw={700} mb="xs">
            Connect Your Calendar
          </Title>
          <Text c="dimmed" maw={440} mx="auto">
            Let PITCH read your upcoming meetings so it can proactively suggest practice sessions
            and help you prepare before every call.
          </Text>
        </Box>

        <CalendarConnectCards />

        <Group justify="space-between" wrap="wrap">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip for now
          </Button>
          <Button onClick={onNext} px={32}>
            {anyConnected ? 'Continue' : 'Continue anyway'}
          </Button>
        </Group>
      </Stack>
    </motion.div>
  )
}
