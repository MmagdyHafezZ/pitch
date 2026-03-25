'use client'

import { Card, Group, Text, Button, Badge, Stack, Avatar } from '@mantine/core'
import { IconBrandGoogle, IconBrandWindows, IconCheck, IconUnlink } from '@tabler/icons-react'
import { useCalendarStore } from '../stores/calendar.store'

export function CalendarConnectCards() {
  const {
    googleStatus,
    microsoftStatus,
    loadingStatus,
    connectGoogle,
    connectMicrosoft,
    disconnectGoogle,
    disconnectMicrosoft,
  } = useCalendarStore()

  const googleConnected = googleStatus?.connected === true
  const microsoftConnected = microsoftStatus?.connected === true

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Avatar color="red" size="md" radius="sm">
              <IconBrandGoogle size={20} />
            </Avatar>
            <Stack gap={2}>
              <Text fw={500}>Google Calendar</Text>
              <Text size="xs" c="dimmed">
                {googleConnected
                  ? `Connected as ${googleStatus?.providerEmail ?? 'Google account'}`
                  : 'Connect to sync your Google meetings'}
              </Text>
            </Stack>
          </Group>
          {googleConnected ? (
            <Group gap="xs">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                Connected
              </Badge>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<IconUnlink size={14} />}
                onClick={disconnectGoogle}
                disabled={loadingStatus}
              >
                Disconnect
              </Button>
            </Group>
          ) : (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconBrandGoogle size={14} />}
              onClick={connectGoogle}
              disabled={loadingStatus}
            >
              Connect
            </Button>
          )}
        </Group>
      </Card>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Avatar color="blue" size="md" radius="sm">
              <IconBrandWindows size={20} />
            </Avatar>
            <Stack gap={2}>
              <Text fw={500}>Outlook / Microsoft 365</Text>
              <Text size="xs" c="dimmed">
                {microsoftConnected
                  ? `Connected as ${microsoftStatus?.providerEmail ?? 'Microsoft account'}`
                  : 'Connect to sync your Outlook meetings'}
              </Text>
            </Stack>
          </Group>
          {microsoftConnected ? (
            <Group gap="xs">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                Connected
              </Badge>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<IconUnlink size={14} />}
                onClick={disconnectMicrosoft}
                disabled={loadingStatus}
              >
                Disconnect
              </Button>
            </Group>
          ) : (
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconBrandWindows size={14} />}
              onClick={connectMicrosoft}
              disabled={loadingStatus}
            >
              Connect
            </Button>
          )}
        </Group>
      </Card>
    </Stack>
  )
}
