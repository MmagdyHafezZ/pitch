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
  IconCrown,
  IconFilter,
  IconHash,
  IconMailPlus,
  IconSearch,
  IconShield,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconUsers,
  IconUserCheck,
} from '@tabler/icons-react'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useTeamConfigStore } from '@/features/teams/stores/team-config.store'
import type { TeamMembership, TeamPendingSignupInvite } from '@/features/teams/types/teams.types'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useMediaQuery } from '@mantine/hooks'

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
]

const MEMBER_ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner (transfer)' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
]

const INVITE_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
]

const roleMeta = {
  OWNER: { label: 'Owner', icon: IconCrown, color: 'yellow' },
  ADMIN: { label: 'Admin', icon: IconShield, color: 'blue' },
  MEMBER: { label: 'Member', icon: IconUser, color: 'gray' },
} as const

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
  return (
    membership.isActive === false &&
    membership.acceptedAt == null &&
    Boolean(membership.invitedByUserId)
  )
}

const isMembershipInTeam = (membership?: TeamMembership | null) => {
  if (!membership) return false
  return membership.isActive !== false
}

const themedPanelStyle = {
  background: `linear-gradient(
    180deg,
    var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))) 0%,
    color-mix(in srgb, var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg))) 82%, transparent) 100%
  )`,
  borderColor: 'var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
  boxShadow: `0 8px 20px color-mix(
    in srgb,
    var(--pitch-card-shadow, var(--pitch-surface-bg, #000)) 14%,
    transparent
  )`,
}

const themedSubtleStyle = {
  background:
    'var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))))',
  borderColor: 'var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
}

const themedIconStyle = {
  color: 'var(--pitch-accent-strong)',
}

