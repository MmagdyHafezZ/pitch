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
  Drawer,
  TextInput,
  Switch,
  Button,
  Skeleton,
  Tooltip,
  Input,
  Avatar,
  Tabs,
  Divider,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconSearch, IconPencil } from '@tabler/icons-react'
import { api } from '@/lib/client'

type TeamMember = {
  userId: string
  role: string
  isActive: boolean
  tokenLimit?: number | null
  user?: { id: string; name: string; email: string; avatar?: string | null }
}

type Team = {
  id: string
  name: string
  slug: string
  isActive: boolean
  availableTokens: number
  usedTokens: number
  billingEmail?: string | null
  billingAddress?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  memberships?: TeamMember[]
}

const roleColor = (role: string) => {
  const map: Record<string, string> = { OWNER: 'orange', ADMIN: 'blue', MEMBER: 'gray' }
  return map[role] ?? 'gray'
}

export default function TeamsManagement() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)
  const [overviewForm, setOverviewForm] = useState({ name: '', isActive: true })
  const [savingOverview, setSavingOverview] = useState(false)

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api.admin.teams.list({ limit: 200 })
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

  const fetchMembers = useCallback(async (teamId: string) => {
    setMembersLoading(true)
    try {
      const data = await api.admin.teams.getMembers(teamId)
      const list: TeamMember[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.memberships)
          ? data.memberships
          : []
      setMembers(list)
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load members', color: 'red' })
    } finally {
      setMembersLoading(false)
    }
  }, [])

  const openTeamDrawer = (team: Team) => {
    setSelectedTeam(team)
    setOverviewForm({ name: team.name, isActive: team.isActive })
    setMembers([])
    openDrawer()
    fetchMembers(team.id)
  }

  const handleSaveOverview = async () => {
    if (!selectedTeam) return
    setSavingOverview(true)
    try {
      await api.admin.teams.update(selectedTeam.id, {
        name: overviewForm.name,
        isActive: overviewForm.isActive,
      })
      notifications.show({ title: 'Success', message: 'Team updated', color: 'teal' })
      fetchTeams()
      setSelectedTeam((t) => (t ? { ...t, ...overviewForm } : t))
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to update team',
        color: 'red',
      })
    } finally {
      setSavingOverview(false)
    }
  }

  const filtered = teams.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.name?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    )
  })

  return (
    <>
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

        <Card withBorder radius="md" p={0} shadow="sm">
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
                  <Table.Th>Team</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th w={80}>Manage</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((team) => (
                  <Table.Tr
                    key={team.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openTeamDrawer(team)}
                  >
                    <Table.Td>
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
                      <Badge
                        color={team.isActive ? 'teal' : 'red'}
                        variant="light"
                        size="sm"
                        radius="sm"
                      >
                        {team.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(team.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Manage team">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openTeamDrawer(team)
                          }}
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title={
          <Group gap="sm">
            <Text fw={700} size="lg">
              {selectedTeam?.name}
            </Text>
            <Badge
              color={selectedTeam?.isActive ? 'teal' : 'red'}
              variant="light"
              size="sm"
              radius="sm"
            >
              {selectedTeam?.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </Group>
        }
        position="right"
        size="xl"
        padding="lg"
      >
        {selectedTeam && (
          <Tabs defaultValue="overview">
            <Tabs.List mb="md">
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="members">Members ({members.length})</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview">
              <Stack gap="md">
                <TextInput
                  label="Team Name"
                  value={overviewForm.name}
                  onChange={(e) => setOverviewForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Switch
                  label="Active"
                  checked={overviewForm.isActive}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked
                    setOverviewForm((f) => ({ ...f, isActive: checked }))
                  }}
                />

                <Divider />

                <TextInput label="ID" value={selectedTeam.id} disabled />
                <TextInput label="Slug" value={selectedTeam.slug} disabled />
                <TextInput
                  label="Available Tokens"
                  value={selectedTeam.availableTokens?.toLocaleString() ?? '0'}
                  disabled
                />
                <TextInput
                  label="Used Tokens"
                  value={selectedTeam.usedTokens?.toLocaleString() ?? '0'}
                  disabled
                />
                <TextInput
                  label="Billing Email"
                  value={selectedTeam.billingEmail ?? '—'}
                  disabled
                />
                {selectedTeam.billingAddress && (
                  <TextInput
                    label="Billing Address"
                    value={JSON.stringify(selectedTeam.billingAddress)}
                    disabled
                  />
                )}
                <TextInput
                  label="Created"
                  value={new Date(selectedTeam.createdAt).toLocaleString()}
                  disabled
                />
                <TextInput
                  label="Updated"
                  value={new Date(selectedTeam.updatedAt).toLocaleString()}
                  disabled
                />

                <Group justify="flex-end" mt="sm">
                  <Button variant="subtle" onClick={closeDrawer}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveOverview} loading={savingOverview}>
                    Save Changes
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="members">
              <Stack gap="md">
                {membersLoading ? (
                  <Stack gap="sm">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} height={56} />
                    ))}
                  </Stack>
                ) : members.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    No members found.
                  </Text>
                ) : (
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
                                  {m.user?.email ?? m.userId}
                                </Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={roleColor(m.role)} variant="light" size="sm" radius="sm">
                              {m.role}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={m.isActive ? 'teal' : 'red'}
                              variant="light"
                              size="sm"
                              radius="sm"
                            >
                              {m.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        )}
      </Drawer>
    </>
  )
}
