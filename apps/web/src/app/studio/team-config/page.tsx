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
  Select,
} from '@mantine/core'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuth } from '@/features/auth'
import { useCreateTeamForm } from '@/features/teams/hooks/useTeamForm'
import { TeamMembersPanel } from '@/components/ui/TeamMembersPanel'
import {
  IconFilter,
  IconMail,
  IconSearch,
  IconTrash,
  IconSettings,
  IconChartBar,
  IconChevronDown,
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
    addMember,
    updateMember,
    deleteMember,
    loading: teamsLoading,
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
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())

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
    ? 'Set up your team details and billing information. You can invite members after the team is created.'
    : 'Manage your team details, billing information, and members.'
  const primaryLabel = isCreateMode ? 'Create team' : 'Save changes'

  const handleEditTeam = async (teamId: string) => {
    await fetchTeamById(teamId)
    router.push('/studio/team-config')
  }

  const handleInvite = async (teamId: string) => {
    const userId = inviteUserId.trim()
    if (!userId) return
    setInviting(true)
    try {
      await addMember(teamId, { userId, role: 'MEMBER' })
      setInviteUserId('')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (teamId: string, userId: string, role: string) => {
    await updateMember(teamId, userId, { role: role as any })
  }

  const handleTokenLimitChange = async (teamId: string, userId: string, current?: number) => {
    const next = window.prompt('Set token limit', String(current ?? 0))
    if (next === null) return
    const parsed = Number(next)
    if (Number.isNaN(parsed) || parsed < 0) return
    await updateMember(teamId, userId, { tokenLimit: parsed })
  }

  const toggleMemberSelected = (userId: string) => {
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

  const selectAllFiltered = (members: { userId: string }[]) => {
    const next = new Set<string>()
    members.forEach((member) => next.add(member.userId))
    setSelectedMembers(next)
  }

  const handleBulkRoleChange = async (teamId: string, role: string) => {
    if (!selectedMembers.size) return
    await Promise.all(
      Array.from(selectedMembers).map((userId) => updateMember(teamId, userId, { role: role as any }))
    )
  }

  const handleBulkRemove = async (teamId: string) => {
    if (!selectedMembers.size) return
    await Promise.all(Array.from(selectedMembers).map((userId) => deleteMember(teamId, userId)))
    clearSelection()
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
    const filteredMembers = members.filter((member) => {
      const q = memberSearch.trim().toLowerCase()
      if (roleFilter !== 'ALL' && member.role !== roleFilter) return false
      if (!q) return true
      const name = member.user?.name?.toLowerCase() ?? ''
      const email = member.user?.email?.toLowerCase() ?? ''
      return name.includes(q) || email.includes(q)
    })
    return (
      <Paper
        p="xl"
        radius="xl"
        shadow="sm"
        withBorder
        style={{ background: 'var(--mantine-color-gray-0)' }}
      >
        <Stack gap="lg">

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
            <Stack gap="lg">
              <Box
                style={{
                  position: 'relative',
                  paddingRight: 240,
                }}
              >
                <Stack gap="xs">
                  <Title order={3}>Team Management</Title>
                  <Text size="sm" c="dimmed">
                    Manage your team members or invite new members to your team.
                  </Text>
                </Stack>
                <Box style={{ position: 'absolute', top: 0, right: 350, pointerEvents: 'none' }}>
                  <Image
                    src="/teamsMascots.png"
                    alt="Team mascots"
                    width={330}
                    height={270}
                    style={{
                      objectFit: 'contain',
                    }}
                  />
                </Box>
              </Box>

              <Stack gap="sm">
                <Paper
                  p="md"
                  radius="lg"
                  withBorder
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(225,235,255,0.7), rgba(245,248,255,0.85))',
                    borderColor: 'rgba(59,130,246,0.12)',
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Team
                      </Text>
                      <Group gap="xs">
                        <Title order={3}>{activeTeam.name}</Title>
                        <Badge variant="light">{role.toLowerCase()}</Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {members.length} member{members.length === 1 ? '' : 's'}
                        {activeTeam.billingEmail ? ` - ${activeTeam.billingEmail}` : ''}
                      </Text>
                    </Stack>
                    <Button ml="auto" size="l" onClick={() => void handleEditTeam(activeTeam.id)}>
                      Edit team
                    </Button>
                  </Group>
                </Paper>

                <Group justify="space-between" align="center">
                  <Stack gap={2}>
                    <Title order={4}>Invite new member</Title>
                    <Text size="sm" c="dimmed">
                      Invite a member by email.
                    </Text>
                  </Stack>
                </Group>

                <Group gap="md" align="flex-end" wrap="nowrap">
                  <TextInput
                    leftSection={<IconMail size={16} />}
                    placeholder="Email address"
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.currentTarget.value)}
                    disabled={!isOwner}
                    styles={{
                      input: { background: 'white' },
                    }}
                    style={{ width: 260 }}
                  />
                  <Button
                    onClick={() => void handleInvite(activeTeam.id)}
                    loading={inviting || teamsLoading}
                    disabled={!isOwner}
                  >
                    Send invite
                  </Button>
                </Group>
                {!isOwner && (
                  <Text size="xs" c="dimmed">
                    Only owners can invite or remove members.
                  </Text>
                )}
              </Stack>

              <Divider />

              <Stack gap="sm">
                <Title order={4}>Members</Title>
                <Group gap="sm" align="flex-end" wrap="nowrap" w="100%">
                  <TextInput
                    leftSection={<IconSearch size={16} />}
                    placeholder="Search by name or role"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.currentTarget.value)}
                    style={{ width: 360 }}
                  />
                  <Menu width={180} position="bottom-end" withArrow>
                    <Menu.Target>
                      <Button
                        variant={roleFilter === 'ALL' ? 'default' : 'light'}
                        leftSection={<IconFilter size={16} />}
                      >
                        {roleFilter === 'ALL' ? 'Filters' : 'Filters - ' + roleFilter}
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
                          <Button variant="light" disabled={!selectedMembers.size}>
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
                        color="red"
                        variant="light"
                        disabled={!selectedMembers.size}
                        onClick={() => void handleBulkRemove(activeTeam.id)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </Group>

                <ScrollArea h={320} type="auto">
                  <Table withColumnBorders={false} striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 28, paddingRight: 0 }}>
                          {selectedMembers.size > 0 && (
                            <Checkbox
                              size="xs"
                              checked={
                                filteredMembers.length > 0 &&
                                filteredMembers.every((member) =>
                                  selectedMembers.has(member.userId)
                                )
                              }
                              indeterminate={
                                selectedMembers.size > 0 &&
                                filteredMembers.some((member) =>
                                  selectedMembers.has(member.userId)
                                ) &&
                                !filteredMembers.every((member) =>
                                  selectedMembers.has(member.userId)
                                )
                              }
                              onChange={() => {
                                const allSelected =
                                  filteredMembers.length > 0 &&
                                  filteredMembers.every((member) =>
                                    selectedMembers.has(member.userId)
                                  )
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
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Role</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredMembers.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Text size="sm" c="dimmed">
                              No matching members.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        filteredMembers.map((member) => (
                          <Table.Tr key={member.id}>
                          <Table.Td style={{ paddingRight: 0 }}>
                            <Checkbox
                              size="xs"
                              checked={selectedMembers.has(member.userId)}
                              onChange={() => toggleMemberSelected(member.userId)}
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
                                  <Text size="xs" c="dimmed">
                                    {member.user?.email ?? ''}
                                  </Text>
                                </Stack>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              {isOwner ? (
                                <Select
                                  size="xs"
                                  variant="unstyled"
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
                                    <IconChevronDown size={14} color="var(--mantine-color-blue-6)" />
                                  }
                                  rightSectionPointerEvents="none"
                                  styles={{
                                    input: {
                                      padding: 0,
                                      minHeight: 'unset',
                                      height: 'auto',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: '0.875rem',
                                    },
                                  }}
                                  w={90}
                                />
                              ) : (
                                <Text size="sm">{member.role.toLowerCase()}</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {isOwner ? (
                                <Menu position="bottom-end" withArrow>
                                  <Menu.Target>
                                    <ActionIcon variant="subtle">
                                      <IconSettings size={16} />
                                    </ActionIcon>
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
                                      onClick={() => void deleteMember(activeTeam.id, member.userId)}
                                      disabled={member.userId === user?.id}
                                    >
                                      Remove member
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              ) : (
                                <Text size="xs" c="dimmed">
                                  —
                                </Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper
      p="xl"
      radius="xl"
      shadow="sm"
      withBorder
      style={{ background: 'var(--mantine-color-gray-0)' }}
    >
      {/* header */}
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={4}>
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
      <Divider my="md" />

      {/* error banner */}
      {bannerError && (
        <Box
          mb="md"
          p="sm"
          style={{
            borderRadius: 8,
            background: 'var(--mantine-color-red-0)',
            border: '1px solid var(--mantine-color-red-3)',
          }}
        >
          <Text size="sm" c="red.7">
            {bannerError}
          </Text>
        </Box>
      )}

      {/* main layout */}
      <SimpleGrid cols={{ base: 1, md: isCreateMode ? 1 : 2 }} spacing="xl">
        {/* LEFT: team details + billing address */}
        <Stack gap="lg">
          <Stack gap="sm">
            <Title order={3}>Team details</Title>
            <Text size="sm" c="dimmed">
              Give your team a clear name. You can change this later in team settings.
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

          <Divider />

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
        </Stack>

        {/* RIGHT: members management only makes sense in edit mode */}
        {!isCreateMode && <TeamMembersPanel />}
      </SimpleGrid>

      {/* Light-weight hint in create mode so we don't waste a full column */}
      {isCreateMode && (
        <Box
          mt="xl"
          p="md"
          style={{
            borderRadius: 14,
            border: '1px solid var(--mantine-color-gray-3)',
            background: 'white',
          }}
        >
          <Text size="sm" c="dimmed">
            Once you create this team, you can invite members and manage roles from the Team Config
            view.
          </Text>
        </Box>
      )}
    </Paper>
  )
}



