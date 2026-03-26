'use client'

import { useEffect, useState } from 'react'
import { Box, Group, Text, ActionIcon, rem } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import dayjs from 'dayjs'

type WeekCalendarProps = {
  value: Date | null
  onChange: (date: Date) => void
}

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day // Monday as first day
  return dayjs(d).add(diff, 'day').startOf('day')
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function WeekCalendar({ value, onChange }: WeekCalendarProps) {
  // anchor = which week we are looking at
  const [anchor, setAnchor] = useState<Date>(value ?? new Date())

  // if the parent changes "value", keep anchor in sync
  useEffect(() => {
    if (value) setAnchor(value)
  }, [value])

  const weekStart = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))

  const handlePrevWeek = () => {
    setAnchor((prev) => dayjs(prev).subtract(7, 'day').toDate())
  }

  const handleNextWeek = () => {
    setAnchor((prev) => dayjs(prev).add(7, 'day').toDate())
  }

  const selected = value ? dayjs(value) : null
  const today = dayjs()

  return (
    <Box p={rem(8)}>
      <Box
        mb={rem(6)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={handlePrevWeek}
          style={{ color: 'var(--pitch-nav-text)' }}
        >
          <IconChevronLeft size={14} />
        </ActionIcon>

        <Text
          size="xs"
          fw={600}
          style={{
            color: 'var(--pitch-nav-text)',
            textAlign: 'center',
            flexGrow: 1,
          }}
        >
          {weekStart.format('MMMM YYYY')}
        </Text>

        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={handleNextWeek}
          style={{ color: 'var(--pitch-nav-text)' }}
        >
          <IconChevronRight size={14} />
        </ActionIcon>
      </Box>

      <Group gap={2} mb={4} justify="space-between" wrap="nowrap">
        {WEEKDAY_LABELS.map((label, idx) => {
          const isWeekend = idx === 5 || idx === 6

          return (
            <Text
              key={label}
              size="xs"
              fw={600}
              ta="center"
              style={{ flex: 1 }}
              c={isWeekend ? 'var(--mantine-color-red-8)' : 'var(--pitch-nav-text-dim)'}
            >
              {label}
            </Text>
          )
        })}
      </Group>

      <Group gap={2} justify="space-between" wrap="nowrap">
        {days.map((d) => {
          const isSelected = selected && d.isSame(selected, 'day')
          const isToday = d.isSame(today, 'day')
          const isPast = d.isBefore(today, 'day')
          const isWeekend = d.day() === 0 || d.day() === 6

          let bg = 'transparent'
          let color: string | undefined = 'var(--mantine-color-gray-0)'
          let opacity = 1

          if (isSelected) {
            bg = 'var(--pitch-accent-strong)'
            color = 'white'
          } else {
            if (isWeekend) {
              color = 'var(--mantine-color-red-8)'
            }
            if (isToday) {
              bg = 'color-mix(in srgb, var(--pitch-nav-text) 12%, transparent)'
            }
            if (isPast && !isToday) {
              opacity = 0.4
            }
          }

          return (
            <Box
              key={d.toISOString()}
              h={rem(26)}
              style={{
                flex: 1,
                borderRadius: rem(999),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: bg,
                opacity,
              }}
              onClick={() => onChange(d.toDate())}
            >
              <Text size="xs" fw={600} c={color}>
                {d.format('D')}
              </Text>
            </Box>
          )
        })}
      </Group>
    </Box>
  )
}
