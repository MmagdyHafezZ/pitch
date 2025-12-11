'use client'

import { useState } from 'react'
import {
  Stepper,
  Button,
  Group,
  TextInput,
  Select,
  TagsInput,
  Tooltip,
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
import { IconX, IconSearch, IconInfoCircle, IconAlertCircle, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
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
  const [sessionNameError, setSessionNameError] = useState('')
  const [selectedPersonaIndex, setSelectedPersonaIndex] = useState(0)

  const personas = [
    { id: '1', name: 'John Doe', tech: 'Technical Knowledge: Expert', lang: 'Language: Expert' },
    { id: '2', name: 'Sarah Lin', tech: 'Technical Knowledge: Expert', lang: 'Language: Expert' },
    { id: '3', name: 'Joe Rogan', tech: 'Technical Knowledge: Expert', lang: 'Language: Expert' },
    { id: '4', name: 'Khabib Nurmagomedov', tech: 'Technical Knowledge: Expert', lang: 'Language: Expert' },
  ]
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

  const nextStep = () => {
    if (active === 0) {
      if (!sessionName.trim()) {
        setSessionNameError('Session name is required')
        return
      }
      setSessionNameError('')
    }
    setActive((current) => (current < 3 ? current + 1 : current))
  }
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current))

  const handleStepClick = (step: number) => {
    if (step < active) {
      setActive(step)
      return
    }
    if (active === 0 && step > 0) {
      if (!sessionName.trim()) {
        setSessionNameError('Session name is required')
        return
      }
      setSessionNameError('')
    }
    setActive(step)
  }

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
        <Stepper active={active} onStepClick={handleStepClick} size="lg" mb="xl">
          <Stepper.Step label="General Info" description="Basic details">
            <Stack gap="xl" mt="xl">
              <Box>
                <Group gap="xs" mb={8}>
                  <Text size="lg" fw={500}>Session Name <Text component="span" c="red">*</Text></Text>
                  <Tooltip label="Give your session a descriptive name that participants will recognize">
                    <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>
                <TextInput
                  placeholder="e.g., Q4 Sales Pitch Practice"
                  size="md"
                  value={sessionName}
                  onChange={(e) => {
                    setSessionName(e.target.value)
                    if (sessionNameError) setSessionNameError('')
                  }}
                  required
                  error={sessionNameError}
                />
              </Box>

              <Box>
                <Group gap="xs" mb={8}>
                  <Text size="lg" fw={500}>Due Date</Text>
                  <Tooltip label="The deadline by which participants should complete this session">
                    <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>
                <DatePickerInput
                  placeholder="Select a due date"
                  value={dueDate}
                  onChange={(value) => setDueDate(value ? new Date(value) : null)}
                  size="md"
                  clearable
                />
              </Box>

              <Box>
                <Group gap="xs" mb={8}>
                  <Text size="lg" fw={500}>Session Type</Text>
                  <Tooltip label="to be updated">
                    <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>
                <Select
                  placeholder="Select session type"
                  size="md"
                  data={[
                    { value: 'type1', label: 'Type 1' },
                    { value: 'type2', label: 'Type 2' },
                    { value: 'type3', label: 'Type 3' }
                  ]}
                  value={sessionType}
                  onChange={(val) => setSessionType(val || '')}
                />
              </Box>

              <Box>
                <Group gap="xs" mb={8}>
                  <Text size="lg" fw={500}>Tags</Text>
                  <Tooltip label="Add tags to categorize and organize your sessions">
                    <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>
                <TagsInput
                  placeholder="Select or type to add tags"
                  size="md"
                  data={['Sales', 'Marketing', 'Product', 'Onboarding', 'Training']}
                  value={tags}
                  onChange={setTags}
                  clearable
                />
              </Box>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Settings" description="Configuration">
            <Stack gap="xl" mt="xl">
              <Box>
                <Group gap="xs" mb={8}>
                  <Text size="lg" fw={500}>Select AI Persona</Text>
                  <Tooltip label="Choose the AI persona that will conduct the session">
                    <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>

                <Group justify="center" align="center" gap="md">
                  <Button
                    variant="subtle"
                    size="lg"
                    onClick={() => setSelectedPersonaIndex((prev) => (prev > 0 ? prev - 1 : personas.length - 1))}
                    style={{ padding: '0.5rem' }}
                  >
                    <IconChevronLeft size={32} />
                  </Button>

                  <Group gap="md" justify="center" style={{ overflow: 'hidden' }}>
                    {personas.map((persona, index) => {
                      const isSelected = index === selectedPersonaIndex
                      const distance = Math.abs(index - selectedPersonaIndex)
                      const isVisible = distance <= 1

                      if (!isVisible) return null

                      return (
                        <Card
                          key={persona.id}
                          withBorder
                          padding="md"
                          radius="md"
                          onClick={() => setSelectedPersonaIndex(index)}
                          style={{
                            cursor: 'pointer',
                            transform: isSelected ? 'scale(1.1)' : 'scale(0.85)',
                            opacity: isSelected ? 1 : 0.5,
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: 250,
                            minHeight: 250,

                          }}
                        >
                          <Stack gap="xs" align="center">
                            <Avatar size={isSelected ? 100 : 80} radius="md" color="gray" />
                            <Text fw={600} size={isSelected ? 'md' : 'sm'}>{persona.name}</Text>
                            {isSelected && (
                              <>
                                <Text size="xs" c="dimmed" ta="center">{persona.tech}</Text>
                                <Text size="xs" c="dimmed" ta="center">{persona.lang}</Text>
                              </>
                            )}
                          </Stack>
                        </Card>
                      )
                    })}
                  </Group>

                  <Button
                    variant="subtle"
                    size="lg"
                    onClick={() => setSelectedPersonaIndex((prev) => (prev < personas.length - 1 ? prev + 1 : 0))}
                    style={{ padding: '0.5rem' }}
                  >
                    <IconChevronRight size={32} />
                  </Button>
                </Group>

                <Group justify="center" gap="xs" mt="md">
                  {personas.map((_, index) => (
                    <Box
                      key={index}
                      onClick={() => setSelectedPersonaIndex(index)}
                      style={{
                        width: index === selectedPersonaIndex ? 12 : 8,
                        height: index === selectedPersonaIndex ? 12 : 8,
                        borderRadius: '50%',
                        backgroundColor: index === selectedPersonaIndex
                          ? 'var(--mantine-color-blue-6)'
                          : 'var(--mantine-color-gray-4)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </Group>
              </Box>

              <Title order={2} mt="xl">
                Configuration
              </Title>

              <SimpleGrid cols={2} spacing="xl">
                <Box>
                  <Group gap="xs" mb={8}>
                    <Text size="lg" fw={500}>Multi-turn Enabled</Text>
                    <Tooltip label="Enable back-and-forth conversation during the session">
                      <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Tooltip>
                  </Group>
                  <Switch
                    checked={multiTurnEnabled}
                    onChange={(e) => setMultiTurnEnabled(e.currentTarget.checked)}
                    size="lg"
                  />
                </Box>

                <Box>
                  <Group gap="xs" mb={8}>
                    <Text size="lg" fw={500}>Difficulty</Text>
                    <Tooltip label="Difficulty level of the session (1-10)">
                      <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Tooltip>
                  </Group>
                  <Slider
                    value={difficulty}
                    onChange={setDifficulty}
                    min={1}
                    max={10}
                    marks={[...Array(10)].map((_, i) => ({
                      value: i + 1,
                      label: (i + 1).toString(),
                    }))}
                    mt="md"
                  />
                </Box>

                <Box>
                  <Group gap="xs" mb={8}>
                    <Text size="lg" fw={500}>Language</Text>
                    <Tooltip label="Primary language for the session">
                      <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Tooltip>
                  </Group>
                  <Select
                    placeholder="Select language"
                    data={['English', 'Spanish', 'French']}
                    value={language}
                    onChange={(val) => setLanguage(val || '')}
                    size="md"
                  />
                </Box>

                <Box>
                  <Group gap="xs" mb={8}>
                    <Text size="lg" fw={500}>Accent</Text>
                    <Tooltip label="Select the accent for AI speech synthesis">
                      <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Tooltip>
                  </Group>
                  <Select
                    placeholder="Select accent"
                    data={['British', 'American', 'Australian']}
                    value={accent}
                    onChange={(val) => setAccent(val || '')}
                    size="md"
                  />
                </Box>

                <Box>
                  <Group gap="xs" mb={8}>
                    <Text size="lg" fw={500}>Speech Rate</Text>
                    <Tooltip label="How fast the AI speaks during the session">
                      <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Tooltip>
                  </Group>
                  <Select
                    placeholder="Select speech rate"
                    data={['Slow', 'Normal', 'Fast']}
                    value={speechRate}
                    onChange={(val) => setSpeechRate(val || '')}
                    size="md"
                  />
                </Box>

                <Box>
                  <Group gap="xs" mb={8}>
                    <Text size="lg" fw={500}>Tone</Text>
                    <Tooltip label="Conversational tone for the AI persona">
                      <IconInfoCircle size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Tooltip>
                  </Group>
                  <Select
                    placeholder="Select tone"
                    data={['Formal', 'Casual', 'Friendly']}
                    value={tone}
                    onChange={(val) => setTone(val || '')}
                    size="md"
                  />
                </Box>
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
