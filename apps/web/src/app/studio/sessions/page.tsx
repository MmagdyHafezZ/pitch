'use client'

import {
  Group,
  Button,
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
  Center,
} from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react'
import { Suspense, useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/features/auth'
import { useSessions, type Session } from '@/features/sessions'

type Status = 'active' | 'ended'
const statusColor: Record<Status, string> = {
  active: 'brand',
  ended: 'green',
}

function SessionCard({
  session,
  onClick,
  isSelected,
}: {
  session: Session
  onClick: () => void
  isSelected?: boolean
}) {
  const displayStatus = session.status as Status
  const displayName =
    session.name && session.name.trim()
      ? session.name.trim()
      : `Session ${session.id.substring(0, 8)}`
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow="sm"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: isSelected ? '2px solid var(--pitch-accent-strong)' : undefined,
        transform: isSelected ? 'scale(1.02)' : undefined,
        boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={5}>{displayName}</Title>
          <Badge color={statusColor[displayStatus]} radius="sm" variant="light">
            {displayStatus}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          ID: {session.id.substring(0, 12)}
        </Text>
        <Text size="xs" c="dimmed">
          {new Date(session.createdAt).toLocaleDateString()}
        </Text>
        <Group gap={6} wrap="wrap">
          <Badge variant="outline" color="brand" radius="sm">
            {session.type}
          </Badge>
          {session.tags?.map((tag: string, idx: number) => (
            <Badge key={`${tag}-${idx}`} variant="outline" color="gray" radius="sm">
              {tag}
            </Badge>
          ))}
        </Group>
      </Stack>
    </Card>
  )
}

