'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Stepper,
  Button,
  Group,
  Box,
  Title,
  Text,
  Alert,
  Paper,
  Container,
  ActionIcon,
  Badge,
  Grid,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconArrowLeft,
  IconUser,
  IconBrain,
  IconSparkles,
  IconAdjustments,
  IconChecklist,
  IconDatabase,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth'
import { useTeams } from '@/features/teams'
import { useSessions, type SessionType, type CreateSessionInput } from '@/features/sessions'
import { useTtsProviders } from '@/features/tts'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/client'
import { useLLMProviders } from '@/features/sessions/hooks/useLLMProviders'
import { Space_Grotesk, Fraunces } from 'next/font/google'
import { useMediaQuery } from '@mantine/hooks'
import classes from './create-session.module.css'
import { BasicsStep } from './components/BasicsStep'
import { ScenarioStep, type ScenarioOption } from './components/ScenarioStep'
import { PersonaStep } from './components/PersonaStep'
import { AIBrainStep } from './components/AIBrainStep'
import { CrmStep } from './components/CrmStep'
import { StyleStep } from './components/StyleStep'
import { ReviewStep } from './components/ReviewStep'
import { SessionConfigForm, Persona, PersonaTraits } from './lib/types'
import { getBrainCompatibleModels, getPreferredBrainModel } from './lib/brain-models'
import { useCrm } from '@/features/crm'
import { useI18n } from '@/features/i18n'
import {
  getSavedCrmConnections,
  getSavedCrmSessionConnections,
  normalizeCrmSelections,
  removeSavedCrmSessionConnection,
  upsertSavedCrmConnection,
  upsertSavedCrmSessionConnection,
  type SavedCrmConnection,
  type SavedCrmSessionConnection,
  type UserSettingsWithCrmPrefs,
} from '@/features/crm/utils/session-crm-preferences'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap' })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const COUNTERPART_ROLE_PATTERN =
  /client|customer|buyer|prospect|stakeholder|procurement|decision maker|decision-maker|economic buyer|cto|cfo|cio|vp/i

const PITCHER_ROLE_PATTERN =
  /sales|seller|pitch|account executive|account manager|sales rep|representative|bdr|sdr|business development|founder|consultant/i

const pickString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const normalizeRole = (value: string | undefined): string | undefined =>
  value ? value.trim().replace(/\s+/g, ' ').toLowerCase() : undefined

const pickCounterpartRole = (candidates: Array<string | undefined>): string | undefined =>
  candidates.find((candidate) => {
    const role = pickString(candidate)
    return !!role && COUNTERPART_ROLE_PATTERN.test(role.toLowerCase())
  })

const pickPitcherRole = (candidates: Array<string | undefined>): string | undefined =>
  candidates.find((candidate) => {
    const role = pickString(candidate)
    return !!role && PITCHER_ROLE_PATTERN.test(role.toLowerCase())
  })

const pickFirstDifferentRole = (
  candidates: Array<string | undefined>,
  exclude?: string
): string | undefined => {
  const normalizedExclude = normalizeRole(exclude)
  return candidates.find((candidate) => {
    const role = pickString(candidate)
    return !!role && normalizeRole(role) !== normalizedExclude
  })
}

const alignPitchRolePair = (
  aiRole?: string,
  userRole?: string
): { aiRole?: string; userRole?: string } => {
  let resolvedAiRole = pickString(aiRole)
  let resolvedUserRole = pickString(userRole)

  if (
    resolvedAiRole &&
    resolvedUserRole &&
    PITCHER_ROLE_PATTERN.test(resolvedAiRole.toLowerCase()) &&
    COUNTERPART_ROLE_PATTERN.test(resolvedUserRole.toLowerCase())
  ) {
    const previousAiRole = resolvedAiRole
    resolvedAiRole = resolvedUserRole
    resolvedUserRole = previousAiRole
  }

  if (
    resolvedAiRole &&
    resolvedUserRole &&
    normalizeRole(resolvedAiRole) === normalizeRole(resolvedUserRole)
  ) {
    resolvedAiRole = undefined
  }

  return {
    aiRole: resolvedAiRole,
    userRole: resolvedUserRole,
  }
}

