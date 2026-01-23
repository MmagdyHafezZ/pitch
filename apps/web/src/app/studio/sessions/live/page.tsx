'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Group,
  Stack,
  Title,
  Text,
  Paper,
  Avatar,
  ActionIcon,
  Badge,
  Card,
} from '@mantine/core'
import { IconPhone, IconPlayerPause, IconMicrophone, IconArrowRight } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

export default function LiveSessionPage() {
  const router = useRouter()
  const [time, setTime] = useState(615)

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const hints = [
    'Hint text placeholder',
    'Hint text placeholder',
    'Hint text placeholder',
    'Hint text placeholder',
    'Hint text placeholder',
    'Hint text placeholder',
    'Hint text placeholder',
  ]

  const timelineEvents = [
    { time: '0:00', progress: 11.5, label: 'User is introducing product', active: true },
    { time: '2:30', progress: 25, label: '', active: false },
    { time: '5:00', progress: 50, label: '', active: false },
    { time: '7:30', progress: 75, label: '', active: false },
    { time: '10:00', progress: 100, label: '', active: false },
  ]

  return (
    <Box
      style={{
        height: '100vh',
        backgroundColor: 'var(--mantine-color-dark-9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <Box
        style={{
          backgroundColor: 'var(--mantine-color-dark-8)',
          padding: '16px 32px',
          borderBottom: '1px solid var(--mantine-color-dark-6)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between">
          <Text fw={600} size="lg" c="white">
            Goal: Improve product pitch
          </Text>
          <Group gap="xl">
            <Text size="xl" fw={700} c="white">
              {formatTime(time)}
            </Text>
            <Group gap="xs">
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'red',
                  animation: 'pulse 2s infinite',
                }}
              />
              <Text c="red" fw={600}>
                Recording
              </Text>
            </Group>
            <Text c="dimmed">Wednesday</Text>
            <Text c="dimmed">Oct 8, 2025</Text>
            <Group gap="xs">
              <ActionIcon size="lg" variant="subtle" color="white">
                <IconPhone size={20} />
              </ActionIcon>
              <ActionIcon size="lg" variant="subtle" color="white">
                <Avatar size="sm" />
              </ActionIcon>
            </Group>
          </Group>
        </Group>
      </Box>

      {/* Main Content */}
      <Box p="xl" style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Hints */}
        <Paper
          withBorder
          radius="lg"
          p="lg"
          style={{
            width: 200,
            backgroundColor: 'white',
            height: 'fit-content',
            flexShrink: 0,
          }}
        >
          <Title order={4} mb="md" ta="center">
            Hints
          </Title>
          <Stack gap="md">
            {hints.map((hint, i) => (
              <Group key={i} gap="xs" align="start">
                <IconArrowRight size={16} style={{ marginTop: 4, flexShrink: 0 }} />
                <Box>
                  <Box h={8} bg="gray.4" style={{ borderRadius: 4, marginBottom: 4 }} />
                  <Box h={8} bg="gray.4" style={{ borderRadius: 4, width: '80%' }} />
                </Box>
              </Group>
            ))}
          </Stack>
        </Paper>

        {/* Center - Main Content */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Video/Audio Visualization */}
          <Paper
            withBorder
            radius="lg"
            p="xl"
            style={{
              flex: 1,
              backgroundColor: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}
          >
            <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Avatar size={120} radius="md" />
            </Box>

            {/* Audio Waveform */}
            <Box
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}
            >
              <Box
                style={{
                  width: 400,
                  height: 400,
                  borderRadius: '50%',
                  border: '2px solid var(--mantine-color-gray-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: 60,
                }}
              >
                {[...Array(15)].map((_, i) => (
                  <Box
                    key={i}
                    style={{
                      width: 6,
                      height: `${Math.random() * 100 + 20}%`,
                      backgroundColor: 'var(--mantine-color-blue-6)',
                      borderRadius: 3,
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Control Buttons */}
            <Group justify="center" gap="xl">
              <ActionIcon
                size={80}
                radius="xl"
                variant="filled"
                color="red"
                style={{
                  border: '4px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                }}
                onClick={() => router.push('/studio/sessions')}
                title="End call and return to sessions"
              >
                <IconPhone size={32} />
              </ActionIcon>
              <ActionIcon
                size={80}
                radius="xl"
                variant="filled"
                color="dark"
                style={{ border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              >
                <IconPlayerPause size={32} />
              </ActionIcon>
              <ActionIcon
                size={80}
                radius="xl"
                variant="filled"
                color="dark"
                style={{ border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              >
                <IconMicrophone size={32} />
              </ActionIcon>
            </Group>
          </Paper>

          {/* Transcript */}
          <Paper withBorder radius="lg" p="lg" style={{ backgroundColor: 'white' }}>
            <Box
              mb="md"
              px="md"
              py="xs"
              style={{
                backgroundColor: 'black',
                borderRadius: 8,
                display: 'inline-block',
              }}
            >
              <Text c="white" fw={600}>
                Transcript
              </Text>
            </Box>
            <Stack gap="xs">
              {[...Array(6)].map((_, i) => (
                <Box
                  key={i}
                  h={8}
                  bg="gray.3"
                  style={{
                    borderRadius: 4,
                    width: i === 5 ? '40%' : '100%',
                  }}
                />
              ))}
            </Stack>
          </Paper>
        </Box>

        {/* Right Panel - Timeline */}
        <Paper
          withBorder
          radius="lg"
          p="lg"
          style={{
            width: 180,
            backgroundColor: 'white',
            height: 'fit-content',
            flexShrink: 0,
          }}
        >
          <Title order={4} mb="xl" ta="center">
            Timeline
          </Title>
          <Box style={{ position: 'relative', paddingLeft: 40 }}>
            {/* Timeline line */}
            <Box
              style={{
                position: 'absolute',
                left: 20,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: 'var(--mantine-color-gray-4)',
              }}
            />

            <Stack gap={60}>
              {timelineEvents.map((event, i) => (
                <Box key={i} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <Box
                    style={{
                      position: 'absolute',
                      left: -28,
                      top: -4,
                      width: event.active ? 16 : 8,
                      height: event.active ? 16 : 8,
                      borderRadius: '50%',
                      backgroundColor: event.active
                        ? 'var(--mantine-color-blue-6)'
                        : 'var(--mantine-color-gray-5)',
                      border: event.active ? '2px solid var(--mantine-color-blue-2)' : 'none',
                    }}
                  />
                  {event.active && event.progress && (
                    <Badge
                      variant="filled"
                      color="blue"
                      size="lg"
                      style={{
                        position: 'absolute',
                        left: -20,
                        top: -30,
                      }}
                    >
                      {event.progress}%
                    </Badge>
                  )}
                  {event.label && (
                    <Text size="xs" mt="md" style={{ lineHeight: 1.3 }}>
                      {event.label}
                    </Text>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Box>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </Box>
  )
}
