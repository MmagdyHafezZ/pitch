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
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useAuth } from '@/features/auth'
import { JsonViewer } from '@/components/ui/JsonViewer'
import { useSessions, type Session } from '@/features/sessions'
import { useTeams, type Team } from '@/features/teams'

type Status = 'active' | 'ended'
const statusColor: Record<Status, string> = {
  active: 'brand',
  ended: 'green',
}

const gridVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: -24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
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
    // For objects, we'll render them with a special component
    if (typeof value === 'object') {
      return value
    }
    return JSON.stringify(value)
  }

  const renderValue = (value: unknown) => {
    const formattedValue = formatValue(value)
    if (typeof formattedValue === 'object' && formattedValue !== null) {
      return <JsonViewer data={formattedValue as Record<string, any>} />
    }
    return (
      <Text size="sm" c="white">
        {String(formattedValue)}
      </Text>
    )
  }

  const panelVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
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
      <motion.div initial="hidden" animate="visible" variants={panelVariants}>
        {/* Header */}
        <motion.div variants={itemVariants}>
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
        </motion.div>

        {/* Type & Tags */}
        <motion.div variants={itemVariants} style={{ marginTop: '2rem', marginBottom: '2rem' }}>
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
        </motion.div>

        {/* Config */}
        <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
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
                  <div style={{ flex: 1 }}>{renderValue(value)}</div>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No config provided.
            </Text>
          )}
        </motion.div>

        {/* Details */}
        <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
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
                <div style={{ flex: 1 }}>{renderValue(detail.value)}</div>
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
        </motion.div>

        {/* Action Buttons */}
        <motion.div variants={itemVariants}>
          <Group gap="md" grow>
            <Button
              size="lg"
              variant="light"
              color="blue"
              onClick={() => router.push(`/studio/sessions/${session.id}/edit`)}
            >
              Edit
            </Button>
            <Button
              size="lg"
              variant="filled"
              color="blue"
              onClick={() => router.push(`/session/${session.id}`)}
            >
              Launch
            </Button>
          </Group>
        </motion.div>
      </motion.div>
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
  const { teams, fetchUserTeams } = useTeams()
  const sessionFilter = searchParams.get('filter') ?? 'All'

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Personal: true,
  })
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchUserSessions(user.id)
      fetchUserTeams()
    }
  }, [user?.id, fetchUserSessions, fetchUserTeams])

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

  const groupedAndFilteredSessions = useMemo(() => {
    const filtered = sessions
      .filter((session) => matchesQuery(session, searchQuery))
      .filter((session) => {
        if (sessionFilter === 'Created by me') {
          return session.userId === user?.id
        }
        if (sessionFilter === 'Shared with me') {
          return session.userId !== user?.id
        }
        return true
      })

    const groups: Record<string, Session[]> = {
      Personal: [],
    }
    teams.forEach((team) => {
      groups[team.name] = []
    })

    filtered.forEach((session) => {
      const team = teams.find((t) => t.id === session.orgId)
      if (team) {
        groups[team.name].push(session)
      } else {
        groups.Personal.push(session)
      }
    })

    return Object.entries(groups)
      .map(([groupName, sessions]) => ({
        groupName,
        sessions,
      }))
      .filter((group) => group.sessions.length > 0)
  }, [sessions, searchQuery, sessionFilter, user?.id, teams])

  useEffect(() => {
    if (!selectedSession) return
    const stillVisible = groupedAndFilteredSessions.some((group) =>
      group.sessions.some((session) => session.id === selectedSession.id)
    )
    if (!stillVisible) {
      setSelectedSession(null)
    }
  }, [groupedAndFilteredSessions, selectedSession])

  return (
    <Group align="start" gap="xl" wrap="nowrap">
      {/* Left side - Sessions list */}
      <motion.div
        data-tour-id="sessions-list"
        animate={{ width: selectedSession ? '65%' : '100%' }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Stack gap="xl">
          <Group justify="space-between" />

          {loading ? (
            <Center p="xl">
              <Loader size="lg" />
            </Center>
          ) : groupedAndFilteredSessions.length === 0 ? (
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
                Try adjusting your filters or create a new session.
              </Text>
              <Button
                data-tour-id="sessions-create-btn"
                variant="light"
                color="brand"
                onClick={() => router.push('/studio/sessions/create')}
              >
                Create a session
              </Button>
            </Box>
          ) : (
            <>
              {groupedAndFilteredSessions.map(({ groupName, sessions: groupSessions }) => (
                <Box key={groupName}>
                  <UnstyledButton
                    onClick={() =>
                      setExpandedCategories((prev) => ({ ...prev, [groupName]: !prev[groupName] }))
                    }
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
                        {groupName} ({groupSessions.length})
                      </Title>
                      {expandedCategories[groupName] ? (
                        <IconChevronDown size={24} color="white" />
                      ) : (
                        <IconChevronUp size={24} color="white" />
                      )}
                    </Group>
                  </UnstyledButton>

                  <Collapse in={expandedCategories[groupName]}>
                    <motion.div variants={gridVariants} initial="hidden" animate="show">
                      <SimpleGrid
                        cols={{ base: 1, sm: 2, lg: selectedSession ? 2 : 3 }}
                        spacing="lg"
                        style={{ transition: 'all 0.3s ease-in-out' }}
                      >
                        {groupSessions.map((session) => (
                          <motion.div key={session.id} variants={cardVariants}>
                            <SessionCard
                              session={session}
                              onClick={() => setSelectedSession(session)}
                              isSelected={selectedSession?.id === session.id}
                            />
                          </motion.div>
                        ))}
                      </SimpleGrid>
                    </motion.div>
                  </Collapse>
                </Box>
              ))}
            </>
          )}
        </Stack>
      </motion.div>

      <AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: 100 }}
            animate={{ width: '35%', opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: 100 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <SessionDetailPanel
              session={selectedSession}
              onDismiss={() => setSelectedSession(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
