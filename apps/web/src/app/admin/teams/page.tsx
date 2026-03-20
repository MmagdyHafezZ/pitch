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
  ActionIcon,
  Modal,
  TextInput,
  Switch,
  Button,
  Skeleton,
  Tooltip,
  Input,
  Avatar,
  Collapse,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconPencil,
  IconTrash,
  IconSearch,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react'
import { api } from '@/lib/client'

type TeamMember = {
  userId: string
  role: string
  isActive: boolean
  user?: { id: string; name: string; email: string; avatar?: string | null }
}

type Team = {
  id: string
  name: string
  slug: string
  isActive: boolean
  billingEmail?: string | null
  createdAt: string
  updatedAt: string
  memberships?: TeamMember[]
}

export default function TeamsManagement() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [opened, { open, close }] = useDisclosure(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', billingEmail: '', isActive: true })
  const [saving, setSaving] = useState(false)

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api.teams.getAll()
      setTeams(Array.isArray(data) ? data : [])
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load teams', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const filtered = teams.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    )
  })

  const openEdit = (team: Team) => {
    setEditingTeam(team)
    setForm({
      name: team.name,
      slug: team.slug,
      billingEmail: team.billingEmail ?? '',
      isActive: team.isActive,
    })
    open()
  }

  const handleSave = async () => {
    if (!editingTeam) return
    setSaving(true)
    try {
      await api.teams.update(editingTeam.id, form)
      notifications.show({ title: 'Success', message: 'Team updated', color: 'teal' })
      close()
      fetchTeams()
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to update team',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (team: Team) => {
    if (!window.confirm(`Delete team "${team.name}"? This cannot be undone.`)) return

    try {
      await api.teams.delete(team.id)
      notifications.show({
        title: 'Deleted',
        message: `Team "${team.name}" deleted`,
        color: 'teal',
      })
      fetchTeams()
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to delete team',
        color: 'red',
      })
    }
  }

  const toggleExpand = (teamId: string) => {
    setExpandedTeam((prev) => (prev === teamId ? null : teamId))
  }

  const roleColor = (role: string) => {
    const map: Record<string, string> = { OWNER: 'orange', ADMIN: 'blue', MEMBER: 'gray' }
    return map[role] ?? 'gray'
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} fw={700}>
            Teams
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            {loading ? 'Loading...' : `${teams.length} total teams`}
          </Text>
        </div>
      </Group>

      <Input
        placeholder="Search by name, slug, or ID..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <Card withBorder radius="md" p={0}>
        {loading ? (
          <Stack p="lg" gap="sm">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl">
            <Text c="dimmed">{search ? 'No teams match your search.' : 'No teams found.'}</Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={30} />
                <Table.Th>Team</Table.Th>
                <Table.Th>Members</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((team) => {
                const isExpanded = expandedTeam === team.id
                const members = team.memberships ?? []
                return (
                  <Table.Tr key={team.id} style={{ cursor: 'pointer' }}>
                    <Table.Td onClick={() => toggleExpand(team.id)}>
                      {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </Table.Td>
                    <Table.Td onClick={() => toggleExpand(team.id)}>
                      <div>
                        <Text size="sm" fw={500}>
                          {team.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {team.slug}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {members.length} members
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={team.isActive ? 'green' : 'red'} variant="dot" size="sm">
                        {team.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(team.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(team)
                            }}
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(team)
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {filtered.map((team) => {
        const isExpanded = expandedTeam === team.id
        const members = team.memberships ?? []
        if (!isExpanded || members.length === 0) return null

        return (
          <Collapse key={team.id} in={isExpanded}>
            <Card withBorder radius="md" p="md" ml="lg">
              <Text size="sm" fw={600} mb="sm">
                Members of {team.name}
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {members.map((m) => (
                    <Table.Tr key={m.userId}>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar src={m.user?.avatar} radius="xl" size="sm" color="blue">
                            {(m.user?.name ?? m.userId).charAt(0).toUpperCase()}
                          </Avatar>
                          <div>
                            <Text size="sm">{m.user?.name ?? m.userId}</Text>
                            <Text size="xs" c="dimmed">
                              {m.user?.email ?? ''}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={roleColor(m.role)} variant="light" size="sm">
                          {m.role}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={m.isActive ? 'green' : 'red'} variant="dot" size="sm">
                          {m.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Collapse>
        )
      })}

      <Modal opened={opened} onClose={close} title="Edit Team" centered size="md">
        <Stack gap="md">
          <TextInput
            label="Team Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <TextInput
            label="Billing Email"
            value={form.billingEmail}
            onChange={(e) => setForm((f) => ({ ...f, billingEmail: e.target.value }))}
          />
          <Switch
            label="Active"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.currentTarget.checked }))}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Update
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
