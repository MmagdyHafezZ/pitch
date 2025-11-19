'use client'

import { useState } from 'react'
import {
  Modal,
  Box,
  Group,
  Stack,
  Text,
  TextInput,
  Select,
  Button,
  Avatar,
  ActionIcon,
  rem,
} from '@mantine/core'
import {
  IconUser,
  IconBell,
  IconMicrophone,
  IconPalette,
  IconWorld,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useAuth } from '@/features/auth'
import { useRouter } from 'next/navigation'

type SettingsSection = 'Account' | 'Notifications' | 'Voice & Video' | 'Appearance' | 'Language'

interface SettingsModalProps {
  opened: boolean
  onClose: () => void
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [activeSection, setActiveSection] = useState<SettingsSection>('Account')
  const [name, setName] = useState(user?.name || 'John Doe')
  const [email, setEmail] = useState(user?.email || 'john.doe@ibm.com')
  const [timezone, setTimezone] = useState('(GMT-5:00) Eastern Time')

  const sections: { icon: typeof IconUser; label: SettingsSection }[] = [
    { icon: IconUser, label: 'Account' },
    { icon: IconBell, label: 'Notifications' },
    { icon: IconMicrophone, label: 'Voice & Video' },
    { icon: IconPalette, label: 'Appearance' },
    { icon: IconWorld, label: 'Language' },
  ]

  const handleLogout = async () => {
    await logout()
    onClose()
    router.push('/login')
  }

  const handleSave = () => {
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="800px"
      padding={0}
      withCloseButton={false}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: rem(12), overflow: 'hidden' },
      }}
    >
      <Group align="stretch" gap={0} wrap="nowrap" style={{ minHeight: 600 }}>
        {/* Left Sidebar */}
        <Box
          style={{
            width: 280,
            backgroundColor: 'var(--mantine-color-dark-8)',
            padding: rem(24),
            position: 'relative',
          }}
        >
          <ActionIcon
            variant="subtle"
            color="white"
            size="lg"
            onClick={onClose}
            style={{ position: 'absolute', top: 16, left: 16 }}
          >
            <IconX size={20} />
          </ActionIcon>

          <Stack gap="xs" mt={rem(40)}>
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <Box
                  key={section.label}
                  onClick={() => setActiveSection(section.label)}
                  style={{
                    padding: `${rem(12)} ${rem(16)}`,
                    borderRadius: rem(8),
                    cursor: 'pointer',
                    backgroundColor:
                      activeSection === section.label ? 'rgba(255,255,255,0.1)' : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Group gap="sm">
                    <Icon size={20} color="white" />
                    <Text c="white" size="sm" fw={500}>
                      {section.label}
                    </Text>
                  </Group>
                </Box>
              )
            })}
          </Stack>

          {/* Logout Button */}
          <Box
            onClick={handleLogout}
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              right: 24,
              padding: `${rem(12)} ${rem(16)}`,
              borderRadius: rem(8),
              cursor: 'pointer',
              backgroundColor: 'rgba(255,255,255,0.05)',
              transition: 'background-color 0.2s',
            }}
          >
            <Group gap="sm">
              <IconX size={20} color="white" />
              <Text c="white" size="sm" fw={500}>
                Logout
              </Text>
            </Group>
          </Box>
        </Box>

        {/* Right Content */}
        <Box style={{ flex: 1, padding: rem(40), backgroundColor: 'white' }}>
          {activeSection === 'Account' && (
            <Stack gap="xl">
              <Group justify="space-between" align="start">
                <Group gap="lg">
                  <Avatar size={100} radius="xl" color="blue">
                    {name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Text size="xl" fw={600} mb="xs">
                      Account
                    </Text>
                    <Button leftSection={<IconUpload size={16} />} variant="light" size="xs">
                      Upload
                    </Button>
                  </Box>
                </Group>
              </Group>

              <TextInput
                label="Name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                size="md"
                styles={{ label: { fontSize: 14, fontWeight: 500, marginBottom: 8 } }}
              />

              <TextInput
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                size="md"
                styles={{ label: { fontSize: 14, fontWeight: 500, marginBottom: 8 } }}
              />

              <TextInput
                label="Password"
                type="password"
                value="***************"
                size="md"
                readOnly
                styles={{ label: { fontSize: 14, fontWeight: 500, marginBottom: 8 } }}
              />

              <Select
                label="Time Zone"
                value={timezone}
                onChange={(val) => setTimezone(val || '')}
                data={[
                  '(GMT-5:00) Eastern Time',
                  '(GMT-6:00) Central Time',
                  '(GMT-7:00) Mountain Time',
                  '(GMT-8:00) Pacific Time',
                ]}
                size="md"
                styles={{ label: { fontSize: 14, fontWeight: 500, marginBottom: 8 } }}
              />

              <Group justify="space-between" mt="xl">
                <Text
                  size="sm"
                  c="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    /* TODO: Implement delete account */
                  }}
                >
                  Delete Account
                </Text>
                <Button onClick={handleSave} size="md">
                  Save
                </Button>
              </Group>
            </Stack>
          )}

          {activeSection === 'Notifications' && (
            <Stack gap="md">
              <Text size="xl" fw={600} mb="md">
                Notifications
              </Text>
              <Text c="dimmed">Notification settings coming soon...</Text>
            </Stack>
          )}

          {activeSection === 'Voice & Video' && (
            <Stack gap="md">
              <Text size="xl" fw={600} mb="md">
                Voice & Video
              </Text>
              <Text c="dimmed">Voice & Video settings coming soon...</Text>
            </Stack>
          )}

          {activeSection === 'Appearance' && (
            <Stack gap="md">
              <Text size="xl" fw={600} mb="md">
                Appearance
              </Text>
              <Text c="dimmed">Appearance settings coming soon...</Text>
            </Stack>
          )}

          {activeSection === 'Language' && (
            <Stack gap="md">
              <Text size="xl" fw={600} mb="md">
                Language
              </Text>
              <Text c="dimmed">Language settings coming soon...</Text>
            </Stack>
          )}
        </Box>
      </Group>
    </Modal>
  )
}
