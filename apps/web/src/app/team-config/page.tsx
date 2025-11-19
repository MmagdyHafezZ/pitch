'use client'

import {
  Group,
  Button,
  Title,
  Paper,
  Text,
  Stack,
  Box,
  Divider,
  TextInput,
  Switch,
  SimpleGrid,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { useAuth } from '@/features/auth'

export default function TeamsPage() {
  const router = useRouter()
  const { logout } = useAuth()
  const [active, setActive] = useState('Team Config')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const {
    teams,
    currentTeam,
    activeTeamId,
    setActiveTeamId,
    updateTeam,
    deleteTeam,
    loading,
    error,
  } = useTeams()

  // local editable state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [billingEmail, setBillingEmail] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  // Whenever currentTeam changes, hydrate the form
  useEffect(() => {
    if (!currentTeam) return

    setName(currentTeam.name ?? '')
    setSlug(currentTeam.slug ?? '')
    setIsActive(currentTeam.isActive ?? true)
    setBillingEmail(currentTeam.billingEmail ?? '')

    const addr = currentTeam.billingAddress
    setStreet(addr?.street ?? '')
    setCity(addr?.city ?? '')
    setStateProvince(addr?.stateProvince ?? '')
    setPostalCode(addr?.postalCode ?? '')
    setCountry(addr?.country ?? '')
    setLocalError(null)
  }, [currentTeam])

  const handleSave = async () => {
    if (!currentTeam) return
    setLocalError(null)
    setSaving(true)

    try {
      await updateTeam(currentTeam.id, {
        name: name.trim() || currentTeam.name,
        slug: slug.trim() || undefined,
        isActive,
        billingEmail: billingEmail.trim() || null,
        billingAddress: {
          street,
          city,
          stateProvince,
          postalCode,
          country,
        },
      })
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentTeam) return
    const confirmed = window.confirm(
      `Are you sure you want to delete "${currentTeam.name}"? This cannot be undone.`
    )
    if (!confirmed) return

    setLocalError(null)
    setDeleting(true)

    try {
      await deleteTeam(currentTeam.id)
      router.push('/home')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to delete team')
    } finally {
      setDeleting(false)
    }
  }

  const hasTeam = !!currentTeam

  return (
    <AppLayout
      header={
        <AppTopBar
          onLogout={handleLogout}
          showSearch={false}
          teamName={currentTeam?.name ?? 'PITCH'}
          searchPlaceholder="Search"
        />
      }
      navbar={
        <Box h="100%" style={{ display: 'flex', flexDirection: 'row' }}>
          <TeamSideBar
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            activeTeamId={activeTeamId}
            onSelectTeam={setActiveTeamId}
          />
          <AppSidebar
            active={active}
            setActive={setActive}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </Box>
      }
    >
      <Box px="xl" py="lg">
        <Paper p="xl" radius="md" shadow="xs" withBorder>
          <Group justify="space-between" align="flex-start" mb="md">
            <Stack gap={4}>
              <Title order={2}>Team settings</Title>
              <Text size="sm" c="dimmed">
                Manage your team details, billing information, and ownership.
              </Text>
              {hasTeam && (
                <Text size="sm" fw={500}>
                  Current team: {currentTeam?.name}
                </Text>
              )}
            </Stack>

            <Group gap="xs">
              <Button variant="default" size="sm" onClick={() => router.push('/new-team')}>
                Create new team
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving || loading}
                disabled={!hasTeam}
              >
                Save changes
              </Button>
            </Group>
          </Group>

          {(error || localError) && (
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
                {localError || error}
              </Text>
            </Box>
          )}

          {!hasTeam ? (
            <Box p="lg" ta="center">
              <Text size="sm" c="dimmed">
                No team selected. Choose a team from the left sidebar or create a new one.
              </Text>
            </Box>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                {/* Team details + billing */}
                <Stack gap="lg">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={3}>Team details</Title>
                      <Text size="xs" c="dimmed">
                        ID: {currentTeam.id}
                      </Text>
                    </Group>

                    <TextInput
                      label="Team name"
                      placeholder="Team name"
                      value={name}
                      onChange={(e) => setName(e.currentTarget.value)}
                      required
                    />

                    <TextInput
                      label="Slug (optional)"
                      description="Used in URLs. Lowercase, numbers and dashes only."
                      placeholder="e.g. sales-enablement"
                      value={slug}
                      onChange={(e) => setSlug(e.currentTarget.value)}
                    />

                    <Switch
                      label="Team is active"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.currentTarget.checked)}
                    />

                    <TextInput
                      label="Billing email (optional)"
                      placeholder="billing@example.com"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.currentTarget.value)}
                    />
                  </Stack>

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
                      value={street}
                      onChange={(e) => setStreet(e.currentTarget.value)}
                    />
                    <Group grow>
                      <TextInput
                        label="City"
                        placeholder="Calgary"
                        value={city}
                        onChange={(e) => setCity(e.currentTarget.value)}
                      />
                      <TextInput
                        label="State / Province"
                        placeholder="AB"
                        value={stateProvince}
                        onChange={(e) => setStateProvince(e.currentTarget.value)}
                      />
                    </Group>
                    <Group grow>
                      <TextInput
                        label="Postal code"
                        placeholder="T2N 1N4"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Country"
                        placeholder="Canada"
                        value={country}
                        onChange={(e) => setCountry(e.currentTarget.value)}
                      />
                    </Group>
                  </Stack>
                </Stack>

                {/* Danger zone */}
                <Stack gap="lg">
                  <Box
                    p="lg"
                    style={{
                      borderRadius: 8,
                      border: '1px solid var(--mantine-color-red-3)',
                      background: 'var(--mantine-color-red-0)',
                    }}
                  >
                    <Stack gap="sm">
                      <Title order={3} c="red.7">
                        Danger zone
                      </Title>
                      <Text size="sm" c="red.7">
                        Deleting a team is permanent. All team memberships and related configuration
                        will be removed.
                      </Text>
                      <Divider my="sm" />
                      <Group justify="space-between" align="center">
                        <div>
                          <Text fw={500} size="sm">
                            Delete this team
                          </Text>
                          <Text size="xs" c="dimmed">
                            You will not be able to undo this action.
                          </Text>
                        </div>
                        <Button
                          color="red"
                          variant="filled"
                          onClick={handleDelete}
                          loading={deleting}
                        >
                          Delete team
                        </Button>
                      </Group>
                    </Stack>
                  </Box>
                </Stack>
              </SimpleGrid>
            </>
          )}
        </Paper>
      </Box>
    </AppLayout>
  )
}