function SessionDetailPanel({ session, onDismiss }: { session: Session; onDismiss: () => void }) {
  const router = useRouter()
  const displayStatus = session.status as Status
  const displayName =
    session.name && session.name.trim()
      ? session.name.trim()
      : `Session ${session.id.substring(0, 12)}`
  const configEntries =
    session.sessionConfig && typeof session.sessionConfig === 'object'
      ? Object.entries(session.sessionConfig as Record<string, unknown>).filter(
          ([key]) => key !== 'description'
        )
      : []
  const description =
    session.sessionConfig &&
    typeof (session.sessionConfig as Record<string, unknown>).description === 'string'
      ? ((session.sessionConfig as Record<string, unknown>).description as string)
      : null
  const details = [
    { label: 'Scenario', value: session.scenarioId },
    { label: 'Persona', value: session.personaId },
    { label: 'Language', value: session.language },
    { label: 'CRM Context', value: session.crmContextId },
    { label: 'Ended Reason', value: session.endedReason },
    {
      label: 'Ended At',
      value: session.endedAt ? new Date(session.endedAt).toLocaleString() : null,
    },
  ]

  const formatValue = (value: unknown) => {
    if (value == null || value === '') return 'N/A'
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    return JSON.stringify(value)
  }

  return (
    <Card
      withBorder={false}
      radius="lg"
      padding="xl"
      style={{
        backgroundColor: 'var(--mantine-color-dark-8)',
        color: 'white',
        height: 'calc(100vh - 3.7em - 32px)',
        maxHeight: 'calc(100vh - 3.7em - 32px)',
        overflowY: 'auto',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
      }}
    >
      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Group justify="space-between" align="start" mb="xs">
            <Stack gap={4} style={{ flex: 1 }}>
              <Title order={2} c="white" style={{ fontWeight: 700 }}>
                {displayName}
              </Title>
              <Text size="sm" c="dimmed">
                ID: {session.id}
              </Text>
            </Stack>
            <Group gap="xs">
              <UnstyledButton
                onClick={onDismiss}
                style={{
                  color: 'var(--mantine-color-gray-5)',
                  transition: 'color 0.2s',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--mantine-color-gray-5)'
                }}
              >
                <IconX size={20} />
              </UnstyledButton>
            </Group>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {new Date(session.createdAt).toLocaleDateString()}
            </Text>
            <Text size="sm" c="dimmed">
              •
            </Text>
            <Badge color={statusColor[displayStatus]} radius="sm" variant="light">
              {displayStatus}
            </Badge>
          </Group>
        </Box>

        {/* Type & Tags */}
        <Box>
          <Title order={4} c="white" mb="md">
            Type & Tags
          </Title>
          <Group gap="xs">
            <Badge variant="filled" color="brand" radius="md" size="lg">
              {session.type}
            </Badge>
            {session.tags?.map((tag: string, idx: number) => (
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
          {configEntries.length > 0 ? (
            <Stack gap="sm">
              {configEntries.map(([key, value]) => (
                <Group key={key} align="flex-start" gap="sm" wrap="nowrap">
                  <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
                    {key}
                  </Text>
                  <Text size="sm" c="white">
                    {formatValue(value)}
                  </Text>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No config provided.
            </Text>
          )}
        </Box>

        {/* Details */}
        <Box>
          <Title order={4} c="white" mb="md">
            Details
          </Title>
          <Stack
            gap="sm"
            p="md"
            style={{
              backgroundColor: 'var(--mantine-color-dark-7)',
              borderRadius: 8,
            }}
          >
            {details.map((detail) => (
              <Group key={detail.label} align="flex-start" gap="sm" wrap="nowrap">
                <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
                  {detail.label}
                </Text>
                <Text size="sm" c="white">
                  {formatValue(detail.value)}
                </Text>
              </Group>
            ))}
            {description && (
              <>
                <Text size="sm" c="dimmed" mt="sm">
                  Description
                </Text>
                <Text size="sm" c="white">
                  {description}
                </Text>
              </>
            )}
          </Stack>
        </Box>

        {/* Action Buttons */}
        <Group gap="md" grow>
          <Button
            size="lg"
            variant="light"
            color="brand"
            onClick={() => router.push(`/studio/sessions/${session.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            size="lg"
            variant="filled"
            color="brand"
            onClick={() => router.push(`/session/${session.id}`)}
          >
            Launch
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<SessionsPageFallback />}>
      <SessionsPageInner />
    </Suspense>
  )
}

function SessionsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { sessions, loading, fetchUserSessions } = useSessions()

  const [assignedExpanded, setAssignedExpanded] = useState(true)
  const [createdExpanded, setCreatedExpanded] = useState(true)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchUserSessions(user.id)
    }
  }, [user?.id, fetchUserSessions])

  const searchQuery = (searchParams.get('q') ?? '').trim().toLowerCase()

  const matchesQuery = (session: Session, query: string) => {
    if (!query) return true

    const description =
      session.sessionConfig &&
      typeof (session.sessionConfig as Record<string, unknown>).description === 'string'
        ? ((session.sessionConfig as Record<string, unknown>).description as string)
        : ''

    const haystack = [
      session.name,
      session.id,
      session.type,
      session.status,
      session.language,
      session.scenarioId,
      session.personaId,
      session.crmContextId,
      session.endedReason,
      ...(session.tags ?? []),
      description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  }

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions
    return sessions.filter((session) => matchesQuery(session, searchQuery))
  }, [sessions, searchQuery])

  const createdSessions = filteredSessions.filter((s) => s.userId === user?.id)
  const assignedSessions = filteredSessions.filter((s) => s.userId !== user?.id)

  useEffect(() => {
    if (!selectedSession) return
    const stillVisible = filteredSessions.some((session) => session.id === selectedSession.id)
    if (!stillVisible) {
      setSelectedSession(null)
    }
  }, [filteredSessions, selectedSession])

  return (
    <Group align="start" gap="xl" wrap="nowrap">
      {/* Left side - Sessions list */}
      <Box
        style={{
          flex: selectedSession ? '0 0 65%' : '1 1 100%',
          transition: 'flex 0.3s linear',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Stack gap="xl">
          {loading ? (
            <Center p="xl">
              <Loader size="lg" />
            </Center>
          ) : assignedSessions.length === 0 && createdSessions.length === 0 ? (
            <Box
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                width: '100%',
                paddingTop: '10em',
              }}
            >
              <Title order={3} c="dimmed" mb="md">
                No sessions found
              </Title>
              <Text c="dimmed" mb="md">
                You haven&apos;t created or been assigned to any sessions yet.
              </Text>
              <Button
                variant="light"
                color="brand"
                onClick={() => router.push('/studio/sessions/create')}
              >
                Create a session
              </Button>
            </Box>
          ) : (
            <>
              {createdSessions.length > 0 && (
                <Box>
                  <Collapse in={createdExpanded}>
                    <SimpleGrid
                      cols={{ base: 1, sm: 2, lg: selectedSession ? 2 : 3 }}
                      spacing="lg"
                      style={{ transition: 'all 0.3s ease-in-out' }}
                    >
                      {createdSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onClick={() => setSelectedSession(session)}
                          isSelected={selectedSession?.id === session.id}
                        />
                      ))}
                    </SimpleGrid>
                  </Collapse>
                </Box>
              )}

              {assignedSessions.length > 0 && (
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
                        Assigned to you ({assignedSessions.length})
                      </Title>
                      {assignedExpanded ? (
                        <IconChevronDown size={24} color="white" />
                      ) : (
                        <IconChevronUp size={24} color="white" />
                      )}
                    </Group>
                  </UnstyledButton>

                  <Collapse in={assignedExpanded}>
                    <SimpleGrid
                      cols={{ base: 1, sm: 2, lg: selectedSession ? 2 : 3 }}
                      spacing="lg"
                      style={{ transition: 'all 0.3s ease-in-out' }}
                    >
                      {assignedSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onClick={() => setSelectedSession(session)}
                          isSelected={selectedSession?.id === session.id}
                        />
                      ))}
                    </SimpleGrid>
                  </Collapse>
                </Box>
              )}
            </>
          )}
        </Stack>
      </Box>

      {selectedSession && (
        <Box
          style={{
            flex: '0 0 35%',
            minWidth: 0,
            animation: 'slideIn 0.3s linear',
          }}
        >
          <SessionDetailPanel
            session={selectedSession}
            onDismiss={() => setSelectedSession(null)}
          />
        </Box>
      )}
    </Group>
  )
}

function SessionsPageFallback() {
  return (
    <Center p="xl">
      <Loader size="lg" />
    </Center>
  )
}

if (typeof document !== 'undefined') {
  const styleId = 'session-slide-animation'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
    `
    document.head.appendChild(style)
  }
}
