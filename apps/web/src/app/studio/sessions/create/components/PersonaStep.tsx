'use client'

import {
  Stack,
  Group,
  Box,
  Title,
  Text,
  Badge,
  Button,
  Loader,
  Alert,
  TextInput,
  ActionIcon,
  Avatar,
  ThemeIcon,
  Progress,
  Paper,
  Select,
} from '@mantine/core'
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconUser,
  IconHeart,
  IconBolt,
  IconSparkles,
  IconStar,
  IconPlayerPlay,
  IconPlayerPause,
} from '@tabler/icons-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Persona, PersonaTraits } from '../lib/types'
import { normalizeMetrics, getVoiceProfile, getRarityColor } from '../lib/helpers'
import classes from '../create-session.module.css'
import { ReactNode, RefObject, useEffect, useRef, useState } from 'react'
import type { TtsProvider } from '@/features/tts'
import { CreatePersonaModal } from './CreatePersonaModal'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'
import { PersonaProfileCard } from './PersonaProfileCard'
import type { SessionType } from '@/features/sessions'
import { PABLO_VIDEO_PRESENTER_PERSONA } from '../lib/videoPresenter'

export const metricIconMap: Record<string, ReactNode> = {
  empathy: <IconHeart size={12} />,
  assertiveness: <IconBolt size={12} />,
  creativity: <IconSparkles size={12} />,
  pacing: <IconStar size={12} />,
}

export const getMetricIcon = (label: string) => {
  const key = label.toLowerCase().replace(/\s+/g, '')
  return metricIconMap[key] ?? null
}

