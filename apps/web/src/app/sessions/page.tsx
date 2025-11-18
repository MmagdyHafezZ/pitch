'use client'

import {
  AppShell,
  Group,
  TextInput,
  Button,
  Select,
  Title,
  Card,
  Stack,
  Text,
  Badge,
  SimpleGrid,
  Box,
  Collapse,
  UnstyledButton,
} from '@mantine/core'
import { IconSearch, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'

type Status = 'Upcoming' | 'Pending' | 'Overdue' | 'Completed'
const statusColor: Record<Status, string> = {
  Upcoming: 'blue',
  Pending: 'yellow',
  Overdue: 'red',
  Completed: 'green',
}

interface SessionType {
  title: string
  date: string
  tags: string[]
  status: Status
  score?: number
  description?: string
}

function SessionCard({
  title,
  date,
  tags,
  status,
  score,
  onClick,
  isSelected,
}: {
  title: string
  date: string
  tags: string[]
  status: Status
  score?: number
  onClick: () => void
  isSelected?: boolean
}) {
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow="sm"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'all 150ms ease',
        border: isSelected ? '2px solid var(--mantine-color-blue-6)' : undefined,
        transform: isSelected ? 'scale(1.02)' : undefined,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={5}>{title}</Title>
          <Badge color={statusColor[status]} radius="sm" variant="light">
            {status}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {date}
        </Text>
        <Group gap={6} wrap="wrap">
          {tags.map((t, idx) => (
            <Badge key={`${t}-${idx}`} variant="outline" color="gray" radius="sm">
              {t}
            </Badge>
          ))}
        </Group>
        {status === 'Completed' && score && (
          <Badge radius="sm" size="lg" color={score >= 7 ? 'green' : 'yellow'}>
            {score.toFixed(1)}
          </Badge>
        )}
      </Stack>
    </Card>
  )
}

