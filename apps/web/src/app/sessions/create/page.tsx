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
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconX, IconSearch, IconInfoCircle } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { AppTopBar } from '@/components/ui/AppTopBar'

const people = [
  { name: 'John Doe', email: 'john.doe16@ibm.com', sessions: 2, team: 'placeholder' },
  { name: 'Sarah Lin', email: 'sarah.lin@ibm.com', sessions: 1, team: 'placeholder' },
  { name: 'Joe Rogan', email: 'joe.rogan@ibm.com', sessions: 0, team: 'placeholder' },
  {
    name: 'Khabib Nurmagomedov',
    email: 'khabib.nurmagomedov@ibm.com',
    sessions: 3,
    team: 'placeholder',
  },
  { name: 'Lewis Hamilton', email: 'lewis.hamilton@ibm.com', sessions: 0, team: 'placeholder' },
]

export default function CreateSessionPage() {
  const router = useRouter()
  const [active, setActive] = useState(0)
  const [sessionName, setSessionName] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [sessionType, setSessionType] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedPeople, setSelectedPeople] = useState<string[]>([
    'John Doe',
    'Khabib Nurmagomedov',
    'Joe Rogan',
  ])
  const [assignToSelf, setAssignToSelf] = useState(true)
  const [multiTurnEnabled, setMultiTurnEnabled] = useState(true)
  const [language, setLanguage] = useState('English')
  const [accent, setAccent] = useState('British')
  const [tone, setTone] = useState('Formal')
  const [speechRate, setSpeechRate] = useState('Normal')
  const [difficulty, setDifficulty] = useState(5)

  const nextStep = () => setActive((current) => (current < 3 ? current + 1 : current))
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current))

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
                <TextInput
                  placeholder="Search by team or by person name"
                  leftSection={<IconSearch size={18} />}
                  style={{ flex: 1 }}
                />
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

              <Table striped highlightOnHover>
                <Table.Thead style={{ backgroundColor: 'var(--mantine-color-blue-6)' }}>
                  <Table.Tr>
                    <Table.Th style={{ color: 'white' }}>Name</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Email</Table.Th>
                    <Table.Th style={{ color: 'white' }}># of Assigned Sessions</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Team</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {people.map((person) => (
                    <Table.Tr key={person.email}>
                      <Table.Td>{person.name}</Table.Td>
                      <Table.Td>{person.email}</Table.Td>
                      <Table.Td>{person.sessions}</Table.Td>
                      <Table.Td>{person.team}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

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
                    <Table.Th style={{ color: 'white' }}># of Assigned Sessions</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Team</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {people
                    .filter((p) => selectedPeople.includes(p.name))
                    .map((person) => (
                      <Table.Tr key={person.email}>
                        <Table.Td>{person.name}</Table.Td>
                        <Table.Td>{person.email}</Table.Td>
                        <Table.Td>{person.sessions}</Table.Td>
                        <Table.Td>{person.team}</Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Stepper.Step>
        </Stepper>

        <Group justify="center" mt="xl">
          {active > 0 && (
            <Button variant="default" onClick={prevStep} size="lg">
              Back
            </Button>
          )}
          {active < 3 ? (
            <Button onClick={nextStep} size="lg" style={{ minWidth: 200 }}>
              Next
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/sessions/live')}
              size="lg"
              style={{ minWidth: 200 }}
            >
              Next
            </Button>
          )}
        </Group>
      </Box>
    </Box>
  )
}
