'use client'

import {
  Box,
  Button,
  Badge,
  ActionIcon,
  Avatar,
  Checkbox,
  Group,
  Table,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  SimpleGrid,
  Paper,
  Divider,
  Menu,
  Modal,
  Select,
  Tooltip,
  UnstyledButton,
  Transition,
  useMantineColorScheme,
} from '@mantine/core'
import { Fragment, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMediaQuery } from '@mantine/hooks'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuth } from '@/features/auth'
import { useCreateTeamForm } from '@/features/teams/hooks/useTeamForm'
import {
  IconFilter,
  IconSearch,
  IconTrash,
  IconSettings,
  IconChartBar,
  IconChevronDown,
  IconX,
} from '@tabler/icons-react'
import Image from 'next/image'

export default function TeamConfigPage() {
  return (
    <Suspense fallback={<div>Loading team configuration...</div>}>
      <TeamConfigInner />
    </Suspense>
  )
}

function TeamConfigInner() {
  const { colorScheme } = useMantineColorScheme()
  const isMobile = useMediaQuery('(max-width: 48em)')
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCreateMode = searchParams.get('mode') === 'create'
  const isMyTeamsTab = searchParams.get('teamTab') === 'my'

  const { user } = useAuth()
  const {
    currentTeam,
    updateTeam,
    teams,
    fetchTeamById,
    activeTeamId,
    updateMember,
    deleteMember,
  } = useTeams()
  const { values, errors, setField, submit, submitting, apiError } = useCreateTeamForm()
  const [editValues, setEditValues] = useState({
    name: '',
    billingEmail: '',
    street: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'MEMBER'>('ALL')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())
  const [roleMenuMemberId, setRoleMenuMemberId] = useState<string | null>(null)
  const [settingsMenuMemberId, setSettingsMenuMemberId] = useState<string | null>(null)
  const [removingMembers, setRemovingMembers] = useState<Set<string>>(new Set())
  const [tokenLimitMember, setTokenLimitMember] = useState<{
    teamId: string
    userId: string
    current?: number
  } | null>(null)
  const [tokenLimitValue, setTokenLimitValue] = useState('')
  const [tokenLimitSaving, setTokenLimitSaving] = useState(false)

  useEffect(() => {
    if (!isCreateMode && currentTeam) {
      const addr = currentTeam.billingAddress ?? ({} as any)
      setEditValues({
        name: currentTeam.name ?? '',
        billingEmail: currentTeam.billingEmail ?? '',
        street: addr.street ?? '',
        city: addr.city ?? '',
        stateProvince: addr.stateProvince ?? '',
        postalCode: addr.postalCode ?? '',
        country: addr.country ?? '',
      })
      setEditError(null)
    }
  }, [isCreateMode, currentTeam])

  const handleCreateClick = async () => {
    const ok = await submit()
    if (!ok) return
    router.push('/studio/team-config')
  }

  const handleSaveEditClick = async () => {
    if (!currentTeam) return

    setEditError(null)

    const name = editValues.name.trim()
    if (!name) {
      setEditError('Team name is required')
      return
    }

    setSavingEdit(true)
    try {
      await updateTeam(currentTeam.id, {
        name,
        billingEmail: editValues.billingEmail.trim() || null,
        billingAddress: {
          street: editValues.street,
          city: editValues.city,
          stateProvince: editValues.stateProvince,
          postalCode: editValues.postalCode,
          country: editValues.country,
        },
      })
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update team')
    } finally {
      setSavingEdit(false)
    }
  }

  const formValues = isCreateMode ? values : editValues
  const formErrors = isCreateMode ? errors : ({} as typeof errors)
  const bannerError = isCreateMode ? apiError : editError
  const primaryLoading = isCreateMode ? submitting : savingEdit

  const setEditField = (field: keyof typeof editValues, value: string) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrimaryClick = () => {
    if (isCreateMode) {
      void handleCreateClick()
    } else {
      void handleSaveEditClick()
    }
  }

  const pageTitle = isCreateMode ? 'Create a new team' : 'Team settings'
  const pageSubtitle = isCreateMode
    ? 'Set up your team profile and billing information.'
    : 'Manage your team profile and billing information.'
  const primaryLabel = isCreateMode ? 'Create team' : 'Save changes'

  const handleEditTeam = async (teamId: string) => {
    await fetchTeamById(teamId)
    router.push('/studio/team-config')
  }

  const handleRoleChange = async (teamId: string, userId: string, role: string) => {
    await updateMember(teamId, userId, { role: role as any })
  }

  const handleTokenLimitChange = async (teamId: string, userId: string, current?: number) => {
    setTokenLimitMember({ teamId, userId, current })
    setTokenLimitValue(String(current ?? 0))
  }

  const handleTokenLimitSave = async () => {
    if (!tokenLimitMember) return
    const parsed = Number(tokenLimitValue)
    if (Number.isNaN(parsed) || parsed < 0) return
    setTokenLimitSaving(true)
    try {
      await updateMember(tokenLimitMember.teamId, tokenLimitMember.userId, { tokenLimit: parsed })
      setTokenLimitMember(null)
    } finally {
      setTokenLimitSaving(false)
    }
  }

  const toggleMemberSelected = (userId: string, role?: string) => {
    if (role === 'OWNER') return
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedMembers(new Set())
  }

  const selectAllFiltered = (members: { userId: string; role?: string }[]) => {
    const next = new Set<string>()
    members.forEach((member) => {
      if (member.role === 'OWNER') return
      next.add(member.userId)
    })
    setSelectedMembers(next)
  }

  const handleBulkRoleChange = async (teamId: string, role: string) => {
    if (!selectedMembers.size) return
    await Promise.all(
      Array.from(selectedMembers).map((userId) => updateMember(teamId, userId, { role: role as any }))
    )
  }

  const handleBulkRemove = async (teamId: string, protectedUserIds: Set<string>) => {
    if (!selectedMembers.size) return
    const removable = Array.from(selectedMembers).filter((userId) => !protectedUserIds.has(userId))
    if (!removable.length) return
    await Promise.all(removable.map((userId) => handleRemoveMember(teamId, userId)))
    clearSelection()
  }

  const toggleMemberExpanded = (memberId: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    setRemovingMembers((prev) => {
      const next = new Set(prev)
      next.add(userId)
      return next
    })
    await new Promise((resolve) => setTimeout(resolve, 240))
    try {
      await deleteMember(teamId, userId)
    } finally {
      setRemovingMembers((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  if (isMyTeamsTab) {
    const activeTeam =
      currentTeam ?? teams.find((team) => (activeTeamId ? team.id === activeTeamId : false))
    const membership =
      activeTeam?.memberships?.find((m) => m.userId === user?.id) ??
      activeTeam?.memberships?.find(
        (m) => user?.email && m.user?.email?.toLowerCase() === user.email.toLowerCase()
      )
    const role = membership?.role ?? 'MEMBER'
    const isOwner = role === 'OWNER'
    const members = (activeTeam?.memberships ?? []).filter((m) => m.isActive !== false)
    const protectedMemberIds = new Set(
      members.filter((member) => member.role === 'OWNER').map((member) => member.userId)
    )
    const filteredMembers = members.filter((member) => {
      const q = memberSearch.trim().toLowerCase()
      if (roleFilter !== 'ALL' && member.role !== roleFilter) return false
      if (!q) return true
      const name = member.user?.name?.toLowerCase() ?? ''
      const email = member.user?.email?.toLowerCase() ?? ''
      return name.includes(q) || email.includes(q)
    })
    const surfaceTint =
      'color-mix(in srgb, var(--pitch-nav-bg) 22%, var(--pitch-surface-bg))'
    const surfaceTintStrong =
      'color-mix(in srgb, var(--pitch-nav-bg) 34%, var(--pitch-surface-bg))'
    const summaryGradient =
      'linear-gradient(135deg, ' +
      'color-mix(in srgb, var(--pitch-accent) 38%, var(--pitch-surface-bg)), ' +
      'color-mix(in srgb, var(--pitch-selected) 38%, var(--pitch-surface-bg)) 48%, ' +
      'color-mix(in srgb, var(--pitch-info) 38%, var(--pitch-surface-bg)))'
    const mascotShadow = colorScheme === 'dark' ? 'drop-shadow(0 8px 10px rgba(0, 0, 0, 0.45))' : undefined

    const tokenLimitMemberName =
      tokenLimitMember &&
      members.find((member) => member.userId === tokenLimitMember.userId)?.user?.name

    return (
      <Paper
        p="xl"
        radius="xl"
        withBorder
        shadow="sm"
        style={{
          background: surfaceTintStrong,
          borderColor: 'var(--pitch-border)',
        }}
      >
        <Stack gap="lg">
          <Modal
            opened={Boolean(tokenLimitMember)}
            onClose={() => setTokenLimitMember(null)}
            radius={'lg'}
            title={
              tokenLimitMemberName ? `Set token limit for ${tokenLimitMemberName}` : 'Set token limit'
            }
            centered
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Enter the maximum number of tokens this member can use.
              </Text>
              <TextInput
                label="Token limit"
                type="number"
                min={0}
                value={tokenLimitValue}
                onChange={(e) => setTokenLimitValue(e.currentTarget.value)}
              />
              <Group justify="flex-end" gap="sm">
                <Button variant="default" radius="xl" onClick={() => setTokenLimitMember(null)}>
                  Cancel
                </Button>
                <Button
                  radius="xl"
                  onClick={() => void handleTokenLimitSave()}
                  loading={tokenLimitSaving}
                >
                  Save
                </Button>
              </Group>
            </Stack>
          </Modal>
          <Group justify={isMobile ? 'center' : 'space-between'} align="center" wrap="wrap">
            <Stack gap={4} align={isMobile ? 'center' : 'flex-start'}>
              <Title order={2}>Team Management</Title>
              <Text size="sm" c="dimmed">
                Manage members, roles, and invitations for your team.
              </Text>
            </Stack>
          </Group>

          <Divider />

        {!activeTeam ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              No team selected.
            </Text>
            <Text size="sm" c="dimmed">
              Choose a team from the sidebar to view details here.
            </Text>
          </Stack>
        ) : (
          <>
            <Group
              align="center"
              wrap="wrap"
              gap="lg"
              justify={isMobile ? 'center' : 'space-between'}
              w="100%"
            >
              <Paper
                p="lg"
                radius="lg"
                shadow="sm"
                style={{
                  background: summaryGradient,
                  borderColor: 'var(--pitch-border)',
                  flex: 1,
                  minWidth: 320,
                }}
              >
                <Group justify="space-between" align="center" wrap="wrap" gap="md">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Team
                    </Text>
                    <Group gap="xs" align="center" wrap="wrap">
                      <Title order={2}>{activeTeam.name}</Title>
                      <Badge variant="light" radius="xl">
                        {role.toLowerCase()}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {members.length} member{members.length === 1 ? '' : 's'}
                    </Text>
                  </Stack>
                  <Button size="md" onClick={() => void handleEditTeam(activeTeam.id)}>
                    Edit team
                  </Button>
                </Group>
              </Paper>
              <Box
                style={{
                  position: 'relative',
                  width: 240,
                  marginLeft: isMobile ? 0 : 'auto',
                }}
              >
                <Box
                  style={{
                    position: 'absolute',
                    bottom: 24,
                    width: 240,
                    height: 22,
                    background:
                      'radial-gradient(ellipse, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.25) 40%, rgba(0, 0, 0, 0) 70%)',
                    filter: 'blur(1px)',
                    zIndex: 0,
                  }}
                />
                <Image
                  src="/teamsMascots.png"
                  alt="Team mascots"
                  width={240}
                  height={200}
                  style={{
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 1,
                    filter: mascotShadow,
                  }}
                />
              </Box>
            </Group>

            <Paper
              p="lg"
              radius="lg"
              withBorder
              shadow="sm"
              style={{ background: surfaceTintStrong, borderColor: 'var(--pitch-border)' }}
            >
              <Group
                justify={isMobile ? 'center' : 'space-between'}
                align="center"
                wrap="wrap"
                mb="sm"
                gap="sm"
              >
                <Stack gap={2} align={isMobile ? 'center' : 'flex-start'}>
                  <Title order={4}>Members</Title>
                  <Text size="sm" c="dimmed">
                    {members.length} total
                  </Text>
                </Stack>
                <Stack gap={2} align={isMobile ? 'center' : 'flex-end'}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: 0.5 }}>
                    Role controls
                  </Text>
                  <Text size="xs" c="dimmed">
                    Only owners can remove members.
                  </Text>
                </Stack>
              </Group>

              <Group
                gap="sm"
                align="flex-end"
                wrap="wrap"
                w="100%"
                mb="sm"
                justify={isMobile ? 'center' : 'flex-start'}
              >
                <TextInput
                  leftSection={<IconSearch size={16} />}
                  placeholder="Search by name or role"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.currentTarget.value)}
                  size="sm"
                  style={{ width: isMobile ? '100%' : 320 }}
                  styles={{
                    input: {
                      background: 'var(--pitch-input-bg)',
                      color: 'var(--pitch-input-text)',
                    },
                  }}
                />
                <Menu width={180} position="bottom-end" withArrow>
                  <Menu.Target>
                    <Button
                      radius="xl"
                      size="sm"
                      variant={roleFilter === 'ALL' ? 'default' : 'light'}
                      leftSection={<IconFilter size={16} />}
                    >
                      {roleFilter === 'ALL' ? 'Filters' : 'Filters: ' + roleFilter}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Role</Menu.Label>
                    <Menu.Item onClick={() => setRoleFilter('ALL')}>
                      {roleFilter === 'ALL' ? '* ' : ''}All
                    </Menu.Item>
                    <Menu.Item onClick={() => setRoleFilter('OWNER')}>
                      {roleFilter === 'OWNER' ? '* ' : ''}Owner
                    </Menu.Item>
                    <Menu.Item onClick={() => setRoleFilter('ADMIN')}>
                      {roleFilter === 'ADMIN' ? '* ' : ''}Admin
                    </Menu.Item>
                    <Menu.Item onClick={() => setRoleFilter('MEMBER')}>
                      {roleFilter === 'MEMBER' ? '* ' : ''}Member
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>

                {isOwner && selectedMembers.size > 0 && (
                  <>
                    <Menu width={180} position="bottom-end" withArrow>
                      <Menu.Target>
                        <Button variant="light" radius="xl" size="sm" disabled={!selectedMembers.size}>
                          Change role
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => void handleBulkRoleChange(activeTeam.id, 'OWNER')}>
                          Owner
                        </Menu.Item>
                        <Menu.Item onClick={() => void handleBulkRoleChange(activeTeam.id, 'ADMIN')}>
                          Admin
                        </Menu.Item>
                        <Menu.Item onClick={() => void handleBulkRoleChange(activeTeam.id, 'MEMBER')}>
                          Member
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                    <Button
                      radius="xl"
                      color="red"
                      size="sm"
                      variant="light"
                      disabled={!selectedMembers.size}
                      onClick={() => void handleBulkRemove(activeTeam.id, protectedMemberIds)}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </Group>

              <ScrollArea h={filteredMembers.length > 6 ? 320 : undefined} type="auto">
                <Table
                  withColumnBorders={false}
                  highlightOnHover
                  horizontalSpacing={isMobile ? 'xs' : 'md'}
                  verticalSpacing="xs"
                  style={{ tableLayout: 'fixed' }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 28, paddingRight: 0 }}>
                        {selectedMembers.size > 0 && (
                          <Checkbox
                            size="xs"
                            checked={
                              filteredMembers.length > 0 &&
                              filteredMembers.every((member) => selectedMembers.has(member.userId))
                            }
                            indeterminate={
                              selectedMembers.size > 0 &&
                              filteredMembers.some((member) => selectedMembers.has(member.userId)) &&
                              !filteredMembers.every((member) => selectedMembers.has(member.userId))
                            }
                            onChange={() => {
                              const allSelected =
                                filteredMembers.length > 0 &&
                                filteredMembers.every((member) => selectedMembers.has(member.userId))
                              if (allSelected) {
                                clearSelection()
                              } else {
                                selectAllFiltered(filteredMembers)
                              }
                            }}
                            styles={{ input: { width: 14, height: 14 } }}
                          />
                        )}
                      </Table.Th>
                      <Table.Th style={{ width: isMobile ? '72%' : '50%' }}>Name</Table.Th>
                      {!isMobile && (
                        <>
                          <Table.Th style={{ width: '20%' }}>Role</Table.Th>
                          <Table.Th style={{ width: '30%' }}>Actions</Table.Th>
                        </>
                      )}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredMembers.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={isMobile ? 2 : 4}>
                          <Text size="sm" c="dimmed">
                            No matching members.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                        filteredMembers.map((member) =>
                          isMobile ? (
                            <Fragment key={member.id}>
                              <Table.Tr
                                style={{
                                  cursor: 'pointer',
                                  opacity: removingMembers.has(member.userId) ? 0 : 1,
                                  transform: removingMembers.has(member.userId)
                                    ? 'translateX(12px)'
                                    : 'translateX(0)',
                                  transition: 'opacity 220ms ease, transform 220ms ease',
                                }}
                                onClick={() => toggleMemberExpanded(member.id)}
                              >
                                <Table.Td style={{ paddingRight: 0 }}>
                                  <Checkbox
                                    size="xs"
                                    checked={selectedMembers.has(member.userId)}
                                    onChange={() => toggleMemberSelected(member.userId, member.role)}
                                    disabled={
                                      member.role === 'OWNER' || removingMembers.has(member.userId)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    styles={{ input: { width: 14, height: 14 } }}
                                  />
                                </Table.Td>
                                <Table.Td>
                                  <Group gap="xs" justify="space-between" wrap="nowrap">
                                    <Text size="sm" fw={600} lineClamp={1}>
                                      {member.user?.name ?? 'Unknown'}
                                    </Text>
                                    <ActionIcon
                                      variant="subtle"
                                      radius="xl"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleMemberExpanded(member.id)
                                      }}
                                      style={{
                                        transform: expandedMembers.has(member.id)
                                          ? 'rotate(180deg)'
                                          : 'rotate(0deg)',
                                        transition: 'transform 150ms ease',
                                      }}
                                    >
                                      <IconChevronDown size={14} />
                                    </ActionIcon>
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                              {expandedMembers.has(member.id) && (
                                <Table.Tr
                                  style={{
                                    opacity: removingMembers.has(member.userId) ? 0 : 1,
                                    transform: removingMembers.has(member.userId)
                                      ? 'translateX(12px)'
                                      : 'translateX(0)',
                                    transition: 'opacity 220ms ease, transform 220ms ease',
                                  }}
                                >
                                  <Table.Td colSpan={2}>
                                    <Stack gap="xs">
                                      <Text size="xs" fw={600}>
                                        {member.user?.name ?? 'Unknown'}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {member.user?.email ?? ''}
                                      </Text>
                                      <Group gap="sm" align="center" wrap="wrap">
                                        {isOwner ? (
                                          roleMenuMemberId === member.id ? (
                                            <Transition
                                              mounted
                                              transition="slide-right"
                                              duration={260}
                                              timingFunction="ease"
                                            >
                                              {(styles) => (
                                                <Stack
                                                  gap="xs"
                                                  style={{
                                                    ...styles,
                                                    background: 'var(--pitch-surface-bg)',
                                                    border: '1px solid var(--pitch-border)',
                                                    borderRadius: 12,
                                                    padding: '8px 10px',
                                                    boxShadow: 'var(--mantine-shadow-xs)',
                                                    transformOrigin: 'left center',
                                                  }}
                                                >
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    onClick={() => {
                                                      void handleRoleChange(
                                                        activeTeam.id,
                                                        member.userId,
                                                        'OWNER'
                                                      )
                                                      setRoleMenuMemberId(null)
                                                    }}
                                                  >
                                                    Owner
                                                  </Button>
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    onClick={() => {
                                                      void handleRoleChange(
                                                        activeTeam.id,
                                                        member.userId,
                                                        'ADMIN'
                                                      )
                                                      setRoleMenuMemberId(null)
                                                    }}
                                                  >
                                                    Admin
                                                  </Button>
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    onClick={() => {
                                                      void handleRoleChange(
                                                        activeTeam.id,
                                                        member.userId,
                                                        'MEMBER'
                                                      )
                                                      setRoleMenuMemberId(null)
                                                    }}
                                                  >
                                                    Member
                                                  </Button>
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    leftSection={<IconX size={12} />}
                                                    onClick={() => setRoleMenuMemberId(null)}
                                                  >
                                                    Close
                                                  </Button>
                                                </Stack>
                                              )}
                                            </Transition>
                                          ) : (
                                            <UnstyledButton
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setRoleMenuMemberId(member.id)
                                              }}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: 0,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <Text size="xs" fw={600}>
                                                Role: {member.role.toLowerCase()}
                                              </Text>
                                              <IconChevronDown size={12} />
                                            </UnstyledButton>
                                          )
                                        ) : (
                                          <Text size="xs" c="dimmed">
                                            Role: {member.role.toLowerCase()}
                                          </Text>
                                        )}
                                      </Group>
                                      <Group gap="sm" align="center" wrap="wrap">
                                        {isOwner ? (
                                          settingsMenuMemberId === member.id ? (
                                            <Transition
                                              mounted
                                              transition="slide-right"
                                              duration={260}
                                              timingFunction="ease"
                                            >
                                              {(styles) => (
                                                <Stack
                                                  gap="xs"
                                                  style={{
                                                    ...styles,
                                                    background: 'var(--pitch-surface-bg)',
                                                    border: '1px solid var(--pitch-border)',
                                                    borderRadius: 12,
                                                    padding: '8px 10px',
                                                    boxShadow: 'var(--mantine-shadow-xs)',
                                                    transformOrigin: 'left center',
                                                  }}
                                                >
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    onClick={() => {
                                                      void handleTokenLimitChange(
                                                        activeTeam.id,
                                                        member.userId,
                                                        member.tokenLimit
                                                      )
                                                      setSettingsMenuMemberId(null)
                                                    }}
                                                  >
                                                    Token limit
                                                  </Button>
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    onClick={() => {
                                                      router.push(
                                                        `/studio/analytics?memberId=${member.userId}`
                                                      )
                                                      setSettingsMenuMemberId(null)
                                                    }}
                                                  >
                                                    Analytics
                                                  </Button>
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    color="red"
                                                    fullWidth
                                                    onClick={() => {
                                                      void handleRemoveMember(activeTeam.id, member.userId)
                                                      setSettingsMenuMemberId(null)
                                                    }}
                                                    disabled={
                                                      member.userId === user?.id ||
                                                      removingMembers.has(member.userId)
                                                    }
                                                  >
                                                    Remove
                                                  </Button>
                                                  <Button
                                                    size="xs"
                                                    radius="sm"
                                                    variant="subtle"
                                                    fullWidth
                                                    leftSection={<IconX size={12} />}
                                                    onClick={() => setSettingsMenuMemberId(null)}
                                                  >
                                                    Close
                                                  </Button>
                                                </Stack>
                                              )}
                                            </Transition>
                                          ) : (
                                            <UnstyledButton
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setSettingsMenuMemberId(member.id)
                                              }}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: 0,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              <Text size="xs" fw={600}>
                                                Settings
                                              </Text>
                                              <IconChevronDown size={12} />
                                            </UnstyledButton>
                                          )
                                        ) : (
                                          <Text size="xs" c="dimmed">
                                            -
                                          </Text>
                                        )}
                                      </Group>
                                    </Stack>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Fragment>
                          ) : (
                            <Table.Tr
                              key={member.id}
                              style={{
                                opacity: removingMembers.has(member.userId) ? 0 : 1,
                                transform: removingMembers.has(member.userId)
                                  ? 'translateX(12px)'
                                  : 'translateX(0)',
                                transition: 'opacity 220ms ease, transform 220ms ease',
                              }}
                            >
                              <Table.Td style={{ paddingRight: 0 }}>
                                <Checkbox
                                  size="xs"
                                  checked={selectedMembers.has(member.userId)}
                                  onChange={() => toggleMemberSelected(member.userId, member.role)}
                                  disabled={
                                    member.role === 'OWNER' || removingMembers.has(member.userId)
                                  }
                                  styles={{ input: { width: 14, height: 14 } }}
                                />
                              </Table.Td>
                              <Table.Td>
                                <Group gap="sm" wrap="nowrap">
                                  <Avatar
                                    src={member.user?.avatar ?? undefined}
                                    radius="xl"
                                    size={32}
                                  />
                                  <Stack gap={2}>
                                    <Text size="sm" fw={600}>
                                      {member.user?.name ?? 'Unknown'}
                                    </Text>
                                    <Text size="xs" c="dimmed" lineClamp={1}>
                                      {member.user?.email ?? ''}
                                    </Text>
                                  </Stack>
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                {isOwner ? (
                                  <Select
                                    size="sm"
                                    radius="xl"
                                    value={member.role}
                                    data={[
                                      { value: 'OWNER', label: 'Owner' },
                                      { value: 'ADMIN', label: 'Admin' },
                                      { value: 'MEMBER', label: 'Member' },
                                    ]}
                                    onChange={(value) => {
                                      if (!value) return
                                      void handleRoleChange(activeTeam.id, member.userId, value)
                                    }}
                                    rightSection={
                                      <IconChevronDown size={14} color="var(--pitch-accent-strong)" />
                                    }
                                    rightSectionPointerEvents="none"
                                    styles={{
                                      input: {
                                        background: 'var(--pitch-input-bg)',
                                        color: 'var(--pitch-input-text)',
                                        borderRadius: 999,
                                        border: 'none',
                                        boxShadow: 'none',
                                        fontSize: '0.875rem',
                                        '&:hover': {
                                          background: 'var(--pitch-input-bg)',
                                        },
                                      },
                                    }}
                                    w={120}
                                  />
                                ) : (
                                  <Text size="sm">{member.role.toLowerCase()}</Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                {isOwner ? (
                                  <Menu position="bottom-end" withArrow>
                                    <Menu.Target>
                                      <Tooltip label="Member settings" withArrow>
                                        <ActionIcon variant="subtle" radius="xl">
                                          <IconSettings size={16} />
                                        </ActionIcon>
                                      </Tooltip>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                      <Menu.Label>Member actions</Menu.Label>
                                      <Menu.Item
                                        leftSection={<IconSettings size={14} />}
                                        onClick={() =>
                                          void handleTokenLimitChange(
                                            activeTeam.id,
                                            member.userId,
                                            member.tokenLimit
                                          )
                                        }
                                      >
                                        Set token limit
                                      </Menu.Item>
                                      <Menu.Item
                                        leftSection={<IconChartBar size={14} />}
                                        onClick={() =>
                                          router.push(`/studio/analytics?memberId=${member.userId}`)
                                        }
                                      >
                                        View analytics
                                      </Menu.Item>
                                      <Menu.Divider />
                                      <Menu.Item
                                        color="red"
                                        leftSection={<IconTrash size={14} />}
                                        onClick={() => void handleRemoveMember(activeTeam.id, member.userId)}
                                        disabled={
                                          member.userId === user?.id ||
                                          removingMembers.has(member.userId)
                                        }
                                      >
                                        Remove member
                                      </Menu.Item>
                                    </Menu.Dropdown>
                                  </Menu>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    -
                                  </Text>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          )
                        )
                      )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>

          </>
        )}
        </Stack>
      </Paper>
    )
  }


  const overviewName = formValues.name?.trim() || 'Untitled team'
  const overviewEmail = formValues.billingEmail?.trim() || 'No billing email'
  const overviewCity = formValues.city?.trim()
  const overviewCountry = formValues.country?.trim()
  const overviewLocation =
    overviewCity && overviewCountry ? `${overviewCity}, ${overviewCountry}` : overviewCountry || 'N/A'
  const overviewStatus = isCreateMode ? 'Draft' : 'Active'
  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : 'N/A'

  return (
    <Paper
      p="xl"
      radius="xl"
      shadow="sm"
      withBorder
      style={{
        background:
          'linear-gradient(145deg, var(--pitch-surface-bg), color-mix(in srgb, var(--pitch-nav-bg) 30%, transparent), var(--pitch-surface-bg))',
        borderColor: 'var(--pitch-border)',
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.6 }}>
              Team Settings
            </Text>
            <Title order={2}>{pageTitle}</Title>
            <Text size="sm" c="dimmed">
              {pageSubtitle}
            </Text>
          </Stack>

          <Group gap="xs">
            <Button variant="default" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button size="sm" onClick={handlePrimaryClick} loading={primaryLoading}>
              {primaryLabel}
            </Button>
          </Group>
        </Group>

        {bannerError && (
          <Box
            p="sm"
            style={{
              borderRadius: 10,
              background: 'var(--mantine-color-red-0)',
              border: '1px solid var(--mantine-color-red-3)',
            }}
          >
            <Text size="sm" c="red.7">
              {bannerError}
            </Text>
          </Box>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="lg">
            <Paper
              p="lg"
              radius="lg"
              withBorder
              shadow="xs"
              style={{ background: 'var(--pitch-surface-bg)', borderColor: 'var(--pitch-border)' }}
            >
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Title order={3}>Team profile</Title>
                  <Badge variant="light" radius="xl">
                    {overviewStatus}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  A clear team name and billing email help us personalize your workspace.
                </Text>

                <TextInput
                  label="Team name"
                  placeholder="e.g. Sales Team"
                  value={formValues.name}
                  error={formErrors.name}
                  onChange={(e) =>
                    isCreateMode
                      ? setField('name', e.currentTarget.value)
                      : setEditField('name', e.currentTarget.value)
                  }
                  required
                />

                <TextInput
                  label="Billing email (optional)"
                  placeholder="billing@example.com"
                  value={formValues.billingEmail}
                  error={formErrors.billingEmail}
                  onChange={(e) =>
                    isCreateMode
                      ? setField('billingEmail', e.currentTarget.value)
                      : setEditField('billingEmail', e.currentTarget.value)
                  }
                />
              </Stack>
            </Paper>

            <Paper
              p="lg"
              radius="lg"
              withBorder
              shadow="xs"
              style={{ background: 'var(--pitch-surface-bg)', borderColor: 'var(--pitch-border)' }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={3}>Billing address</Title>
                  <Text size="xs" c="dimmed">
                    Optional
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Used for invoices and account communication.
                </Text>

                <TextInput
                  label="Street address"
                  placeholder="123 Main St"
                  value={formValues.street}
                  error={formErrors.street}
                  onChange={(e) =>
                    isCreateMode
                      ? setField('street', e.currentTarget.value)
                      : setEditField('street', e.currentTarget.value)
                  }
                />
                <Group grow>
                  <TextInput
                    label="City"
                    placeholder="Calgary"
                    value={formValues.city}
                    error={formErrors.city}
                    onChange={(e) =>
                      isCreateMode
                        ? setField('city', e.currentTarget.value)
                        : setEditField('city', e.currentTarget.value)
                    }
                  />
                  <TextInput
                    label="State / Province"
                    placeholder="AB"
                    value={formValues.stateProvince}
                    error={formErrors.stateProvince}
                    onChange={(e) =>
                      isCreateMode
                        ? setField('stateProvince', e.currentTarget.value)
                        : setEditField('stateProvince', e.currentTarget.value)
                    }
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="Postal code"
                    placeholder="T2N 1N4"
                    value={formValues.postalCode}
                    error={formErrors.postalCode}
                    onChange={(e) =>
                      isCreateMode
                        ? setField('postalCode', e.currentTarget.value)
                        : setEditField('postalCode', e.currentTarget.value)
                    }
                  />
                  <TextInput
                    label="Country"
                    placeholder="Canada"
                    value={formValues.country}
                    error={formErrors.country}
                    onChange={(e) =>
                      isCreateMode
                        ? setField('country', e.currentTarget.value)
                        : setEditField('country', e.currentTarget.value)
                    }
                  />
                </Group>
              </Stack>
            </Paper>
          </Stack>

          <Stack gap="lg">
            <Paper
              p="lg"
              radius="lg"
              withBorder
              shadow="xs"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in srgb, var(--pitch-accent) 10%, transparent), var(--pitch-surface-bg))',
                borderColor: 'var(--pitch-border)',
              }}
            >
              <Stack gap="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.6 }}>
                  Overview
                </Text>
                <Title order={4}>{overviewName}</Title>
                <Text size="sm" c="dimmed">
                  {overviewEmail}
                </Text>
                <Divider />
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Status
                  </Text>
                  <Badge variant="light" radius="xl">
                    {overviewStatus}
                  </Badge>
                </Group>
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Location
                  </Text>
                  <Text size="sm">{overviewLocation}</Text>
                </Group>
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Team ID
                  </Text>
                  <Text size="sm" c="dimmed">
                    {currentTeam?.id ?? 'N/A'}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            <Paper
              p="lg"
              radius="lg"
              withBorder
              shadow="xs"
              style={{ background: 'var(--pitch-surface-bg)', borderColor: 'var(--pitch-border)' }}
            >
              <Stack gap="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.6 }}>
                  Token usage
                </Text>
                <Text size="sm" c="dimmed">
                  To be added.
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Paper>
  )
}