const resolveSignatureTraits = (traits: PersonaTraits | Record<string, unknown>): string[] => {
  const personaTraits = traits as Partial<PersonaTraits>
  const rawValue: unknown = personaTraits.signatureTraits ?? personaTraits.highlights ?? []

  if (Array.isArray(rawValue)) {
    return rawValue
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  if (typeof rawValue === 'string') {
    return rawValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

const resolvePersonaAvatarUrl = (
  traits: PersonaTraits | Record<string, unknown>
): string | undefined => {
  const personaTraits = traits as Partial<PersonaTraits>
  const avatar = personaTraits.avatar
  return typeof avatar?.imageUrl === 'string' && avatar.imageUrl.trim().length > 0
    ? avatar.imageUrl
    : undefined
}

interface PersonaStepProps {
  sessionType: SessionType | null
  personasLoading: boolean
  personas: Persona[]
  filteredPersonas: Persona[]
  personaSearch: string
  setPersonaSearch: (value: string) => void
  scrollPersona: (direction: 'left' | 'right') => void
  personaScrollRef: RefObject<HTMLDivElement | null>
  selectedPersona: string | null
  setSelectedPersona: (id: string | null) => void
  errors: Record<string, string>
  selectedPersonaData: Persona | null
  ttsProvider: string
  setTtsProvider: (value: string) => void
  ttsVoice: string
  setTtsVoice: (value: string) => void
  ttsModel?: string | null
  ttsProviders: TtsProvider[]
  onCreatePersona: (input: { name: string; traits: PersonaTraits }) => Promise<Persona>
  createDisabledReason?: string | null
}

export function PersonaStep({
  sessionType,
  personasLoading,
  personas,
  filteredPersonas,
  personaSearch,
  setPersonaSearch,
  scrollPersona,
  personaScrollRef,
  selectedPersona,
  setSelectedPersona,
  errors,
  selectedPersonaData,
  ttsProvider,
  setTtsProvider,
  ttsVoice,
  setTtsVoice,
  ttsModel = null,
  ttsProviders,
  onCreatePersona,
  createDisabledReason,
}: PersonaStepProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [previewLoadingPersonaId, setPreviewLoadingPersonaId] = useState<string | null>(null)
  const [playingPersonaId, setPlayingPersonaId] = useState<string | null>(null)
  const [infoPersonaId, setInfoPersonaId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const visiblePersonas = filteredPersonas.filter((persona) => persona.id !== selectedPersona)
  const isVideoSession = sessionType === 'video'

  const formatProviderLabel = (providerName: string) => {
    const normalized = providerName.trim().toLowerCase()
    if (normalized === 'elevenlabs') return 'ElevenLabs'
    if (normalized === 'openai') return 'OpenAI'
    if (normalized === 'melotts') return 'MeloTTS'
    if (!normalized) return 'Voice'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.src = ''
      previewAudioRef.current = null
    }
    clearPreviewUrl()
    setPlayingPersonaId(null)
  }

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.src = ''
        previewAudioRef.current = null
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  if (isVideoSession) {
    const presenter = PABLO_VIDEO_PRESENTER_PERSONA
    const pabloVoicePreviewId = 'video-presenter-pablo-preview'
    const presenterTraits = (presenter.traits ?? {}) as PersonaTraits
    const presenterMetrics = normalizeMetrics(presenterTraits)
    const presenterSignatureTraits = resolveSignatureTraits(presenterTraits)
    const selectedProvider =
      ttsProviders.find((provider) => provider.name === ttsProvider) ?? ttsProviders[0] ?? null
    const providerOptions = ttsProviders.map((provider) => ({
      value: provider.name,
      label: formatProviderLabel(provider.name),
    }))
    const voiceOptions = (selectedProvider?.voices ?? []).map((voice) => ({
      value: voice,
      label: voice,
    }))
    const selectedVoice =
      selectedProvider?.voices.includes(ttsVoice) === true
        ? ttsVoice
        : (selectedProvider?.voices[0] ?? ttsVoice)
    const canPreviewPabloVoice = Boolean(selectedProvider?.name && selectedVoice)
    const isPreviewLoading = previewLoadingPersonaId === pabloVoicePreviewId
    const isPreviewPlaying = playingPersonaId === pabloVoicePreviewId
    const presenterVoiceProfile =
      selectedProvider?.name && selectedVoice
        ? `${formatProviderLabel(selectedProvider.name)} / ${selectedVoice}`
        : getVoiceProfile(presenterTraits)
    const presenterArchetype = presenterTraits.archetype ?? presenterTraits.role ?? 'Persona'
    const presenterRarity = presenterTraits.rarity ?? 'Locked'
    const presenterRarityColor = getRarityColor(presenterRarity, presenterTraits.rarityColor)
    const presenterImageUrl = resolvePersonaAvatarUrl(presenterTraits)

    return (
      <LayoutGroup>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Box>
              <Title order={3}>Select AI Persona</Title>
              <Text size="sm" c="dimmed">
                Match the persona to your training scenario.
              </Text>
            </Box>
          </Group>

          <Stack gap="lg">
            <Box className={classes.personaCarousel}>
              <motion.div
                ref={personaScrollRef}
                className={classes.personaTrack}
                layoutScroll
                style={{ justifyContent: 'center' }}
              >
                <motion.div
                  key={presenter.id}
                  layout="position"
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 160, scale: 0.88 }}
                  transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                  style={{ flexShrink: 0 }}
                >
                  <PersonaProfileCard
                    persona={presenter}
                    avatarUrl={presenterImageUrl}
                    archetype={presenterArchetype}
                    rarity={presenterRarity}
                    rarityColor={presenterRarityColor}
                    voiceProfile={presenterVoiceProfile}
                    metrics={presenterMetrics}
                    signatureTraits={presenterSignatureTraits}
                    isPreviewLoading={false}
                    isPreviewPlaying={false}
                    infoOpen={infoPersonaId === presenter.id}
                    onInfoToggle={() => {
                      setInfoPersonaId((current) =>
                        current === presenter.id ? null : presenter.id
                      )
                    }}
                    onPreviewAudio={() => undefined}
                    onSelect={() => {
                      setInfoPersonaId(null)
                    }}
                  />
                </motion.div>
              </motion.div>
            </Box>

            <div className={classes.personaDropzone}>
              <motion.div
                key={presenter.id}
                initial={{ opacity: 0, y: -80, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.96 }}
                transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
              >
                <Paper
                  withBorder
                  radius="xl"
                  p="lg"
                  className={`${classes.personaPreview} ${classes.personaSelectedCard}`}
                >
                  <Stack gap="md">
                    <Group align="center" className={classes.personaPreviewHeader}>
                      <Avatar size={72} radius="lg" src={presenterImageUrl}>
                        <IconUser size={34} />
                      </Avatar>
                      <Stack gap={2}>
                        <Text fw={700}>{presenter.name}</Text>
                        <Text size="xs" c="dimmed">
                          {presenterTraits.role ?? 'AI Persona'} ·{' '}
                          {presenterTraits.level ?? 'Expert'}
                        </Text>
                        <Group gap={6}>
                          <Badge size="xs" variant="light">
                            {presenterArchetype}
                          </Badge>
                          <Badge size="xs" variant="outline" color={presenterRarityColor}>
                            {presenterRarity}
                          </Badge>
                        </Group>
                      </Stack>
                    </Group>

                    {presenterTraits.personality && (
                      <Text size="sm" c="dimmed" className={classes.personaPreviewBio}>
                        {presenterTraits.personality}
                      </Text>
                    )}

                    <Box className={classes.personaPreviewBlock}>
                      <Text size="xs" fw={600}>
                        Voice Profile
                      </Text>
                      <Text size="sm" c="dimmed">
                        {presenterVoiceProfile}
                      </Text>
                      {selectedProvider?.name && (
                        <Text size="xs" c="dimmed">
                          Provider: {selectedProvider.name}
                        </Text>
                      )}
                      {selectedVoice && (
                        <Text size="xs" c="dimmed">
                          Voice: {selectedVoice}
                        </Text>
                      )}
                      {presenterTraits.voice?.language && (
                        <Text size="xs" c="dimmed">
                          Accent: {presenterTraits.voice.language}
                        </Text>
                      )}
                      <Stack gap={8} mt="sm">
                        <Text size="xs" c="dimmed">
                          Pablo is locked as the persona, but you can change his voice for this
                          session.
                        </Text>
                        <Button
                          size="xs"
                          variant={isPreviewPlaying ? 'filled' : 'light'}
                          color={isPreviewPlaying ? 'red' : 'brand'}
                          loading={isPreviewLoading}
                          leftSection={
                            isPreviewPlaying ? (
                              <IconPlayerPause size={14} />
                            ) : (
                              <IconPlayerPlay size={14} />
                            )
                          }
                          disabled={!canPreviewPabloVoice}
                          onClick={async () => {
                            if (!canPreviewPabloVoice || !selectedProvider?.name || !selectedVoice)
                              return

                            if (isPreviewPlaying) {
                              stopPreviewAudio()
                              return
                            }

                            setPreviewLoadingPersonaId(pabloVoicePreviewId)
                            stopPreviewAudio()

                            try {
                              const audioBlob = await api.tts.speak({
                                text: "Let's start the session. Tell me your opening pitch in one minute.",
                                provider: selectedProvider.name,
                                voice: selectedVoice,
                                ...(ttsModel ? { model: ttsModel } : {}),
                              })
                              const objectUrl = URL.createObjectURL(audioBlob)
                              previewUrlRef.current = objectUrl

                              const audio = new Audio(objectUrl)
                              previewAudioRef.current = audio
                              audio.onended = () => {
                                setPlayingPersonaId(null)
                                clearPreviewUrl()
                              }
                              audio.onerror = () => {
                                setPlayingPersonaId(null)
                                clearPreviewUrl()
                              }

                              await audio.play()
                              setPlayingPersonaId(pabloVoicePreviewId)
                            } catch (error) {
                              notifications.show({
                                title: 'Voice preview unavailable',
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : 'Unable to generate Pablo voice preview.',
                                color: 'red',
                              })
                            } finally {
                              setPreviewLoadingPersonaId((current) =>
                                current === pabloVoicePreviewId ? null : current
                              )
                            }
                          }}
                        >
                          {isPreviewPlaying ? 'Stop voice' : 'Test voice'}
                        </Button>
                        <Select
                          label="Voice provider"
                          data={providerOptions}
                          value={selectedProvider?.name ?? null}
                          onChange={(value) => {
                            if (!value) return
                            setTtsProvider(value)
                            const provider = ttsProviders.find((entry) => entry.name === value)
                            if (!provider || provider.voices.length === 0) return
                            if (!provider.voices.includes(ttsVoice)) {
                              setTtsVoice(provider.voices[0] ?? '')
                            }
                          }}
                          disabled={providerOptions.length === 0}
                          searchable
                          nothingFoundMessage="No providers"
                        />
                        <Select
                          label="Voice"
                          data={voiceOptions}
                          value={selectedVoice || null}
                          onChange={(value) => {
                            if (!value) return
                            setTtsVoice(value)
                          }}
                          disabled={voiceOptions.length === 0}
                          searchable
                          nothingFoundMessage="No voices"
                        />
                      </Stack>
                    </Box>

                    <Box className={classes.personaPreviewBlock}>
                      <Text size="xs" fw={600}>
                        Signature Traits
                      </Text>
                      {presenterSignatureTraits.length > 0 ? (
                        <Group gap={6} mt={6}>
                          {presenterSignatureTraits.map((trait) => (
                            <Badge key={trait} size="xs" variant="light" color="gray">
                              {trait}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed" mt={6}>
                          No signature traits configured.
                        </Text>
                      )}
                    </Box>

                    <Box className={classes.personaPreviewBlock}>
                      <Text size="xs" fw={600}>
                        Comparison Metrics
                      </Text>
                      {presenterMetrics.length > 0 ? (
                        <Stack gap="xs" mt="xs">
                          {presenterMetrics.map((metric) => (
                            <Box key={metric.label} className={classes.personaMetric}>
                              <Group justify="space-between" align="center" mb={4}>
                                <Group gap={6}>
                                  <ThemeIcon size="xs" variant="light">
                                    {getMetricIcon(metric.label) ?? <IconStar size={12} />}
                                  </ThemeIcon>
                                  <Text size="xs">{metric.label}</Text>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {metric.value}
                                </Text>
                              </Group>
                              <Progress value={metric.value} size="xs" radius="xl" />
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Text size="xs" c="dimmed" mt={6}>
                          No metrics configured for this persona yet.
                        </Text>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </motion.div>
            </div>
          </Stack>

          {errors.persona && (
            <Text c="red" size="sm">
              {errors.persona}
            </Text>
          )}
        </Stack>
      </LayoutGroup>
    )
  }

  const handlePreviewAudio = async (persona: Persona) => {
    if (playingPersonaId === persona.id) {
      stopPreviewAudio()
      return
    }

    setPreviewLoadingPersonaId(persona.id)
    stopPreviewAudio()

    try {
      const audioBlob = await api.personas.getPreviewAudio(persona.id)
      const objectUrl = URL.createObjectURL(audioBlob)
      previewUrlRef.current = objectUrl

      const audio = new Audio(objectUrl)
      previewAudioRef.current = audio
      audio.onended = () => {
        setPlayingPersonaId(null)
        clearPreviewUrl()
      }
      audio.onerror = () => {
        setPlayingPersonaId(null)
        clearPreviewUrl()
      }

      await audio.play()
      setPlayingPersonaId(persona.id)
    } catch (error) {
      notifications.show({
        title: 'Preview unavailable',
        message: error instanceof Error ? error.message : 'Unable to load persona preview audio.',
        color: 'red',
      })
    } finally {
      setPreviewLoadingPersonaId((current) => (current === persona.id ? null : current))
    }
  }

  if (personasLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
        <Text c="dimmed">Loading personas...</Text>
      </Group>
    )
  }

  if (personas.length === 0) {
    return (
      <Stack gap="md">
        <Alert color="yellow" title="No personas available">
          No personas found yet. Create one to continue.
        </Alert>
        <Button
          variant="light"
          onClick={() => setCreateModalOpen(true)}
          disabled={Boolean(createDisabledReason)}
        >
          Create Persona Here
        </Button>
        <CreatePersonaModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreatePersona={onCreatePersona}
          ttsProviders={ttsProviders}
          createDisabledReason={createDisabledReason}
        />
      </Stack>
    )
  }

  return (
    <LayoutGroup>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={3}>Select AI Persona</Title>
            <Text size="sm" c="dimmed">
              Match the persona to your training scenario.
            </Text>
          </Box>
          <Group gap="sm">
            {selectedPersona && (
              <Badge size="lg" variant="light">
                Persona selected
              </Badge>
            )}
            <Button variant="light" onClick={() => setCreateModalOpen(true)}>
              Create Persona Here
            </Button>
          </Group>
        </Group>

        <Stack gap="lg">
          <TextInput
            value={personaSearch}
            onChange={(event: { currentTarget: { value: string } }) =>
              setPersonaSearch(event.currentTarget.value)
            }
            placeholder="Search personas by name, role, or archetype"
            leftSection={<IconSearch size={16} />}
          />
          <Box className={classes.personaCarousel}>
            <ActionIcon
              variant="light"
              size="lg"
              className={`${classes.personaArrow} ${classes.personaArrowLeft}`}
              onClick={() => scrollPersona('left')}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              size="lg"
              className={`${classes.personaArrow} ${classes.personaArrowRight}`}
              onClick={() => scrollPersona('right')}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
            <motion.div ref={personaScrollRef} className={classes.personaTrack} layoutScroll>
              <AnimatePresence mode="popLayout">
                {visiblePersonas.length === 0 ? (
                  <Box className={classes.personaEmptyInline}>
                    <Text size="sm" c="dimmed">
                      {selectedPersonaData
                        ? 'Your selected persona is shown below. Adjust the search or create another persona to compare more options.'
                        : 'No personas match your search.'}
                    </Text>
                  </Box>
                ) : (
                  visiblePersonas.map((persona) => {
                    const traits = persona.traits ?? {}
                    const metrics = normalizeMetrics(traits)
                    const signatureTraits = resolveSignatureTraits(traits)
                    const voiceProfile = getVoiceProfile(traits)
                    const archetype = traits.archetype ?? traits.role ?? 'Persona'
                    const rarity = traits.rarity ?? 'Standard'
                    const rarityColor = getRarityColor(rarity, traits.rarityColor)
                    const avatarUrl = resolvePersonaAvatarUrl(traits)
                    const isPreviewLoading = previewLoadingPersonaId === persona.id
                    const isPreviewPlaying = playingPersonaId === persona.id

                    return (
                      <motion.div
                        key={persona.id}
                        layout="position"
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 160, scale: 0.88 }}
                        transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                        style={{ flexShrink: 0 }}
                      >
                        <PersonaProfileCard
                          persona={persona}
                          avatarUrl={avatarUrl}
                          archetype={archetype}
                          rarity={rarity}
                          rarityColor={rarityColor}
                          voiceProfile={voiceProfile}
                          metrics={metrics}
                          signatureTraits={signatureTraits}
                          isPreviewLoading={isPreviewLoading}
                          isPreviewPlaying={isPreviewPlaying}
                          infoOpen={infoPersonaId === persona.id}
                          onInfoToggle={() => {
                            setInfoPersonaId((current) =>
                              current === persona.id ? null : persona.id
                            )
                          }}
                          onPreviewAudio={() => {
                            void handlePreviewAudio(persona)
                          }}
                          onSelect={() => {
                            setInfoPersonaId(null)
                            setSelectedPersona(persona.id)
                          }}
                        />
                      </motion.div>
                    )
                  })
                )}
              </AnimatePresence>
            </motion.div>
          </Box>

          <div className={classes.personaDropzone}>
            <AnimatePresence mode="wait">
              {selectedPersonaData ? (
                (() => {
                  const traits = (selectedPersonaData.traits ?? {}) as PersonaTraits
                  const metrics = normalizeMetrics(traits)
                  const signatureTraits = resolveSignatureTraits(traits)
                  const voiceProfile = getVoiceProfile(traits)
                  const archetype = traits.archetype ?? traits.role ?? 'Persona'
                  const rarity = traits.rarity ?? 'Standard'
                  const rarityColor = getRarityColor(rarity, traits.rarityColor)
                  const avatarUrl = resolvePersonaAvatarUrl(traits)
                  const isPreviewLoading = previewLoadingPersonaId === selectedPersonaData.id
                  const isPreviewPlaying = playingPersonaId === selectedPersonaData.id

                  return (
                    <motion.div
                      key={selectedPersonaData.id}
                      initial={{ opacity: 0, y: -80, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 40, scale: 0.96 }}
                      transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <Paper
                        withBorder
                        radius="xl"
                        p="lg"
                        className={`${classes.personaPreview} ${classes.personaSelectedCard}`}
                        onClick={() => setSelectedPersona(null)}
                      >
                        <Stack gap="md">
                          <Group align="center" className={classes.personaPreviewHeader}>
                            <Avatar size={72} radius="lg" src={avatarUrl}>
                              <IconUser size={34} />
                            </Avatar>
                            <Stack gap={2}>
                              <Text fw={700}>{selectedPersonaData.name}</Text>
                              <Text size="xs" c="dimmed">
                                {traits.role ?? 'AI Persona'} · {traits.level ?? 'Expert'}
                              </Text>
                              <Group gap={6}>
                                <Badge size="xs" variant="light">
                                  {archetype}
                                </Badge>
                                <Badge size="xs" variant="outline" color={rarityColor}>
                                  {rarity}
                                </Badge>
                                <Button
                                  size="xs"
                                  variant={isPreviewPlaying ? 'filled' : 'light'}
                                  color={isPreviewPlaying ? 'red' : 'brand'}
                                  loading={isPreviewLoading}
                                  leftSection={
                                    isPreviewPlaying ? (
                                      <IconPlayerPause size={14} />
                                    ) : (
                                      <IconPlayerPlay size={14} />
                                    )
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handlePreviewAudio(selectedPersonaData)
                                  }}
                                >
                                  {isPreviewPlaying ? 'Stop voice' : 'Play voice'}
                                </Button>
                              </Group>
                            </Stack>
                          </Group>

                          {traits.personality && (
                            <Text size="sm" c="dimmed" className={classes.personaPreviewBio}>
                              {traits.personality}
                            </Text>
                          )}

                          <Box className={classes.personaPreviewBlock}>
                            <Text size="xs" fw={600}>
                              Voice Profile
                            </Text>
                            <Text size="sm" c="dimmed">
                              {voiceProfile}
                            </Text>
                            {traits.voice?.provider && (
                              <Text size="xs" c="dimmed">
                                Provider: {traits.voice.provider}
                              </Text>
                            )}
                            {traits.voice?.voiceName && (
                              <Text size="xs" c="dimmed">
                                Voice: {traits.voice.voiceName}
                              </Text>
                            )}
                            {traits.voice?.language && (
                              <Text size="xs" c="dimmed">
                                Accent: {traits.voice.language}
                              </Text>
                            )}
                          </Box>

                          <Box className={classes.personaPreviewBlock}>
                            <Text size="xs" fw={600}>
                              Signature Traits
                            </Text>
                            {signatureTraits.length > 0 ? (
                              <Group gap={6} mt={6}>
                                {signatureTraits.map((trait) => (
                                  <Badge key={trait} size="xs" variant="light" color="gray">
                                    {trait}
                                  </Badge>
                                ))}
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed" mt={6}>
                                No signature traits configured.
                              </Text>
                            )}
                          </Box>

                          <Box className={classes.personaPreviewBlock}>
                            <Text size="xs" fw={600}>
                              Comparison Metrics
                            </Text>
                            {metrics.length > 0 ? (
                              <Stack gap="xs" mt="xs">
                                {metrics.map((metric) => (
                                  <Box key={metric.label} className={classes.personaMetric}>
                                    <Group justify="space-between" align="center" mb={4}>
                                      <Group gap={6}>
                                        <ThemeIcon size="xs" variant="light">
                                          {getMetricIcon(metric.label) ?? <IconStar size={12} />}
                                        </ThemeIcon>
                                        <Text size="xs">{metric.label}</Text>
                                      </Group>
                                      <Text size="xs" c="dimmed">
                                        {metric.value}
                                      </Text>
                                    </Group>
                                    <Progress value={metric.value} size="xs" radius="xl" />
                                  </Box>
                                ))}
                              </Stack>
                            ) : (
                              <Text size="xs" c="dimmed" mt={6}>
                                No metrics configured for this persona yet.
                              </Text>
                            )}
                          </Box>
                        </Stack>
                      </Paper>
                    </motion.div>
                  )
                })()
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Stack gap="sm" align="center" className={classes.personaEmpty}>
                    <Avatar size={68} radius="lg" variant="light">
                      <IconUser size={28} />
                    </Avatar>
                    <Text fw={600}>Choose your character</Text>
                    <Text size="sm" c="dimmed" ta="center">
                      Select a persona to dock their full dossier here.
                    </Text>
                  </Stack>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {errors.persona && (
            <Text c="red" size="sm">
              {errors.persona}
            </Text>
          )}
        </Stack>
        <CreatePersonaModal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreatePersona={onCreatePersona}
          ttsProviders={ttsProviders}
          createDisabledReason={createDisabledReason}
        />
      </Stack>
    </LayoutGroup>
  )
}
