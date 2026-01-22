'use client'

import { Box, Group, TextInput, ActionIcon, Text, rem } from '@mantine/core'
import { IconSearch, IconBell, IconUser } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { ReactNode, useMemo, useState } from 'react'
import { SettingsModal } from './SettingsModal'

export type HeaderProps = {
  value?: string
  onChange?: (v: string) => void
  date?: Date
  gutter?: number
  onLogout?: () => Promise<void> | void
  showSearch?: boolean
  searchPlaceholder?: string
  rightSlot?: ReactNode
}

export function AppTopBar({
  value,
  onChange,
  date = new Date(),
  gutter = 16,
  rightSlot,
  showSearch = true,
  searchPlaceholder = 'Search',
}: HeaderProps) {
  const weekday = useMemo(() => dayjs(date).format('dddd'), [date])
  const shortDate = useMemo(() => dayjs(date).format('MMM D, YYYY'), [date])
  const [settingsOpened, setSettingsOpened] = useState(false)

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Box style={{ height: '100%' }}>
        <Box
          style={{
            background: 'transparent',
            height: '100%',
            paddingInline: rem(12),
            borderTopLeftRadius: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Group justify="space-between" align="center" w="100%" gap={rem(8)}>
            {rightSlot ??
              (showSearch && (
                <TextInput
                  value={value}
                  onChange={(e) => onChange?.(e.currentTarget.value)}
                  placeholder={searchPlaceholder}
                  leftSection={<IconSearch size={16} />}
                  size="sm"
                  w={rem(360)}
                  styles={{
                    input: {
                      height: rem(32),
                      borderRadius: rem(8),
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      background: '#f8fafc',
                      color: '#0f172a',
                      paddingLeft: rem(28),
                      paddingRight: rem(10),
                      boxShadow: 'inset 0 1px 1px rgba(15, 23, 42, 0.04)',
                    },
                    section: { color: '#475569' },
                  }}
                />
              ))}

            <Group gap={rem(8)} align="center">
              <Box ta="right" lh={1}>
                <Text size="xs" fw={700} c="#e2e8f0">
                  {weekday}
                </Text>
                <Text size="xs" c="#94a3b8">
                  {shortDate}
                </Text>
              </Box>

              <ActionIcon
                aria-label="Notifications"
                size={30}
                radius="sm"
                variant="default"
                styles={{
                  root: {
                    background: '#ffffff',
                    color: '#1e3a8a',
                    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.35)',
                  },
                }}
              >
                <IconBell size={16} />
              </ActionIcon>

              <ActionIcon
                aria-label="Account"
                size={30}
                radius="sm"
                variant="default"
                onClick={() => setSettingsOpened(true)}
                styles={{
                  root: {
                    background: '#ffffff',
                    color: '#1e3a8a',
                    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.35)',
                    cursor: 'pointer',
                  },
                }}
              >
                <IconUser size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </Box>
      </Box>
    </>
  )
}
