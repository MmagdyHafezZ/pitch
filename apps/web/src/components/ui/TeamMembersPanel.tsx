'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  Select,
  SegmentedControl,
  Table,
  NumberInput,
  Tooltip,
  ScrollArea,
  SimpleGrid,
  Loader,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconFilter,
  IconMailPlus,
  IconSearch,
  IconTrash,
  IconUserPlus,
  IconUsers,
  IconUserCheck,
} from '@tabler/icons-react'
import { useTeams } from '@/features/teams/hooks/useTeams'
import type { TeamMembership } from '@/features/teams/types/teams.types'
import { api } from '@/lib/client'
import { notifications } from '@mantine/notifications'

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
]

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const formatDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const isMembershipPending = (membership: TeamMembership) => {
  if (membership.isActive === false) return true
  if (membership.acceptedAt) return false
  return Boolean(membership.user?.invitedAt)
}

export function TeamMembersPanel() {
  const { currentTeam, addMember, updateMember, deleteMember, loading } = useTeams()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'MEMBER'>('ALL')

  const [inviteEmail, setInviteEmail] = useState('')
  const [newRole, setNewRole] = useState<'MEMBER' | 'ADMIN' | 'OWNER'>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [quickInvitingUserId, setQuickInvitingUserId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [orgUsersLoading, setOrgUsersLoading] = useState(false)
  const [orgUsersError, setOrgUsersError] = useState<string | null>(null)
  const [membershipFilter, setMembershipFilter] = useState<'IN_TEAM' | 'NOT_IN_TEAM' | 'ALL'>('ALL')

  useEffect(() => {
    let mounted = true

    const loadUsers = async () => {
      setOrgUsersLoading(true)
      setOrgUsersError(null)
      try {
        const users = await api.users.getAll()
        if (!mounted) return
        setAllUsers(Array.isArray(users) ? users : [])
      } catch (error) {
        if (!mounted) return
        setOrgUsersError(
          error instanceof Error ? error.message : 'Failed to load organization users'
        )
      } finally {
        if (mounted) setOrgUsersLoading(false)
      }
    }

    void loadUsers()
    return () => {
      mounted = false
    }
  }, [])

  const members: TeamMembership[] = useMemo(
    () => (currentTeam?.memberships ?? []).filter((m) => m.isActive !== false),
    [currentTeam]
  )

  const memberStats = useMemo(() => {
    const total = members.length
    const pending = members.filter(isMembershipPending).length
    const admins = members.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length
    return { total, pending, admins }
  }, [members])

  const peopleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = allUsers
      .map((user) => {
        const membership = members.find((m) => m.userId === user?.id)
        const inTeam = Boolean(membership)
        return { user, membership, inTeam }
      })
      .filter(({ user, membership, inTeam }) => {
        const name = String(user?.name ?? '').toLowerCase()
        const email = String(user?.email ?? '').toLowerCase()
        const matchesSearch = !q || name.includes(q) || email.includes(q)
        if (!matchesSearch) return false

        if (membershipFilter === 'IN_TEAM' && !inTeam) return false
        if (membershipFilter === 'NOT_IN_TEAM' && inTeam) return false

        if (roleFilter === 'ALL') return true
        return membership?.role === roleFilter
      })
      .sort((a, b) => {
        // In team first when viewing all
        if (membershipFilter === 'ALL' && a.inTeam !== b.inTeam) {
          return a.inTeam ? -1 : 1
        }

        const roleRank = (role?: string) => {
          if (role === 'OWNER') return 0
          if (role === 'ADMIN') return 1
          if (role === 'MEMBER') return 2
          return 3
        }

        // Elevated access first for members in team
        if (a.inTeam && b.inTeam) {
          const diff = roleRank(a.membership?.role) - roleRank(b.membership?.role)
          if (diff !== 0) return diff
        }

        return String(a.user?.name ?? a.user?.email ?? '').localeCompare(
          String(b.user?.name ?? b.user?.email ?? '')
        )
      })

    return rows
  }, [allUsers, members, membershipFilter, roleFilter, search])

  const inviteExistingUserToTeam = async (user: any) => {
    if (!currentTeam?.id || !user?.id) return
    setInviteError(null)
    setQuickInvitingUserId(user.id)
    try {
      await addMember(currentTeam.id, {
        userId: user.id,
        role: newRole,
      })
      notifications.show({
        title: 'Member invited',
        message: `${user.name ?? user.email} was added to ${currentTeam.name}.`,
        color: 'teal',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite member'
      setInviteError(message)
    } finally {
      setQuickInvitingUserId(null)
    }
  }

  const handleAddMember = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !currentTeam) return

    setInviteError(null)
    if (!isValidEmail(email)) {
      setInviteError('Enter a valid email address')
      return
    }

    setSubmitting(true)
    try {
      const users = await api.users.getAll()
      const matchedUser = users.find(
        (candidate: any) => String(candidate?.email ?? '').toLowerCase() === email
      )

      if (!matchedUser?.id) {
        setInviteError(
          'No account found for that email. Ask them to register first, then invite them again.'
        )
        return
      }

      await addMember(currentTeam.id, {
        userId: matchedUser.id,
        role: newRole,
      })

      setInviteEmail('')
      setAllUsers((prev) =>
        prev.some((u) => u?.id === matchedUser.id) ? prev : [...prev, matchedUser]
      )
      notifications.show({
        title: 'Member invited',
        message: `${matchedUser.name ?? matchedUser.email} was added to ${currentTeam.name}.`,
        color: 'teal',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite member'
      setInviteError(message)
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
      radius="xl"
      shadow="lg"
      p="lg"
      style={{
        background:
          'linear-gradient(160deg, color-mix(in srgb, var(--mantine-color-blue-6) 10%, var(--mantine-color-dark-8)), var(--mantine-color-dark-8))',
        borderColor: 'color-mix(in srgb, var(--mantine-color-blue-6) 25%, transparent)',
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
              <Group gap="xs">
                <IconUsers size={16} />
                <Text fw={700}>Team members</Text>
              </Group>
              <Text size="sm" c="dimmed">
                See everyone in this organization team, invite by email, and manage access roles.
              </Text>
            </Stack>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Paper withBorder radius="lg" p="sm" bg="dark.7">
              <Text size="xs" c="dimmed">
                Active members
              </Text>
              <Text fw={700} size="xl">
                {memberStats.total}
              </Text>
            </Paper>
            <Paper withBorder radius="lg" p="sm" bg="dark.7">
              <Text size="xs" c="dimmed">
                Admins / Owners
              </Text>
              <Text fw={700} size="xl">
                {memberStats.admins}
              </Text>
            </Paper>
            <Paper withBorder radius="lg" p="sm" bg="dark.7">
              <Text size="xs" c="dimmed">
                Pending invites
              </Text>
              <Text fw={700} size="xl">
                {memberStats.pending}
              </Text>
            </Paper>
          </SimpleGrid>

          <Divider label="Roster" labelPosition="left" />

          <Group gap="xs" wrap="wrap">
            <TextInput
              leftSection={<IconSearch size={14} />}
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              size="sm"
              style={{ flex: 1, minWidth: 220 }}
            />
            <Select
              leftSection={<IconFilter size={14} />}
              size="sm"
              w={180}
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

          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm" c="dimmed">
              All users in the organization. Use filters to focus on in-team or not-in-team users.
            </Text>
            <SegmentedControl
              size="xs"
              value={membershipFilter}
              onChange={(value) => setMembershipFilter(value as 'IN_TEAM' | 'NOT_IN_TEAM' | 'ALL')}
              data={[
                { label: 'In team', value: 'IN_TEAM' },
                { label: 'Not in team', value: 'NOT_IN_TEAM' },
                { label: 'All', value: 'ALL' },
              ]}
            />
          </Group>

          {orgUsersError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {orgUsersError}
            </Alert>
          )}

          {orgUsersLoading ? (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading people…
              </Text>
            </Group>
          ) : peopleRows.length === 0 ? (
            <Text size="sm" c="dimmed">
              No users match the current filters.
            </Text>
          ) : (
            <ScrollArea h={420} type="auto">
              <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Team status</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Token limit</Table.Th>
                    <Table.Th>Sessions</Table.Th>
                    <Table.Th style={{ width: 170 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {peopleRows.map(({ user, membership, inTeam }) => {
                    const name = user?.name ?? 'Unknown user'
                    const email = user?.email ?? '—'
                    const avatarSrc =
                      user?.avatar ?? user?.avatarUrl ?? membership?.user?.avatar ?? undefined
                    const isPending = membership ? isMembershipPending(membership) : false
                    const sessions = membership ? getSessionCount(membership.userId) : 0

                    return (
                      <Table.Tr key={user.id}>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <Avatar
                              radius="xl"
                              color={inTeam ? 'blue' : 'cyan'}
                              variant="light"
                              src={avatarSrc}
                              alt={name}
                            >
                              {String(name || email)
                                .slice(0, 1)
                                .toUpperCase()}
                            </Avatar>
                            <Stack gap={2}>
                              <Text size="sm" fw={600}>
                                {name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {email}
                              </Text>
                            </Stack>
                          </Group>
                        </Table.Td>

                        <Table.Td>
                          {inTeam ? (
                            <Badge
                              color={isPending ? 'yellow' : 'teal'}
                              variant="light"
                              leftSection={!isPending ? <IconUserCheck size={12} /> : undefined}
                            >
                              {isPending ? 'Pending' : 'In team'}
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light">
                              Not in team
                            </Badge>
                          )}
                        </Table.Td>

                        <Table.Td>
                          {membership ? (
                            <Select
                              size="xs"
                              value={membership.role}
                              data={ROLE_OPTIONS}
                              onChange={(v) => handleUpdateRole(membership, v)}
                            />
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>

                        <Table.Td>
                          {membership ? (
                            <NumberInput
                              size="xs"
                              min={0}
                              value={membership.tokenLimit}
                              onChange={(val) => handleUpdateTokenLimit(membership, val)}
                            />
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>

                        <Table.Td>
                          <Badge size="sm" variant="light" color={inTeam ? 'blue' : 'gray'}>
                            {inTeam ? sessions : '—'}
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          {membership ? (
                            <Group justify="flex-end" gap={4}>
                              <Tooltip label="Remove from team" withArrow>
                                <ActionIcon
                                  size="sm"
                                  color="red"
                                  variant="subtle"
                                  onClick={() => handleKickMember(membership)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          ) : (
                            <Group justify="flex-end">
                              <Button
                                size="xs"
                                variant="light"
                                leftSection={<IconUserPlus size={14} />}
                                onClick={() => void inviteExistingUserToTeam(user)}
                                loading={quickInvitingUserId === user.id || loading}
                              >
                                Invite to team
                              </Button>
                            </Group>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}

          {inviteError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {inviteError}
            </Alert>
          )}

          <Paper
            withBorder
            radius="lg"
            p="sm"
            bg="dark.7"
            style={{
              borderColor: 'color-mix(in srgb, var(--mantine-color-dark-4) 35%, transparent)',
            }}
          >
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Can&apos;t find who you&apos;re looking for?
              </Text>
              <Text size="xs" c="dimmed">
                Invite them by email!
              </Text>
              <Group align="end" gap="xs" wrap="wrap">
                <TextInput
                  placeholder="teammate@company.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.currentTarget.value)
                    if (inviteError) setInviteError(null)
                  }}
                  size="sm"
                  style={{ flex: 1, minWidth: 220 }}
                />
                <Select
                  value={newRole}
                  onChange={(v) => setNewRole((v as any) ?? 'MEMBER')}
                  data={ROLE_OPTIONS}
                  size="sm"
                  w={130}
                />
                <Button
                  leftSection={<IconMailPlus size={16} />}
                  onClick={handleAddMember}
                  loading={submitting || loading}
                  size="sm"
                >
                  Invite
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Card>
  )
}