export function TeamMembersPanel() {
  const { currentTeam, inviteMember, sendSignupInvite, updateMember, deleteMember, loading } =
    useTeams()
  const isMobile = useMediaQuery('(max-width: 48em)')
  const orgUsers = useTeamConfigStore((s) => s.orgUsers)
  const orgUsersLoading = useTeamConfigStore((s) => s.orgUsersLoading)
  const orgUsersError = useTeamConfigStore((s) => s.orgUsersError)
  const fetchOrgUsers = useTeamConfigStore((s) => s.fetchOrgUsers)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'MEMBER'>('ALL')

  const [inviteEmail, setInviteEmail] = useState('')
  const [newRole, setNewRole] = useState<'MEMBER' | 'ADMIN' | 'OWNER'>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [quickInvitingUserId, setQuickInvitingUserId] = useState<string | null>(null)
  const [optimisticPendingUserIds, setOptimisticPendingUserIds] = useState<string[]>([])
  const [membershipFilter, setMembershipFilter] = useState<'IN_TEAM' | 'NOT_IN_TEAM' | 'ALL'>('ALL')

  useEffect(() => {
    void fetchOrgUsers()
  }, [fetchOrgUsers])

  useEffect(() => {
    setInviteError(null)
  }, [currentTeam?.id])

  useEffect(() => {
    // Keep optimistic pending users in sync with real server state.
    setOptimisticPendingUserIds((prev) =>
      prev.filter((userId) =>
        (currentTeam?.memberships ?? []).some(
          (membership) => membership.userId === userId && isMembershipPending(membership)
        )
      )
    )
  }, [currentTeam?.memberships])

  const memberships: TeamMembership[] = useMemo(() => currentTeam?.memberships ?? [], [currentTeam])
  const activeMembers: TeamMembership[] = useMemo(
    () => memberships.filter((m) => isMembershipInTeam(m)),
    [memberships]
  )
  const pendingEmailInvites: TeamPendingSignupInvite[] = useMemo(
    () => currentTeam?.metadata?.pendingSignupInvites ?? [],
    [currentTeam]
  )
  const currentOwner = useMemo(
    () => activeMembers.find((m) => m.role === 'OWNER') ?? null,
    [activeMembers]
  )

  const memberStats = useMemo(() => {
    const total = activeMembers.length
    const pending = memberships.filter(isMembershipPending).length + pendingEmailInvites.length
    const admins = activeMembers.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length
    return { total, pending, admins }
  }, [activeMembers, memberships, pendingEmailInvites.length])

  const peopleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = orgUsers
      .map((user) => {
        const membership = memberships.find((m) => m.userId === user?.id)
        const inTeam = isMembershipInTeam(membership)
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
  }, [orgUsers, memberships, membershipFilter, roleFilter, search])

  const inviteExistingUserToTeam = async (user: any) => {
    if (!currentTeam?.id || !user?.id) return
    setInviteError(null)
    setQuickInvitingUserId(user.id)
    try {
      await inviteMember(currentTeam.id, {
        userId: user.id,
        role: newRole,
      })
      setOptimisticPendingUserIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
      notifications.show({
        title: 'Invitation sent',
        message: `${user.name ?? user.email} is now pending acceptance for ${currentTeam.name}.`,
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
      const users = orgUsers.length > 0 ? orgUsers : await fetchOrgUsers()
      const matchedUser = users.find(
        (candidate: any) => String(candidate?.email ?? '').toLowerCase() === email
      )

      setInviteEmail('')
      if (matchedUser?.id) {
        await inviteMember(currentTeam.id, {
          userId: matchedUser.id,
          role: newRole,
        })

        notifications.show({
          title: 'Invitation sent',
          message: `${matchedUser.name ?? matchedUser.email} is now pending acceptance for ${currentTeam.name}.`,
          color: 'teal',
        })
      } else {
        await sendSignupInvite(currentTeam.id, { email, role: newRole })
        notifications.show({
          title: 'Signup invitation sent',
          message: `${email} will receive an email to sign up and join ${currentTeam.name}.`,
          color: 'teal',
        })
      }
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

    if (roleValue === 'OWNER' && membership.role !== 'OWNER') {
      const targetName = membership.user?.name ?? membership.user?.email ?? 'this member'
      const currentOwnerName =
        currentOwner?.userId && currentOwner.userId !== membership.userId
          ? (currentOwner.user?.name ?? currentOwner.user?.email ?? 'the current owner')
          : null
      modals.openConfirmModal({
        title: 'Transfer ownership',
        centered: true,
        labels: {
          confirm: 'Transfer ownership',
          cancel: 'Cancel',
        },
        children: (
          <Stack gap={6}>
            <Text size="sm">
              The ownership of <strong>{currentTeam.name}</strong> will be transferred to{' '}
              <strong>{targetName}</strong>. Are you sure?
            </Text>
            {currentOwnerName ? (
              <Text size="xs" c="dimmed">
                {currentOwnerName} will be changed to Admin.
              </Text>
            ) : null}
          </Stack>
        ),
        onConfirm: async () => {
          await updateMember(currentTeam.id, membership.userId, {
            role: roleValue as any,
          })

          notifications.show({
            title: 'Ownership transferred',
            message: `${membership.user?.name ?? membership.user?.email ?? 'Member'} is now the team owner.`,
            color: 'teal',
          })
        },
      })
      return
    }

    await updateMember(currentTeam.id, membership.userId, {
      role: roleValue as any,
    })

    if (roleValue === 'OWNER') {
      notifications.show({
        title: 'Ownership transferred',
        message: `${membership.user?.name ?? membership.user?.email ?? 'Member'} is now the team owner.`,
        color: 'teal',
      })
    }
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
    const memberName = membership.user?.name ?? membership.user?.email ?? 'this member'
    const actionLabel = isMembershipPending(membership) ? 'Cancel invitation' : 'Remove member'

    modals.openConfirmModal({
      title: actionLabel,
      centered: true,
      labels: {
        confirm: actionLabel,
        cancel: 'Cancel',
      },
      confirmProps: { color: 'red' },
      children: (
        <Stack gap={6}>
          <Text size="sm">
            Are you sure you want to{' '}
            {isMembershipPending(membership) ? 'cancel the invite for' : 'remove'}{' '}
            <strong>{memberName}</strong>?
          </Text>
          <Text size="xs" c="dimmed">
            Team: <strong>{currentTeam.name}</strong>
          </Text>
        </Stack>
      ),
      onConfirm: async () => {
        await deleteMember(currentTeam.id, membership.userId)
        setOptimisticPendingUserIds((prev) => prev.filter((id) => id !== membership.userId))
      },
    })
  }

  const getSessionCount = (userId: string): number => {
    return 0 // TODO: replace with real logic
  }

  const getRoleSelectOptions = (membership: TeamMembership) =>
    membership.role === 'OWNER' ? ROLE_OPTIONS : MEMBER_ROLE_OPTIONS

  const getRoleIcon = (role?: TeamMembership['role']) => {
    if (!role) return <IconUser size={14} />
    if (!(role in roleMeta)) return <IconUser size={14} />
    const meta = roleMeta[role as keyof typeof roleMeta]
    const Icon = meta.icon
    return <Icon size={14} />
  }

  return (
    <Card
      withBorder
      radius="xl"
      shadow="lg"
      p="lg"
      style={themedPanelStyle}
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
                <IconUsers size={16} style={themedIconStyle} />
                <Text fw={700}>Team members</Text>
              </Group>
              <Text size="sm" c="dimmed">
                See everyone in this organization team, invite by email, and manage access roles.
              </Text>
            </Stack>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Paper withBorder radius="lg" p="sm" style={themedSubtleStyle}>
              <Text size="xs" c="dimmed">
                Active members
              </Text>
              <Text fw={700} size="xl">
                {memberStats.total}
              </Text>
            </Paper>
            <Paper withBorder radius="lg" p="sm" style={themedSubtleStyle}>
              <Text size="xs" c="dimmed">
                Admins / Owners
              </Text>
              <Text fw={700} size="xl">
                {memberStats.admins}
              </Text>
            </Paper>
            <Paper withBorder radius="lg" p="sm" style={themedSubtleStyle}>
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
              style={{ flex: 1, minWidth: isMobile ? 0 : 220 }}
            />
            <Select
              leftSection={<IconFilter size={14} />}
              size="sm"
              w={isMobile ? '100%' : 180}
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
              fullWidth={isMobile}
              value={membershipFilter}
              onChange={(value) => setMembershipFilter(value as 'IN_TEAM' | 'NOT_IN_TEAM' | 'ALL')}
              data={[
                { label: 'In team', value: 'IN_TEAM' },
                { label: 'Not in team', value: 'NOT_IN_TEAM' },
                { label: 'All', value: 'ALL' },
              ]}
            />
          </Group>

          {orgUsersError && orgUsers.length === 0 && (
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
            <ScrollArea h={isMobile ? 340 : 420} type="auto">
              <Table
                highlightOnHover
                verticalSpacing="xs"
                horizontalSpacing="md"
                style={{ minWidth: isMobile ? 720 : undefined }}
              >
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
                    const isPending = membership
                      ? isMembershipPending(membership)
                      : optimisticPendingUserIds.includes(user.id)
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
                          {membership && isPending ? (
                            <Badge color="yellow" variant="light">
                              Pending
                            </Badge>
                          ) : inTeam ? (
                            <Badge
                              color="teal"
                              variant="light"
                              leftSection={<IconUserCheck size={12} />}
                            >
                              In team
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light">
                              Not in team
                            </Badge>
                          )}
                        </Table.Td>

                        <Table.Td>
                          {membership && inTeam ? (
                            <Select
                              size="xs"
                              value={membership.role}
                              data={getRoleSelectOptions(membership)}
                              onChange={(v) => handleUpdateRole(membership, v)}
                              leftSection={getRoleIcon(membership.role)}
                              w={170}
                            />
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>

                        <Table.Td>
                          {membership && inTeam ? (
                            <NumberInput
                              size="xs"
                              min={0}
                              value={membership.tokenLimit}
                              onChange={(val) => handleUpdateTokenLimit(membership, val)}
                              leftSection={<IconHash size={13} />}
                              thousandSeparator=","
                              allowDecimal={false}
                              clampBehavior="strict"
                              w={190}
                              styles={{
                                input: {
                                  background:
                                    'var(--pitch-card-bg-subtle, var(--pitch-card-bg, var(--pitch-surface-bg, var(--mantine-color-body))))',
                                  borderColor:
                                    'var(--pitch-card-border, var(--pitch-border, var(--mantine-color-default-border)))',
                                  fontWeight: 600,
                                },
                              }}
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
                          {membership && (inTeam || isPending) ? (
                            <Group justify="flex-end" gap={4}>
                              <Tooltip
                                label={isPending ? 'Cancel invitation' : 'Remove from team'}
                                withArrow
                              >
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
                            <Group justify="flex-end" gap={4}>
                              <Tooltip label="Invite to team" withArrow>
                                <ActionIcon
                                  size="sm"
                                  color="blue"
                                  variant="subtle"
                                  onClick={() => void inviteExistingUserToTeam(user)}
                                  loading={quickInvitingUserId === user.id || loading}
                                >
                                  <IconUserPlus size={14} />
                                </ActionIcon>
                              </Tooltip>
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

          {inviteError && inviteError !== orgUsersError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {inviteError}
            </Alert>
          )}

          {pendingEmailInvites.length > 0 && (
            <Paper
              withBorder
              radius="lg"
              p="sm"
              style={themedSubtleStyle}
            >
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  Pending email invites
                </Text>
                {pendingEmailInvites.map((invite) => {
                  const invitedAt = formatDate(invite.invitedAt)
                  return (
                    <Group key={`${invite.email}-${invite.invitedAt}`} justify="space-between">
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>
                          {invite.email}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {invitedAt ? `Invited ${invitedAt}` : 'Invited'}
                        </Text>
                      </Stack>
                      <Badge color="yellow" variant="light">
                        Pending {invite.role ? `(${invite.role})` : ''}
                      </Badge>
                    </Group>
                  )
                })}
              </Stack>
            </Paper>
          )}

          <Paper
            withBorder
            radius="lg"
            p="sm"
            style={themedSubtleStyle}
          >
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Can&apos;t find who you&apos;re looking for?
              </Text>
              <Text size="xs" c="dimmed">
                Invite them by email. If they do not have an account yet, they will be prompted to
                sign up first.
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
                  style={{ flex: 1, minWidth: isMobile ? 0 : 220 }}
                />
                <Select
                  value={newRole}
                  onChange={(v) => setNewRole((v as any) ?? 'MEMBER')}
                  data={INVITE_ROLE_OPTIONS}
                  size="sm"
                  w={isMobile ? '100%' : 130}
                />
                <Button
                  data-tour-id="team-invite-btn"
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
