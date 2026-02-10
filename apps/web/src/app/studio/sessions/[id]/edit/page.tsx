'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Paper,
  Stepper,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBrain,
  IconCheck,
  IconChecklist,
  IconDatabase,
  IconSparkles,
  IconAdjustments,
  IconUser,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useParams, useRouter } from 'next/navigation'
import { useMediaQuery } from '@mantine/hooks'
import { Space_Grotesk, Fraunces } from 'next/font/google'
import { api } from '@/lib/client'
import { useAuth } from '@/features/auth'
import { useTeams } from '@/features/teams'
import { useSessions, type Session, type SessionType } from '@/features/sessions'
import { useTtsProviders } from '@/features/tts'
import { useLLMProviders } from '@/features/sessions/hooks/useLLMProviders'
import { useCrm } from '@/features/crm'
import { BasicsStep } from '../../create/components/BasicsStep'
import { ScenarioStep, type ScenarioOption } from '../../create/components/ScenarioStep'
import { PersonaStep } from '../../create/components/PersonaStep'
import { AIBrainStep } from '../../create/components/AIBrainStep'
import { CrmStep } from '../../create/components/CrmStep'
import { StyleStep } from '../../create/components/StyleStep'
import { ReviewStep } from '../../create/components/ReviewStep'
import { SessionConfigForm, Persona, PersonaTraits } from '../../create/lib/types'
import classes from '../../create/create-session.module.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap' })

const resolveConfig = (session: Session | null) => {
  if (!session || !session.sessionConfig || typeof session.sessionConfig !== 'object') {
    return {}
  }
  return session.sessionConfig as Record<string, any>
}

