'use client'

import { Box, Group, TextInput, ActionIcon, Text, rem } from '@mantine/core'
import { IconSearch, IconBell, IconUser } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useMemo } from 'react'

type HeaderProps = {
  value?: string
  onChange?: (v: string) => void
  date?: Date
  gutter?: number
}

export function AppTopBar({ value, onChange, date = new Date(), gutter = 16 }: HeaderProps) {
  const weekday = useMemo(() => dayjs(date).format('dddd'), [date])
  const shortDate = useMemo(() => dayjs(date).format('MMM D, YYYY'), [date])

  return (
    <Box px={rem(gutter)} pt={rem(gutter)}>
      <Box
        style={{
          background: 'var(--mantine-color-dark-8)',
          borderRadius: rem(14),
          height: rem(44),
          paddingInline: rem(10),
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Group justify="space-between" align="center" w="100%" gap={rem(8)}>
          <TextInput
            value={value}
            onChange={(e) => onChange?.(e.currentTarget.value)}
            placeholder=""
            leftSection={<IconSearch size={16} />}
            size="sm"
            w={rem(360)}
            styles={{
              input: {
                height: rem(28),
                borderRadius: rem(999),
                border: 'none',
                background: 'white',
                paddingLeft: rem(28),
                paddingRight: rem(10),
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
              },
              section: { color: 'var(--mantine-color-dark-6)' },
            }}
          />

          <Group gap={rem(8)} align="center">
            <Box ta="right" lh={1}>
              <Text size="xs" fw={700} c="gray.2">
                {weekday}
              </Text>
              <Text size="xs" c="gray.5">
                {shortDate}
              </Text>
            </Box>

            <ActionIcon
              aria-label="Notifications"
              size={28}
              radius="md"
              variant="default"
              styles={{
                root: {
                  background: 'white',
                  color: 'var(--mantine-color-dark-7)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                },
              }}
            >
              <IconBell size={16} />
            </ActionIcon>

            <ActionIcon
              aria-label="Account"
              size={28}
              radius="md"
              variant="default"
              styles={{
                root: {
                  background: 'white',
                  color: 'var(--mantine-color-dark-7)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                },
              }}
            >
              <IconUser size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>
    </Box>
  )
}
