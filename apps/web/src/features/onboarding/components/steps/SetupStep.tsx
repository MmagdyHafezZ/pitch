'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Title,
  Text,
  Stack,
  Button,
  Group,
  Card,
  Switch,
  Select,
  Badge,
  Alert,
  Loader,
  ThemeIcon,
} from '@mantine/core'
import {
  IconMicrophone,
  IconBell,
  IconAlertCircle,
  IconCheck,
  IconVideo,
  IconSettings,
} from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

interface SetupStepProps {
  onNext: () => void
  onSkip: () => void
}

export function SetupStep({ onNext, onSkip }: SetupStepProps) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  // ── Device enumeration ───────────────────────────────────────────────────
  const [mediaDevices, setMediaDevices] = useState<{
    microphones: MediaDeviceInfo[]
    cameras: MediaDeviceInfo[]
  }>({ microphones: [], cameras: [] })
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [prefMic, setPrefMic] = useState<string | null>(
    () =>
      ((
        (user?.settings as Record<string, unknown> | undefined)?.voiceVideo as
          | Record<string, unknown>
          | undefined
      )?.preferredMicrophone as string | null) ?? null
  )
  const [prefCamera, setPrefCamera] = useState<string | null>(
    () =>
      ((
        (user?.settings as Record<string, unknown> | undefined)?.voiceVideo as
          | Record<string, unknown>
          | undefined
      )?.preferredCamera as string | null) ?? null
  )
  const hasEnumerated = useRef(false)

  useEffect(() => {
    if (hasEnumerated.current) return
    hasEnumerated.current = true

    const load = async () => {
      setDevicesLoading(true)
      try {
        await navigator.mediaDevices
          .getUserMedia({ audio: true, video: true })
          .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }))
        const all = await navigator.mediaDevices.enumerateDevices()
        setMediaDevices({
          microphones: all.filter((d) => d.kind === 'audioinput'),
          cameras: all.filter((d) => d.kind === 'videoinput'),
        })
      } catch {
        setDevicesError('Could not access devices. You can configure them later in Settings.')
      } finally {
        setDevicesLoading(false)
      }
    }

    void load()
  }, [])

  // ── Notifications ────────────────────────────────────────────────────────
  const [desktopPermission, setDesktopPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))
  const [emailNotifs, setEmailNotifs] = useState(
    () =>
      (
        (user?.settings as Record<string, unknown> | undefined)?.notifications as
          | Record<string, unknown>
          | undefined
      )?.emailNotifications !== false
  )
  const [sessionReminders, setSessionReminders] = useState(
    () =>
      (
        (user?.settings as Record<string, unknown> | undefined)?.notifications as
          | Record<string, unknown>
          | undefined
      )?.sessionReminders !== false
  )

  const requestDesktopPermission = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setDesktopPermission(result)
  }

  // ── Save & continue ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  const handleContinue = async () => {
    setSaving(true)
    try {
      const existing = user?.settings ?? {}
      const updated = await api.users.updateMySettings({
        ...existing,
        notifications: {
          ...((existing as Record<string, unknown>).notifications as object),
          emailNotifications: emailNotifs,
          sessionReminders,
          desktopNotifications: desktopPermission === 'granted',
        },
        voiceVideo: {
          ...((existing as Record<string, unknown>).voiceVideo as object),
          ...(prefMic ? { preferredMicrophone: prefMic } : {}),
          ...(prefCamera ? { preferredCamera: prefCamera } : {}),
        },
      })
      if (user) setUser({ ...user, settings: updated })
    } catch {
      // Non-blocking — proceed regardless
    } finally {
      setSaving(false)
      onNext()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <Stack gap="xl">
        <Box ta="center">
          <ThemeIcon
            size={64}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo' }}
            mx="auto"
            mb="md"
          >
            <IconSettings size={32} />
          </ThemeIcon>
          <Title order={2} fw={700} mb="xs">
            Set Up Your Devices &amp; Alerts
          </Title>
          <Text c="dimmed" maw={440} mx="auto">
            Choose your preferred microphone and camera, and decide how you&apos;d like PITCH to
            notify you. You can always change these in Settings.
          </Text>
        </Box>

        {/* Devices card */}
        <Card padding="md" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <IconMicrophone size={16} />
              <Text fw={600} size="sm">
                Devices
              </Text>
              {devicesLoading && <Loader size="xs" />}
            </Group>

            {devicesError && (
              <Alert
                color="orange"
                variant="light"
                radius="md"
                icon={<IconAlertCircle size={16} />}
              >
                {devicesError}
              </Alert>
            )}

            <Select
              label="Microphone"
              leftSection={<IconMicrophone size={16} />}
              placeholder={devicesLoading ? 'Detecting…' : 'Default microphone'}
              data={mediaDevices.microphones.map((d) => ({
                value: d.deviceId,
                label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
              }))}
              value={prefMic}
              disabled={devicesLoading}
              onChange={setPrefMic}
            />

            <Select
              label="Camera"
              leftSection={<IconVideo size={16} />}
              placeholder={devicesLoading ? 'Detecting…' : 'Default camera'}
              data={mediaDevices.cameras.map((d) => ({
                value: d.deviceId,
                label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
              }))}
              value={prefCamera}
              disabled={devicesLoading || mediaDevices.cameras.length === 0}
              onChange={setPrefCamera}
            />
          </Stack>
        </Card>

        {/* Notifications card */}
        <Card padding="md" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <IconBell size={16} />
              <Text fw={600} size="sm">
                Notifications
              </Text>
            </Group>

            <Switch
              label="Session summaries by email"
              description="Get a recap email after each practice session."
              checked={emailNotifs}
              onChange={(e) => setEmailNotifs(e.currentTarget.checked)}
            />

            <Switch
              label="Session reminders"
              description="Remind me before a scheduled session."
              checked={sessionReminders}
              onChange={(e) => setSessionReminders(e.currentTarget.checked)}
            />

            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  Desktop notifications
                </Text>
                <Text size="xs" c="dimmed">
                  Show browser alerts for real-time updates.
                </Text>
              </Stack>
              {desktopPermission === 'granted' && (
                <Badge color="teal" size="sm" variant="light" leftSection={<IconCheck size={11} />}>
                  Allowed
                </Badge>
              )}
              {desktopPermission === 'denied' && (
                <Badge color="red" size="sm" variant="light">
                  Blocked in browser
                </Badge>
              )}
              {desktopPermission === 'default' && (
                <Button size="xs" variant="light" onClick={() => void requestDesktopPermission()}>
                  Allow
                </Button>
              )}
              {desktopPermission === 'unsupported' && (
                <Badge color="gray" size="sm" variant="light">
                  Not supported
                </Badge>
              )}
            </Group>
          </Stack>
        </Card>

        <Group justify="space-between" wrap="wrap">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip for now
          </Button>
          <Button px={32} loading={saving} onClick={() => void handleContinue()}>
            Continue
          </Button>
        </Group>
      </Stack>
    </motion.div>
  )
}
