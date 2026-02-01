'use client'

import { useState, useEffect } from 'react'
import {
  Stepper,
  Button,
  Group,
  TextInput,
  Select,
  Stack,
  Box,
  Title,
  Text,
  Textarea,
  MultiSelect,
  Loader,
  Alert,
  NumberInput,
  Paper,
  Container,
  ActionIcon,
  Card,
  Avatar,
  SimpleGrid,
  Badge,
  Checkbox,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconArrowLeft,
  IconPlus,
  IconX,
  IconUser,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth'
import { useTeams } from '@/features/teams'
import { useSessions, type SessionType, type CreateSessionInput } from '@/features/sessions'
import { useTtsProviders } from '@/features/tts'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'

interface SessionConfigForm {
  multiTurnEnabled: boolean
  accent: string
  tone: string
  speechRate: string
  difficulty: number
  [key: string]: any
}

interface Persona {
  id: string
  name: string
  orgId: string
  traits: {
    role: string
    level: string
    personality: string
    voice?: {
      provider: string
      voiceName: string
      language: string
    }
  }
}

export default function CreateSessionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { teams, activeTeamId, fetchUserTeams, loading: teamsLoading } = useTeams()
  const { createSession, loading, error } = useSessions()
  const { providers: ttsProviders, loading: ttsLoading } = useTtsProviders()

  const [active, setActive] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [language, setLanguage] = useState('en-US')

  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personasLoading, setPersonasLoading] = useState(false)

  const [multiTurnEnabled, setMultiTurnEnabled] = useState(true)
  const [ttsProvider, setTtsProvider] = useState('elevenlabs')
  const [ttsVoice, setTtsVoice] = useState('Rachel')
  const [accent, setAccent] = useState('British')
  const [tone, setTone] = useState('Formal')
  const [speechRate, setSpeechRate] = useState('Normal')
  const [difficulty, setDifficulty] = useState(5)

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user?.id) {
      fetchUserTeams()
    }
  }, [user?.id, fetchUserTeams])

  useEffect(() => {
    if (activeTeamId && selectedTeamId === null) {
      setSelectedTeamId(activeTeamId)
    }
  }, [activeTeamId, selectedTeamId])

  useEffect(() => {
    const fetchPersonas = async () => {
      setPersonasLoading(true)
      try {
        const response = await api.personas.getAll()
        setPersonas(response.personas)
      } catch (err) {
        notifications.show({
          title: 'Warning',
          message: 'Failed to load personas. Using default options.',
          color: 'yellow',
        })
      } finally {
        setPersonasLoading(false)
      }
    }

    fetchPersonas()
  }, [])

  useEffect(() => {
    if (!ttsLoading && ttsProviders.length > 0 && !ttsVoice) {
      const provider = ttsProviders.find((p) => p.name === ttsProvider)
      if (provider && provider.voices.length > 0) {
        setTtsVoice(provider.voices[0])
      }
    }
  }, [ttsLoading, ttsProviders, ttsProvider, ttsVoice])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!sessionType) newErrors.sessionType = 'Session type is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(active)) {
      setActive((current) => (current < 3 ? current + 1 : current))
    }
  }

  const prevStep = () => {
    setActive((current) => (current > 0 ? current - 1 : current))
    setErrors({})
  }

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async () => {
    if (!user?.id) {
      notifications.show({
        title: 'Error',
        message: 'You must be logged in to create a session',
        color: 'red',
        icon: <IconAlertCircle />,
      })
      return
    }

    if (!sessionType) {
      notifications.show({
        title: 'Error',
        message: 'Session type is required',
        color: 'red',
        icon: <IconAlertCircle />,
      })
      return
    }

    setIsSubmitting(true)

    try {
      const sessionConfig: SessionConfigForm = {
        multiTurnEnabled,
        accent,
        tone,
        speechRate,
        difficulty,
      }

      if (sessionType === 'voice' || sessionType === 'video') {
        sessionConfig.ttsProvider = ttsProvider
        sessionConfig.ttsVoice = ttsVoice
      }

      if (!sessionType) {
        throw new Error('Session type is required')
      }

      const sessionData: CreateSessionInput = {
        orgId: selectedTeamId || user.id,
        name: sessionName.trim() || undefined,
        type: sessionType,
        tags: tags.length > 0 ? tags : undefined,
        language: language || undefined,
        personaId: selectedPersona ?? undefined,
        sessionConfig,
      }

      await createSession(sessionData)

      notifications.show({
        title: 'Success',
        message: 'Session created successfully!',
        color: 'green',
        icon: <IconCheck />,
      })

      router.push('/studio/sessions')
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to create session',
        color: 'red',
        icon: <IconAlertCircle />,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Container size="lg" py="xl">
      <Group mb="xl">
        <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/studio/sessions')}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={1}>Create New Session</Title>
      </Group>
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
          {error}
        </Alert>
      )}
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stepper active={active} onStepClick={setActive} mb="xl">
          <Stepper.Step label="Basic Info" description="Session details">
            <Stack gap="md" mt="xl">
              <Select
                label="Team (Optional)"
                placeholder={
                  teamsLoading
                    ? 'Loading teams...'
                    : 'Select a team or leave empty for personal session'
                }
                value={selectedTeamId === '' ? '' : selectedTeamId}
                onChange={(value) => {
                  setSelectedTeamId(value || '')
                }}
                data={[
                  { value: '', label: 'Personal Session (No Team)' },
                  ...teams.map((team) => ({
                    value: team.id,
                    label: team.name,
                  })),
                ]}
                description="Select a team to share this session, or create a personal session"
                disabled={teamsLoading}
                searchable
                clearable
              />

              <TextInput
                label="Session Name"
                placeholder="Give this session a name"
                value={sessionName}
                onChange={(event) => setSessionName(event.currentTarget.value)}
                description="Optional, but helpful for finding sessions later"
              />

              <Select
                label="Session Type"
                placeholder="Select type"
                value={sessionType}
                onChange={(value) => setSessionType(value)}
                data={[
                  { value: 'text', label: 'Text' },
                  { value: 'voice', label: 'Voice' },
                  { value: 'video', label: 'Video' },
                ]}
                error={errors.sessionType}
                required
                description="The type of simulation session"
              />

              <Box>
                <Text size="sm" fw={500} mb={4}>
                  Tags
                </Text>
                <Group gap="xs" mb="xs">
                  {tags.map((tag) => (
                    <Paper key={tag} px="sm" py={4} withBorder>
                      <Group gap={4}>
                        <Text size="sm">{tag}</Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => removeTag(tag)}
                        >
                          <IconX size={12} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  ))}
                </Group>
                <Group gap="xs">
                  <TextInput
                    placeholder="Add a tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button onClick={addTag} leftSection={<IconPlus size={16} />}>
                    Add
                  </Button>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Press Enter or click Add to add tags
                </Text>
              </Box>

              <Select
                label="Language"
                placeholder="Select language"
                value={language}
                onChange={(value) => setLanguage(value || 'en-US')}
                data={[
                  { value: 'en-US', label: 'English (US)' },
                  { value: 'en-GB', label: 'English (UK)' },
                  { value: 'es-ES', label: 'Spanish' },
                  { value: 'fr-FR', label: 'French' },
                  { value: 'de-DE', label: 'German' },
                ]}
                description="Language for the session"
              />
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="AI Persona" description="Select persona">
            <Stack gap="md" mt="xl">
              <Title order={3}>Select AI Persona</Title>
              <Text size="sm" c="dimmed">
                Choose the AI persona that will participate in this session
              </Text>

              {personasLoading ? (
                <Group justify="center" p="xl">
                  <Loader />
                  <Text c="dimmed">Loading personas...</Text>
                </Group>
              ) : personas.length === 0 ? (
                <Alert color="yellow" title="No personas available">
                  No personas found. Please contact support or try again later.
                </Alert>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                  {personas.map((persona) => {
                    const isSelected = selectedPersona === persona.id
                    return (
                      <Card
                        key={persona.id}
                        withBorder
                        padding="md"
                        radius="md"
                        style={{
                          cursor: 'pointer',
                          border: isSelected ? '2px solid var(--pitch-accent-strong)' : undefined,
                          backgroundColor: isSelected ? 'var(--pitch-accent-soft)' : undefined,
                        }}
                        onClick={() => {
                          setSelectedPersona(selectedPersona === persona.id ? null : persona.id)
                        }}
                      >
                        <Stack gap="xs" align="center">
                          <Box pos="relative">
                            <Avatar size={80} radius="md" color="brand">
                              <IconUser size={40} />
                            </Avatar>
                            {isSelected && (
                              <Box
                                style={{
                                  position: 'absolute',
                                  top: -8,
                                  right: -8,
                                  background: 'var(--pitch-accent-strong)',
                                  borderRadius: '50%',
                                  width: 24,
                                  height: 24,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <IconCheck size={16} color="white" />
                              </Box>
                            )}
                          </Box>
                          <Text fw={600} size="sm" ta="center">
                            {persona.name}
                          </Text>
                          <Badge size="xs" variant="light">
                            {persona.traits?.role || 'AI Assistant'}
                          </Badge>
                          <Text size="xs" c="dimmed" ta="center">
                            {persona.traits?.level || 'Expert'}
                          </Text>
                        </Stack>
                      </Card>
                    )
                  })}
                </SimpleGrid>
              )}

              {selectedPersona && (
                <Paper p="md" withBorder mt="md">
                  <Group>
                    <Text fw={500}>Selected Persona:</Text>
                    <Text c="dimmed">
                      {personas.find((p) => p.id === selectedPersona)?.name || selectedPersona}
                    </Text>
                  </Group>
                </Paper>
              )}
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Configuration" description="Session settings">
            <Stack gap="md" mt="xl">
              <Title order={3}>Session Configuration</Title>

              <Select
                label="Accent"
                value={accent}
                onChange={(value) => setAccent(value || 'British')}
                data={[
                  { value: 'British', label: 'British' },
                  { value: 'American', label: 'American' },
                  { value: 'Australian', label: 'Australian' },
                  { value: 'Canadian', label: 'Canadian' },
                ]}
                description="Voice accent for audio sessions"
              />

              <Select
                label="Tone"
                value={tone}
                onChange={(value) => setTone(value || 'Formal')}
                data={[
                  { value: 'Formal', label: 'Formal' },
                  { value: 'Casual', label: 'Casual' },
                  { value: 'Friendly', label: 'Friendly' },
                  { value: 'Professional', label: 'Professional' },
                ]}
                description="Conversation tone"
              />

              <Select
                label="Speech Rate"
                value={speechRate}
                onChange={(value) => setSpeechRate(value || 'Normal')}
                data={[
                  { value: 'Slow', label: 'Slow' },
                  { value: 'Normal', label: 'Normal' },
                  { value: 'Fast', label: 'Fast' },
                ]}
                description="Speaking speed for audio sessions"
              />

              {(sessionType === 'voice' || sessionType === 'video') && (
                <>
                  <Select
                    label="TTS Provider"
                    value={ttsProvider}
                    onChange={(value) => {
                      const newProvider = value || 'elevenlabs'
                      setTtsProvider(newProvider)
                      const provider = ttsProviders.find((p) => p.name === newProvider)
                      if (provider && provider.voices.length > 0) {
                        setTtsVoice(provider.voices[0])
                      } else {
                        setTtsVoice('')
                      }
                    }}
                    data={
                      ttsLoading
                        ? [{ value: 'elevenlabs', label: 'Loading...' }]
                        : ttsProviders.map((provider) => ({
                            value: provider.name,
                            label: provider.description || provider.name,
                          }))
                    }
                    description="Text-to-speech provider for voice sessions"
                    disabled={ttsLoading}
                  />

                  <Select
                    label="Voice"
                    value={ttsVoice}
                    onChange={(value) => setTtsVoice(value || '')}
                    data={
                      ttsProviders
                        .find((p) => p.name === ttsProvider)
                        ?.voices.map((voice) => ({
                          value: voice,
                          label: voice,
                        })) || []
                    }
                    description="Voice to use for speech synthesis"
                    searchable
                    disabled={!ttsProvider}
                  />
                </>
              )}

              <NumberInput
                label="Difficulty"
                value={difficulty}
                onChange={(value) => setDifficulty(Number(value))}
                min={1}
                max={10}
                description="Session difficulty level (1-10)"
              />

              <Select
                label="Multi-turn Enabled"
                value={multiTurnEnabled ? 'yes' : 'no'}
                onChange={(value) => setMultiTurnEnabled(value === 'yes')}
                data={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                description="Enable multiple conversation turns"
              />
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Review" description="Confirm details">
            <Stack gap="lg" mt="xl">
              <Title order={3}>Review Session Details</Title>

              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <Group justify="apart">
                    <Text fw={500}>Session Name:</Text>
                    <Text c="dimmed">{sessionName.trim() || 'Untitled session'}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Team:</Text>
                    <Text c="dimmed">
                      {selectedTeamId && selectedTeamId !== ''
                        ? teams.find((t) => t.id === selectedTeamId)?.name || selectedTeamId
                        : 'Personal Session'}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Type:</Text>
                    <Text c="dimmed">{sessionType || 'Not set'}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Language:</Text>
                    <Text c="dimmed">{language}</Text>
                  </Group>
                  {tags.length > 0 && (
                    <Box>
                      <Text fw={500} mb="xs">
                        Tags:
                      </Text>
                      <Group gap="xs">
                        {tags.map((tag) => (
                          <Paper key={tag} px="sm" py={4} withBorder>
                            <Text size="sm">{tag}</Text>
                          </Paper>
                        ))}
                      </Group>
                    </Box>
                  )}
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Title order={4} mb="md">
                  Configuration
                </Title>
                <Stack gap="xs">
                  <Group justify="apart">
                    <Text fw={500}>Multi-turn:</Text>
                    <Text c="dimmed">{multiTurnEnabled ? 'Enabled' : 'Disabled'}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Accent:</Text>
                    <Text c="dimmed">{accent}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Tone:</Text>
                    <Text c="dimmed">{tone}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Speech Rate:</Text>
                    <Text c="dimmed">{speechRate}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Difficulty:</Text>
                    <Text c="dimmed">{difficulty}/10</Text>
                  </Group>
                </Stack>
              </Paper>

              {selectedPersona && (
                <Paper p="md" withBorder>
                  <Title order={4} mb="md">
                    Selected Persona
                  </Title>
                  <Stack gap="xs">
                    <Badge size="lg" variant="filled">
                      {[
                        { id: 'persona_1', name: 'Sarah - Sales Expert' },
                        { id: 'persona_2', name: 'John - Product Manager' },
                        { id: 'persona_3', name: 'Maria - Customer Success' },
                        { id: 'persona_4', name: 'Alex - Technical Lead' },
                      ].find((p) => p.id === selectedPersona)?.name || selectedPersona}
                    </Badge>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={prevStep} disabled={active === 0}>
            Back
          </Button>

          {active < 3 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={isSubmitting || loading}
              leftSection={<IconCheck size={16} />}
            >
              Create Session
            </Button>
          )}
        </Group>
      </Paper>
    </Container>
  )
}