function SessionDetailPanel({ session }: { session: SessionType }) {
  const router = useRouter()

  return (
    <Card
      withBorder={false}
      radius="lg"
      padding="xl"
      style={{
        backgroundColor: 'var(--mantine-color-dark-8)',
        color: 'white',
        height: 'fit-content',
        position: 'sticky',
        top: 20,
      }}
    >
      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Group justify="space-between" align="start" mb="xs">
            <Title order={2} c="white" style={{ fontWeight: 700 }}>
              {session.title}
            </Title>
            {session.score && (
              <Text size="xl" fw={700} c="white">
                {session.score.toFixed(1)}/10
              </Text>
            )}
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {session.date}
            </Text>
            <Text size="sm" c="dimmed">
              •
            </Text>
            <Badge color={statusColor[session.status]} radius="sm" variant="light">
              {session.status}
            </Badge>
          </Group>
        </Box>

        {/* Tags */}
        <Box>
          <Title order={4} c="white" mb="md">
            Tags
          </Title>
          <Group gap="xs">
            {session.tags.map((tag, idx) => (
              <Badge
                key={`detail-${tag}-${idx}`}
                variant="filled"
                color="dark.6"
                radius="md"
                size="lg"
              >
                {tag}
              </Badge>
            ))}
          </Group>
        </Box>

        {/* Config */}
        <Box>
          <Title order={4} c="white" mb="md">
            Config
          </Title>
          <Stack gap="md">
            <Box
              style={{
                height: 8,
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderRadius: 4,
              }}
            />
            <Box
              style={{
                height: 8,
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderRadius: 4,
              }}
            />
            <Box
              style={{
                height: 8,
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderRadius: 4,
              }}
            />
          </Stack>
        </Box>

        {/* Description */}
        <Box>
          <Title order={4} c="white" mb="md">
            Description
          </Title>
          <Box
            p="md"
            style={{
              backgroundColor: 'white',
              borderRadius: 8,
              minHeight: 200,
            }}
          >
            <Stack gap="sm">
              {[...Array(7)].map((_, i) => (
                <Box
                  key={i}
                  style={{
                    height: 8,
                    backgroundColor: 'var(--mantine-color-gray-3)',
                    borderRadius: 4,
                    width: i === 6 ? '60%' : '100%',
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Group gap="md" grow>
          <Button
            size="lg"
            variant="light"
            color="blue"
            onClick={() => router.push('/sessions/create')}
          >
            Edit
          </Button>
          <Button
            size="lg"
            variant="filled"
            color="blue"
            onClick={() => router.push('/sessions/live')}
          >
            Launch
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

export default function SessionsPage() {
  const router = useRouter()
  const [active, setActive] = useState('Sessions')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [assignedExpanded, setAssignedExpanded] = useState(true)
  const [createdExpanded, setCreatedExpanded] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionType | null>(null)

  const assigned: SessionType[] = [
    {
      title: 'Product Intro Practice',
      date: 'October 13, 2025',
      tags: ['Tag', 'Tag', 'Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Upcoming' as const,
      description: 'Practice session for product introduction',
    },
    {
      title: 'Product Intro Practice',
      date: 'October 11, 2025',
      tags: ['Tag', 'Tag', 'Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Upcoming' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 10, 2025',
      tags: ['Tag', 'Tag', 'Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Upcoming' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 8, 2025',
      tags: ['Tag', 'Tag', 'Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Pending' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 7, 2025',
      tags: ['Tag', 'Tag', 'Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Overdue' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 5, 2025',
      tags: ['Tag', 'Tag', 'Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Overdue' as const,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 4, 2025',
      tags: ['Tag', 'Tag', 'Tag', '+9 more'],
      status: 'Completed' as const,
      score: 8.2,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 4, 2025',
      tags: ['Tag', 'Tag', 'Tag', '+9 more'],
      status: 'Completed' as const,
      score: 6.5,
    },
    {
      title: 'Product Intro Practice',
      date: 'October 3, 2025',
      tags: ['Tag', 'Tag', 'Tag', '+9 more'],
      status: 'Completed' as const,
      score: 3.7,
    },
  ]

  const created: SessionType[] = [
    {
      title: 'Sales Pitch 101',
      date: 'September 20, 2025',
      tags: ['Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Upcoming' as const,
    },
    {
      title: 'Pricing Objection Handling',
      date: 'September 18, 2025',
      tags: ['Tag', 'Tag', 'Tag', '+7 more'],
      status: 'Pending' as const,
    },
    {
      title: 'Competitive Intel Brief',
      date: 'September 08, 2025',
      tags: ['Tag', 'Tag', 'Tag', '+9 more'],
      status: 'Completed' as const,
      score: 7.9,
    },
  ]

  return (
    <AppLayout
      header={
        <AppTopBar
          showSearch={false}
          rightSlot={
            <Group gap="sm" wrap="nowrap">
              <Select
                data={['Sort Descending', 'Sort Ascending']}
                defaultValue="Sort Descending"
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
                styles={{
                  input: {
                    background: 'var(--mantine-color-dark-7)',
                    color: 'white',
                    border: '1px solid var(--mantine-color-dark-6)',
                  },
                }}
                radius="xl"
                w={180}
              />
              <TextInput
                placeholder="Search"
                leftSection={<IconSearch size={18} />}
                radius="xl"
                styles={{
                  input: {
                    width: 'clamp(220px, 32vw, 420px)',
                    background: 'var(--mantine-color-dark-7)',
                    color: 'white',
                    border: '1px solid var(--mantine-color-dark-6)',
                  },
                }}
              />
              <Button radius="md" onClick={() => router.push('/sessions/create')}>
                Create New Session
              </Button>
            </Group>
          }
        />
      }
      navbar={
        <AppSidebar
          active={active}
          setActive={setActive}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      }
    >
      <Group align="start" gap="xl" wrap="nowrap">
        {/* Left side - Sessions list */}
        <Box style={{ flex: selectedSession ? '0 0 65%' : '1 1 100%' }}>
          <Stack gap="xl">
            {/* Assigned to you section */}
            <Box>
              <UnstyledButton
                onClick={() => setAssignedExpanded(!assignedExpanded)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  backgroundColor: 'var(--mantine-color-dark-8)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Title order={3} c="white" style={{ fontWeight: 600 }}>
                    Assigned to you
                  </Title>
                  {assignedExpanded ? (
                    <IconChevronDown size={24} color="white" />
                  ) : (
                    <IconChevronUp size={24} color="white" />
                  )}
                </Group>
              </UnstyledButton>

              <Collapse in={assignedExpanded}>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: selectedSession ? 2 : 3 }} spacing="lg">
                  {assigned.map((s, i) => (
                    <SessionCard
                      key={`${s.title}-${i}`}
                      {...s}
                      onClick={() => setSelectedSession(s)}
                      isSelected={
                        selectedSession?.title === s.title && selectedSession?.date === s.date
                      }
                    />
                  ))}
                </SimpleGrid>
              </Collapse>
            </Box>

            {/* Created by you section */}
            <Box>
              <UnstyledButton
                onClick={() => setCreatedExpanded(!createdExpanded)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  backgroundColor: 'var(--mantine-color-dark-8)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Title order={3} c="white" style={{ fontWeight: 600 }}>
                    Created by you
                  </Title>
                  {createdExpanded ? (
                    <IconChevronDown size={24} color="white" />
                  ) : (
                    <IconChevronUp size={24} color="white" />
                  )}
                </Group>
              </UnstyledButton>

              <Collapse in={createdExpanded}>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: selectedSession ? 2 : 3 }} spacing="lg">
                  {created.map((s, i) => (
                    <SessionCard
                      key={`${s.title}-created-${i}`}
                      {...s}
                      onClick={() => setSelectedSession(s)}
                      isSelected={
                        selectedSession?.title === s.title && selectedSession?.date === s.date
                      }
                    />
                  ))}
                </SimpleGrid>
              </Collapse>
            </Box>
          </Stack>
        </Box>

        {/* Right side - Session details */}
        {selectedSession && (
          <Box style={{ flex: '0 0 35%', minWidth: 0 }}>
            <SessionDetailPanel session={selectedSession} />
          </Box>
        )}
      </Group>
    </AppLayout>
  )
}
