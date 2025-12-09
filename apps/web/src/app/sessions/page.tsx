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
  Loader,
  Alert,
  Center,
} from '@mantine/core'
import { IconSearch, IconChevronDown, IconChevronUp, IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { useSessions } from '@/features/sessions/hooks/useSessions'

type Status = 'Upcoming' | 'Pending' | 'Overdue' | 'Completed'
const statusColor: Record<Status, string> = {
  Upcoming: 'blue',
  Pending: 'yellow',
  Overdue: 'red',
  Completed: 'green',
}

interface SessionType {
  id?: string
  title: string
  date: string
  tags?: string[]
  status: string
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
  tags?: string[]
  status: string
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
          <Badge color={statusColor[status as Status] || 'gray'} radius="sm" variant="light">
            {status}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {date}
        </Text>
        <Group gap={6} wrap="wrap">
          {tags?.map((t, idx) => (
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
            <Badge color={statusColor[session.status as Status] || 'gray'} radius="sm" variant="light">
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
            {session.tags?.map((tag, idx) => (
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

  // Fetch sessions from API
  const { data: sessions, isLoading, isError } = useSessions()

  // Filter sessions by category (temporarily using all sessions for both until backend implements categories)
  const assigned = sessions || []
  const created: SessionType[] = []

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
      {/* Loading State */}
      {isLoading && (
        <Center style={{ minHeight: '400px' }}>
          <Stack align="center" gap="md">
            <Loader size="xl" type="dots" />
            <Text size="lg" c="dimmed">
              Loading sessions...
            </Text>
          </Stack>
        </Center>
      )}

      {/* Error State */}
      {isError && (
        <Center style={{ minHeight: '400px', padding: '2rem' }}>
          <Alert
            icon={<IconAlertCircle size={24} />}
            title="Error Loading Sessions"
            color="red"
            variant="light"
            style={{ maxWidth: '500px' }}
          >
            Failed to load sessions. Please try again later or contact support if the problem
            persists.
          </Alert>
        </Center>
      )}

      {/* Empty State */}
      {!isLoading && !isError && assigned.length === 0 && created.length === 0 && (
        <Center style={{ minHeight: '400px' }}>
          <Text size="lg" c="dimmed">
            No sessions found.
          </Text>
        </Center>
      )}

      {/* Session List Content */}
      {!isLoading && !isError && (assigned.length > 0 || created.length > 0) && (
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
      )}
    </AppLayout>
  )
}
