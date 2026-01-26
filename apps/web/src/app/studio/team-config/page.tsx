'use client'

import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  SimpleGrid,
  Paper,
} from '@mantine/core'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuth } from '@/features/auth'
import { useCreateTeamForm } from '@/features/teams/hooks/useTeamForm'
import { TeamMembersPanel } from '@/components/ui/TeamMembersPanel'

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

  const { logout } = useAuth()
  const { currentTeam, updateTeam } = useTeams()
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

  return (
    <Paper p="xl" radius="md" shadow="xs" withBorder>
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

          <Stack gap="sm" mt="md">
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
        {!isCreateMode && (
          <Card withBorder radius="md" shadow="xs" p="lg">
            <TeamMembersPanel />
          </Card>
        )}
      </SimpleGrid>

      {/* Light-weight hint in create mode so we don't waste a full column */}
      {isCreateMode && (
        <Box
          mt="xl"
          p="md"
          style={{
            borderRadius: 8,
            background: 'var(--mantine-color-gray-0)',
            border: '1px solid var(--mantine-color-gray-3)',
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