export default function EditSessionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const { user } = useAuth()
  const { teams, activeTeamId, fetchUserTeams, loading: teamsLoading } = useTeams()
  const { currentSession, loading, error, fetchSessionById, updateSession } = useSessions()
  const { providers: ttsProviders, loading: ttsLoading } = useTtsProviders()
  const { data: llmProvidersData, isLoading: llmProvidersLoading } = useLLMProviders()
  const {
    status: crmStatus,
    loadingStatus: crmStatusLoading,
    loadingData: crmDataLoading,
    accounts: crmAccounts,
    opportunities: crmOpportunities,
    leads: crmLeads,
    contacts: crmContacts,
    fetchStatus: fetchCrmStatus,
    connect: connectCrm,
    loadData: loadCrmData,
  } = useCrm()
  const isStepperCompact = useMediaQuery('(max-width: 900px)')

  const [active, setActive] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [language, setLanguage] = useState('en-US')
  const [durationMinutes, setDurationMinutes] = useState(30)

  const [scenarios, setScenarios] = useState<ScenarioOption[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [scenarioTopic, setScenarioTopic] = useState('')
  const [scenarioObjective, setScenarioObjective] = useState('')
  const [scenarioContext, setScenarioContext] = useState('')
  const [aiRole, setAiRole] = useState('')
  const [scenarioGenerating, setScenarioGenerating] = useState(false)
  const [scenarioCount, setScenarioCount] = useState(3)

  const [llmProvider, setLlmProvider] = useState<string | null>(null)
  const [llmModel, setLlmModel] = useState<string | null>(null)

  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personasLoading, setPersonasLoading] = useState(false)
  const [personaSearch, setPersonaSearch] = useState('')
  const selectedPersonaData = personas.find((persona) => persona.id === selectedPersona) ?? null

  const [multiTurnEnabled, setMultiTurnEnabled] = useState(true)
  const [ttsProvider, setTtsProvider] = useState('elevenlabs')
  const [ttsVoice, setTtsVoice] = useState('Rachel')
  const [accent, setAccent] = useState('Persona-based')
  const [tone, setTone] = useState('Formal')
  const [speechRate, setSpeechRate] = useState('Normal')
  const [difficulty, setDifficulty] = useState(5)
  const [modelSearch, setModelSearch] = useState('')

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])

  const [errors, setErrors] = useState<Record<string, string>>({})

  const personaScrollRef = useRef<HTMLDivElement | null>(null)
  const modelScrollRef = useRef<HTMLDivElement | null>(null)

  const session = currentSession?.id === sessionId ? currentSession : null

  useEffect(() => {
    if (user?.id) {
      fetchUserTeams()
    }
  }, [user?.id, fetchUserTeams])

  useEffect(() => {
    if (!sessionId) return
    fetchSessionById(sessionId)
  }, [sessionId, fetchSessionById])

  useEffect(() => {
    if (user?.id) {
      fetchCrmStatus(true)
    }
  }, [user?.id, fetchCrmStatus])

  useEffect(() => {
    const orgId = selectedTeamId || user?.id
    if (!orgId) return
    const fetchScenarios = async () => {
      setScenariosLoading(true)
      try {
        const response = await api.scenarios.getAll({ orgId })
        const list = response?.scenarios ?? response ?? []
        setScenarios(list)
      } catch (err) {
        notifications.show({
          title: 'Warning',
          message: 'Failed to load scenarios.',
          color: 'yellow',
        })
      } finally {
        setScenariosLoading(false)
      }
    }

    fetchScenarios()
  }, [selectedTeamId, user?.id])

  useEffect(() => {
    const fetchPersonas = async () => {
      setPersonasLoading(true)
      try {
        const response = await api.personas.getAll()
        setPersonas(response.personas)
      } catch (err) {
        notifications.show({
          title: 'Warning',
          message: 'Failed to load personas.',
          color: 'yellow',
        })
      } finally {
        setPersonasLoading(false)
      }
    }

    fetchPersonas()
  }, [])

  useEffect(() => {
    if (!session) return

    setSelectedTeamId(session.orgId ?? activeTeamId ?? null)
    setSessionName(session.name ?? '')
    setSessionType(session.type ?? null)
    setTags(session.tags ?? [])
    setLanguage(session.language ?? 'en-US')
    setSelectedScenarioId(session.scenarioId ?? null)
    setSelectedPersona(session.personaId ?? null)

    const config = resolveConfig(session)
    setMultiTurnEnabled(
      typeof config.multiTurnEnabled === 'boolean' ? config.multiTurnEnabled : true
    )
    setAccent(typeof config.accent === 'string' ? config.accent : 'Persona-based')
    setTone(typeof config.tone === 'string' ? config.tone : 'Formal')
    setSpeechRate(typeof config.speechRate === 'string' ? config.speechRate : 'Normal')
    setDifficulty(typeof config.difficulty === 'number' ? config.difficulty : 5)
    setDurationMinutes(typeof config.durationMinutes === 'number' ? config.durationMinutes : 30)
    setAiRole(typeof config.aiRole === 'string' ? config.aiRole : '')

    if (config.llm?.provider) {
      setLlmProvider(config.llm.provider)
    }
    if (config.llm?.model) {
      setLlmModel(config.llm.model)
    }

    if (config.ttsProvider) {
      setTtsProvider(config.ttsProvider)
    }
    if (config.ttsVoice) {
      setTtsVoice(config.ttsVoice)
    }

    if (config.scenario) {
      setScenarioTopic(config.scenario.topic || '')
      setScenarioObjective(config.scenario.objective || '')
      setScenarioContext(config.scenario.context || '')
      if (config.scenario.scenarioId) {
        setSelectedScenarioId(config.scenario.scenarioId)
      }
    }

    if (config.crm?.selections) {
      setSelectedAccounts(config.crm.selections.accounts ?? [])
      setSelectedOpportunities(config.crm.selections.opportunities ?? [])
      setSelectedLeads(config.crm.selections.leads ?? [])
      setSelectedContacts(config.crm.selections.contacts ?? [])
    }

    const resolvedPhoneNumber =
      typeof config.phoneNumber === 'string'
        ? config.phoneNumber
        : typeof config.phone?.number === 'string'
          ? config.phone.number
          : ''
    setPhoneNumber(resolvedPhoneNumber)
  }, [session, activeTeamId])

  useEffect(() => {
    if (activeTeamId && selectedTeamId === null && !session) {
      setSelectedTeamId(activeTeamId)
    }
  }, [activeTeamId, selectedTeamId, session])

  useEffect(() => {
    if (!ttsLoading && ttsProviders.length > 0 && !ttsVoice) {
      const provider = ttsProviders.find((p) => p.name === ttsProvider)
      if (provider && provider.voices.length > 0) {
        setTtsVoice(provider.voices[0])
      }
    }
  }, [ttsLoading, ttsProviders, ttsProvider, ttsVoice])

  useEffect(() => {
    if (!selectedPersonaData?.traits) {
      setAccent('Persona-based')
      return
    }
    const traits = selectedPersonaData.traits as PersonaTraits
    if (traits.voice?.provider) {
      setTtsProvider(traits.voice.provider)
    }
    if (traits.voice?.voiceName) {
      setTtsVoice(traits.voice.voiceName)
    }
    const derivedAccent = traits.voice?.language || traits.voiceProfile || 'Persona-based'
    setAccent(derivedAccent)
  }, [selectedPersonaData])

  const filteredPersonas = personas.filter((persona) => {
    const term = personaSearch.trim().toLowerCase()
    if (!term) return true
    const traits = (persona.traits ?? {}) as PersonaTraits
    return (
      persona.name.toLowerCase().includes(term) ||
      (traits.role ?? '').toLowerCase().includes(term) ||
      (traits.level ?? '').toLowerCase().includes(term) ||
      (traits.personality ?? '').toLowerCase().includes(term) ||
      (traits.archetype ?? '').toLowerCase().includes(term)
    )
  })

  useEffect(() => {
    if (!llmProvidersLoading && llmProvidersData && !llmProvider) {
      const firstEnabledProvider = llmProvidersData.providers.find((p) => p.enabled)
      if (firstEnabledProvider) {
        setLlmProvider(firstEnabledProvider.name)
        if (firstEnabledProvider.modelDetails.length > 0) {
          const preferredModel = firstEnabledProvider.modelDetails.find(
            (m) => m.name === 'gpt-4o-mini'
          )
          setLlmModel(preferredModel?.name || firstEnabledProvider.modelDetails[0].name)
        }
      }
    }
  }, [llmProvidersLoading, llmProvidersData, llmProvider])

  useEffect(() => {
    if (sessionType && errors.sessionType) {
      setErrors(({ sessionType: _sessionType, ...rest }) => rest)
    }
  }, [sessionType, errors.sessionType])

  useEffect(() => {
    if (phoneNumber.trim() && errors.phoneNumber) {
      setErrors(({ phoneNumber: _phoneNumber, ...rest }) => rest)
    }
  }, [phoneNumber, errors.phoneNumber])

  useEffect(() => {
    if (selectedPersona && errors.persona) {
      setErrors(({ persona: _persona, ...rest }) => rest)
    }
  }, [selectedPersona, errors.persona])

  useEffect(() => {
    if (llmProvider && errors.llmProvider) {
      setErrors(({ llmProvider: _llmProvider, ...rest }) => rest)
    }
  }, [llmProvider, errors.llmProvider])

  useEffect(() => {
    if (llmModel && errors.llmModel) {
      setErrors(({ llmModel: _llmModel, ...rest }) => rest)
    }
  }, [llmModel, errors.llmModel])

  useEffect(() => {
    if (durationMinutes > 0 && errors.durationMinutes) {
      setErrors(({ durationMinutes: _durationMinutes, ...rest }) => rest)
    }
  }, [durationMinutes, errors.durationMinutes])

  useEffect(() => {
    if (scenarioTopic.trim() && errors.scenarioTopic) {
      setErrors(({ scenarioTopic: _scenarioTopic, ...rest }) => rest)
    }
  }, [scenarioTopic, errors.scenarioTopic])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!sessionType) newErrors.sessionType = 'Session type is required'
      if (sessionType === 'phone') {
        const normalized = phoneNumber.trim()
        if (!normalized) {
          newErrors.phoneNumber = 'Phone number is required for phone calls'
        } else if (!/^\+?[1-9]\d{7,14}$/.test(normalized)) {
          newErrors.phoneNumber = 'Use E.164 format (e.g. +15551234567)'
        }
      }
    }

    if (step === 1) {
      if (!durationMinutes || durationMinutes <= 0) {
        newErrors.durationMinutes = 'Session length must be greater than 0'
      }
    }

    if (step === 2) {
      if (!selectedPersona) newErrors.persona = 'Please select a persona to continue'
    }

    if (step === 3) {
      if (!llmProvider) newErrors.llmProvider = 'LLM provider is required'
      if (!llmModel) newErrors.llmModel = 'LLM model is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(active)) {
      setActive((current) => (current < steps.length - 1 ? current + 1 : current))
    }
  }

  const prevStep = () => {
    setActive((current) => (current > 0 ? current - 1 : current))
    setErrors({})
  }

  const handleGenerateScenario = async () => {
    const orgId = selectedTeamId || user?.id
    if (!orgId) {
      notifications.show({
        title: 'Missing organization',
        message: 'Select a team or log in to generate a scenario.',
        color: 'yellow',
      })
      return
    }

    if (!scenarioTopic.trim()) {
      setErrors((current) => ({
        ...current,
        scenarioTopic: 'Provide a topic before generating.',
      }))
      return
    }

    setScenarioGenerating(true)
    try {
      const response = await api.scenarios.generateBatch({
        orgId,
        name: scenarioTopic.trim(),
        type: sessionType || undefined,
        tags,
        language,
        sessionConfig: {
          difficulty,
          durationMinutes,
        },
        personaId: selectedPersona || undefined,
        crmContextId: session?.crmContextId,
        userSnapshot: user ? { id: user.id, email: user.email, name: user.name } : undefined,
        orgSnapshot: session?.orgSnapshot ?? undefined,
        objective: scenarioObjective,
        context: scenarioContext,
        requestedBy: user?.id,
        count: scenarioCount,
      })

      const generated = response?.scenarios ?? []
      if (generated.length > 0) {
        setSelectedScenarioId(generated[0].id)
        setScenarios((current) => {
          const existingIds = new Set(current.map((scenario) => scenario.id))
          const next = [
            ...generated.filter((scenario: ScenarioOption) => !existingIds.has(scenario.id)),
            ...current,
          ]
          return next
        })
        notifications.show({
          title: 'Scenario generated',
          message: `We created ${generated.length} scenarios and selected one.`,
          color: 'green',
        })
      }
    } catch (err) {
      notifications.show({
        title: 'Generation failed',
        message: 'Unable to generate a scenario right now.',
        color: 'red',
      })
    } finally {
      setScenarioGenerating(false)
    }
  }

  const handleCrmConnect = async () => {
    try {
      const response = await connectCrm()
      if (response?.authUrl) {
        window.open(response.authUrl, '_blank', 'noopener,noreferrer')
        return
      }
      notifications.show({
        title: 'Connection unavailable',
        message: 'Salesforce connect URL was not returned. Please try again.',
        color: 'yellow',
      })
    } catch (err) {
      notifications.show({
        title: 'Connection failed',
        message: 'Unable to start Salesforce connection.',
        color: 'red',
      })
    }
  }

  const handleSubmit = async () => {
    if (!sessionId || !session) return

    if (!sessionType) {
      notifications.show({
        title: 'Error',
        message: 'Session type is required',
        color: 'red',
        icon: <IconAlertCircle />,
      })
      return
    }

    if (sessionType === 'phone') {
      const normalized = phoneNumber.trim()
      if (!normalized || !/^\+?[1-9]\d{7,14}$/.test(normalized)) {
        notifications.show({
          title: 'Error',
          message: 'Enter a valid phone number in E.164 format (e.g. +15551234567)',
          color: 'red',
          icon: <IconAlertCircle />,
        })
        return
      }
    }

    if (!selectedPersona) {
      notifications.show({
        title: 'Error',
        message: 'Please select a persona before updating a session',
        color: 'red',
        icon: <IconAlertCircle />,
      })
      return
    }

    if (!llmProvider || !llmModel) {
      notifications.show({
        title: 'Error',
        message: 'Please select an AI provider and model',
        color: 'red',
        icon: <IconAlertCircle />,
      })
      return
    }

    setIsSubmitting(true)

    try {
      const baseConfig = resolveConfig(session)
      const sessionConfig: SessionConfigForm = {
        ...baseConfig,
        multiTurnEnabled,
        accent,
        tone,
        speechRate,
        difficulty,
        durationMinutes,
        aiRole: aiRole.trim() || undefined,
      }

      if (llmProvider && llmModel) {
        sessionConfig.llm = {
          provider: llmProvider,
          model: llmModel,
        }
      }

      sessionConfig.scenario = {
        topic: scenarioTopic,
        objective: scenarioObjective,
        context: scenarioContext,
        scenarioId: selectedScenarioId,
      }

      sessionConfig.crm = {
        provider: 'salesforce',
        connected: crmStatus?.connected ?? false,
        selections: {
          accounts: selectedAccounts,
          opportunities: selectedOpportunities,
          leads: selectedLeads,
          contacts: selectedContacts,
        },
      }

      if (sessionType === 'voice' || sessionType === 'video' || sessionType === 'phone') {
        sessionConfig.ttsProvider = ttsProvider
        sessionConfig.ttsVoice = ttsVoice
        sessionConfig.voice = {
          provider: ttsProvider,
          voice: ttsVoice,
        }
      }

      if (sessionType === 'phone') {
        sessionConfig.phone = {
          number: phoneNumber.trim(),
        }
      }

      await updateSession(sessionId, {
        orgId: selectedTeamId || session.orgId,
        orgSnapshot: session.orgSnapshot ?? undefined,
        name: sessionName.trim() || undefined,
        type: sessionType,
        tags: tags.length > 0 ? tags : undefined,
        language: language || undefined,
        scenarioId: selectedScenarioId ?? undefined,
        personaId: selectedPersona ?? undefined,
        crmContextId: session.crmContextId ?? undefined,
        sessionConfig,
      })

      notifications.show({
        title: 'Saved',
        message: 'Session updated successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      router.push('/studio/sessions')
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update session',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const scrollPersona = (direction: 'left' | 'right') => {
    const container = personaScrollRef.current
    if (!container) return
    const amount = container.clientWidth * 0.8
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const scrollModels = (direction: 'left' | 'right') => {
    const container = modelScrollRef.current
    if (!container) return
    const amount = container.clientWidth * 0.8
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const steps = [
    {
      label: 'Basics',
      description: 'Type and details',
      icon: <IconSparkles size={18} />,
      content: (
        <BasicsStep
          sessionType={sessionType}
          setSessionType={(value) => setSessionType(value)}
          errors={errors}
          sessionName={sessionName}
          setSessionName={setSessionName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          teamsLoading={teamsLoading}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          teams={teams}
          language={language}
          setLanguage={setLanguage}
          tags={tags}
          setTags={setTags}
        />
      ),
    },
    {
      label: 'Scenario',
      description: 'Topic & setup',
      icon: <IconSparkles size={18} />,
      content: (
        <ScenarioStep
          scenariosLoading={scenariosLoading}
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          setSelectedScenarioId={setSelectedScenarioId}
          scenarioTopic={scenarioTopic}
          setScenarioTopic={setScenarioTopic}
          scenarioObjective={scenarioObjective}
          setScenarioObjective={setScenarioObjective}
          scenarioContext={scenarioContext}
          setScenarioContext={setScenarioContext}
          aiRole={aiRole}
          setAiRole={setAiRole}
          durationMinutes={durationMinutes}
          setDurationMinutes={setDurationMinutes}
          scenarioCount={scenarioCount}
          setScenarioCount={setScenarioCount}
          onGenerate={handleGenerateScenario}
          isGenerating={scenarioGenerating}
          errors={errors}
        />
      ),
    },
    {
      label: 'Persona',
      description: 'Choose who speaks',
      icon: <IconUser size={18} />,
      content: (
        <PersonaStep
          personasLoading={personasLoading}
          personas={personas}
          filteredPersonas={filteredPersonas}
          personaSearch={personaSearch}
          setPersonaSearch={setPersonaSearch}
          scrollPersona={scrollPersona}
          personaScrollRef={personaScrollRef}
          selectedPersona={selectedPersona}
          setSelectedPersona={setSelectedPersona}
          errors={errors}
          selectedPersonaData={selectedPersonaData}
        />
      ),
    },
    {
      label: 'AI Brain',
      description: 'Model & cost',
      icon: <IconBrain size={18} />,
      content: (
        <AIBrainStep
          llmProvidersLoading={llmProvidersLoading}
          llmProvidersData={llmProvidersData}
          llmProvider={llmProvider}
          setLlmProvider={setLlmProvider}
          setLlmModel={setLlmModel}
          setModelSearch={setModelSearch}
          errors={errors}
          modelSearch={modelSearch}
          llmModel={llmModel}
          scrollModels={scrollModels}
          modelScrollRef={modelScrollRef}
        />
      ),
    },
    {
      label: 'CRM',
      description: 'Salesforce context',
      icon: <IconDatabase size={18} />,
      content: (
        <CrmStep
          crmStatus={crmStatus}
          loadingStatus={crmStatusLoading}
          onConnect={handleCrmConnect}
          onRefreshStatus={() => fetchCrmStatus(true)}
          onLoadData={loadCrmData}
          loadingData={crmDataLoading}
          accounts={crmAccounts}
          opportunities={crmOpportunities}
          leads={crmLeads}
          contacts={crmContacts}
          selectedAccounts={selectedAccounts}
          setSelectedAccounts={setSelectedAccounts}
          selectedOpportunities={selectedOpportunities}
          setSelectedOpportunities={setSelectedOpportunities}
          selectedLeads={selectedLeads}
          setSelectedLeads={setSelectedLeads}
          selectedContacts={selectedContacts}
          setSelectedContacts={setSelectedContacts}
        />
      ),
    },
    {
      label: 'Style',
      description: 'Voice & tone',
      icon: <IconAdjustments size={18} />,
      content: (
        <StyleStep
          tone={tone}
          setTone={setTone}
          speechRate={speechRate}
          setSpeechRate={setSpeechRate}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          multiTurnEnabled={multiTurnEnabled}
          setMultiTurnEnabled={setMultiTurnEnabled}
        />
      ),
    },
    {
      label: 'Review',
      description: 'Finalize',
      icon: <IconChecklist size={18} />,
      content: (
        <ReviewStep
          sessionName={sessionName}
          selectedTeamId={selectedTeamId}
          teams={teams}
          sessionType={sessionType}
          phoneNumber={phoneNumber}
          language={language}
          tags={tags}
          selectedPersona={selectedPersona}
          personas={personas}
          selectedPersonaData={selectedPersonaData}
          accent={accent}
          scenarioTopic={scenarioTopic}
          scenarioObjective={scenarioObjective}
          scenarioContext={scenarioContext}
          scenarioId={selectedScenarioId}
          scenarios={scenarios}
          durationMinutes={durationMinutes}
          crmSelections={{
            accounts: selectedAccounts,
            opportunities: selectedOpportunities,
            leads: selectedLeads,
            contacts: selectedContacts,
          }}
          crmConnected={crmStatus?.connected ?? false}
          llmProvider={llmProvider}
          llmModel={llmModel}
          llmProvidersData={llmProvidersData}
          tone={tone}
          speechRate={speechRate}
          difficulty={difficulty}
          multiTurnEnabled={multiTurnEnabled}
        />
      ),
    },
  ]

  return (
    <Box className={`${spaceGrotesk.className} ${classes.page}`}>
      <Container size="xl" py="xl">
        <Group
          style={{
            width: '100vw',
          }}
          py="md"
          className={classes.hero}
        >
          <Group
            style={{
              width: '80.6em',
            }}
            align="flex-start"
          >
            <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/studio/sessions')}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Paper className={classes.heroCard}>
              <Badge variant="light" color="blue" radius="md" mb={10}>
                Edit Session Wizard
              </Badge>
              <Title order={1} className={`${fraunces.className} ${classes.heroTitle}`}>
                Update your session
              </Title>
              <Text size="sm" className={classes.heroSub}>
                Adjust settings and save your changes.
              </Text>
            </Paper>
          </Group>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        {!session && loading ? (
          <Paper shadow="sm" p="xl" radius="md" withBorder>
            <Text c="dimmed">Loading session...</Text>
          </Paper>
        ) : !session ? (
          <Paper shadow="sm" p="xl" radius="md" withBorder>
            <Text c="dimmed">Session not found.</Text>
          </Paper>
        ) : (
          <Grid gutter="xl">
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Box className={classes.stepPanel}>
                <Paper className={classes.stepPanelCard} p="md">
                  <Stepper
                    active={active}
                    onStepClick={setActive}
                    orientation={isStepperCompact ? 'horizontal' : 'vertical'}
                    size="sm"
                    color="blue"
                    className={classes.stepperRoot}
                  >
                    {steps.map((step) => (
                      <Stepper.Step
                        key={step.label}
                        label={step.label}
                        description={step.description}
                        icon={step.icon}
                      />
                    ))}
                  </Stepper>
                </Paper>
              </Box>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 9 }}>
              <Paper className={classes.contentCard} p="xl">
                {steps[active]?.content}
              </Paper>

              <Group justify="space-between" mt="xl">
                <Button variant="default" onClick={prevStep} disabled={active === 0}>
                  Back
                </Button>

                {active < steps.length - 1 ? (
                  <Button onClick={nextStep}>Next</Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    loading={isSubmitting || loading}
                    leftSection={<IconCheck size={16} />}
                  >
                    Save Changes
                  </Button>
                )}
              </Group>
            </Grid.Col>
          </Grid>
        )}
      </Container>
    </Box>
  )
}