const scrollTrackByCard = (container: HTMLDivElement, direction: 'left' | 'right') => {
  const items = Array.from(container.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element.clientWidth > 0
  )
  if (items.length === 0) {
    return
  }

  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
  if (maxScrollLeft <= 0) {
    return
  }

  const targets = Array.from(
    new Set(items.map((item) => Math.min(Math.max(0, item.offsetLeft), maxScrollLeft)))
  ).sort((a, b) => a - b)
  if (targets.length === 0) {
    return
  }

  const current = container.scrollLeft
  const epsilon = 8
  const lastIndex = targets.length - 1
  let nextIndex = 0

  if (direction === 'right') {
    let baseIndex = 0
    for (let index = 0; index <= lastIndex; index += 1) {
      if ((targets[index] ?? 0) <= current + epsilon) {
        baseIndex = index
      }
    }
    nextIndex = Math.min(baseIndex + 1, lastIndex)
  } else {
    let baseIndex = lastIndex
    for (let index = 0; index <= lastIndex; index += 1) {
      if ((targets[index] ?? 0) >= current - epsilon) {
        baseIndex = index
        break
      }
    }
    nextIndex = Math.max(baseIndex - 1, 0)
  }

  const target = targets[nextIndex] ?? current

  if (Math.abs(target - current) < 2) {
    const fallbackAmount = container.clientWidth * 0.8
    container.scrollBy({
      left: direction === 'left' ? -fallbackAmount : fallbackAmount,
      behavior: 'smooth',
    })
    return
  }

  container.scrollTo({ left: target, behavior: 'smooth' })
}

