'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
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
  IconMapPin,
  IconSettings,
  IconUsersGroup,
} from '@tabler/icons-react'
import { Space_Grotesk, Fraunces } from 'next/font/google'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuth } from '@/features/auth'
import { useTour } from '@/features/onboarding'
import { useCreateTeamForm } from '@/features/teams/hooks/useTeamForm'
import { TeamMembersPanel } from '@/components/ui/TeamMembersPanel'
import { TeamSubscriptionPanel } from '@/components/ui/TeamSubscriptionPanel'
import classes from './team-config.module.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap' })

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
  const isCompactStepper = useMediaQuery('(max-width: 900px)')
  const { startTour } = useTour()
  const autoStartedTourKeyRef = useRef<string | null>(null)

  const { user } = useAuth()
  const { currentTeam, updateTeam, loading, fetchTeamById } = useTeams()
  const { values, errors, setField, submit, submitting, apiError } = useCreateTeamForm()

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

  useEffect(() => {
    const startTourParam = searchParams.get('startTour')
    const tourScreenParam = searchParams.get('tourScreen')
    const key = `${startTourParam ?? ''}:${tourScreenParam ?? ''}`

    if (autoStartedTourKeyRef.current === key) {
      return
    }

    if (startTourParam === 'team-config') {
      const timer = setTimeout(() => {
        autoStartedTourKeyRef.current = key
        void startTour('team-config')
      }, 800)
      return () => clearTimeout(timer)
    }

    if (startTourParam === 'full' && tourScreenParam === 'team-config') {
      const timer = setTimeout(() => {
        autoStartedTourKeyRef.current = key
        void startTour('team-config', { mode: 'full' })
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [searchParams, startTour])

  useEffect(() => {
    if (!isCreateMode && currentTeam && !currentTeam.memberships?.length) {
      void fetchTeamById(currentTeam.id)
    }
  }, [currentTeam, fetchTeamById, isCreateMode])

  useEffect(() => {
    if (!isCreateMode && currentTeam) {
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
  }, [isCreateMode, currentTeam])

  const hasElevatedAccess = useMemo(() => {
    if (isCreateMode) return true
    if (!user || !currentTeam?.memberships?.length) return false

    const membership = currentTeam.memberships.find((m) => m.userId === user.id)
    return membership?.role === 'OWNER' || membership?.role === 'ADMIN'
  }, [currentTeam, isCreateMode, user])

  useEffect(() => {
    if (isCreateMode || loading) return
    if (!currentTeam) return
    if (!hasElevatedAccess) {
      router.replace('/studio/home')
    }
  }, [currentTeam, hasElevatedAccess, isCreateMode, loading, router])

  if (!isCreateMode && loading && !currentTeam) {
    return <div>Loading team configuration…</div>
  }

  if (!isCreateMode && currentTeam && !hasElevatedAccess) {
    return null
  }

  const formValues = isCreateMode ? values : editValues
  const formErrors = isCreateMode ? errors : ({} as typeof errors)
  const bannerError = isCreateMode ? apiError : editError
  const primaryLoading = isCreateMode ? submitting : savingEdit

  const setEditField = (field: keyof TeamEditValues, value: string) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }

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
      setActiveStep(0)
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
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update team')
    } finally {
      setSavingEdit(false)
    }
  }

  const pageTitle = 'Create a new team'
  const pageSubtitle =
    'Set up your team profile and billing details. Members and subscriptions can be managed after creation.'

  return (
    <Container size="xl" py="xl" className={classes.page}>
      <Paper className={classes.shell} p={{ base: 'md', sm: 'xl' }}>
        <Stack gap="lg">
          {isCreateMode && (
            <Paper
              data-tour-id="team-create-hero"
              className={classes.heroCard}
              p={{ base: 'md', sm: 'xl' }}
            >
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
                  <Title className={`${fraunces.className} ${classes.heroTitle}`} order={1}>
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

          {isCreateMode ? (
            <CreateModeLayout
              formValues={formValues}
              formErrors={formErrors}
              setField={setField}
              classes={classes}
              fontClass={spaceGrotesk.className}
            />
          ) : (
            <EditModeLayout
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              isCompactStepper={!!isCompactStepper}
              currentTeamName={currentTeam?.name ?? 'Team'}
              currentTeamId={currentTeam?.id ?? ''}
              canManage={hasElevatedAccess}
              formValues={editValues}
              setEditField={setEditField}
              onSaveProfile={() => void handleSaveEditClick()}
              savingEdit={savingEdit}
              classes={classes}
              fontClass={spaceGrotesk.className}
            />
          )}
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
  fontClass,
}: {
  formValues: any
  formErrors: any
  setField: (field: any, value: string) => void
  classes: Record<string, string>
  fontClass: string
}) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Paper data-tour-id="team-create-details" className={classes.contentCard} p="lg">
        <Stack gap="md">
          <Group gap="xs">
            <IconBuildingSkyscraper size={18} />
            <Title order={3} className={fontClass}>
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

      <Paper data-tour-id="team-create-billing" className={classes.contentCard} p="lg">
        <Stack gap="md">
          <Group gap="xs">
            <IconMapPin size={18} />
            <Title order={3} className={fontClass}>
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
  fontClass,
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
  fontClass: string
}) {
  const maxStep = 3
  const profileIcon = <IconSettings size={16} />
  const membersIcon = <IconUsersGroup size={16} />
  const billingIcon = <IconMapPin size={16} />
  const subscriptionIcon = <IconCreditCard size={16} />

  return (
    <Stack gap="lg">
      <Stack data-tour-id="team-config-header" gap={4}>
        <Title order={2} className={fontClass}>
          {currentTeamName}
        </Title>
      </Stack>

      <Paper data-tour-id="team-config-stepper" className={classes.stepperWrap} p="md">
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
        <Paper data-tour-id="team-profile-form" className={classes.contentCard} p="lg">
          <Stack gap="md">
            <Title order={3} className={fontClass}>
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
        <Box data-tour-id="team-members">
          <TeamMembersPanel />
        </Box>
      )}

      {activeStep === 2 && (
        <Paper data-tour-id="team-billing-form" className={classes.contentCard} p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="xs">
                <IconMapPin size={18} />
                <Title order={3} className={fontClass}>
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
        <Box data-tour-id="team-subscription">
          <TeamSubscriptionPanel
            teamId={currentTeamId}
            teamName={currentTeamName}
            canManage={canManage}
          />
        </Box>
      )}

      <Group data-tour-id="team-config-nav" justify="space-between" wrap="wrap">
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
