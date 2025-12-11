'use client'

import { useState } from 'react'
import {
  Stepper,
  Button,
  Group,
  TextInput,
  Select,
  Stack,
  Box,
  Title,
  Card,
  Text,
  Badge,
  Avatar,
  Table,
  Checkbox,
  Switch,
  Slider,
  SimpleGrid,
  Paper,
  Loader,
  Alert,
  Center,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconX, IconSearch, IconInfoCircle, IconAlertCircle } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { AppTopBar } from '@/components/ui/AppTopBar'
import { useUsers } from '@/features/sessions/hooks/useUsers'
import { useTeams } from '@/features/sessions/hooks/useTeams'
import { useCreateSession } from '@/features/sessions/hooks/useCreateSession'
import { useMemo } from 'react'


export default function CreateSessionPage() {
  const router = useRouter()
  const [active, setActive] = useState(0)
  const [sessionName, setSessionName] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [sessionType, setSessionType] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedPeople, setSelectedPeople] = useState<string[]>([])
  const [assignToSelf, setAssignToSelf] = useState(true)
  const [multiTurnEnabled, setMultiTurnEnabled] = useState(true)
  const [language, setLanguage] = useState('English')
  const [accent, setAccent] = useState('British')
  const [tone, setTone] = useState('Formal')
  const [speechRate, setSpeechRate] = useState('Normal')
  const [difficulty, setDifficulty] = useState(5)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null)
  const { data: users, isLoading: usersLoading, isError: usersError } = useUsers()
  const { data: teams } = useTeams()

  const teamMemberIds = useMemo(() => {
    if (!selectedTeamFilter || !teams) return null
    const team = teams.find((t) => t.id === selectedTeamFilter)
    if (!team) return null
    return new Set(team.memberships?.map((m) => m.user?.id).filter(Boolean) || [])
  }, [selectedTeamFilter, teams])

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter((user) => {
      const matchesSearch =
        !searchQuery ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesTeam = !teamMemberIds || teamMemberIds.has(user.id)

      return matchesSearch && matchesTeam
    })
  }, [users, searchQuery, teamMemberIds])

  const teamOptions = useMemo(() => {
    if (!teams) return []
    return teams.map((team) => ({ value: team.id, label: team.name }))
  }, [teams])

  const userTeamsMap = useMemo(() => {
    if (!teams) return new Map<string, string[]>()
    const map = new Map<string, string[]>()
    teams.forEach((team) => {
      team.memberships?.forEach((membership) => {
        if (membership.user?.id) {
          const existing = map.get(membership.user.id) || []
          existing.push(team.name)
          map.set(membership.user.id, existing)
        }
      })
    })
    return map
  }, [teams])

  const { mutate: createSession, isPending, isError: submitError, error } = useCreateSession()

  const nextStep = () => setActive((current) => (current < 3 ? current + 1 : current))
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current))

  const handleSubmit = () => {
    if (!dueDate) {
      alert('Please select a due date')
      return
    }

    createSession(
      {
        title: sessionName,
        dueDate: dueDate.toISOString(),
        type: sessionType,
        tags,
        assignedUserIds: selectedPeople,
        assignToSelf,
        config: {
          multiTurnEnabled,
          language,
          accent,
          tone,
          speechRate,
          difficulty,
        },
      },
      {
        onSuccess: (session) => {
          router.push(`/sessions/live/${session.id}`)
        },
      },
    )
  }

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AppTopBar showSearch={true} />
      <Box p="xl" style={{ flex: 1, overflow: 'auto' }}>
        <Stepper active={active} onStepClick={setActive} size="lg" mb="xl">
          <Stepper.Step label="General Info" description="Basic details">
            <Stack gap="xl" mt="xl">
              <TextInput
                label="Session Name:"
                placeholder="Placeholder text"
                size="md"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                styles={{ label: { fontSize: 18, fontWeight: 500, marginBottom: 8 } }}
              />

              <DatePickerInput
                label="Due Date:"
                placeholder="Pick date"
                value={dueDate}
                onChange={(value) => setDueDate(value ? new Date(value) : null)}
                size="md"
                rightSection={<IconX size={16} />}
                styles={{ label: { fontSize: 18, fontWeight: 500, marginBottom: 8 } }}
              />

              <Select
                label="Session Type:"
                placeholder="Placeholder text"
                size="md"
                data={['Type 1', 'Type 2', 'Type 3']}
                value={sessionType}
                onChange={(val) => setSessionType(val || '')}
                styles={{ label: { fontSize: 18, fontWeight: 500, marginBottom: 8 } }}
              />

              <Select
                label="Tags:"
                placeholder="Placeholder"
                size="md"
                data={['Tag 1', 'Tag 2', 'Tag 3']}
                styles={{ label: { fontSize: 18, fontWeight: 500, marginBottom: 8 } }}
              />

              <Group justify="center" mt={100}>
                <Text size="xl" c="dimmed">
                  • • •
                </Text>
              </Group>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Settings" description="Configuration">
            <Stack gap="xl" mt="xl">
              <SimpleGrid cols={4} spacing="lg">
                {[
                  {
                    name: 'John Doe',
                    tech: 'Technical Knowledge: Expert',
                    lang: 'Language: Expert',
                  },
                  {
                    name: 'Sarah Lin',
                    tech: 'Technical Knowledge: Expert',
                    lang: 'Language: Expert',
                  },
                  {
                    name: 'Joe Rogan',
                    tech: 'Technical Knowledge: Expert',
                    lang: 'Language: Expert',
                  },
                  {
                    name: 'Khabib Nurmagomedov',
                    tech: 'Technical Knowledge: Expert',
                    lang: 'Language: Expert',
                  },
                ].map((person) => (
                  <Card key={person.name} withBorder padding="md" radius="md">
                    <Stack gap="xs" align="center">
                      <Box pos="relative">
                        <Avatar size={100} radius="md" color="gray" />
                        <IconX
                          size={20}
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            background: 'black',
                            borderRadius: '50%',
                            padding: 2,
                            cursor: 'pointer',
                          }}
                        />
                      </Box>
                      <Text fw={600}>{person.name}</Text>
                      <Text size="xs" c="dimmed" ta="center">
                        {person.tech}
                      </Text>
                      <Text size="xs" c="dimmed" ta="center">
                        {person.lang}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>

              <Title order={2} mt="xl">
                Configuration
              </Title>

              <SimpleGrid cols={2} spacing="xl">
                <Group>
                  <IconInfoCircle size={20} />
                  <Text>Multi-turn enabled:</Text>
                  <Switch
                    checked={multiTurnEnabled}
                    onChange={(e) => setMultiTurnEnabled(e.currentTarget.checked)}
                    size="lg"
                  />
                </Group>

                <Group>
                  <IconInfoCircle size={20} />
                  <Text>Accent:</Text>
                  <Select
                    data={['British', 'American', 'Australian']}
                    value={accent}
                    onChange={(val) => setAccent(val || '')}
                    style={{ flex: 1 }}
                  />
                </Group>

                <Group>
                  <IconInfoCircle size={20} />
                  <Text>Language:</Text>
                  <Select
                    data={['English', 'Spanish', 'French']}
                    value={language}
                    onChange={(val) => setLanguage(val || '')}
                    style={{ flex: 1 }}
                  />
                </Group>

                <Group>
                  <IconInfoCircle size={20} />
                  <Text>Tone:</Text>
                  <Select
                    data={['Formal', 'Casual', 'Friendly']}
                    value={tone}
                    onChange={(val) => setTone(val || '')}
                    style={{ flex: 1 }}
                  />
                </Group>

                <Group>
                  <IconInfoCircle size={20} />
                  <Text>Speech Rate:</Text>
                  <Select
                    data={['Slow', 'Normal', 'Fast']}
                    value={speechRate}
                    onChange={(val) => setSpeechRate(val || '')}
                    style={{ flex: 1 }}
                  />
                </Group>

                <Group align="start">
                  <IconInfoCircle size={20} style={{ marginTop: 8 }} />
                  <Box style={{ flex: 1 }}>
                    <Text mb="xs">Difficulty:</Text>
                    <Slider
                      value={difficulty}
                      onChange={setDifficulty}
                      min={1}
                      max={10}
                      marks={[...Array(10)].map((_, i) => ({
                        value: i + 1,
                        label: (i + 1).toString(),
                      }))}
                    />
                  </Box>
                </Group>
              </SimpleGrid>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="People" description="Assign">
            <Stack gap="xl" mt="xl">
              <Group justify="space-between">
                <Group style={{ flex: 1 }} gap="md">
                  <TextInput
                    placeholder="Search by name or email"
                    leftSection={<IconSearch size={18} />}
                    style={{ flex: 1 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Select
                    placeholder="Filter by team"
                    data={teamOptions}
                    value={selectedTeamFilter}
                    onChange={setSelectedTeamFilter}
                    clearable
                    style={{ minWidth: 200 }}
                  />
                </Group>
                <Group>
                  <Checkbox
                    checked={assignToSelf}
                    onChange={(e) => setAssignToSelf(e.currentTarget.checked)}
                    label="Assign to yourself"
                  />
                  <Button variant="light" leftSection={<IconSearch size={18} />}>
                    Assignees ({selectedPeople.length})
                  </Button>
                </Group>
              </Group>

              {/* Loading State */}
              {usersLoading && (
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <Loader size="lg" />
                    <Text c="dimmed">Loading users...</Text>
                  </Stack>
                </Center>
              )}

              {/* Error State - Only for API errors */}
              {usersError && (
                <Alert
                  icon={<IconAlertCircle size={24} />}
                  title="Error Loading Users"
                  color="red"
                  variant="light"
                >
                  Failed to load users. Please try again later.
                </Alert>
              )}

              {/* Users Table - Show even when empty */}
              {!usersLoading && !usersError && (
                <Table striped highlightOnHover>
                  <Table.Thead style={{ backgroundColor: 'var(--mantine-color-blue-6)' }}>
                    <Table.Tr>
                      <Table.Th style={{ color: 'white' }}>Select</Table.Th>
                      <Table.Th style={{ color: 'white' }}>Name</Table.Th>
                      <Table.Th style={{ color: 'white' }}>Email</Table.Th>
                      <Table.Th style={{ color: 'white' }}>Team</Table.Th>
                      <Table.Th style={{ color: 'white' }}>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredUsers && filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <Table.Tr key={user.id}>
                          <Table.Td>
                            <Checkbox
                              checked={selectedPeople.includes(user.id)}
                              onChange={(e) => {
                                if (e.currentTarget.checked) {
                                  setSelectedPeople([...selectedPeople, user.id])
                                } else {
                                  setSelectedPeople(selectedPeople.filter((id) => id !== user.id))
                                }
                              }}
                            />
                          </Table.Td>
                          <Table.Td>{user.name}</Table.Td>
                          <Table.Td>{user.email}</Table.Td>
                          <Table.Td>
                            {userTeamsMap.get(user.id)?.join(', ') || <Text c="dimmed" size="sm">—</Text>}
                          </Table.Td>
                          <Table.Td>
                            <Badge color={user.isActive ? 'green' : 'gray'} variant="light">
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    ) : (
                      <Table.Tr>
                        <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                          <Text c="dimmed" size="sm">
                            {searchQuery || selectedTeamFilter
                              ? 'No users match your filters.'
                              : 'No people found in your organization.'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              )}

              <Text ta="center" mt="xl">
                Need to add someone? No problem add them{' '}
                <Text component="span" c="blue" style={{ cursor: 'pointer' }}>
                  here
                </Text>
              </Text>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Review" description="Confirm">
            <Stack gap="xl" mt="xl">
              <Title order={3}>Session Settings</Title>
              <SimpleGrid cols={1} spacing="md">
                {[1, 2, 3].map((i) => (
                  <Paper
                    key={i}
                    p="md"
                    withBorder
                    radius="md"
                    style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}
                  >
                    <Stack gap="xs">
                      <Box h={8} bg="gray.4" style={{ borderRadius: 4, width: '80%' }} />
                      <Box h={8} bg="gray.4" style={{ borderRadius: 4, width: '60%' }} />
                      <Box h={8} bg="gray.4" style={{ borderRadius: 4, width: '90%' }} />
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>

              <Title order={3} mt="xl">
                Persona Details
              </Title>
              <Card withBorder padding="lg" radius="md">
                <Group>
                  <Avatar size={100} radius="md" />
                  <Stack gap={4}>
                    <Text fw={600} size="lg">
                      Joe Rogan
                    </Text>
                    <Text size="sm" c="dimmed">
                      Technical Knowledge: Expert
                    </Text>
                    <Text size="sm" c="dimmed">
                      Language: Expert
                    </Text>
                  </Stack>
                </Group>
              </Card>

              <Title order={3} mt="xl">
                People Selected
              </Title>
              <Table striped>
                <Table.Thead style={{ backgroundColor: 'var(--mantine-color-blue-6)' }}>
                  <Table.Tr>
                    <Table.Th style={{ color: 'white' }}>Name</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Email</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users
                    ?.filter((u) => selectedPeople.includes(u.id))
                    .map((user) => (
                      <Table.Tr key={user.id}>
                        <Table.Td>{user.name}</Table.Td>
                        <Table.Td>{user.email}</Table.Td>
                        <Table.Td>
                          <Badge color={user.isActive ? 'green' : 'gray'} variant="light">
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Stepper.Step>
        </Stepper>

        {/* Submit Error Display */}
        {submitError && (
          <Alert
            icon={<IconAlertCircle size={24} />}
            title="Error Creating Session"
            color="red"
            variant="light"
            mt="xl"
          >
            {error?.message || 'Failed to create session. Please try again.'}
          </Alert>
        )}

        <Group justify="center" mt="xl">
          {active > 0 && (
            <Button variant="default" onClick={prevStep} size="lg" disabled={isPending}>
              Back
            </Button>
          )}
          {active < 3 ? (
            <Button onClick={nextStep} size="lg" style={{ minWidth: 200 }}>
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              size="lg"
              style={{ minWidth: 200 }}
              loading={isPending}
              disabled={isPending}
            >
              {isPending ? 'Creating Session...' : 'Create Session'}
            </Button>
          )}
        </Group>
      </Box>
    </Box>
  )
}
