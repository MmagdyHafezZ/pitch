'use client'

import {
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Avatar,
  ActionIcon,
  SimpleGrid,
  Badge,
} from '@mantine/core'
import { IconUserPlus, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppLayout } from '@/components/layout/AppLayout'
import { AppSidebar } from '@/components/ui/AppSideBar'
import { TeamSideBar } from '@/components/ui/TeamSideBar'
import { useTeams } from '@/features/teams/hooks/useTeams'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { useAuth } from '@/features/auth'
import { useCreateTeamForm } from '@/features/teams/hooks/useTeamForm'

export default function CreateTeamPage() {
  const router = useRouter()
  const { logout } = useAuth()
  const [active, setActive] = useState('new-team')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const { teams, currentTeam, activeTeamId, setActiveTeamId } = useTeams()

  const { values, errors, setField, submit, submitting, apiError } = useCreateTeamForm()

  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<{ id: string; email: string }[]>([])
  const [invites, setInvites] = useState<{ id: string; email: string }[]>([])

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const handleAddMember = () => {
    const email = memberQuery.trim()
    if (!email) return

    setInvites((prev) => [...prev, { id: `${Date.now()}-${email}`, email }])
    setMemberQuery('')
  }

  const handleRemoveInvite = (id: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const handleCreateClick = async () => {
    const ok = await submit()
    if (!ok) return
    router.push('/team-config')
  }

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
      <Box>
        <Group justify="space-between" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Create a new team</Title>
          </Stack>

          <Group gap="xs">
            <Button variant="default" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={handleCreateClick} loading={submitting}>
              Create team
            </Button>
          </Group>
        </Group>

        {apiError && (
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
              {apiError}
            </Text>
          </Box>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Left column – team details & billing */}
          <Stack gap="md">
            <Card
              shadow="xs"
              padding="lg"
              radius="md"
              withBorder
              style={{ borderColor: 'var(--mantine-color-gray-3)' }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={3}>Team details</Title>
                  <Text size="xs" c="dimmed">
                    Required
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Give your team a clear name and optional slug for URLs.
                </Text>

                <TextInput
                  label="Team name"
                  placeholder="e.g. Sales Team"
                  value={values.name}
                  error={errors.name}
                  onChange={(e) => setField('name', e.currentTarget.value)}
                  required
                />

                <TextInput
                  label="Billing email (optional)"
                  placeholder="billing@example.com"
                  value={values.billingEmail}
                  error={errors.billingEmail}
                  onChange={(e) => setField('billingEmail', e.currentTarget.value)}
                />
              </Stack>
            </Card>

            <Card
              shadow="xs"
              padding="lg"
              radius="md"
              withBorder
              style={{ borderColor: 'var(--mantine-color-gray-3)' }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={3}>Billing address</Title>
                  <Text size="xs" c="dimmed">
                    Optional
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Used for invoices and account communication. Leave blank if you don’t want to set
                  this yet.
                </Text>

                <TextInput
                  label="Street address"
                  placeholder="123 Main St"
                  value={values.street}
                  error={errors.street}
                  onChange={(e) => setField('street', e.currentTarget.value)}
                />
                <Group grow>
                  <TextInput
                    label="City"
                    placeholder="Calgary"
                    value={values.city}
                    error={errors.city}
                    onChange={(e) => setField('city', e.currentTarget.value)}
                  />
                  <TextInput
                    label="State / Province"
                    placeholder="AB"
                    value={values.stateProvince}
                    error={errors.stateProvince}
                    onChange={(e) => setField('stateProvince', e.currentTarget.value)}
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="Postal code"
                    placeholder="T2N 1N4"
                    value={values.postalCode}
                    error={errors.postalCode}
                    onChange={(e) => setField('postalCode', e.currentTarget.value)}
                  />
                  <TextInput
                    label="Country"
                    placeholder="Canada"
                    value={values.country}
                    error={errors.country}
                    onChange={(e) => setField('country', e.currentTarget.value)}
                  />
                </Group>
              </Stack>
            </Card>
          </Stack>

          {/* Right column – members & invitations */}
          <Card
            shadow="xs"
            padding="lg"
            radius="md"
            withBorder
            style={{ borderColor: 'var(--mantine-color-gray-3)' }}
          >
            <Stack gap="md">
              <Title order={3}>Team members</Title>
              <Text size="sm" c="dimmed">
                Add existing members or invite new collaborators by email. Invites will be sent
                after the team is created.
              </Text>

              <Group align="flex-end">
                <TextInput
                  label="Invite by email"
                  placeholder="name@example.com"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  leftSection={<IconUserPlus size={16} />}
                  onClick={handleAddMember}
                  variant="light"
                >
                  Invite
                </Button>
              </Group>

              {(members.length > 0 || invites.length > 0) && (
                <>
                  <Divider label="Current & invited members" labelPosition="left" />

                  <Stack gap="xs">
                    {members.map((m) => (
                      <Group key={m.id} justify="space-between" align="center" py={4}>
                        <Group gap="sm">
                          <Avatar radius="xl" size={28}>
                            {m.email[0]?.toUpperCase() ?? '?'}
                          </Avatar>
                          <div>
                            <Text size="sm">{m.email}</Text>
                            <Text size="xs" c="dimmed">
                              Member
                            </Text>
                          </div>
                        </Group>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          aria-label="Remove member"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    ))}

                    {invites.map((i) => (
                      <Group key={i.id} justify="space-between" align="center" py={4}>
                        <Group gap="sm">
                          <Avatar radius="xl" size={28}>
                            {i.email[0]?.toUpperCase() ?? '?'}
                          </Avatar>
                          <div>
                            <Group gap={6}>
                              <Text size="sm">{i.email}</Text>
                              <Badge size="xs" variant="light" color="yellow">
                                Pending invite
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed">
                              Will receive an email invitation once you create the team.
                            </Text>
                          </div>
                        </Group>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          aria-label="Remove invite"
                          onClick={() => handleRemoveInvite(i.id)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}

              {members.length === 0 && invites.length === 0 && (
                <Box
                  p="md"
                  style={{
                    borderRadius: 8,
                    background: 'var(--mantine-color-gray-0)',
                  }}
                >
                  <Text size="sm" c="dimmed">
                    No members added yet. Start by inviting people using their email address. You
                    can always add more members later from the team settings.
                  </Text>
                </Box>
              )}
            </Stack>
          </Card>
        </SimpleGrid>
      </Box>
    </AppLayout>
  )
}
