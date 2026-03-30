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
  ThemeIcon,
} from '@mantine/core'
import { IconChartBar, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, type Variants } from 'framer-motion'
import { useAuth } from '@/features/auth'
import { useTour } from '@/features/onboarding'
import { useSessions, type Session } from '@/features/sessions'
import { useTeams } from '@/features/teams'
import { useI18n } from '@/features/i18n'

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

const themedCardStyle = {
  background: `linear-gradient(
    180deg,
    var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))) 0%,
    color-mix(in srgb, var(--pitch-card-bg-strong, var(--pitch-card-bg, var(--pitch-surface-bg))) 84%, transparent) 100%
  )`,
  border:
    '1px solid var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
  boxShadow: `0 10px 24px color-mix(
    in srgb,
    var(--pitch-card-shadow, var(--pitch-surface-bg, #000)) 16%,
    transparent
  )`,
}

const elevatedCardStyle = {
  ...themedCardStyle,
  boxShadow: `0 14px 30px color-mix(
    in srgb,
    var(--pitch-card-shadow, var(--pitch-accent-strong)) 18%,
    transparent
  )`,
}

const themedIconStyle = {
  background:
    'var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))))',
  color: 'var(--pitch-accent-strong)',
  border:
    '1px solid var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
}

const groupHeaderStyle = {
  ...elevatedCardStyle,
  width: '100%',
  padding: '16px 20px',
  borderRadius: 'var(--mantine-radius-lg)',
  marginBottom: '16px',
}

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  const { tp } = useI18n()
  const displayStatus = session.status as Status
  const statusLabel = displayStatus === 'active' ? tp('Active') : tp('Ended')
  const displayName =
    session.name && session.name.trim()
      ? session.name.trim()
      : `${tp('Session')} ${session.id.substring(0, 8)}`
  return (
    <Card
      withBorder
      radius="lg"
      padding="lg"
      onClick={onClick}
      style={{
        ...themedCardStyle,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor =
          'var(--pitch-card-border-strong, var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border))))'
        e.currentTarget.style.boxShadow = `0 14px 30px color-mix(
          in srgb,
          var(--pitch-card-shadow, var(--pitch-accent-strong)) 18%,
          transparent
        )`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.borderColor = ''
        e.currentTarget.style.boxShadow = `0 10px 24px color-mix(
          in srgb,
          var(--pitch-card-shadow, var(--pitch-surface-bg, #000)) 16%,
          transparent
        )`
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title
            order={5}
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {displayName}
          </Title>
        </Group>
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
  const { startTour } = useTour()
  const { tp } = useI18n()
  const { sessions, loading, fetchUserSessions } = useSessions()
  const { teams, fetchUserTeams } = useTeams()
  const sessionFilter = searchParams.get('filter') ?? 'All'
  const autoStartedTourKeyRef = useRef<string | null>(null)
  const personalGroupKey = '__personal__'

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [personalGroupKey]: true,
  })

  useEffect(() => {
    const startTourParam = searchParams.get('startTour')
    const tourScreenParam = searchParams.get('tourScreen')
    const key = `${startTourParam ?? ''}:${tourScreenParam ?? ''}`

    if (autoStartedTourKeyRef.current === key) {
      return
    }

    if (startTourParam === 'sessions') {
      const timer = setTimeout(() => {
        autoStartedTourKeyRef.current = key
        void startTour('sessions')
      }, 800)
      return () => clearTimeout(timer)
    }

    if (startTourParam === 'full' && tourScreenParam === 'sessions') {
      const timer = setTimeout(() => {
        autoStartedTourKeyRef.current = key
        void startTour('sessions', { mode: 'full' })
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [searchParams, startTour])

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
        if (sessionFilter === 'Created' || sessionFilter === 'Created by me') {
          return session.userId === user?.id
        }
        if (sessionFilter === 'Shared' || sessionFilter === 'Shared with me') {
          return session.userId !== user?.id
        }
        return true
      })

    const groups: Record<string, Session[]> = { [personalGroupKey]: [] }
    teams.forEach((team) => {
      groups[team.name] = []
    })

    filtered.forEach((session) => {
      const team = teams.find((t) => t.id === session.orgId)
      if (team) {
        groups[team.name].push(session)
      } else {
        groups[personalGroupKey].push(session)
      }
    })

    return Object.entries(groups)
      .map(([groupName, groupSessions]) => ({ groupName, sessions: groupSessions }))
      .filter((group) => group.sessions.length > 0)
  }, [sessions, searchQuery, sessionFilter, user?.id, teams, personalGroupKey])

  return (
    <Stack gap="xl">
      <Group justify="space-between" />

      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : groupedAndFilteredSessions.length === 0 ? (
        <Card withBorder radius="xl" p="xl" style={elevatedCardStyle}>
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={64} radius="xl" style={themedIconStyle}>
              <IconChartBar size={30} />
            </ThemeIcon>
            <Stack align="center" gap={4}>
              <Text fw={700} size="xl">
                {tp('No sessions found')}
              </Text>
              <Text size="sm" c="dimmed" ta="center" maw={380}>
                {tp('Try adjusting your filters or create a new session.')}
              </Text>
            </Stack>
            <Button
              data-tour-id="sessions-create-btn"
              variant="light"
              color="brand"
              size="md"
              onClick={() => router.push('/studio/sessions/create')}
            >
              {tp('Create a session')}
            </Button>
          </Stack>
        </Card>
      ) : (
        <Stack data-tour-id="sessions-list" gap="xl">
          {groupedAndFilteredSessions.map(({ groupName, sessions: groupSessions }) => (
            <Box key={groupName}>
              <UnstyledButton
                onClick={() =>
                  setExpandedCategories((prev) => ({ ...prev, [groupName]: !prev[groupName] }))
                }
                style={groupHeaderStyle}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Title order={3} style={{ fontWeight: 600 }}>
                    {groupName === personalGroupKey ? tp('Personal') : groupName} (
                    {groupSessions.length})
                  </Title>
                  {expandedCategories[groupName] ? (
                    <IconChevronDown size={24} />
                  ) : (
                    <IconChevronUp size={24} />
                  )}
                </Group>
              </UnstyledButton>

              <Collapse in={expandedCategories[groupName] ?? true}>
                <motion.div
                  data-tour-id="sessions-groups"
                  variants={gridVariants}
                  initial="hidden"
                  animate="show"
                >
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                    {groupSessions.map((session) => (
                      <motion.div
                        key={session.id}
                        variants={cardVariants}
                        data-tour-id="sessions-session-card"
                      >
                        <SessionCard
                          session={session}
                          onClick={() => router.push(`/studio/sessions/${session.id}`)}
                        />
                      </motion.div>
                    ))}
                  </SimpleGrid>
                </motion.div>
              </Collapse>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function SessionsPageFallback() {
  return (
    <Center p="xl">
      <Loader size="lg" />
    </Center>
  )
}
