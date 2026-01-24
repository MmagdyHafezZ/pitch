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
  showSearch?: boolean
  searchPlaceholder?: string
  rightSlot?: ReactNode
  teamName?: string
}

export function AppTopBar({
  value,
  onChange,
  date = new Date(),
  rightSlot,
  showSearch = true,
  searchPlaceholder = 'Search',
  teamName,
}: HeaderProps) {
  const weekday = useMemo(() => dayjs(date).format('dddd'), [date])
  const shortDate = useMemo(() => dayjs(date).format('MMM D, YYYY'), [date])
  const [settingsOpened, setSettingsOpened] = useState(false)

  return (
    <>
      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
      <Box
        style={{
          background: 'var(--mantine-color-dark-9)',
          borderBottomLeftRadius: 0,
          height: rem(60),
          paddingInline: rem(10),
          display: 'flex',
          alignItems: 'center',
          gap: rem(10),
        }}
      >
        <Group justify="space-between" align="center" w="100%">
          <Group align="center" style={{ flex: 1, minWidth: 0 }}>
            {teamName && (
              <Text
                px={rem(40)}
                size={rem(28)}
                fw={700}
                c="var(--mantine-color-blue-4)"
                style={{ whiteSpace: 'nowrap' }}
              >
                P.I.T.C.H
              </Text>
            )}
          </Group>
          {rightSlot ??
            (showSearch && (
              <Group align="center" style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  value={value}
                  onChange={(e) => onChange?.(e.currentTarget.value)}
                  placeholder={searchPlaceholder}
                  leftSection={<IconSearch size={16} />}
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
              </Group>
            ))}

          <Group align="center">
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
              onClick={() => setSettingsOpened(true)}
              styles={{
                root: {
                  background: 'white',
                  color: 'var(--mantine-color-dark-7)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                },
              }}
            >
              <IconUser size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>
    </>
  )
}
