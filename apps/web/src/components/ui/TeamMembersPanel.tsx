'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Table,
  Badge,
  ActionIcon,
  NumberInput,
  Button,
  Tooltip,
  Divider,
  ScrollArea,
} from '@mantine/core'
import { IconSearch, IconFilter, IconTrash, IconUserPlus } from '@tabler/icons-react'
import { useTeams } from '@/features/teams/hooks/useTeams'
import type { TeamMembership } from '@/features/teams/types/teams.types'

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
]

export function TeamMembersPanel() {
  const { currentTeam, addMember, updateMember, deleteMember, loading } = useTeams()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'MEMBER'>('ALL')

  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState<'MEMBER' | 'ADMIN' | 'OWNER'>('MEMBER')
  const [submitting, setSubmitting] = useState(false)

  // Always call hooks – guard nulls inside useMemo
  const members: TeamMembership[] = useMemo(
    () =>
      (currentTeam?.memberships ?? []).filter(
        (m) => m.isActive !== false // hide inactive
      ),
    [currentTeam]
  )

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()

    return members.filter((m) => {
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false

      if (!q) return true

      const name = m.user?.name?.toLowerCase() ?? ''
      const email = m.user?.email?.toLowerCase() ?? ''
      return name.includes(q) || email.includes(q)
    })
  }, [members, search, roleFilter])

  const handleAddMember = async () => {
    const userId = newUserId.trim()
    if (!userId || !currentTeam) return

    setSubmitting(true)
    try {
      await addMember(currentTeam.id, {
        userId,
        role: newRole,
      })
      setNewUserId('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateRole = async (membership: TeamMembership, roleValue: string | null) => {
    if (!currentTeam || !roleValue) return
    if (roleValue === membership.role) return

    await updateMember(currentTeam.id, membership.userId, {
      role: roleValue as any,
    })
  }

  const handleUpdateTokenLimit = async (membership: TeamMembership, nextValue: string | number) => {
    if (!currentTeam) return

    const tokenLimit =
      typeof nextValue === 'number' ? nextValue : nextValue.trim() === '' ? 0 : Number(nextValue)

    if (tokenLimit === membership.tokenLimit) return

    await updateMember(currentTeam.id, membership.userId, {
      tokenLimit,
    })
  }

  const handleKickMember = async (membership: TeamMembership) => {
    if (!currentTeam) return
    const confirmed = window.confirm(
      `Remove ${membership.user?.name ?? membership.user?.email ?? 'this member'} from the team?`
    )
    if (!confirmed) return

    await deleteMember(currentTeam.id, membership.userId)
  }

  const getSessionCount = (userId: string): number => {
    return 0 // TODO: replace with real logic
  }

  return (
    <Card
      withBorder
      radius="md"
      shadow="xs"
      p="lg"
      style={{
        background: 'var(--mantine-color-gray-1)'
      }}
    >
      {!currentTeam ? (
        <Text size="sm" c="dimmed">
          No team selected. Choose a team first.
        </Text>
      ) : (
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text fw={600}>Team members</Text>
              <Text size="sm" c="dimmed">
                Manage who has access to this team, their roles, and their session assignments.
              </Text>
            </Stack>

            <Group gap="xs">
              <TextInput
                leftSection={<IconSearch size={14} />}
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                size="xs"
              />
              <Select
                leftSection={<IconFilter size={14} />}
                size="xs"
                w={160}
                value={roleFilter}
                onChange={(v) => setRoleFilter((v as any) ?? 'ALL')}
                data={[
                  { value: 'ALL', label: 'All roles' },
                  { value: 'OWNER', label: 'Owner' },
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'MEMBER', label: 'Member' },
                ]}
              />
            </Group>
          </Group>

          <Divider label="Add member" labelPosition="left" />

          <Group align="flex-end" gap="sm">
            <TextInput
              label="User ID (or email placeholder)"
              placeholder="user_123 / email@example.com"
              value={newUserId}
              onChange={(e) => setNewUserId(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              label="Role"
              value={newRole}
              onChange={(v) => setNewRole((v as any) ?? 'MEMBER')}
              data={ROLE_OPTIONS}
              style={{ width: 140 }}
            />
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={handleAddMember}
              loading={submitting || loading}
            >
              Add
            </Button>
          </Group>

          <Divider label="Current members" labelPosition="left" />

          {filteredMembers.length === 0 ? (
            <Text size="sm" c="dimmed">
              No matching members.
            </Text>
          ) : (
            <ScrollArea h={300} type="auto">
              <Table
                striped
                highlightOnHover
                withColumnBorders={false}
                verticalSpacing="xs"
                horizontalSpacing="md"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Member</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Token limit</Table.Th>
                    <Table.Th>Sessions</Table.Th>
                    <Table.Th style={{ width: 60 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredMembers.map((m) => {
                    const name = m.user?.name ?? 'Unknown'
                    const email = m.user?.email ?? '—'
                    const sessions = getSessionCount(m.userId)

                    return (
                      <Table.Tr key={m.id}>
                        <Table.Td>
                          <Stack gap={2} justify="center">
                            <Text size="sm" fw={500}>
                              {name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {email}
                            </Text>
                          </Stack>
                        </Table.Td>

                        <Table.Td>
                          <Select
                            size="xs"
                            value={m.role}
                            data={ROLE_OPTIONS}
                            onChange={(v) => handleUpdateRole(m, v)}
                          />
                        </Table.Td>

                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            value={m.tokenLimit}
                            onChange={(val) => handleUpdateTokenLimit(m, val)}
                          />
                        </Table.Td>

                        <Table.Td>
                          <Badge size="sm" variant="light">
                            {sessions}
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          <Group justify="flex-end" gap={4}>
                            <Tooltip label="Remove from team" withArrow>
                              <ActionIcon
                                size="sm"
                                color="red"
                                variant="subtle"
                                onClick={() => handleKickMember(m)}
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
            </ScrollArea>
          )}
        </Stack>
      )}
    </Card>
  )
}
