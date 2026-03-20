'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title,
  Text,
  Table,
  Card,
  Group,
  Stack,
  Badge,
  Skeleton,
  Input,
  Select,
  Button,
  Pagination,
  Tooltip,
  ActionIcon,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconEye, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'

type Session = {
  id: string
  name?: string | null
  userId: string
  orgId: string
  type: string
  status: string
  createdAt: string
  endedAt?: string | null
  scenario?: { name?: string } | null
  persona?: { name?: string } | null
}

const PAGE_SIZE = 25

export default function SessionsManagement() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter

      const data = await api.sessions.getAll(params)
      const list = data?.sessions ?? (Array.isArray(data) ? data : [])
      setSessions(list)
      setTotal(data?.total ?? list.length)
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load sessions', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, typeFilter])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const filtered = sessions.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.name?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.userId?.toLowerCase().includes(q) ||
      s.scenario?.name?.toLowerCase().includes(q) ||
      s.persona?.name?.toLowerCase().includes(q)
    )
  })

  const handleDelete = async (session: Session) => {
    if (!window.confirm(`Delete session "${session.name || session.id}"?`)) return
    try {
      await api.sessions.delete(session.id)
      notifications.show({ title: 'Deleted', message: 'Session deleted', color: 'teal' })
      fetchSessions()
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to delete',
        color: 'red',
      })
    }
  }

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      active: 'green',
      ended: 'gray',
      paused: 'yellow',
      error: 'red',
    }
    return map[status] ?? 'blue'
  }

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      text: 'blue',
      voice: 'violet',
      video: 'teal',
      phone: 'orange',
    }
    return map[type] ?? 'gray'
  }

  const duration = (s: Session) => {
    if (!s.endedAt) return 'Ongoing'
    const ms = new Date(s.endedAt).getTime() - new Date(s.createdAt).getTime()
    const mins = Math.round(ms / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={700}>
            Sessions
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            {loading ? 'Loading...' : `${total} total sessions`}
          </Text>
        </div>
      </Group>

      <Group>
        <Input
          placeholder="Search by name, ID, user, scenario..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Status"
          clearable
          data={[
            { value: 'active', label: 'Active' },
            { value: 'ended', label: 'Ended' },
          ]}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val)
            setPage(1)
          }}
          w={140}
        />
        <Select
          placeholder="Type"
          clearable
          data={[
            { value: 'text', label: 'Text' },
            { value: 'voice', label: 'Voice' },
            { value: 'video', label: 'Video' },
            { value: 'phone', label: 'Phone' },
          ]}
          value={typeFilter}
          onChange={(val) => {
            setTypeFilter(val)
            setPage(1)
          }}
          w={130}
        />
      </Group>

      <Card withBorder radius="md" p={0}>
        {loading ? (
          <Stack p="lg" gap="sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl">
            <Text c="dimmed">
              {search || statusFilter || typeFilter
                ? 'No sessions match your filters.'
                : 'No sessions found.'}
            </Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Session</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Scenario</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((session) => (
                <Table.Tr key={session.id}>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {session.name || 'Untitled Session'}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {session.id}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={typeColor(session.type)} variant="light" size="sm">
                      {session.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(session.status)} variant="dot" size="sm">
                      {session.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {session.scenario?.name ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{duration(session)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="View Details">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => router.push(`/admin/sessions/${session.id}`)}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(session)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Group>
      )}
    </Stack>
  )
}