export default function CreateSessionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { locale } = useI18n()
  const { teams, activeTeamId, fetchUserTeams, loading: teamsLoading } = useTeams()
  const { createSession, loading, error } = useSessions()
  const { providers: ttsProviders, loading: ttsLoading } = useTtsProviders()
  const { data: llmProvidersData, isLoading: llmProvidersLoading } = useLLMProviders()
  const isStepperCompact = useMediaQuery('(max-width: 900px)')

  const [active, setActive] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
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
  const [userRole, setUserRole] = useState('')
  const [scenarioGenerating, setScenarioGenerating] = useState(false)
  const [scenarioCount, setScenarioCount] = useState(1)

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
  const [ttsModel, setTtsModel] = useState<string | null>(null)
  const [accent, setAccent] = useState('Persona-based')
  const [tone, setTone] = useState('Formal')
  const [speechRate, setSpeechRate] = useState('Conversational')
  const [responseLength, setResponseLength] = useState('Balanced')
  const [patienceLevel, setPatienceLevel] = useState('Medium')
  const [initiativeLevel, setInitiativeLevel] = useState('Balanced')
  const [difficulty, setDifficulty] = useState(5)
  const [modelSearch, setModelSearch] = useState('')

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
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [saveCrmForFutureUse, setSaveCrmForFutureUse] = useState(false)
  const [savedCrmLabel, setSavedCrmLabel] = useState('')
  const [userSettings, setUserSettings] = useState<UserSettingsWithCrmPrefs | null>(null)
  const [savedCrmConnections, setSavedCrmConnections] = useState<SavedCrmSessionConnection[]>([])
  const [savedCrmAccounts, setSavedCrmAccounts] = useState<SavedCrmConnection[]>([])
  const [selectedSavedCrmAccountId, setSelectedSavedCrmAccountId] = useState<string | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})

  const personaScrollRef = useRef<HTMLDivElement | null>(null)
  const modelScrollRef = useRef<HTMLDivElement | null>(null)
  const languageTouchedRef = useRef(false)

  useEffect(() => {
    if (!languageTouchedRef.current) {
      setLanguage(locale)
    }
  }, [locale])

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
    if (ttsLoading || ttsProviders.length === 0) {
      return
    }

    const provider = ttsProviders.find((entry) => entry.name === ttsProvider) ?? ttsProviders[0]
    if (provider.name !== ttsProvider) {
      setTtsProvider(provider.name)
    }

    if (!ttsVoice || !provider.voices.includes(ttsVoice)) {
      setTtsVoice(provider.voices[0] ?? '')
    }

    if ((provider.models?.length ?? 0) > 0) {
      if (!ttsModel || !provider.models?.includes(ttsModel)) {
        setTtsModel(provider.models?.[0] ?? null)
      }
      return
    }

    if (ttsModel) {
      setTtsModel(null)
    }
  }, [ttsLoading, ttsProviders, ttsProvider, ttsVoice, ttsModel])

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
    if (traits.voice?.model) {
      setTtsModel(traits.voice.model)
    }
    const derivedAccent = traits.voice?.language || traits.voiceProfile || 'Persona-based'
    setAccent(derivedAccent)
  }, [selectedPersonaData])

  useEffect(() => {
    if (!selectedScenarioId) return
    const scenario = scenarios.find((item) => item.id === selectedScenarioId)
    if (!scenario || !isRecord(scenario.config)) return

    const scenarioConfig = scenario.config as Record<string, unknown>
    const scenarioSessionConfig = isRecord(scenarioConfig.sessionConfig)
      ? (scenarioConfig.sessionConfig as Record<string, unknown>)
      : {}

    const aiRoleFromSessionConfig =
      typeof scenarioSessionConfig.aiRole === 'string' ? scenarioSessionConfig.aiRole : undefined
    const userRoleFromSessionConfig =
      typeof scenarioSessionConfig.userRole === 'string'
        ? scenarioSessionConfig.userRole
        : undefined

    let aiRoleFromRoles: string | undefined
    let userRoleFromRoles: string | undefined

    if (isRecord(scenarioConfig.roles)) {
      const rolesObj = scenarioConfig.roles as Record<string, unknown>
      const assistantRole =
        typeof rolesObj.assistant === 'string'
          ? rolesObj.assistant
          : typeof rolesObj.ai === 'string'
            ? rolesObj.ai
            : undefined
      const clientRole = typeof rolesObj.client === 'string' ? rolesObj.client : undefined
      const userRole = typeof rolesObj.user === 'string' ? rolesObj.user : undefined
      aiRoleFromRoles =
        pickCounterpartRole([clientRole, assistantRole, userRole]) ??
        assistantRole ??
        clientRole ??
        userRole
      userRoleFromRoles =
        userRole ??
        pickPitcherRole([assistantRole, clientRole]) ??
        pickFirstDifferentRole([assistantRole, clientRole, userRole], aiRoleFromRoles)
    } else if (Array.isArray(scenarioConfig.roles)) {
      const rolesArray = scenarioConfig.roles as Array<{ name?: string }>
      const preferredAiRole =
        pickCounterpartRole(rolesArray.map((role) => role?.name)) ?? rolesArray[0]?.name
      aiRoleFromRoles = preferredAiRole
      userRoleFromRoles =
        pickPitcherRole(
          rolesArray
            .map((role) => role?.name)
            .filter((name) => normalizeRole(name) !== normalizeRole(preferredAiRole))
        ) ?? rolesArray.find((role) => role?.name && role.name !== preferredAiRole)?.name
    }

    const alignedInferredRoles = alignPitchRolePair(
      aiRoleFromSessionConfig ?? aiRoleFromRoles,
      userRoleFromSessionConfig ?? userRoleFromRoles
    )

    if (!aiRole.trim()) {
      const nextAiRole = alignedInferredRoles.aiRole
      if (nextAiRole) {
        setAiRole(nextAiRole)
      }
    }

    if (!userRole.trim()) {
      const nextUserRole = alignedInferredRoles.userRole
      if (nextUserRole) {
        setUserRole(nextUserRole)
      }
    }
  }, [selectedScenarioId, scenarios, aiRole, userRole])

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
        const preferredModel = getPreferredBrainModel(firstEnabledProvider)
        if (preferredModel) {
          setLlmModel(preferredModel.name)
        }
      }
    }
  }, [llmProvidersLoading, llmProvidersData, llmProvider])

  useEffect(() => {
    if (!llmProvidersData || !llmProvider) {
      return
    }

    const provider = llmProvidersData.providers.find((entry) => entry.name === llmProvider)
    const compatibleModels = getBrainCompatibleModels(provider)
    if (compatibleModels.length === 0) {
      return
    }

    if (!llmModel || !compatibleModels.some((model) => model.name === llmModel)) {
      const preferredModel = getPreferredBrainModel(provider)
      if (preferredModel) {
        setLlmModel(preferredModel.name)
      }
    }
  }, [llmProvidersData, llmProvider, llmModel])

  useEffect(() => {
    if (sessionType && errors.sessionType) {
      setErrors(({ sessionType: _sessionType, ...rest }) => rest)
    }
  }, [sessionType, errors.sessionType])

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

  useEffect(() => {
    if (user?.id) {
      fetchCrmStatus(true)
    }
  }, [user?.id, fetchCrmStatus])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const loadUserSettings = async () => {
      try {
        const settings = (await api.users.getMySettings()) as UserSettingsWithCrmPrefs
        if (cancelled) return
        setUserSettings(settings ?? {})
        setSavedCrmConnections(getSavedCrmSessionConnections(settings))
        setSavedCrmAccounts(getSavedCrmConnections(settings))
      } catch {
        if (!cancelled) {
          setUserSettings({})
          setSavedCrmConnections([])
          setSavedCrmAccounts([])
        }
      }
    }

    void loadUserSettings()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!crmStatus?.providerEmail) return
    setSavedCrmLabel((current) =>
      current.trim().length > 0 ? current : `Salesforce (${crmStatus.providerEmail})`
    )
  }, [crmStatus?.providerEmail])

  const getStepErrors = (step: number): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!sessionType) newErrors.sessionType = 'Session type is required'
    }

    if (step === 1) {
      if (!durationMinutes || durationMinutes < 5 || durationMinutes > 180) {
        newErrors.durationMinutes = 'Session length must be between 5 and 180 minutes'
      }
    }

    if (step === 2) {
      if (!selectedPersona) newErrors.persona = 'Please select a persona to continue'
    }

    if (step === 3) {
      if (!llmProvider) newErrors.llmProvider = 'LLM provider is required'
      if (!llmModel) newErrors.llmModel = 'LLM model is required'
    }

    return newErrors
  }

  const validateStep = (step: number): boolean => {
    const newErrors = getStepErrors(step)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const attemptStepChange = (targetStep: number) => {
    if (targetStep <= active) {
      setErrors({})
      setActive(targetStep)
      return
    }

    for (let step = active; step < targetStep; step += 1) {
      const stepErrors = getStepErrors(step)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        setActive(step)
        return
      }
    }

    setErrors({})
    setActive(targetStep)
  }

  const validateAllSteps = () => {
    for (let step = 0; step <= 3; step += 1) {
      const stepErrors = getStepErrors(step)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        setActive(step)
        return false
      }
    }

    setErrors({})
    return true
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

    if (!validateAllSteps()) {
      notifications.show({
        title: 'Fix highlighted fields',
        message: 'Complete the required fields before creating the session.',
        color: 'red',
        icon: <IconAlertCircle />,
      })
      return
    }

    setIsSubmitting(true)

    try {
      if (saveCrmForFutureUse && user?.id && crmStatus?.connected) {
        let nextSettings = userSettings ?? {}

        const nextSavedCrmAccount: SavedCrmConnection = {
          id:
            globalThis.crypto?.randomUUID?.() ??
            `crm:${Date.now()}:${crmStatus.providerEmail ?? 'default'}`,
          name:
            savedCrmLabel.trim() ||
            (crmStatus.providerEmail ? `Salesforce (${crmStatus.providerEmail})` : 'Salesforce'),
          provider: 'salesforce',
          providerEmail: crmStatus.providerEmail ?? null,
          connected: crmStatus.connected ?? false,
          lastSyncAt: crmStatus.lastSyncAt ?? null,
          autoSync: true,
          savedAt: new Date().toISOString(),
        }

        nextSettings = upsertSavedCrmConnection(nextSettings, nextSavedCrmAccount)

        const nextConnection: SavedCrmSessionConnection = {
          id: `${Date.now()}`,
          provider: 'salesforce',
          providerEmail: crmStatus.providerEmail ?? null,
          label:
            savedCrmLabel.trim() ||
            (crmStatus.providerEmail ? `Salesforce (${crmStatus.providerEmail})` : 'Salesforce'),
          connected: crmStatus.connected ?? false,
          savedAt: new Date().toISOString(),
          selections: normalizeCrmSelections({
            accounts: selectedAccounts,
            opportunities: selectedOpportunities,
            leads: selectedLeads,
            contacts: selectedContacts,
          }),
        }

        nextSettings = upsertSavedCrmSessionConnection(nextSettings, nextConnection)
        await api.users.updateMySettings(nextSettings)
        setUserSettings(nextSettings)
        setSavedCrmAccounts(getSavedCrmConnections(nextSettings))
        setSavedCrmConnections(getSavedCrmSessionConnections(nextSettings))
      }

      const sessionConfig: SessionConfigForm = {
        multiTurnEnabled,
        accent,
        tone,
        speechRate,
        responseLength,
        patienceLevel,
        initiativeLevel,
        difficulty,
        durationMinutes,
        ...alignPitchRolePair(aiRole, userRole),
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
        provider: selectedSavedCrmAccount?.provider ?? 'salesforce',
        connected: crmStatus?.connected ?? false,
        providerEmail:
          selectedSavedCrmAccount?.providerEmail ?? crmStatus?.providerEmail ?? undefined,
        connectionName: selectedSavedCrmAccount?.name,
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
        sessionConfig.ttsModel = ttsModel ?? undefined
        sessionConfig.voice = {
          provider: ttsProvider,
          voice: ttsVoice,
          ...(ttsModel ? { model: ttsModel } : {}),
        }
      }

      if (sessionType === 'video') {
        const personaAvatar = selectedPersonaData?.traits?.avatar
        sessionConfig.video = {
          mode: 'realtime',
          provider: 'heygen',
          fallbackProvider: 'azure-avatar',
          ...(personaAvatar?.liveAvatarId ? { liveAvatarId: personaAvatar.liveAvatarId } : {}),
          ...(personaAvatar?.liveAvatarName
            ? { liveAvatarName: personaAvatar.liveAvatarName }
            : personaAvatar?.label
              ? { liveAvatarName: personaAvatar.label }
              : {}),
          ...(personaAvatar?.heygenAvatarId
            ? {
                heygenAvatarId: personaAvatar.heygenAvatarId,
                ...(personaAvatar.avatarStyle
                  ? { heygenAvatarStyle: personaAvatar.avatarStyle }
                  : {}),
                ...(personaAvatar.backgroundColor
                  ? { heygenBackgroundColor: personaAvatar.backgroundColor }
                  : {}),
              }
            : {}),
        }
      }

      const sessionData: CreateSessionInput = {
        orgId: selectedTeamId || user.id,
        userSnapshot: {
          id: user.id,
          email: user.email,
          name: user.name,
          settings: {
            language: {
              locale,
            },
          },
        },
        name: sessionName.trim() || undefined,
        type: sessionType as SessionType,
        tags: tags.length > 0 ? tags : undefined,
        language: language || undefined,
        personaId: selectedPersona ?? undefined,
        scenarioId: selectedScenarioId ?? undefined,
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

  const scrollPersona = (direction: 'left' | 'right') => {
    const container = personaScrollRef.current
    if (!container) return
    scrollTrackByCard(container, direction)
  }

  const scrollModels = (direction: 'left' | 'right') => {
    const container = modelScrollRef.current
    if (!container) return
    scrollTrackByCard(container, direction)
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
          ...alignPitchRolePair(aiRole, userRole),
        },
        personaId: selectedPersona || undefined,
        crmContextId: undefined,
        userSnapshot: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              settings: {
                language: {
                  locale,
                },
              },
            }
          : undefined,
        orgSnapshot: undefined,
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

  const handleCreatePersona = async (input: { name: string; traits: PersonaTraits }) => {
    const orgId = selectedTeamId || user?.id
    if (!orgId) {
      throw new Error('Select a team or sign in before creating a persona.')
    }

    const createdPersona = (await api.personas.create({
      orgId,
      name: input.name,
      traits: input.traits as Record<string, unknown>,
    })) as Persona

    setPersonas((current) =>
      [...current, createdPersona].sort((left, right) => left.name.localeCompare(right.name))
    )
    setSelectedPersona(createdPersona.id)
    setPersonaSearch('')

    notifications.show({
      title: 'Persona created',
      message: `${createdPersona.name} is ready to use in this session.`,
      color: 'green',
    })

    return createdPersona
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

  const handleUseSavedCrmConnection = (connection: SavedCrmSessionConnection) => {
    const selections = normalizeCrmSelections(connection.selections)
    setSelectedAccounts(selections.accounts)
    setSelectedOpportunities(selections.opportunities)
    setSelectedLeads(selections.leads)
    setSelectedContacts(selections.contacts)
    setSaveCrmForFutureUse(true)
    setSavedCrmLabel(connection.label)
    notifications.show({
      title: 'Saved CRM setup applied',
      message: `Applied ${connection.label} to this session.`,
      color: 'green',
    })
  }

  const selectedSavedCrmAccount =
    savedCrmAccounts.find((entry) => entry.id === selectedSavedCrmAccountId) ?? null

  const handleSelectSavedCrmAccount = (crmId: string | null) => {
    setSelectedSavedCrmAccountId(crmId)
    if (!crmId) {
      return
    }

    const selected = savedCrmAccounts.find((entry) => entry.id === crmId)
    if (!selected) return

    setSavedCrmLabel((current) => current.trim() || selected.name)
    notifications.show({
      title: 'Saved CRM selected',
      message: `Using ${selected.name} for this session.`,
      color: 'green',
    })
  }

  const handleRemoveSavedCrmConnection = async (connection: SavedCrmSessionConnection) => {
    try {
      const nextSettings = removeSavedCrmSessionConnection(userSettings ?? {}, connection.id)
      await api.users.updateMySettings(nextSettings)
      setUserSettings(nextSettings)
      setSavedCrmConnections(getSavedCrmSessionConnections(nextSettings))
      notifications.show({
        title: 'Saved CRM preset removed',
        message: `"${connection.label}" was removed from future session presets.`,
        color: 'green',
      })
    } catch {
      notifications.show({
        title: 'Remove failed',
        message: 'Could not remove saved CRM preset.',
        color: 'red',
      })
    }
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
          teamsLoading={teamsLoading}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          teams={teams}
          language={language}
          setLanguage={(value) => {
            languageTouchedRef.current = true
            setLanguage(value)
          }}
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
          userRole={userRole}
          setUserRole={setUserRole}
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
          ttsProviders={ttsProviders}
          onCreatePersona={handleCreatePersona}
          createDisabledReason={
            user?.id ? null : 'You need to be signed in before creating a persona.'
          }
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
          saveForFutureUse={saveCrmForFutureUse}
          setSaveForFutureUse={setSaveCrmForFutureUse}
          savedCrms={savedCrmAccounts}
          selectedSavedCrmId={selectedSavedCrmAccountId}
          onSelectSavedCrm={handleSelectSavedCrmAccount}
          savedConnections={savedCrmConnections}
          onUseSavedConnection={handleUseSavedCrmConnection}
          onRemoveSavedConnection={(connection) => void handleRemoveSavedCrmConnection(connection)}
          savedConnectionLabel={savedCrmLabel}
          setSavedConnectionLabel={setSavedCrmLabel}
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
          responseLength={responseLength}
          setResponseLength={setResponseLength}
          patienceLevel={patienceLevel}
          setPatienceLevel={setPatienceLevel}
          initiativeLevel={initiativeLevel}
          setInitiativeLevel={setInitiativeLevel}
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
          aiRole={aiRole}
          userRole={userRole}
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
          responseLength={responseLength}
          patienceLevel={patienceLevel}
          initiativeLevel={initiativeLevel}
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
            width: '100%',
          }}
          py="md"
          className={classes.hero}
        >
          <Group
            style={{
              width: '100%',
              maxWidth: '80.6em',
            }}
            align="flex-start"
          >
            <ActionIcon variant="subtle" size="lg" onClick={() => router.push('/studio/sessions')}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Paper className={classes.heroCard}>
              <Badge variant="light" color="blue" radius="md" mb={10}>
                New Session Wizard
              </Badge>
              <Title order={1} className={`${fraunces.className} ${classes.heroTitle}`}>
                Compose your next session
              </Title>
              <Text size="sm" className={classes.heroSub}>
                Build a tailored experience in minutes with guided steps.
              </Text>
            </Paper>
          </Group>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        <Grid gutter={isStepperCompact ? 'md' : 'xl'}>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Box className={classes.stepPanel}>
              <Paper className={classes.stepPanelCard} p="md">
                <Stepper
                  active={active}
                  onStepClick={attemptStepChange}
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
            <Paper className={classes.contentCard} p={isStepperCompact ? 'md' : 'xl'}>
              {steps[active]?.content}
            </Paper>

            <Group justify="space-between" mt="xl" gap="sm" wrap="wrap">
              <Button variant="default" onClick={prevStep} disabled={active === 0}>
                Back
              </Button>

              {active < steps.length - 1 ? (
                <Button data-tour-id="create-session-next" onClick={nextStep}>
                  Next
                </Button>
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
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  )
}
