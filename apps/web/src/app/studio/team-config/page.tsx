'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconBuildingSkyscraper,
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
  IconEdit,
  IconMapPin,
  IconSettings,
  IconUsersGroup,
} from '@tabler/icons-react'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuth } from '@/features/auth'
import { useCreateTeamForm } from '@/features/teams/hooks/useTeamForm'
import { TeamMembersPanel } from '@/components/ui/TeamMembersPanel'
import { TeamSubscriptionPanel } from '@/components/ui/TeamSubscriptionPanel'
import { TeamService } from '@/features/teams/services/teams.service'
import type { Team } from '@/features/teams/types/teams.types'
import classes from './team-config.module.css'

type TeamEditValues = {
  name: string
  billingEmail: string
  street: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
}

export default function TeamConfigPage() {
  return (
    <Suspense fallback={<div>Loading team configuration…</div>}>
      <TeamConfigInner />
    </Suspense>
  )
}

function TeamConfigInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCreateMode = searchParams.get('mode') === 'create'
  const selectedTeamIdFromQuery = searchParams.get('teamId')
  const selectedTeamView = searchParams.get('teamView') === 'My Teams' ? 'My Teams' : 'All'
  const isEditingMode = !isCreateMode && !!selectedTeamIdFromQuery
  const isCompactStepper = useMediaQuery('(max-width: 900px)')

  const { user } = useAuth()
  const { teams, currentTeam, updateTeam, loading, fetchTeamById, setActiveTeamId } = useTeams()
  const { values, errors, setField, submit, submitting, apiError } = useCreateTeamForm()
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [allTeamsLoading, setAllTeamsLoading] = useState(false)
  const [allTeamsError, setAllTeamsError] = useState<string | null>(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'MEMBER' | 'NONE'>('ALL')
  const [sortBy, setSortBy] = useState<'updated-desc' | 'name-asc' | 'name-desc' | 'members-desc' | 'members-asc'>(
    'updated-desc'
  )

  const [activeStep, setActiveStep] = useState(0)
  const [editValues, setEditValues] = useState<TeamEditValues>({
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

  const selectedTeamId = selectedTeamIdFromQuery ?? null

  useEffect(() => {
    if (!isCreateMode && currentTeam && selectedTeamId && currentTeam.id === selectedTeamId) {
      const addr = (currentTeam.billingAddress ?? {}) as Partial<TeamEditValues>
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
  }, [isCreateMode, currentTeam, selectedTeamId])

  useEffect(() => {
    if (isCreateMode || !selectedTeamId) return
    if (!currentTeam || currentTeam.id !== selectedTeamId || !currentTeam.memberships?.length) {
      void fetchTeamById(selectedTeamId)
    }
  }, [currentTeam, fetchTeamById, isCreateMode, selectedTeamId])

  useEffect(() => {
    if (isCreateMode || selectedTeamView !== 'All') return
    let cancelled = false
    setAllTeamsLoading(true)
    setAllTeamsError(null)

    void TeamService.getAll()
      .then((data) => {
        if (cancelled) return
        setAllTeams(data)
      })
      .catch((error) => {
        if (cancelled) return
        setAllTeamsError(error instanceof Error ? error.message : 'Failed to load all teams')
      })
      .finally(() => {
        if (cancelled) return
        setAllTeamsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isCreateMode, selectedTeamView])

  const formValues = isCreateMode ? values : editValues
  const formErrors = isCreateMode ? errors : ({} as typeof errors)
  const bannerError = isCreateMode ? apiError : editError
  const primaryLoading = isCreateMode ? submitting : savingEdit
  const visibleTeams = selectedTeamView === 'My Teams' ? teams : allTeams
  const selectedTeam = selectedTeamId && currentTeam?.id === selectedTeamId ? currentTeam : null
  const selectedTeamMembership = selectedTeam?.memberships?.find((m) => m.userId === user?.id)
  const canManageSelectedTeam = selectedTeamMembership?.role === 'OWNER'
  const filteredTeams = useMemo(() => {
    const normalizedQuery = teamSearch.trim().toLowerCase()
    const withMeta = visibleTeams.map((team) => {
      const activeMemberships = team.memberships?.filter((membership) => membership.isActive !== false) ?? []
      const myRole = activeMemberships.find((membership) => membership.userId === user?.id)?.role ?? null
      const memberCount = activeMemberships.length
      return { team, myRole, memberCount }
    })

    const searched = withMeta.filter(({ team, myRole }) => {
      if (!normalizedQuery) return true
      return team.name.toLowerCase().includes(normalizedQuery)
    })

    const roleFiltered = searched.filter(({ myRole }) => {
      if (roleFilter === 'ALL') return true
      if (roleFilter === 'NONE') return !myRole
      return myRole === roleFilter
    })

    const sorted = [...roleFiltered].sort((a, b) => {
      if (sortBy === 'name-asc') return a.team.name.localeCompare(b.team.name)
      if (sortBy === 'name-desc') return b.team.name.localeCompare(a.team.name)
      if (sortBy === 'members-desc') return b.memberCount - a.memberCount
      if (sortBy === 'members-asc') return a.memberCount - b.memberCount
      return new Date(b.team.updatedAt).getTime() - new Date(a.team.updatedAt).getTime()
    })

    return sorted
  }, [roleFilter, sortBy, teamSearch, user?.id, visibleTeams])

  const setEditField = (field: keyof TeamEditValues, value: string) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }

  const isTeamOwner = (team: Team) =>
    !!user?.id && team.memberships?.some((membership) => membership.userId === user.id && membership.role === 'OWNER')

  const handleOpenTeamEditor = (teamId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('mode')
    params.set('teamId', teamId)
    setActiveTeamId(teamId)
    router.push(`/studio/team-config?${params.toString()}`)
  }

  const handleBackToTeams = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('teamId')
    router.push(params.toString() ? `/studio/team-config?${params.toString()}` : '/studio/team-config')
  }

  const handleCreateClick = async () => {
    const ok = await submit()
    if (!ok) return
    router.push('/studio/team-config')
  }

  const handleSaveEditClick = async () => {
    if (!selectedTeam) return

    setEditError(null)
    const name = editValues.name.trim()

    if (!name) {
      setEditError('Team name is required')
      setActiveStep(0)
      return
    }

    setSavingEdit(true)
    try {
      await updateTeam(selectedTeam.id, {
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
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update team')
    } finally {
      setSavingEdit(false)
    }
  }

  const pageTitle = 'Create a new team'
  const pageSubtitle =
    'Set up your team profile and billing details. Members and subscriptions can be managed after creation.'
  const isEditLoading = !isCreateMode && isEditingMode && loading && !currentTeam

  if (isEditLoading) {
    return <div>Loading team configuration…</div>
  }

  return (
    <Container size="xl" py="xl" className={classes.page}>
      <Paper className={classes.shell} p={{ base: 'md', sm: 'xl' }}>
        <Stack gap="lg">
          {isCreateMode && (
            <Paper className={classes.heroCard} p={{ base: 'md', sm: 'xl' }}>
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap="sm" maw={700}>
                  <Group gap="xs">
                    <Badge variant="light" color="blue">
                      Studio
                    </Badge>
                    <Badge variant="light" color="cyan">
                      New team
                    </Badge>
                  </Group>
                  <Title className={classes.heroTitle} order={1}>
                    {pageTitle}
                  </Title>
                  <Text c="dimmed">{pageSubtitle}</Text>
                </Stack>

                <Group gap="sm">
                  <Button
                    variant="default"
                    leftSection={<IconChevronLeft size={16} />}
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => void handleCreateClick()} loading={primaryLoading}>
                    Create team
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          {bannerError && (
            <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />} radius="md">
              {bannerError}
            </Alert>
          )}

          {!isCreateMode && !isEditingMode && (
            <Paper className={classes.contentCard} p="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Title order={3} className={classes.sectionTitle}>
                    {selectedTeamView === 'My Teams' ? 'My Teams' : 'All Teams'}
                  </Title>
                </Group>
                <Group className={classes.listControls} align="flex-end" wrap="wrap">
                  <TextInput
                    label="Search teams"
                    placeholder="Search by team name"
                    value={teamSearch}
                    onChange={(event) => setTeamSearch(event.currentTarget.value)}
                    className={classes.searchControl}
                  />
                  <Select
                    label="Role filter"
                    value={roleFilter}
                    onChange={(value) => setRoleFilter((value as typeof roleFilter) ?? 'ALL')}
                    data={[
                      { value: 'ALL', label: 'All roles' },
                      { value: 'OWNER', label: 'Owner' },
                      { value: 'ADMIN', label: 'Admin' },
                      { value: 'MEMBER', label: 'Member' },
                      { value: 'NONE', label: 'No membership' },
                    ]}
                    className={classes.filterControl}
                    allowDeselect={false}
                  />
                  <Select
                    label="Sort by"
                    value={sortBy}
                    onChange={(value) => setSortBy((value as typeof sortBy) ?? 'updated-desc')}
                    data={[
                      { value: 'updated-desc', label: 'Recently updated' },
                      { value: 'name-asc', label: 'Name A-Z' },
                      { value: 'name-desc', label: 'Name Z-A' },
                      { value: 'members-desc', label: 'Most members' },
                      { value: 'members-asc', label: 'Fewest members' },
                    ]}
                    className={classes.filterControl}
                    allowDeselect={false}
                  />
                </Group>

                {selectedTeamView === 'All' && allTeamsLoading ? (
                  <Text c="dimmed" size="sm">
                    Loading teams…
                  </Text>
                ) : null}

                {selectedTeamView === 'All' && allTeamsError ? (
                  <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />} radius="md">
                    {allTeamsError}
                  </Alert>
                ) : null}

                {!allTeamsLoading && filteredTeams.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    No teams match your search/filter.
                  </Text>
                ) : (
                  <Stack gap={0} className={classes.teamList}>
                    {filteredTeams.map(({ team, myRole, memberCount }) => {
                      const canEdit = isTeamOwner(team)
                      const roleLabel = myRole
                      const roleColor =
                        roleLabel === 'OWNER' ? 'brand' : roleLabel === 'ADMIN' ? 'brand' : 'gray'
                      return (
                        <Group key={team.id} className={classes.teamListItem} justify="space-between" align="center" wrap="wrap">
                          <Stack gap={2}>
                            <Text fw={600}>{team.name}</Text>
                            <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                              </Text>
                              {roleLabel ? (
                                <Badge variant="light" color={roleColor} size="sm">
                                  {roleLabel}
                                </Badge>
                              ) : null}
                            </Group>
                          </Stack>
                          {canEdit ? (
                            <Button
                              size="sm"
                              variant="light"
                              leftSection={<IconEdit size={14} />}
                              onClick={() => handleOpenTeamEditor(team.id)}
                            >
                              Edit
                            </Button>
                          ) : null}
                        </Group>
                      )
                    })}
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}

          {isCreateMode ? (
            <CreateModeLayout
              formValues={formValues}
              formErrors={formErrors}
              setField={setField}
              classes={classes}
            />
          ) : isEditingMode && selectedTeam && canManageSelectedTeam ? (
            <>
              <Group className={classes.editToolbar} justify="space-between" align="center" wrap="wrap">
                <Button
                  variant="subtle"
                  leftSection={<IconChevronLeft size={16} />}
                  onClick={handleBackToTeams}
                  className={classes.backToListButton}
                >
                  Back to team list
                </Button>
                <Text size="sm" c="dimmed">
                  Editing: {selectedTeam.name}
                </Text>
              </Group>
              <EditModeLayout
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                isCompactStepper={!!isCompactStepper}
                currentTeamName={selectedTeam.name ?? 'Team'}
                currentTeamId={selectedTeam.id ?? ''}
                canManage={true}
                formValues={editValues}
                setEditField={setEditField}
                onSaveProfile={() => void handleSaveEditClick()}
                savingEdit={savingEdit}
                classes={classes}
              />
            </>
          ) : isEditingMode && selectedTeam && !canManageSelectedTeam ? (
            <>
              <Group className={classes.editToolbar} justify="space-between" align="center" wrap="wrap">
                <Button
                  variant="subtle"
                  leftSection={<IconChevronLeft size={16} />}
                  onClick={handleBackToTeams}
                  className={classes.backToListButton}
                >
                  Back to team list
                </Button>
                <Text size="sm" c="dimmed">
                  {selectedTeam.name}
                </Text>
              </Group>
              <Alert variant="light" color="yellow" icon={<IconAlertCircle size={16} />} radius="md">
                You can only edit teams you own.
              </Alert>
            </>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  )
}

function CreateModeLayout({
  formValues,
  formErrors,
  setField,
  classes,
}: {
  formValues: any
  formErrors: any
  setField: (field: any, value: string) => void
  classes: Record<string, string>
}) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Paper className={classes.contentCard} p="lg">
        <Stack gap="md">
          <Group gap="xs">
            <IconBuildingSkyscraper size={18} />
            <Title order={3} className={classes.sectionTitle}>
              Team details
            </Title>
          </Group>

          <TextInput
            label="Team name"
            placeholder="Revenue Operations"
            value={formValues.name}
            error={formErrors.name}
            onChange={(e) => setField('name', e.currentTarget.value)}
            required
          />

          <TextInput
            label="Billing email (optional)"
            placeholder="billing@company.com"
            value={formValues.billingEmail}
            error={formErrors.billingEmail}
            onChange={(e) => setField('billingEmail', e.currentTarget.value)}
          />

          <Text size="sm" c="dimmed">
            You can invite members and assign a plan right after the team is created.
          </Text>
        </Stack>
      </Paper>

      <Paper className={classes.contentCard} p="lg">
        <Stack gap="md">
          <Group gap="xs">
            <IconMapPin size={18} />
            <Title order={3} className={classes.sectionTitle}>
              Billing address
            </Title>
            <Badge variant="light" color="gray">
              Optional
            </Badge>
          </Group>

          <TextInput
            label="Street address"
            placeholder="123 Main St"
            value={formValues.street}
            error={formErrors.street}
            onChange={(e) => setField('street', e.currentTarget.value)}
          />
          <Group grow align="flex-start">
            <TextInput
              label="City"
              placeholder="New York"
              value={formValues.city}
              error={formErrors.city}
              onChange={(e) => setField('city', e.currentTarget.value)}
            />
            <TextInput
              label="State / Province"
              placeholder="NY"
              value={formValues.stateProvince}
              error={formErrors.stateProvince}
              onChange={(e) => setField('stateProvince', e.currentTarget.value)}
            />
          </Group>
          <Group grow align="flex-start">
            <TextInput
              label="Postal code"
              placeholder="10001"
              value={formValues.postalCode}
              error={formErrors.postalCode}
              onChange={(e) => setField('postalCode', e.currentTarget.value)}
            />
            <TextInput
              label="Country"
              placeholder="United States"
              value={formValues.country}
              error={formErrors.country}
              onChange={(e) => setField('country', e.currentTarget.value)}
            />
          </Group>
        </Stack>
      </Paper>
    </SimpleGrid>
  )
}

function EditModeLayout({
  activeStep,
  setActiveStep,
  isCompactStepper,
  currentTeamName,
  currentTeamId,
  canManage,
  formValues,
  setEditField,
  onSaveProfile,
  savingEdit,
  classes,
}: {
  activeStep: number
  setActiveStep: (value: number) => void
  isCompactStepper: boolean
  currentTeamName: string
  currentTeamId: string
  canManage: boolean
  formValues: TeamEditValues
  setEditField: (field: keyof TeamEditValues, value: string) => void
  onSaveProfile: () => void
  savingEdit: boolean
  classes: Record<string, string>
}) {
  const maxStep = 3
  const profileIcon = <IconSettings size={16} />
  const membersIcon = <IconUsersGroup size={16} />
  const billingIcon = <IconMapPin size={16} />
  const subscriptionIcon = <IconCreditCard size={16} />

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2} className={classes.pageHeading}>
          {currentTeamName}
        </Title>
      </Stack>

      <Paper className={classes.stepperWrap} p="md">
        <Stepper
          active={activeStep}
          onStepClick={setActiveStep}
          allowNextStepsSelect
          orientation={isCompactStepper ? 'vertical' : 'horizontal'}
          size="sm"
          className={classes.stepper}
        >
          <Stepper.Step
            className={`${classes.stepItem} ${activeStep === 0 ? classes.stepCurrent : ''}`}
            icon={profileIcon}
            completedIcon={profileIcon}
            label="Profile"
            description="Team identity"
          />
          <Stepper.Step
            className={`${classes.stepItem} ${activeStep === 1 ? classes.stepCurrent : ''}`}
            icon={membersIcon}
            completedIcon={membersIcon}
            label="Members"
            description="Roster + invites"
          />
          <Stepper.Step
            className={`${classes.stepItem} ${activeStep === 2 ? classes.stepCurrent : ''}`}
            icon={billingIcon}
            completedIcon={billingIcon}
            label="Billing"
            description="Address + contact"
          />
          <Stepper.Step
            className={`${classes.stepItem} ${activeStep === 3 ? classes.stepCurrent : ''}`}
            icon={subscriptionIcon}
            completedIcon={subscriptionIcon}
            label="Subscription"
            description="Plans"
          />
        </Stepper>
      </Paper>

      {activeStep === 0 && (
        <Paper className={classes.contentCard} p="lg">
          <Stack gap="md">
            <Title order={3} className={classes.sectionTitle}>
              Team profile
            </Title>
            <Text c="dimmed" size="sm">
              Basic organization identity used across invitations, billing, and studio workflows.
            </Text>

            <TextInput
              label="Team name"
              placeholder="Revenue Operations"
              value={formValues.name}
              onChange={(e) => setEditField('name', e.currentTarget.value)}
              required
            />

            <TextInput
              label="Billing email"
              placeholder="billing@company.com"
              value={formValues.billingEmail}
              onChange={(e) => setEditField('billingEmail', e.currentTarget.value)}
            />

            <Group justify="space-between" wrap="wrap">
              <Text size="sm" c="dimmed">
                Manage the team profile used across invites and billing.
              </Text>
              <Button onClick={onSaveProfile} loading={savingEdit} disabled={!canManage}>
                Save profile
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {activeStep === 1 && (
        <Box>
          <TeamMembersPanel />
        </Box>
      )}

      {activeStep === 2 && (
        <Paper className={classes.contentCard} p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="xs">
                <IconMapPin size={18} />
                <Title order={3} className={classes.sectionTitle}>
                  Billing address
                </Title>
              </Group>
              <Badge variant="light" color="gray">
                Used for invoices
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TextInput
                label="Street address"
                placeholder="123 Main St"
                value={formValues.street}
                onChange={(e) => setEditField('street', e.currentTarget.value)}
              />
              <TextInput
                label="Country"
                placeholder="United States"
                value={formValues.country}
                onChange={(e) => setEditField('country', e.currentTarget.value)}
              />
              <TextInput
                label="City"
                placeholder="New York"
                value={formValues.city}
                onChange={(e) => setEditField('city', e.currentTarget.value)}
              />
              <TextInput
                label="State / Province"
                placeholder="NY"
                value={formValues.stateProvince}
                onChange={(e) => setEditField('stateProvince', e.currentTarget.value)}
              />
              <TextInput
                label="Postal code"
                placeholder="10001"
                value={formValues.postalCode}
                onChange={(e) => setEditField('postalCode', e.currentTarget.value)}
              />
            </SimpleGrid>

            <Group justify="flex-end">
              <Button onClick={onSaveProfile} loading={savingEdit} disabled={!canManage}>
                Save billing details
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {activeStep === 3 && currentTeamId && (
        <TeamSubscriptionPanel
          teamId={currentTeamId}
          teamName={currentTeamName}
          canManage={canManage}
        />
      )}

      <Group justify="space-between" wrap="wrap">
        <Button
          variant="default"
          leftSection={<IconChevronLeft size={16} />}
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
        >
          Back
        </Button>
        <Button
          rightSection={<IconChevronRight size={16} />}
          onClick={() => setActiveStep(Math.min(maxStep, activeStep + 1))}
          disabled={activeStep === maxStep}
        >
          Next
        </Button>
      </Group>
    </Stack>
  )
}
