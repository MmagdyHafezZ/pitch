'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Grid,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconArrowLeft,
  IconAlertTriangle,
  IconBolt,
  IconBuilding,
  IconChevronDown,
  IconClock,
  IconFileText,
  IconListDetails,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconServer,
  IconSettings,
  IconShield,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconX,
} from '@tabler/icons-react'
import { useRouter, useSearchParams } from 'next/navigation'
import classes from '../admin-console.module.css'
import { useAuthStore } from '@/features/auth'
import { useAdminAccess } from '@/features/admin/hooks/useAdminAccess'
import { requestJsonPath } from '@/features/admin/services/admin.service'

type JsonRecord = Record<string, unknown>
const EMPTY_RECORD: JsonRecord = {}
const EMPTY_RECORD_ARRAY: JsonRecord[] = []

type PlanFormState = {
  name: string
  description: string
  planLevel: string
  maxCoins: number
  isActive: boolean
}

type UserEditFormState = {
  email: string
  name: string
  avatar: string
  isActive: boolean
  settingsText: string
}

type UserCreateFormState = {
  email: string
  name: string
  avatar: string
  isActive: boolean
}

type UserInviteFormState = {
  email: string
  teamId: string
  role: string
}

type TeamEditFormState = {
  name: string
  slug: string
  billingEmail: string
  isActive: boolean
  billingAddressText: string
  metadataText: string
}

type TeamCreateFormState = {
  name: string
  slug: string
  billingEmail: string
  billingAddressText: string
}

type TeamSubscriptionFormState = {
  planId: string
  interval: string
  cancelAtPeriodEnd: boolean
  metadataText: string
}

type SessionEditFormState = {
  orgId: string
  name: string
  type: string
  status: string
  tagsText: string
  language: string
  scenarioId: string
  personaId: string
  crmContextId: string
  sessionConfigText: string
}

type SessionCreateFormState = {
  orgId: string
  name: string
  type: string
  tagsText: string
  language: string
  scenarioId: string
  personaId: string
  crmContextId: string
  sessionConfigText: string
  memberUserIds: string[]
  memberRole: string
}

type TeamMembershipEditFormState = {
  role: string
  tokenLimit: number
  isActive: boolean
}

type TeamMemberCreateFormState = {
  userId: string
  role: string
  tokenLimit: number
  isActive: boolean
}

type TeamMemberInviteFormState = {
  email: string
  role: string
}

type SessionMemberCreateFormState = {
  userIds: string[]
  role: string
}

type StudioAccessRequest = {
  userId: string
  email: string
  name: string
  requestedAt: string
  quota?: number
  role?: 'MEMBER' | 'ADMIN' | 'OWNER'
}

type PendingCoinRefillRequest = {
  userId: string
  email: string
  name: string
  teamId: string
  requestedCoins: number
  requestedAt: string
}

type ReviewRole = 'MEMBER' | 'ADMIN'

export type AdminWorkspaceView = 'dashboard' | 'system' | 'users' | 'teams' | 'plans' | 'sessions'

type AdminEntityView = 'users' | 'teams' | 'sessions'

const STATUS_COLORS: Record<string, string> = {
  ok: 'success',
  healthy: 'success',
  success: 'success',
  active: 'success',
  valid: 'success',
  degraded: 'selected',
  warning: 'selected',
  pending: 'selected',
  not_configured: 'gray',
  inactive: 'gray',
  error: 'brand',
  failed: 'brand',
  invalid: 'brand',
}

const SYSTEM_DEPENDENCY_LABELS: Record<string, string> = {
  userDatabase: 'User database',
  simulationDatabase: 'Simulation database',
  redis: 'Redis',
  rabbitMq: 'RabbitMQ',
  mongo: 'MongoDB',
}

const SYSTEM_INTEGRATION_LABELS: Record<string, string> = {
  redisConfigured: 'Redis',
  mongoConfigured: 'MongoDB',
  rabbitMqConfigured: 'RabbitMQ',
  openAiConfigured: 'OpenAI',
  watsonxConfigured: 'Watsonx',
  phoneWebhookConfigured: 'Phone webhook',
  twilioConfigured: 'Twilio',
  vapiConfigured: 'Vapi',
}

const MICROSERVICE_LABELS: Record<string, string> = {
  user_queue: 'User service',
  simulation_queue: 'Simulation service',
  analytics_queue: 'Analytics service',
  support_queue: 'Support service',
  lti_queue: 'LTI service',
  s3_queue: 'S3 service',
  crm_queue: 'CRM service',
  jobs_queue: 'Jobs service',
  gateway_queue: 'Gateway service',
}

const COLLECTION_KEYS = [
  'data',
  'logs',
  'errors',
  'requests',
  'users',
  'teams',
  'plans',
  'subscriptions',
  'sessions',
  'members',
  'personas',
  'scenarios',
  'challenges',
  'providers',
  'flags',
  'jobs',
  'queues',
  'platforms',
  'files',
  'events',
  'traces',
  'transcripts',
  'conversationHistory',
  'subscriptions',
]

const PLAN_LEVEL_OPTIONS = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'] as const
const SUBSCRIPTION_INTERVAL_OPTIONS = ['MONTH', 'QUARTER', 'SEMIANNUAL', 'ANNUAL'] as const
const TEAM_ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MEMBER'] as const
const SESSION_TYPE_OPTIONS = ['text', 'voice', 'video', 'phone'] as const
const SESSION_STATUS_OPTIONS = ['active', 'ended'] as const
const SESSION_MEMBER_ROLE_OPTIONS = ['viewer', 'editor'] as const

const EMPTY_PLAN_FORM: PlanFormState = {
  name: '',
  description: '',
  planLevel: 'FREE',
  maxCoins: 0,
  isActive: true,
}

const EMPTY_USER_CREATE_FORM: UserCreateFormState = {
  email: '',
  name: '',
  avatar: '',
  isActive: true,
}

const EMPTY_USER_INVITE_FORM: UserInviteFormState = {
  email: '',
  teamId: '',
  role: 'MEMBER',
}

const EMPTY_TEAM_CREATE_FORM: TeamCreateFormState = {
  name: '',
  slug: '',
  billingEmail: '',
  billingAddressText: '',
}

const EMPTY_SESSION_CREATE_FORM: SessionCreateFormState = {
  orgId: '',
  name: '',
  type: 'text',
  tagsText: '',
  language: '',
  scenarioId: '',
  personaId: '',
  crmContextId: '',
  sessionConfigText: '',
  memberUserIds: [],
  memberRole: 'viewer',
}

const EMPTY_TEAM_MEMBER_CREATE_FORM: TeamMemberCreateFormState = {
  userId: '',
  role: 'MEMBER',
  tokenLimit: 0,
  isActive: true,
}

const EMPTY_TEAM_MEMBER_INVITE_FORM: TeamMemberInviteFormState = {
  email: '',
  role: 'MEMBER',
}

const EMPTY_SESSION_MEMBER_CREATE_FORM: SessionMemberCreateFormState = {
  userIds: [],
  role: 'viewer',
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toJson = (value: unknown) => JSON.stringify(value, null, 2)
const areSerializedValuesEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right)
const areBooleanRecordValuesEqual = (
  left: Record<string, boolean>,
  right: Record<string, boolean>
) => {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

const formatDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const formatCompactDate = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatNumber = (value: unknown) => {
  if (typeof value !== 'number') return '0'
  return new Intl.NumberFormat().format(value)
}

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

const readBoolean = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value
    }
  }
  return null
}

const truncate = (value: string | null, max = 72) => {
  if (!value) return 'n/a'
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

const truncateMiddle = (value: string | null, max = 68) => {
  if (!value) return 'n/a'
  if (value.length <= max) return value
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

const extractArray = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }

  if (!isRecord(value)) {
    return []
  }

  for (const key of COLLECTION_KEYS) {
    const candidate = value[key]
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord)
    }
  }

  return []
}

const getCollectionCount = (value: unknown) => {
  if (Array.isArray(value)) return value.length
  if (!isRecord(value)) return 0

  const explicitCount = readNumber(value.total, value.count)
  if (explicitCount !== null) return explicitCount

  return extractArray(value).length
}

const formatAdminLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const deriveStatus = (value: unknown) => {
  if (!isRecord(value)) return 'unknown'

  const status =
    readString(value.status, value.state, value.health)?.toLowerCase() ??
    (readBoolean(value.valid) === true
      ? 'ok'
      : readBoolean(value.valid) === false
        ? 'error'
        : readBoolean(value.connected) === true
          ? 'ok'
          : readBoolean(value.connected) === false
            ? 'warning'
            : 'ok')

  return status
}

const summarizeHealthDetail = (value: unknown) => {
  if (!isRecord(value)) return null

  const error = readString(value.error)
  if (error) return truncate(error, 96)

  const message = readString(value.message)
  if (message) return truncate(message, 96)

  const timestampLabel = formatCompactDate(readString(value.timestamp))
  const status = readString(value.status, value.state, value.health)?.toLowerCase()
  const valid = readBoolean(value.valid)
  const connected = readBoolean(value.connected)
  const configured = readBoolean(value.configured)

  if (status === 'not_configured' || configured === false) {
    return 'Not configured'
  }

  if (valid === true) {
    return timestampLabel ? `Valid • checked ${timestampLabel}` : 'Valid'
  }

  if (valid === false) {
    return timestampLabel ? `Invalid • checked ${timestampLabel}` : 'Invalid'
  }

  if (connected === true) {
    return timestampLabel ? `Connected • checked ${timestampLabel}` : 'Connected'
  }

  if (connected === false) {
    return 'Disconnected'
  }

  if (status === 'ok') {
    return timestampLabel ? `Healthy • checked ${timestampLabel}` : 'Healthy'
  }

  if (status === 'degraded') {
    return timestampLabel ? `Degraded • checked ${timestampLabel}` : 'Degraded'
  }

  if (status === 'pending') {
    return 'Checking now'
  }

  if (status === 'warning') {
    return 'Needs attention'
  }

  if (status === 'error' || status === 'failed' || status === 'invalid') {
    return 'Unavailable'
  }

  if (timestampLabel) {
    return `Checked ${timestampLabel}`
  }

  return null
}

const summarizeData = (value: unknown) => {
  if (Array.isArray(value)) {
    return `${value.length} items`
  }

  if (!isRecord(value)) {
    return 'Available'
  }

  const explicitCount = readNumber(value.count, value.total, value.totalCount)
  if (explicitCount !== null) {
    return `${formatNumber(explicitCount)} records`
  }

  if (typeof value.valid === 'boolean') {
    return value.valid ? 'Valid' : 'Invalid'
  }

  if (typeof value.connected === 'boolean') {
    return value.connected ? 'Connected' : 'Disconnected'
  }

  if (typeof value.configured === 'boolean') {
    return value.configured ? 'Configured' : 'Not configured'
  }

  const healthDetail = summarizeHealthDetail(value)
  if (healthDetail) {
    return healthDetail
  }

  const summary = readString(value.message, value.error, value.provider, value.environment)
  return truncate(summary, 64)
}

const formatSystemEndpointPath = (path: string) => path.replace(/^\/api\/v1/, '') || path

const summarizeAuthValidationDetail = (value: unknown) => {
  if (!isRecord(value)) return 'Protected auth route responded successfully'
  return 'JWT auth guard and current-user hydration responded successfully'
}

const resolveHealthRowStatus = ({
  data,
  loading,
  error,
  status,
}: {
  data: unknown
  loading: boolean
  error: string | null
  status?: string | null
}) => status ?? (error ? 'error' : loading ? 'pending' : deriveStatus(data))

const resolveHealthRowDetail = ({
  data,
  error,
  detail,
}: {
  data: unknown
  error: string | null
  detail?: string | null
}) => detail ?? error ?? summarizeData(data)

const isHealthySystemStatus = (status: string) =>
  ['ok', 'healthy', 'success', 'active', 'valid'].includes(status)

const isAttentionStatus = (status: string) =>
  ['warning', 'error', 'failed', 'invalid', 'degraded', 'pending'].includes(status)

const combineSystemStatuses = (statuses: string[]) => {
  if (statuses.some((status) => ['error', 'failed', 'invalid'].includes(status))) return 'error'
  if (statuses.some((status) => ['warning', 'degraded', 'pending'].includes(status))) {
    return 'degraded'
  }
  if (statuses.length > 0 && statuses.every((status) => isHealthySystemStatus(status))) return 'ok'
  return 'unknown'
}

const summarizeLogBody = (value: unknown, fallback: string) => {
  if (value == null) return fallback

  if (typeof value === 'string') {
    return truncate(value, 120)
  }

  if (Array.isArray(value)) {
    return `${value.length} records returned`
  }

  if (!isRecord(value)) {
    return fallback
  }

  const explicitCount = readNumber(value.count, value.total, value.totalCount)
  if (explicitCount !== null) {
    return `${formatNumber(explicitCount)} records returned`
  }

  const summary = readString(
    value.message,
    value.error,
    value.status,
    value.health,
    value.provider,
    value.environment
  )

  if (summary) {
    return truncate(summary, 120)
  }

  const keys = Object.keys(value).slice(0, 5)
  return keys.length > 0 ? `Fields: ${keys.join(', ')}` : fallback
}

const getQueueLabel = (queue: JsonRecord) => {
  const queueName = readString(queue.name)
  return (queueName && MICROSERVICE_LABELS[queueName]) || queueName || 'Unknown service'
}

const getQueueStatus = (queue: JsonRecord) => {
  const baseStatus = readString(queue.status)?.toLowerCase()
  const consumers = readNumber(queue.consumerCount)

  if (baseStatus === 'ok' && consumers === 0) {
    return 'warning'
  }

  if (baseStatus === 'missing') return 'warning'
  return baseStatus ?? 'unknown'
}

const getQueueSummary = (queue: JsonRecord) => {
  const consumers = readNumber(queue.consumerCount)
  const messages = readNumber(queue.messageCount)
  const deadLetters = readNumber(queue.deadLetterMessageCount)
  const error = readString(queue.error)

  if (error) return error

  const parts = [
    `${formatNumber(consumers ?? 0)} consumers`,
    `${formatNumber(messages ?? 0)} queued`,
  ]

  if (deadLetters !== null && deadLetters > 0) {
    parts.push(`${formatNumber(deadLetters)} DLQ`)
  }

  return parts.join(' • ')
}

const getPrimaryText = (item: JsonRecord) =>
  readString(
    item.name,
    item.email,
    item.title,
    item.key,
    item.id,
    item.provider,
    item.slug,
    item.status
  ) ?? 'Unnamed record'

const getSecondaryText = (item: JsonRecord) =>
  readString(
    item.email,
    item.status,
    item.type,
    item.role,
    item.planLevel,
    item.description,
    item.provider,
    item.id
  )

const getRecordId = (value: unknown) => (isRecord(value) ? readString(value.id) : null)

const getSessionLabel = (session: JsonRecord) => {
  const scenario = isRecord(session.scenario) ? session.scenario : {}
  return (
    readString(session.name, scenario.name, session.title, session.id) ??
    `Session ${String(session.id ?? '').slice(0, 8)}`
  )
}

const PLAN_DISPLAY_CONTENT = {
  FREE: {
    tierLabel: 'Free',
    fallbackTitle: 'Free',
    pricing: { amount: '$0', cadence: '/month' },
    audience: 'For getting started',
    description: 'Essential access for exploring the platform and running early practice.',
    features: ['Core workspace access', 'Self-serve setup'],
  },
  PRO: {
    tierLabel: 'Pro',
    fallbackTitle: 'Pro',
    pricing: { amount: 'Custom', cadence: 'pricing' },
    audience: 'For individual sellers',
    description:
      'Expanded capacity for power users who need more practice volume and faster iteration.',
    features: ['Higher usage allowance', 'Built for focused individual use'],
  },
  TEAM: {
    tierLabel: 'Team',
    fallbackTitle: 'Team',
    pricing: { amount: 'Custom', cadence: 'pricing' },
    audience: 'For team rollout',
    description: 'Shared enablement workspace for managers and team-based coaching programs.',
    features: ['Shared workspace setup', 'Manager-friendly rollout'],
  },
  ENTERPRISE: {
    tierLabel: 'Enterprise',
    fallbackTitle: 'Enterprise',
    pricing: { amount: 'Custom', cadence: 'contract' },
    audience: 'For large organizations',
    description:
      'Scaled rollout support for org-wide adoption, governance, and operational control.',
    features: ['Governance-ready rollout', 'Enterprise operating model'],
  },
} as const

const normalizePlanLevel = (planLevel: unknown): (typeof PLAN_LEVEL_OPTIONS)[number] => {
  const normalized = readString(planLevel)?.toUpperCase()
  if (
    normalized &&
    PLAN_LEVEL_OPTIONS.includes(normalized as (typeof PLAN_LEVEL_OPTIONS)[number])
  ) {
    return normalized as (typeof PLAN_LEVEL_OPTIONS)[number]
  }

  return 'FREE'
}

const getPlanDisplayContent = (planLevel: unknown) =>
  PLAN_DISPLAY_CONTENT[normalizePlanLevel(planLevel)]

const getPlanPriceHeadline = (plan: JsonRecord) => {
  const pricingAmount = getPlanDisplayContent(plan.planLevel).pricing.amount
  if (pricingAmount !== 'Custom') return pricingAmount
  return getPlanLabel(plan)
}

const getPlanLabel = (plan: JsonRecord) => {
  const rawName = readString(plan.name)?.trim()
  if (rawName) return rawName
  return PLAN_DISPLAY_CONTENT[normalizePlanLevel(plan.planLevel)].fallbackTitle
}

const getPlanDescription = (plan: JsonRecord) => {
  const description = readString(plan.description)?.trim()
  if (description) return description
  return getPlanDisplayContent(plan.planLevel).description
}

const getPlanStatusLabel = (plan: JsonRecord) =>
  readBoolean(plan.isActive) === false ? 'Draft' : 'Published'

const getPlanStatusTone = (plan: JsonRecord) =>
  readBoolean(plan.isActive) === false ? 'gray' : 'teal'

const getPlanSupportNote = (subscriptionCounts: { total: number; active: number }) => {
  if (subscriptionCounts.active > 0) {
    return `${formatNumber(subscriptionCounts.active)} active team${
      subscriptionCounts.active === 1 ? '' : 's'
    } on this plan`
  }

  if (subscriptionCounts.total > 0) {
    return `Assigned to ${formatNumber(subscriptionCounts.total)} team${
      subscriptionCounts.total === 1 ? '' : 's'
    }`
  }

  return 'Ready to assign'
}

const toSettingsEditorText = (value: unknown) => {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return '{}'
  }

  return toJson(value)
}

const toOptionalObjectEditorText = (value: unknown) => {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return ''
  }

  return toJson(value)
}

const toSessionConfigEditorText = (value: unknown) => {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return ''
  }

  return toJson(value)
}

const toUserEditFormState = (user: JsonRecord | null | undefined): UserEditFormState => ({
  email: readString(user?.email) ?? '',
  name: readString(user?.name) ?? '',
  avatar: readString(user?.avatar) ?? '',
  isActive: readBoolean(user?.isActive) ?? true,
  settingsText: toSettingsEditorText(user?.settings),
})

const toTeamEditFormState = (team: JsonRecord | null | undefined): TeamEditFormState => ({
  name: readString(team?.name) ?? '',
  slug: readString(team?.slug) ?? '',
  billingEmail: readString(team?.billingEmail) ?? '',
  isActive: readBoolean(team?.isActive) ?? true,
  billingAddressText: toOptionalObjectEditorText(team?.billingAddress),
  metadataText: toOptionalObjectEditorText(team?.metadata),
})

const toSessionEditFormState = (session: JsonRecord | null | undefined): SessionEditFormState => {
  const scenario = isRecord(session?.scenario) ? session.scenario : {}
  const persona = isRecord(session?.persona) ? session.persona : {}
  const tags = Array.isArray(session?.tags)
    ? session.tags
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim())
    : []

  return {
    orgId: readString(session?.orgId) ?? '',
    name: readString(session?.name) ?? '',
    type: readString(session?.type)?.toLowerCase() ?? 'text',
    status: readString(session?.status)?.toLowerCase() ?? 'active',
    tagsText: tags.join(', '),
    language: readString(session?.language) ?? '',
    scenarioId: readString(session?.scenarioId, scenario.id) ?? '',
    personaId: readString(session?.personaId, persona.id) ?? '',
    crmContextId: readString(session?.crmContextId) ?? '',
    sessionConfigText: toSessionConfigEditorText(session?.sessionConfig),
  }
}

const toTeamMembershipEditFormState = (
  membership: JsonRecord | null | undefined,
  fallbackTokenLimit?: number | null
): TeamMembershipEditFormState => ({
  role: readString(membership?.role)?.toUpperCase() ?? 'MEMBER',
  tokenLimit: readNumber(membership?.tokenLimit, fallbackTokenLimit) ?? 0,
  isActive: readBoolean(membership?.isActive) ?? true,
})

const toPlanFormState = (plan: JsonRecord | null | undefined): PlanFormState => ({
  name: readString(plan?.name) ?? '',
  description: readString(plan?.description) ?? '',
  planLevel: readString(plan?.planLevel)?.toUpperCase() ?? 'FREE',
  maxCoins: readNumber(plan?.maxCoins) ?? 0,
  isActive: readBoolean(plan?.isActive) ?? true,
})

const toTeamSubscriptionFormState = (
  subscription: JsonRecord | null | undefined,
  fallbackPlanId = ''
): TeamSubscriptionFormState => {
  const plan = isRecord(subscription?.plan) ? subscription.plan : {}

  return {
    planId: readString(subscription?.planId, plan.id) ?? fallbackPlanId,
    interval: readString(subscription?.interval)?.toUpperCase() ?? 'MONTH',
    cancelAtPeriodEnd: readBoolean(subscription?.cancelAtPeriodEnd) ?? false,
    metadataText: toOptionalObjectEditorText(subscription?.metadata),
  }
}

const getPlanLevelColor = (planLevel: unknown) => {
  const normalized = normalizePlanLevel(planLevel).toLowerCase()
  if (normalized === 'enterprise') return 'yellow'
  if (normalized === 'team') return 'indigo'
  if (normalized === 'pro') return 'info'
  return 'gray'
}

const getPlanTierCardClassName = (planLevel: unknown) => {
  const normalized = normalizePlanLevel(planLevel).toLowerCase()
  if (normalized === 'enterprise') return classes.planCardEnterprise
  if (normalized === 'team') return classes.planCardTeam
  if (normalized === 'pro') return classes.planCardPro
  return classes.planCardFree
}

const isFeaturedPlanLevel = (planLevel: unknown) => normalizePlanLevel(planLevel) === 'PRO'

const getSubscriptionStatus = (subscription: JsonRecord) =>
  readString(
    subscription.status,
    subscription.subscriptionStatus,
    subscription.state
  )?.toLowerCase() ?? 'unknown'

const getStatusColor = (value: unknown, fallback = 'gray') => {
  const normalized = readString(value)?.toLowerCase()
  return (normalized && STATUS_COLORS[normalized]) || fallback
}

const getStudioAccessSettings = (user: JsonRecord | null | undefined) => {
  const settings = isRecord(user?.settings) ? user.settings : EMPTY_RECORD
  return isRecord(settings.studioAccess) ? settings.studioAccess : EMPTY_RECORD
}

const getStudioAccessStatus = (user: JsonRecord | null | undefined) =>
  readString(getStudioAccessSettings(user).status)?.toLowerCase() ?? null

const getStudioAccessRequestedAt = (user: JsonRecord | null | undefined) =>
  readString(getStudioAccessSettings(user).requestedAt)

const getCoinRefillSettings = (user: JsonRecord | null | undefined) => {
  const settings = isRecord(user?.settings) ? user.settings : EMPTY_RECORD
  return isRecord(settings.coinRefillRequest) ? settings.coinRefillRequest : EMPTY_RECORD
}

const toPendingCoinRefillRequest = (
  user: JsonRecord | null | undefined
): PendingCoinRefillRequest | null => {
  const request = getCoinRefillSettings(user)
  const status = readString(request.status)?.toLowerCase()
  const userId = readString(user?.id)
  const requestedAt = readString(request.requestedAt)
  const teamId = readString(request.teamId)
  const requestedCoins = readNumber(request.requestedCoins)

  if (status !== 'pending' || !userId || !requestedAt || !teamId || requestedCoins === null) {
    return null
  }

  const email = readString(user?.email, userId) ?? userId

  return {
    userId,
    email,
    name: readString(user?.name, email, userId) ?? email,
    teamId,
    requestedCoins,
    requestedAt,
  }
}

const toStudioAccessRequest = (
  request: JsonRecord | null | undefined
): StudioAccessRequest | null => {
  const userId = readString(request?.userId)
  const email = readString(request?.email)
  const requestedAt = readString(request?.requestedAt)

  if (!userId || !email || !requestedAt) {
    return null
  }

  const roleValue = readString(request?.role)?.toUpperCase()
  const role =
    roleValue === 'OWNER' || roleValue === 'ADMIN' || roleValue === 'MEMBER' ? roleValue : undefined

  return {
    userId,
    email,
    name: readString(request?.name, email, userId) ?? email,
    requestedAt,
    quota: readNumber(request?.quota) ?? undefined,
    role,
  }
}

const getUserStatus = (user: JsonRecord | null | undefined) =>
  (getStudioAccessStatus(user) === 'pending'
    ? 'pending access'
    : readString(user?.status)?.toLowerCase()) ??
  (readBoolean(user?.isActive) === false ? 'inactive' : 'active')

const getTeamLabel = (team: JsonRecord) =>
  readString(team.name, team.slug, team.id) ?? 'Unknown team'

const getUserLabel = (user: JsonRecord) =>
  readString(user.name, user.email, user.id) ?? 'Unknown user'

const getSessionStatus = (session: JsonRecord) =>
  readString(session.status)?.toLowerCase() ?? 'unknown'

const getSessionType = (session: JsonRecord) => readString(session.type) ?? 'unknown'

const getSessionDate = (session: JsonRecord) =>
  formatCompactDate(session.endedAt ?? session.updatedAt ?? session.createdAt) ?? 'n/a'

const extractTranscriptSegments = (transcriptPayload: unknown): JsonRecord[] => {
  const rows = extractArray(transcriptPayload)
  const segments = rows.flatMap((row) => {
    const enriched = isRecord(row.enrichedTranscript) ? row.enrichedTranscript : {}
    const enrichedSegments = Array.isArray(enriched.segments)
      ? enriched.segments.filter(isRecord)
      : []

    if (enrichedSegments.length > 0) {
      return enrichedSegments.map((segment) => ({
        ...segment,
        assetId: row.assetId,
        transcriptId: row.id,
      }))
    }

    const transcriptText = readString(row.text)
    return transcriptText
      ? [{ text: transcriptText, transcriptId: row.id, assetId: row.assetId }]
      : []
  })

  return segments
}

function useConsoleJsonQuery<T = unknown>(
  key: string,
  path: string,
  enabled: boolean,
  refetchInterval: number | false = false
) {
  const adminScopeKey = useAuthStore((state) => state.user?.id ?? 'anonymous')

  return useQuery({
    queryKey: ['admin-console', adminScopeKey, key, path],
    queryFn: () => requestJsonPath<T>(path),
    enabled,
    retry: false,
    staleTime: refetchInterval ? 0 : 1000 * 60,
    refetchInterval,
  })
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge color={STATUS_COLORS[status] ?? 'gray'} variant="light" tt="uppercase">
      {status}
    </Badge>
  )
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={classes.kpiCard}>
      <Text size="xs" tt="uppercase" fw={700} className={classes.metricLabel}>
        {label}
      </Text>
      <Text mt={6} size="xl" fw={800} className={classes.metricValue}>
        {value}
      </Text>
      <Text size="xs" className={classes.metricNote}>
        {note}
      </Text>
    </div>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <div className={`${classes.jsonBlock} ${classes.consoleText}`}>
      <pre>{toJson(value)}</pre>
    </div>
  )
}

function FeedSection({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: JsonRecord[]
  emptyLabel: string
}) {
  return (
    <Box className={classes.feedSection}>
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{title}</Text>
        <Badge color="gray" variant="light">
          {items.length}
        </Badge>
      </Group>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyLabel}
        </Text>
      ) : (
        items.slice(0, 5).map((item, index) => (
          <div
            key={readString(item.id, item.key, item.email, item.name) ?? `${title}-${index}`}
            className={classes.feedItem}
          >
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate="end">
                {getPrimaryText(item)}
              </Text>
              <Text size="xs" c="dimmed">
                {truncate(getSecondaryText(item), 64)}
              </Text>
            </Box>
            <Text size="xs" className={classes.mutedText} ta="right">
              {formatCompactDate(item.updatedAt ?? item.createdAt) ??
                truncate(readString(item.id), 18)}
            </Text>
          </div>
        ))
      )}
    </Box>
  )
}

function ExplorerRow({
  title,
  subtitle,
  meta,
  badges,
  actions,
  active = false,
  onClick,
}: {
  title: string
  subtitle?: string | null
  meta?: string | null
  badges?: React.ReactNode
  actions?: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  const content = (
    <>
      <Box style={{ minWidth: 0 }}>
        <Group gap="xs" mb={4} wrap="wrap">
          {badges}
        </Group>
        <Text fw={700} size="sm" truncate="end">
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" className={classes.mutedText}>
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {meta ? (
        <Text size="xs" className={classes.mutedText} ta="right">
          {meta}
        </Text>
      ) : null}
    </>
  )

  if (actions) {
    return (
      <div className={`${classes.entityRow} ${active ? classes.entityRowActive : ''}`}>
        <button type="button" className={classes.entityRowMain} onClick={onClick}>
          {content}
        </button>
        <div className={classes.entityRowActions}>{actions}</div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`${classes.entityRow} ${active ? classes.entityRowActive : ''}`}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

function DetailMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={classes.detailMetric}>
      <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
        {label}
      </Text>
      <Text fw={800}>{value}</Text>
      {hint ? (
        <Text size="xs" className={classes.mutedText}>
          {hint}
        </Text>
      ) : null}
    </div>
  )
}

function DetailSection({
  title,
  icon,
  children,
  action,
  collapsible = false,
  expanded = true,
  onToggle,
  bodyClassName,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  action?: ReactNode
  collapsible?: boolean
  expanded?: boolean
  onToggle?: () => void
  bodyClassName?: string
}) {
  const headerContent = (
    <div className={classes.detailSectionHeaderContent}>
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon size={28} radius="xl" color="brand" variant="light">
          {icon}
        </ThemeIcon>
        <Text fw={700}>{title}</Text>
      </Group>
      <div className={classes.detailSectionHeaderActions}>
        {action}
        {collapsible ? (
          <span
            className={`${classes.detailSectionChevron} ${
              expanded ? classes.detailSectionChevronOpen : ''
            }`}
            aria-hidden="true"
          >
            <IconChevronDown size={16} />
          </span>
        ) : null}
      </div>
    </div>
  )

  if (collapsible) {
    return (
      <div className={`${classes.detailSection} ${classes.detailSectionCollapsible}`}>
        <button
          type="button"
          className={classes.detailSectionHeaderButton}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {headerContent}
        </button>
        <Collapse in={expanded}>
          <div className={[classes.detailSectionBody, bodyClassName].filter(Boolean).join(' ')}>
            {children}
          </div>
        </Collapse>
      </div>
    )
  }

  return (
    <div className={classes.detailSection}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon size={28} radius="xl" color="brand" variant="light">
            {icon}
          </ThemeIcon>
          <Text fw={700}>{title}</Text>
        </Group>
        {action}
      </Group>
      {children}
    </div>
  )
}

function SessionEditorSection({
  form,
  setForm,
  baseline,
  hasChanges,
  saving,
  onReset,
  onSave,
  expanded,
  onToggle,
  teams,
  scenarios,
  personas,
}: {
  form: SessionEditFormState | null
  setForm: React.Dispatch<React.SetStateAction<SessionEditFormState | null>>
  baseline: SessionEditFormState | null
  hasChanges: boolean
  saving: boolean
  onReset: () => void
  onSave: () => void
  expanded: boolean
  onToggle: () => void
  teams: JsonRecord[]
  scenarios: JsonRecord[]
  personas: JsonRecord[]
}) {
  const teamOptions = useMemo(() => {
    const options = teams
      .map((team) => {
        const value = getRecordId(team)
        if (!value) return null

        return {
          value,
          label: `${getTeamLabel(team)} • ${truncateMiddle(value, 32)}`,
        }
      })
      .filter((option): option is { value: string; label: string } => option !== null)

    if (form?.orgId && !options.some((option) => option.value === form.orgId)) {
      options.unshift({
        value: form.orgId,
        label: `Current org • ${truncateMiddle(form.orgId, 32)}`,
      })
    }

    return options
  }, [form?.orgId, teams])

  const scenarioOptions = useMemo(() => {
    const options = scenarios
      .map((scenario) => {
        const value = getRecordId(scenario)
        if (!value) return null

        return {
          value,
          label: `${readString(scenario.name, scenario.title, value) ?? value}`,
        }
      })
      .filter((option): option is { value: string; label: string } => option !== null)

    if (form?.scenarioId && !options.some((option) => option.value === form.scenarioId)) {
      options.unshift({
        value: form.scenarioId,
        label: `Current scenario • ${truncateMiddle(form.scenarioId, 32)}`,
      })
    }

    return options
  }, [form?.scenarioId, scenarios])

  const personaOptions = useMemo(() => {
    const options = personas
      .map((persona) => {
        const value = getRecordId(persona)
        if (!value) return null

        return {
          value,
          label: `${readString(persona.name, persona.title, value) ?? value}`,
        }
      })
      .filter((option): option is { value: string; label: string } => option !== null)

    if (form?.personaId && !options.some((option) => option.value === form.personaId)) {
      options.unshift({
        value: form.personaId,
        label: `Current persona • ${truncateMiddle(form.personaId, 32)}`,
      })
    }

    return options
  }, [form?.personaId, personas])

  return (
    <DetailSection
      title="Session editor"
      icon={<IconSettings size={16} />}
      collapsible
      expanded={expanded}
      onToggle={onToggle}
      bodyClassName={classes.inspectorSectionBody}
      action={
        <Badge color={hasChanges ? 'selected' : 'gray'} variant="light">
          {hasChanges ? 'unsaved' : 'synced'}
        </Badge>
      }
    >
      {form ? (
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Team / org"
                searchable
                data={teamOptions}
                value={form.orgId}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          orgId: value ?? '',
                        }
                      : current
                  )
                }
                nothingFoundMessage="No teams found"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Session name"
                placeholder="Optional session label"
                value={form.name}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          name: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Type"
                data={SESSION_TYPE_OPTIONS.map((value) => ({
                  value,
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
                value={form.type}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          type: value ?? 'text',
                        }
                      : current
                  )
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Status"
                data={SESSION_STATUS_OPTIONS.map((value) => ({
                  value,
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
                value={form.status}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          status: value ?? 'active',
                        }
                      : current
                  )
                }
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput
                label="Tags"
                placeholder="priority, enterprise, onboarding"
                value={form.tagsText}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          tagsText: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Language"
                placeholder="en-US"
                value={form.language}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          language: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="CRM context ID"
                placeholder="crm_context_123"
                value={form.crmContextId}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          crmContextId: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Scenario"
                searchable
                clearable
                data={scenarioOptions}
                value={form.scenarioId || null}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          scenarioId: value ?? '',
                        }
                      : current
                  )
                }
                nothingFoundMessage="No scenarios found"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Persona"
                searchable
                clearable
                data={personaOptions}
                value={form.personaId || null}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          personaId: value ?? '',
                        }
                      : current
                  )
                }
                nothingFoundMessage="No personas found"
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Session config JSON"
                placeholder='{"difficulty":"hard"}'
                minRows={8}
                value={form.sessionConfigText}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          sessionConfigText: value,
                        }
                      : current
                  )
                }}
                classNames={{ input: classes.consoleText }}
              />
            </Grid.Col>
          </Grid>

          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Text size="sm" className={classes.mutedText}>
              Blank optional fields clear their value. Session config must be a JSON object or
              blank.
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button variant="light" disabled={!hasChanges || !baseline} onClick={onReset}>
                Reset
              </Button>
              <Button loading={saving} disabled={!hasChanges} onClick={onSave}>
                Save changes
              </Button>
            </Group>
          </Group>
        </Stack>
      ) : (
        <Text size="sm" className={classes.mutedText}>
          Loading editable session details.
        </Text>
      )}
    </DetailSection>
  )
}

function TeamEditorSection({
  form,
  setForm,
  baseline,
  hasChanges,
  saving,
  onReset,
  onSave,
  expanded,
  onToggle,
}: {
  form: TeamEditFormState | null
  setForm: React.Dispatch<React.SetStateAction<TeamEditFormState | null>>
  baseline: TeamEditFormState | null
  hasChanges: boolean
  saving: boolean
  onReset: () => void
  onSave: () => void
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <DetailSection
      title="Team editor"
      icon={<IconSettings size={16} />}
      collapsible
      expanded={expanded}
      onToggle={onToggle}
      bodyClassName={classes.inspectorSectionBody}
      action={
        <Badge color={hasChanges ? 'selected' : 'gray'} variant="light">
          {hasChanges ? 'unsaved' : 'synced'}
        </Badge>
      }
    >
      {form ? (
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Team name"
                value={form.name}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          name: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Slug"
                placeholder="team-slug"
                value={form.slug}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          slug: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Billing email"
                placeholder="billing@example.com"
                value={form.billingEmail}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          billingEmail: value,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Box style={{ paddingTop: '1.8rem' }}>
                <Switch
                  checked={form.isActive}
                  label="Team is active"
                  onChange={(event) => {
                    const checked = event.currentTarget.checked
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            isActive: checked,
                          }
                        : current
                    )
                  }}
                />
              </Box>
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Billing address JSON"
                placeholder='{"street":"123 Main St","city":"Calgary"}'
                minRows={6}
                value={form.billingAddressText}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          billingAddressText: value,
                        }
                      : current
                  )
                }}
                classNames={{ input: classes.consoleText }}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Metadata JSON"
                placeholder='{"profile":{"industry":"Software"}}'
                minRows={8}
                value={form.metadataText}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          metadataText: value,
                        }
                      : current
                  )
                }}
                classNames={{ input: classes.consoleText }}
              />
            </Grid.Col>
          </Grid>

          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Text size="sm" className={classes.mutedText}>
              Metadata patches merge with the current team metadata. JSON fields must be objects or
              blank.
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button variant="light" disabled={!hasChanges || !baseline} onClick={onReset}>
                Reset
              </Button>
              <Button loading={saving} disabled={!hasChanges} onClick={onSave}>
                Save changes
              </Button>
            </Group>
          </Group>
        </Stack>
      ) : (
        <Text size="sm" className={classes.mutedText}>
          Loading editable team details.
        </Text>
      )}
    </DetailSection>
  )
}

function TeamMemberAssignmentSection({
  form,
  setForm,
  inviteForm,
  setInviteForm,
  userOptions,
  saving,
  inviteSaving,
  onAssign,
  onInvite,
  expanded,
  onToggle,
}: {
  form: TeamMemberCreateFormState
  setForm: React.Dispatch<React.SetStateAction<TeamMemberCreateFormState>>
  inviteForm: TeamMemberInviteFormState
  setInviteForm: React.Dispatch<React.SetStateAction<TeamMemberInviteFormState>>
  userOptions: Array<{ value: string; label: string }>
  saving: boolean
  inviteSaving: boolean
  onAssign: () => void
  onInvite: () => void
  expanded: boolean
  onToggle: () => void
}) {
  const [mode, setMode] = useState<'assign' | 'invite'>('assign')

  return (
    <DetailSection
      title="Add team member"
      icon={<IconPlus size={16} />}
      collapsible
      expanded={expanded}
      onToggle={onToggle}
      bodyClassName={classes.inspectorSectionBody}
      action={
        <Badge color="selected" variant="light">
          assign
        </Badge>
      }
    >
      <Stack gap="md">
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as 'assign' | 'invite')}
          data={[
            { label: 'In-app user', value: 'assign' },
            { label: 'Email invite', value: 'invite' },
          ]}
        />

        {mode === 'assign' ? (
          <>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Select
                  label="User"
                  searchable
                  data={userOptions}
                  value={form.userId || null}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      userId: value ?? '',
                    }))
                  }
                  nothingFoundMessage="No eligible users found"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Select
                  label="Role"
                  data={TEAM_ROLE_OPTIONS.filter((role) => role !== 'OWNER').map((value) => ({
                    value,
                    label: value,
                  }))}
                  value={form.role}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      role: value ?? 'MEMBER',
                    }))
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <NumberInput
                  label="Coin limit"
                  min={0}
                  allowDecimal={false}
                  thousandSeparator=","
                  value={form.tokenLimit}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      tokenLimit: typeof value === 'number' && Number.isFinite(value) ? value : 0,
                    }))
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Box style={{ paddingTop: '1.8rem' }}>
                  <Switch
                    checked={form.isActive}
                    label="Membership starts active"
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setForm((current) => ({
                        ...current,
                        isActive: checked,
                      }))
                    }}
                  />
                </Box>
              </Grid.Col>
            </Grid>

            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Text size="sm" className={classes.mutedText}>
                Add an existing user into this team with a role and optional per-member coin limit.
              </Text>
              <Button loading={saving} onClick={onAssign}>
                Add member
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <TextInput
                  label="Email"
                  placeholder="new-member@example.com"
                  value={inviteForm.email}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setInviteForm((current) => ({
                      ...current,
                      email: value,
                    }))
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Select
                  label="Role"
                  data={TEAM_ROLE_OPTIONS.filter((role) => role !== 'OWNER').map((value) => ({
                    value,
                    label: value,
                  }))}
                  value={inviteForm.role}
                  onChange={(value) =>
                    setInviteForm((current) => ({
                      ...current,
                      role: value ?? 'MEMBER',
                    }))
                  }
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Text size="sm" className={classes.mutedText}>
                Send the team signup invite email directly from this team and let the user join
                through the invite link.
              </Text>
              <Button loading={inviteSaving} onClick={onInvite}>
                Send invite
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </DetailSection>
  )
}

function TeamSubscriptionSection({
  form,
  setForm,
  baseline,
  hasChanges,
  saving,
  onReset,
  onSave,
  expanded,
  onToggle,
  planOptions,
  hasExistingSubscription,
  subscriptionStatus,
  currentPeriodEnd,
}: {
  form: TeamSubscriptionFormState | null
  setForm: React.Dispatch<React.SetStateAction<TeamSubscriptionFormState | null>>
  baseline: TeamSubscriptionFormState | null
  hasChanges: boolean
  saving: boolean
  onReset: () => void
  onSave: () => void
  expanded: boolean
  onToggle: () => void
  planOptions: Array<{ value: string; label: string }>
  hasExistingSubscription: boolean
  subscriptionStatus: string | null
  currentPeriodEnd: unknown
}) {
  return (
    <DetailSection
      title="Team subscription"
      icon={<IconBolt size={16} />}
      collapsible
      expanded={expanded}
      onToggle={onToggle}
      bodyClassName={classes.inspectorSectionBody}
      action={
        <Badge
          color={hasExistingSubscription ? getStatusColor(subscriptionStatus, 'selected') : 'gray'}
          variant="light"
        >
          {hasExistingSubscription ? (subscriptionStatus ?? 'active') : 'not subscribed'}
        </Badge>
      }
    >
      {form ? (
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Select
                label="Plan"
                searchable
                data={planOptions}
                value={form.planId || null}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          planId: value ?? '',
                        }
                      : current
                  )
                }
                nothingFoundMessage="No plans found"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Select
                label="Billing interval"
                data={SUBSCRIPTION_INTERVAL_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
                value={form.interval}
                onChange={(value) =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          interval: value ?? 'MONTH',
                        }
                      : current
                  )
                }
                allowDeselect={false}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Switch
                checked={form.cancelAtPeriodEnd}
                label="Cancel at period end"
                onChange={(event) => {
                  const checked = event.currentTarget.checked
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          cancelAtPeriodEnd: checked,
                        }
                      : current
                  )
                }}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Metadata JSON"
                placeholder='{"source":"admin","notes":"Subscribed during migration"}'
                minRows={6}
                value={form.metadataText}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          metadataText: value,
                        }
                      : current
                  )
                }}
                classNames={{ input: classes.consoleText }}
              />
            </Grid.Col>
          </Grid>

          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Text size="sm" className={classes.mutedText}>
              {hasExistingSubscription
                ? `Current period ends ${formatCompactDate(currentPeriodEnd) ?? 'n/a'}.`
                : 'Attach this team to a billing plan and start coin entitlement tracking.'}{' '}
              Metadata must be a JSON object or blank.
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button
                variant="light"
                disabled={hasExistingSubscription ? !hasChanges || !baseline : !baseline}
                onClick={onReset}
              >
                Reset
              </Button>
              <Button
                loading={saving}
                disabled={!form.planId || (hasExistingSubscription ? !hasChanges : false)}
                onClick={onSave}
              >
                {hasExistingSubscription ? 'Save subscription' : 'Subscribe team'}
              </Button>
            </Group>
          </Group>
        </Stack>
      ) : (
        <Text size="sm" className={classes.mutedText}>
          Loading team subscription details.
        </Text>
      )}
    </DetailSection>
  )
}

function SessionMemberAssignmentSection({
  form,
  setForm,
  userOptions,
  saving,
  onAssign,
  expanded,
  onToggle,
}: {
  form: SessionMemberCreateFormState
  setForm: React.Dispatch<React.SetStateAction<SessionMemberCreateFormState>>
  userOptions: Array<{ value: string; label: string }>
  saving: boolean
  onAssign: () => void
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <DetailSection
      title="Assign members"
      icon={<IconPlus size={16} />}
      collapsible
      expanded={expanded}
      onToggle={onToggle}
      bodyClassName={classes.inspectorSectionBody}
      action={
        <Badge color="selected" variant="light">
          add users
        </Badge>
      }
    >
      <Stack gap="md">
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <MultiSelect
              label="Users"
              searchable
              data={userOptions}
              value={form.userIds}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  userIds: value,
                }))
              }
              nothingFoundMessage="No eligible users found"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Select
              label="Role"
              data={SESSION_MEMBER_ROLE_OPTIONS.map((value) => ({
                value,
                label: value.charAt(0).toUpperCase() + value.slice(1),
              }))}
              value={form.role}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  role: value ?? 'viewer',
                }))
              }
            />
          </Grid.Col>
        </Grid>

        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text size="sm" className={classes.mutedText}>
            Add one or more existing users to the session as editors or viewers.
          </Text>
          <Button loading={saving} onClick={onAssign}>
            Add to session
          </Button>
        </Group>
      </Stack>
    </DetailSection>
  )
}

function HealthRow({
  label,
  data,
  loading,
  error,
  status,
  detail,
}: {
  label: string
  data: unknown
  loading: boolean
  error: string | null
  status?: string | null
  detail?: string | null
}) {
  const resolvedStatus = resolveHealthRowStatus({ data, loading, error, status })
  const resolvedDetail = resolveHealthRowDetail({ data, error, detail })

  return (
    <div className={classes.statusRow}>
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Text fw={600} size="sm">
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {resolvedDetail}
        </Text>
      </Box>
      <Box style={{ flexShrink: 0 }}>
        <StatusBadge status={resolvedStatus} />
      </Box>
    </div>
  )
}

export function AdminWorkspacePage({ view }: { view: AdminWorkspaceView }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { adminIdentity, isSystemAdmin, isCheckingAccess, accessError } = useAdminAccess()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [userFilter, setUserFilter] = useState('')
  const [userListMode, setUserListMode] = useState<'all' | 'access-requests'>('all')
  const [teamFilter, setTeamFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isInvitingUser, setIsInvitingUser] = useState(false)
  const [createUserForm, setCreateUserForm] = useState<UserCreateFormState>(EMPTY_USER_CREATE_FORM)
  const [inviteUserForm, setInviteUserForm] = useState<UserInviteFormState>(EMPTY_USER_INVITE_FORM)
  const [studioAccessQuotas, setStudioAccessQuotas] = useState<Record<string, number>>({})
  const [studioAccessRoles, setStudioAccessRoles] = useState<Record<string, ReviewRole>>({})
  const [coinRefillApprovedAmounts, setCoinRefillApprovedAmounts] = useState<
    Record<string, number>
  >({})
  const [reviewingStudioAccessUserId, setReviewingStudioAccessUserId] = useState<string | null>(
    null
  )
  const [reviewingCoinRefillUserId, setReviewingCoinRefillUserId] = useState<string | null>(null)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [createTeamForm, setCreateTeamForm] = useState<TeamCreateFormState>(EMPTY_TEAM_CREATE_FORM)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [createSessionForm, setCreateSessionForm] =
    useState<SessionCreateFormState>(EMPTY_SESSION_CREATE_FORM)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userInspectorMode, setUserInspectorMode] = useState<'user' | 'team' | 'session'>('user')
  const [userInspectorReturnMode, setUserInspectorReturnMode] = useState<'user' | 'team'>('user')
  const [userInspectorSections, setUserInspectorSections] = useState<Record<string, boolean>>({})
  const [teamInspectorMode, setTeamInspectorMode] = useState<'team' | 'session'>('team')
  const [teamInspectorSections, setTeamInspectorSections] = useState<Record<string, boolean>>({})
  const [sessionInspectorSections, setSessionInspectorSections] = useState<Record<string, boolean>>(
    {}
  )
  const [userEditForm, setUserEditForm] = useState<UserEditFormState | null>(null)
  const [teamEditForm, setTeamEditForm] = useState<TeamEditFormState | null>(null)
  const [teamSubscriptionForm, setTeamSubscriptionForm] =
    useState<TeamSubscriptionFormState | null>(null)
  const [sessionEditForm, setSessionEditForm] = useState<SessionEditFormState | null>(null)
  const [teamMembershipEditForm, setTeamMembershipEditForm] =
    useState<TeamMembershipEditFormState | null>(null)
  const [teamMemberCreateForm, setTeamMemberCreateForm] = useState<TeamMemberCreateFormState>(
    EMPTY_TEAM_MEMBER_CREATE_FORM
  )
  const [teamMemberInviteForm, setTeamMemberInviteForm] = useState<TeamMemberInviteFormState>(
    EMPTY_TEAM_MEMBER_INVITE_FORM
  )
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionMemberCreateForm, setSessionMemberCreateForm] =
    useState<SessionMemberCreateFormState>(EMPTY_SESSION_MEMBER_CREATE_FORM)
  const [selectedSessionActivityKey, setSelectedSessionActivityKey] = useState<string | null>(null)
  const [selectedTranscriptKey, setSelectedTranscriptKey] = useState<string | null>(null)
  const [selectedTraceKey, setSelectedTraceKey] = useState<string | null>(null)

  const requestedUserId = searchParams.get('userId')?.trim() || null
  const requestedUserPanel = searchParams.get('panel')?.trim() || null
  const requestedTeamId = searchParams.get('teamId')?.trim() || null
  const requestedSessionId = searchParams.get('sessionId')?.trim() || null

  const liveRefetch = autoRefresh ? 30_000 : false

  const overviewQuery = useConsoleJsonQuery(
    'overview',
    '/api/v1/admin/overview',
    isSystemAdmin,
    liveRefetch
  )
  const dependenciesQuery = useConsoleJsonQuery(
    'dependencies',
    '/api/v1/admin/health/dependencies',
    isSystemAdmin,
    liveRefetch
  )
  const versionQuery = useConsoleJsonQuery('version', '/api/v1/admin/version', isSystemAdmin)
  const runtimeConfigQuery = useConsoleJsonQuery(
    'runtime-config',
    '/api/v1/admin/runtime-config',
    isSystemAdmin
  )
  const healthQuery = useConsoleJsonQuery('health', '/api/v1/health', isSystemAdmin, liveRefetch)
  const authMeQuery = useConsoleJsonQuery('auth-me', '/api/v1/auth/me', isSystemAdmin)
  const authValidateQuery = useConsoleJsonQuery(
    'auth-validate',
    '/api/v1/auth/validate',
    isSystemAdmin,
    liveRefetch
  )
  const sessionServiceHealthQuery = useConsoleJsonQuery(
    'session-service-health',
    '/api/v1/simulation/sessions/health',
    isSystemAdmin,
    liveRefetch
  )
  const llmServiceHealthQuery = useConsoleJsonQuery(
    'llm-service-health',
    '/api/v1/simulation/llm/health',
    isSystemAdmin,
    liveRefetch
  )
  const usersQuery = useConsoleJsonQuery('users', '/api/v1/admin/users', isSystemAdmin)
  const studioAccessRequestsQuery = useConsoleJsonQuery(
    'studio-access-requests',
    '/api/v1/studio-access/requests',
    isSystemAdmin && view === 'users',
    liveRefetch
  )
  const teamsQuery = useConsoleJsonQuery('teams', '/api/v1/admin/teams', isSystemAdmin)
  const plansQuery = useConsoleJsonQuery('plans', '/api/v1/admin/plans', isSystemAdmin)
  const subscriptionsQuery = useConsoleJsonQuery(
    'subscriptions',
    '/api/v1/admin/subscriptions',
    isSystemAdmin
  )
  const sessionsQuery = useConsoleJsonQuery(
    'sessions',
    '/api/v1/admin/sessions?limit=50',
    isSystemAdmin
  )
  const userDetailQuery = useConsoleJsonQuery(
    'user-detail',
    `/api/v1/admin/users/${selectedUserId ?? 'missing'}`,
    isSystemAdmin && Boolean(selectedUserId)
  )
  const userActivityQuery = useConsoleJsonQuery(
    'user-activity',
    `/api/v1/admin/users/${selectedUserId ?? 'missing'}/activity`,
    isSystemAdmin && Boolean(selectedUserId)
  )
  const userSessionsQuery = useConsoleJsonQuery(
    'user-sessions',
    `/api/v1/admin/users/${selectedUserId ?? 'missing'}/sessions?limit=50`,
    isSystemAdmin && Boolean(selectedUserId)
  )
  const selectedUserTeamIdsFromActivity = useMemo(() => {
    const payload = isRecord(userActivityQuery.data) ? userActivityQuery.data : {}
    const activityUser = isRecord(payload.user) ? payload.user : {}
    const memberships = Array.isArray(activityUser.memberships)
      ? activityUser.memberships.filter(isRecord)
      : []

    return Array.from(
      new Set(
        memberships
          .map((membership) => {
            const team = isRecord(membership.team) ? membership.team : {}
            return readString(membership.teamId, team.id)
          })
          .filter((teamId): teamId is string => Boolean(teamId))
      )
    )
  }, [userActivityQuery.data])
  const userMembershipTeamsQuery = useQuery({
    queryKey: [
      'admin-console',
      'user-membership-teams',
      selectedUserId,
      selectedUserTeamIdsFromActivity,
    ],
    enabled:
      isSystemAdmin &&
      view === 'users' &&
      Boolean(selectedUserId) &&
      selectedUserTeamIdsFromActivity.length > 0,
    queryFn: async () =>
      Promise.all(
        selectedUserTeamIdsFromActivity.map(async (teamId) => {
          try {
            const usage = await requestJsonPath(
              `/api/v1/admin/teams/${encodeURIComponent(teamId)}/usage`
            )

            return {
              teamId,
              usage,
            }
          } catch (error) {
            return {
              teamId,
              error: error instanceof Error ? error.message : 'Unable to load team usage snapshot',
            }
          }
        })
      ),
  })
  const teamDetailQuery = useConsoleJsonQuery(
    'team-detail',
    `/api/v1/admin/teams/${selectedTeamId ?? 'missing'}`,
    isSystemAdmin && Boolean(selectedTeamId)
  )
  const planDetailQuery = useConsoleJsonQuery(
    'plan-detail',
    `/api/v1/admin/plans/${selectedPlanId ?? 'missing'}`,
    isSystemAdmin && Boolean(selectedPlanId) && !isCreatingPlan
  )
  const teamUsageQuery = useConsoleJsonQuery(
    'team-usage',
    `/api/v1/admin/teams/${selectedTeamId ?? 'missing'}/usage`,
    isSystemAdmin && Boolean(selectedTeamId)
  )
  const teamSubscriptionQuery = useConsoleJsonQuery(
    'team-subscription',
    `/api/v1/admin/subscriptions/teams/${selectedTeamId ?? 'missing'}`,
    isSystemAdmin && Boolean(selectedTeamId)
  )
  const teamSessionsQuery = useConsoleJsonQuery(
    'team-sessions',
    `/api/v1/admin/sessions?orgId=${encodeURIComponent(selectedTeamId ?? 'missing')}&limit=50`,
    isSystemAdmin && Boolean(selectedTeamId)
  )
  const sessionDetailQuery = useConsoleJsonQuery(
    'session-detail',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionMembersQuery = useConsoleJsonQuery(
    'session-members',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/members`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionTimelineQuery = useConsoleJsonQuery(
    'session-timeline',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/timeline?limit=50`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionInvitationsQuery = useConsoleJsonQuery(
    'session-invitations',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/invitations`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionAssessmentQuery = useConsoleJsonQuery(
    'session-assessment',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/assessments/latest`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionTranscriptQuery = useConsoleJsonQuery(
    'session-transcript',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/transcript`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionEventsQuery = useConsoleJsonQuery(
    'session-events',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/events?limit=50`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const sessionLlmCallsQuery = useConsoleJsonQuery(
    'session-llm-calls',
    `/api/v1/admin/sessions/${selectedSessionId ?? 'missing'}/llm-calls?limit=50`,
    isSystemAdmin && Boolean(selectedSessionId)
  )
  const personasQuery = useConsoleJsonQuery(
    'personas',
    '/api/v1/simulation/personas',
    isSystemAdmin
  )
  const scenariosQuery = useConsoleJsonQuery(
    'scenarios',
    '/api/v1/simulation/scenarios',
    isSystemAdmin
  )
  const llmProvidersQuery = useConsoleJsonQuery(
    'llm-providers',
    '/api/v1/simulation/llm/providers',
    isSystemAdmin
  )
  const ttsProvidersQuery = useConsoleJsonQuery(
    'tts-providers',
    '/api/v1/tts/providers',
    isSystemAdmin
  )
  const challengesQuery = useConsoleJsonQuery('challenges', '/api/v1/challenges', isSystemAdmin)
  const salesforceStatusQuery = useConsoleJsonQuery(
    'salesforce-status',
    '/api/crm/salesforce/status',
    isSystemAdmin
  )
  const jobsQuery = useConsoleJsonQuery('jobs', '/api/v1/admin/jobs', isSystemAdmin, liveRefetch)
  const queuesQuery = useConsoleJsonQuery(
    'queues',
    '/api/v1/admin/queues',
    isSystemAdmin,
    liveRefetch
  )

  const parseOptionalJsonObject = (value: string, label: string) => {
    if (!value) return undefined

    const parsed = JSON.parse(value)
    if (!isRecord(parsed)) {
      throw new Error(`${label} must be a JSON object or blank`)
    }

    return parsed
  }

  const toNullableValue = (value: string) => {
    const trimmed = value.trim()
    return trimmed || null
  }

  const buildCreateUserPayload = () => {
    const name = createUserForm.name.trim()
    const email = createUserForm.email.trim()
    const avatar = createUserForm.avatar.trim()

    if (!name) {
      throw new Error('User name is required')
    }

    if (!email) {
      throw new Error('User email is required')
    }

    return {
      email,
      name,
      avatar: avatar || null,
      isActive: createUserForm.isActive,
    }
  }

  const createUserMutation = useMutation({
    mutationFn: () =>
      requestJsonPath('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(buildCreateUserPayload()),
      }),
    onSuccess: (createdUser) => {
      const createdUserId = isRecord(createdUser) ? readString(createdUser.id) : null
      setIsCreatingUser(false)
      setCreateUserForm(EMPTY_USER_CREATE_FORM)
      if (createdUserId) {
        setSelectedUserId(createdUserId)
        setUserInspectorMode('user')
        setUserInspectorReturnMode('user')
      }
      notifications.show({
        title: 'User created',
        message: 'The new account is ready to inspect and edit.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Create user failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildInviteUserPayload = () => {
    const email = inviteUserForm.email.trim()
    const teamId = inviteUserForm.teamId.trim()
    const role = inviteUserForm.role.trim().toUpperCase()

    if (!email) {
      throw new Error('Invite email is required')
    }

    if (!teamId) {
      throw new Error('Choose a team for the invite')
    }

    if (!TEAM_ROLE_OPTIONS.includes(role as (typeof TEAM_ROLE_OPTIONS)[number])) {
      throw new Error('Invite role is invalid')
    }

    if (role === 'OWNER') {
      throw new Error('Owner role cannot be assigned through signup invites')
    }

    return {
      teamId,
      body: {
        email,
        role,
      },
    }
  }

  const buildTeamMemberInvitePayload = (teamId: string) => {
    const email = teamMemberInviteForm.email.trim()
    const role = teamMemberInviteForm.role.trim().toUpperCase()

    if (!email) {
      throw new Error('Invite email is required')
    }

    if (!teamId) {
      throw new Error('Choose a team for the invite')
    }

    if (!TEAM_ROLE_OPTIONS.includes(role as (typeof TEAM_ROLE_OPTIONS)[number])) {
      throw new Error('Invite role is invalid')
    }

    if (role === 'OWNER') {
      throw new Error('Owner role cannot be assigned through signup invites')
    }

    return {
      teamId,
      body: {
        email,
        role,
      },
    }
  }

  const inviteUserMutation = useMutation({
    mutationFn: () => {
      const payload = buildInviteUserPayload()
      return requestJsonPath(
        `/api/v1/admin/teams/${encodeURIComponent(payload.teamId)}/invitations/signup`,
        {
          method: 'POST',
          body: JSON.stringify(payload.body),
        }
      )
    },
    onSuccess: () => {
      setInviteUserForm((current) => ({
        ...current,
        email: '',
      }))
      notifications.show({
        title: 'Invite sent',
        message: 'The signup email has been queued for delivery.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Invite failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const approveStudioAccessMutation = useMutation({
    mutationFn: ({
      request,
      quota,
      role,
    }: {
      request: StudioAccessRequest
      quota: number
      role: ReviewRole
    }) =>
      requestJsonPath(
        `/api/v1/studio-access/requests/${encodeURIComponent(request.userId)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ quota, role }),
        }
      ),
    onSuccess: (_result, { request, quota, role }) => {
      notifications.show({
        title: 'Access approved',
        message: `${request.email} now has Studio access as ${role === 'ADMIN' ? 'an admin' : 'a regular user'} with ${formatNumber(quota)} coins.`,
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Approval failed',
        message: error instanceof Error ? error.message : 'Unable to approve access right now.',
        color: 'brand',
      })
    },
    onSettled: () => {
      setReviewingStudioAccessUserId(null)
    },
  })

  const denyStudioAccessMutation = useMutation({
    mutationFn: ({ request }: { request: StudioAccessRequest }) =>
      requestJsonPath(`/api/v1/studio-access/requests/${encodeURIComponent(request.userId)}/deny`, {
        method: 'POST',
      }),
    onSuccess: (_result, { request }) => {
      notifications.show({
        title: 'Access denied',
        message: `${request.email} was notified that Studio access was not approved.`,
        color: 'yellow',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Denial failed',
        message: error instanceof Error ? error.message : 'Unable to deny access right now.',
        color: 'brand',
      })
    },
    onSettled: () => {
      setReviewingStudioAccessUserId(null)
    },
  })

  const handleApproveStudioAccess = (request: StudioAccessRequest) => {
    const quota = Math.floor(studioAccessQuotas[request.userId] ?? request.quota ?? 5000)
    const role =
      studioAccessRoles[request.userId] ?? (request.role === 'ADMIN' ? 'ADMIN' : 'MEMBER')

    if (quota <= 0) {
      notifications.show({
        title: 'Invalid quota',
        message: 'Quota must be greater than zero.',
        color: 'brand',
      })
      return
    }

    setReviewingStudioAccessUserId(request.userId)
    approveStudioAccessMutation.mutate({ request, quota, role })
  }

  const handleDenyStudioAccess = (request: StudioAccessRequest) => {
    setReviewingStudioAccessUserId(request.userId)
    denyStudioAccessMutation.mutate({ request })
  }

  const approveCoinRefillMutation = useMutation({
    mutationFn: ({
      request,
      approvedCoins,
    }: {
      request: PendingCoinRefillRequest
      approvedCoins: number
    }) =>
      requestJsonPath(
        `/api/v1/coins/refill/requests/${encodeURIComponent(request.userId)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ approvedCoins }),
        }
      ),
    onSuccess: (_result, { request, approvedCoins }) => {
      notifications.show({
        title: 'Top-up approved',
        message: `Approved ${formatNumber(approvedCoins)} personal credits for ${request.email}.`,
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Approval failed',
        message:
          error instanceof Error ? error.message : 'Unable to approve this top-up right now.',
        color: 'brand',
      })
    },
    onSettled: () => {
      setReviewingCoinRefillUserId(null)
    },
  })

  const denyCoinRefillMutation = useMutation({
    mutationFn: ({ request }: { request: PendingCoinRefillRequest }) =>
      requestJsonPath(`/api/v1/coins/refill/requests/${encodeURIComponent(request.userId)}/deny`, {
        method: 'POST',
      }),
    onSuccess: (_result, { request }) => {
      notifications.show({
        title: 'Top-up denied',
        message: `Denied the personal credit top-up request for ${request.email}.`,
        color: 'yellow',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Denial failed',
        message: error instanceof Error ? error.message : 'Unable to deny this top-up right now.',
        color: 'brand',
      })
    },
    onSettled: () => {
      setReviewingCoinRefillUserId(null)
    },
  })

  const handleApproveCoinRefill = (request: PendingCoinRefillRequest) => {
    const approvedCoins = Math.floor(
      coinRefillApprovedAmounts[request.userId] ?? request.requestedCoins
    )

    if (approvedCoins <= 0) {
      notifications.show({
        title: 'Invalid amount',
        message: 'Approved coins must be greater than zero.',
        color: 'brand',
      })
      return
    }

    setReviewingCoinRefillUserId(request.userId)
    approveCoinRefillMutation.mutate({ request, approvedCoins })
  }

  const handleDenyCoinRefill = (request: PendingCoinRefillRequest) => {
    setReviewingCoinRefillUserId(request.userId)
    denyCoinRefillMutation.mutate({ request })
  }

  const buildSessionUpdatePayload = () => {
    if (!sessionEditForm) {
      throw new Error('Session editor is not ready yet')
    }

    const orgId = sessionEditForm.orgId.trim()
    const type = sessionEditForm.type.trim().toLowerCase()
    const status = sessionEditForm.status.trim().toLowerCase()
    const sessionConfigText = sessionEditForm.sessionConfigText.trim()

    if (!orgId) {
      throw new Error('Team / org is required')
    }

    if (!SESSION_TYPE_OPTIONS.includes(type as (typeof SESSION_TYPE_OPTIONS)[number])) {
      throw new Error('Session type is invalid')
    }

    if (!SESSION_STATUS_OPTIONS.includes(status as (typeof SESSION_STATUS_OPTIONS)[number])) {
      throw new Error('Session status is invalid')
    }

    let sessionConfig: Record<string, unknown> | null = null
    if (sessionConfigText) {
      const parsed = JSON.parse(sessionConfigText)
      if (!isRecord(parsed)) {
        throw new Error('Session config must be a JSON object or blank')
      }
      sessionConfig = parsed
    }

    const tags = Array.from(
      new Set(
        sessionEditForm.tagsText
          .split(/[,\n]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    )

    const toNullableValue = (value: string) => {
      const trimmed = value.trim()
      return trimmed || null
    }

    return {
      orgId,
      name: toNullableValue(sessionEditForm.name),
      type,
      status,
      tags,
      language: toNullableValue(sessionEditForm.language),
      scenarioId: toNullableValue(sessionEditForm.scenarioId),
      personaId: toNullableValue(sessionEditForm.personaId),
      crmContextId: toNullableValue(sessionEditForm.crmContextId),
      sessionConfig,
    }
  }
  const updateSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      requestJsonPath(`/api/v1/admin/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        body: JSON.stringify(buildSessionUpdatePayload()),
      }),
    onSuccess: (updatedSession) => {
      if (isRecord(updatedSession)) {
        setSessionEditForm(toSessionEditFormState(updatedSession))
      }
      notifications.show({
        title: 'Session updated',
        message: 'Session changes are now live.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Session update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildCreateSessionPayload = () => {
    const orgId = createSessionForm.orgId.trim()
    const type = createSessionForm.type.trim().toLowerCase()
    const sessionConfigText = createSessionForm.sessionConfigText.trim()

    if (!orgId) {
      throw new Error('Team / org is required')
    }

    if (!SESSION_TYPE_OPTIONS.includes(type as (typeof SESSION_TYPE_OPTIONS)[number])) {
      throw new Error('Session type is invalid')
    }

    let sessionConfig: Record<string, unknown> | null = null
    if (sessionConfigText) {
      const parsed = JSON.parse(sessionConfigText)
      if (!isRecord(parsed)) {
        throw new Error('Session config must be a JSON object or blank')
      }
      sessionConfig = parsed
    }

    const tags = Array.from(
      new Set(
        createSessionForm.tagsText
          .split(/[,\n]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    )

    return {
      orgId,
      name: toNullableValue(createSessionForm.name),
      type,
      tags,
      language: toNullableValue(createSessionForm.language),
      scenarioId: toNullableValue(createSessionForm.scenarioId),
      personaId: toNullableValue(createSessionForm.personaId),
      crmContextId: toNullableValue(createSessionForm.crmContextId),
      sessionConfig,
    }
  }

  const buildSessionMemberCreatePayload = (formState = sessionMemberCreateForm) => {
    const userIds = Array.from(
      new Set(formState.userIds.map((userId) => userId.trim()).filter(Boolean))
    )
    const role = formState.role.trim().toLowerCase()

    if (userIds.length === 0) {
      throw new Error('Select at least one user to assign')
    }

    if (
      !SESSION_MEMBER_ROLE_OPTIONS.includes(role as (typeof SESSION_MEMBER_ROLE_OPTIONS)[number])
    ) {
      throw new Error('Session member role is invalid')
    }

    return {
      userIds,
      role,
    }
  }

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const createdSession = await requestJsonPath('/api/v1/admin/sessions', {
        method: 'POST',
        body: JSON.stringify(buildCreateSessionPayload()),
      })

      const createdSessionId = isRecord(createdSession) ? readString(createdSession.id) : null
      const initialMemberIds = Array.from(
        new Set(createSessionForm.memberUserIds.map((userId) => userId.trim()).filter(Boolean))
      )

      if (createdSessionId && initialMemberIds.length > 0) {
        await requestJsonPath(
          `/api/v1/admin/sessions/${encodeURIComponent(createdSessionId)}/members`,
          {
            method: 'POST',
            body: JSON.stringify({
              userIds: initialMemberIds,
              role: createSessionForm.memberRole,
            }),
          }
        )
      }

      return createdSession
    },
    onSuccess: (createdSession) => {
      const createdSessionId = isRecord(createdSession) ? readString(createdSession.id) : null
      setIsCreatingSession(false)
      setCreateSessionForm(EMPTY_SESSION_CREATE_FORM)
      if (createdSessionId) {
        setSelectedSessionId(createdSessionId)
      }
      notifications.show({
        title: 'Session created',
        message: 'The new session is ready for deeper editing and assignment.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Create session failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const addSessionMembersMutation = useMutation({
    mutationFn: (sessionId: string) =>
      requestJsonPath(`/api/v1/admin/sessions/${encodeURIComponent(sessionId)}/members`, {
        method: 'POST',
        body: JSON.stringify(buildSessionMemberCreatePayload()),
      }),
    onSuccess: () => {
      setSessionMemberCreateForm(EMPTY_SESSION_MEMBER_CREATE_FORM)
      notifications.show({
        title: 'Session members added',
        message: 'The session member list is refreshing now.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Add session members failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const removeSessionMemberMutation = useMutation({
    mutationFn: ({ sessionId, userId }: { sessionId: string; userId: string }) =>
      requestJsonPath(
        `/api/v1/admin/sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: (result, variables) => {
      const sessionDeleted = isRecord(result) ? readBoolean(result.sessionDeleted) === true : false
      const responseMessage = isRecord(result) ? readString(result.message) : null
      const newOwnerId = isRecord(result) ? readString(result.newOwnerId) : null

      notifications.show({
        title: sessionDeleted ? 'Session deleted' : 'Session member removed',
        message:
          responseMessage ??
          (sessionDeleted
            ? 'That was the last member, so the session was deleted.'
            : newOwnerId
              ? `The member was removed and ownership moved to ${newOwnerId}.`
              : 'The session member list is refreshing now.'),
        color: 'success',
      })

      if (sessionDeleted && selectedSessionId === variables.sessionId) {
        closeSessionInspector()
      }

      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Remove session member failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildTeamUpdatePayload = () => {
    if (!teamEditForm) {
      throw new Error('Team editor is not ready yet')
    }

    const name = teamEditForm.name.trim()
    const slug = teamEditForm.slug.trim()
    const billingEmail = teamEditForm.billingEmail.trim()
    const billingAddressText = teamEditForm.billingAddressText.trim()
    const metadataText = teamEditForm.metadataText.trim()

    if (!name) {
      throw new Error('Team name is required')
    }

    const parseOptionalObject = (value: string, label: string) => {
      if (!value) return undefined

      const parsed = JSON.parse(value)
      if (!isRecord(parsed)) {
        throw new Error(`${label} must be a JSON object or blank`)
      }
      return parsed
    }

    return {
      name,
      slug: slug || undefined,
      isActive: teamEditForm.isActive,
      billingEmail: billingEmail || null,
      billingAddress: parseOptionalObject(billingAddressText, 'Billing address'),
      metadata: parseOptionalObject(metadataText, 'Metadata'),
    }
  }
  const updateTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      requestJsonPath(`/api/v1/admin/teams/${encodeURIComponent(teamId)}`, {
        method: 'PUT',
        body: JSON.stringify(buildTeamUpdatePayload()),
      }),
    onSuccess: (updatedTeam) => {
      if (isRecord(updatedTeam)) {
        setTeamEditForm(toTeamEditFormState(updatedTeam))
      }
      notifications.show({
        title: 'Team updated',
        message: 'Team changes are now live.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Team update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildCreateTeamPayload = () => {
    const name = createTeamForm.name.trim()
    const slug = createTeamForm.slug.trim()
    const billingEmail = createTeamForm.billingEmail.trim()
    const billingAddressText = createTeamForm.billingAddressText.trim()

    if (!name) {
      throw new Error('Team name is required')
    }

    return {
      name,
      slug: slug || undefined,
      billingEmail: billingEmail || undefined,
      billingAddress: parseOptionalJsonObject(billingAddressText, 'Billing address'),
    }
  }

  const createTeamMutation = useMutation({
    mutationFn: () =>
      requestJsonPath('/api/v1/admin/teams', {
        method: 'POST',
        body: JSON.stringify(buildCreateTeamPayload()),
      }),
    onSuccess: (createdTeam) => {
      const createdTeamId = isRecord(createdTeam) ? readString(createdTeam.id) : null
      setIsCreatingTeam(false)
      setCreateTeamForm(EMPTY_TEAM_CREATE_FORM)
      if (createdTeamId) {
        setSelectedTeamId(createdTeamId)
        setTeamInspectorMode('team')
      }
      notifications.show({
        title: 'Team created',
        message: 'You can add members and adjust billing details now.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Create team failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildUserUpdatePayload = () => {
    if (!userEditForm) {
      throw new Error('User editor is not ready yet')
    }

    const name = userEditForm.name.trim()
    const email = userEditForm.email.trim()
    const avatar = userEditForm.avatar.trim()
    const settingsText = userEditForm.settingsText.trim()

    if (!name) {
      throw new Error('User name is required')
    }

    if (!email) {
      throw new Error('User email is required')
    }

    let settings: Record<string, unknown> | null = null
    if (settingsText) {
      const parsed = JSON.parse(settingsText)
      if (!isRecord(parsed)) {
        throw new Error('Settings must be a JSON object or blank')
      }
      settings = parsed
    }

    return {
      email,
      name,
      avatar: avatar || null,
      isActive: userEditForm.isActive,
      settings,
    }
  }
  const updateUserMutation = useMutation({
    mutationFn: (userId: string) =>
      requestJsonPath(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        body: JSON.stringify(buildUserUpdatePayload()),
      }),
    onSuccess: (updatedUser) => {
      if (isRecord(updatedUser)) {
        setUserEditForm(toUserEditFormState(updatedUser))
      }
      notifications.show({
        title: 'User updated',
        message: 'User profile changes are now live.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'User update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      requestJsonPath(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      notifications.show({
        title: 'User deleted',
        message: 'The user has been removed from the platform.',
        color: 'success',
      })
      closeUserInspector()
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Delete user failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })
  const buildTeamMembershipPayload = () => {
    if (!teamMembershipEditForm) {
      throw new Error('Membership editor is not ready yet')
    }

    const role = teamMembershipEditForm.role.toUpperCase()

    if (!TEAM_ROLE_OPTIONS.includes(role as (typeof TEAM_ROLE_OPTIONS)[number])) {
      throw new Error('Membership role is invalid')
    }

    if (
      !Number.isFinite(teamMembershipEditForm.tokenLimit) ||
      teamMembershipEditForm.tokenLimit < 0
    ) {
      throw new Error('Token limit must be zero or greater')
    }

    return {
      role,
      tokenLimit: Math.trunc(teamMembershipEditForm.tokenLimit),
      isActive: teamMembershipEditForm.isActive,
    }
  }
  const updateTeamMembershipMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      requestJsonPath(
        `/api/v1/admin/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'PUT',
          body: JSON.stringify(buildTeamMembershipPayload()),
        }
      ),
    onSuccess: (updatedMembership) => {
      if (isRecord(updatedMembership)) {
        setTeamMembershipEditForm(
          toTeamMembershipEditFormState(updatedMembership, selectedUserTeamMembershipLimit)
        )
      }
      notifications.show({
        title: 'Membership updated',
        message: 'Team membership changes are now live.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Membership update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildTeamMemberCreatePayload = () => {
    const userId = teamMemberCreateForm.userId.trim()
    const role = teamMemberCreateForm.role.toUpperCase()

    if (!userId) {
      throw new Error('Select a user to add to this team')
    }

    if (!TEAM_ROLE_OPTIONS.includes(role as (typeof TEAM_ROLE_OPTIONS)[number])) {
      throw new Error('Membership role is invalid')
    }

    if (!Number.isFinite(teamMemberCreateForm.tokenLimit) || teamMemberCreateForm.tokenLimit < 0) {
      throw new Error('Coin limit must be zero or greater')
    }

    return {
      userId,
      role,
      tokenLimit: Math.trunc(teamMemberCreateForm.tokenLimit),
      isActive: teamMemberCreateForm.isActive,
    }
  }

  const addTeamMemberMutation = useMutation({
    mutationFn: (teamId: string) =>
      requestJsonPath(`/api/v1/admin/teams/${encodeURIComponent(teamId)}/members`, {
        method: 'POST',
        body: JSON.stringify(buildTeamMemberCreatePayload()),
      }),
    onSuccess: () => {
      setTeamMemberCreateForm(EMPTY_TEAM_MEMBER_CREATE_FORM)
      notifications.show({
        title: 'Team member added',
        message: 'The membership list is refreshing now.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Add team member failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const inviteTeamMemberMutation = useMutation({
    mutationFn: (teamId: string) => {
      const payload = buildTeamMemberInvitePayload(teamId)
      return requestJsonPath(
        `/api/v1/admin/teams/${encodeURIComponent(payload.teamId)}/invitations/signup`,
        {
          method: 'POST',
          body: JSON.stringify(payload.body),
        }
      )
    },
    onSuccess: () => {
      setTeamMemberInviteForm(EMPTY_TEAM_MEMBER_INVITE_FORM)
      notifications.show({
        title: 'Invite sent',
        message: 'The signup email has been queued for delivery.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Invite failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      requestJsonPath(
        `/api/v1/admin/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: (result, variables) => {
      notifications.show({
        title: 'Team member removed',
        message:
          (isRecord(result) ? readString(result.message) : null) ??
          'The membership list is refreshing now.',
        color: 'success',
      })

      if (selectedTeamId === variables.teamId && selectedUserId === variables.userId) {
        setTeamMembershipEditForm(null)
      }

      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Remove team member failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const requestTeamMemberRemoval = ({
    teamId,
    userId,
    role,
    label,
  }: {
    teamId: string
    userId: string
    role: string | null
    label: string
  }) => {
    if (role?.toUpperCase() === 'OWNER') {
      notifications.show({
        title: 'Transfer owner first',
        message: 'Use the team ownership transfer action before removing the current owner.',
        color: 'brand',
      })
      return
    }

    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Remove ${label} from team ${teamId}? This will deactivate their membership but keep the user account.`
      )
    ) {
      return
    }

    removeTeamMemberMutation.mutate({ teamId, userId })
  }

  const requestSessionMemberRemoval = ({
    sessionId,
    userId,
    role,
    label,
  }: {
    sessionId: string
    userId: string
    role: string | null
    label: string
  }) => {
    const ownerNote =
      role?.toLowerCase() === 'owner'
        ? ' Ownership will move to the next member, or the session will be deleted if nobody remains.'
        : ''

    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Remove ${label} from session ${sessionId}? This removes their session access.${ownerNote}`
      )
    ) {
      return
    }

    removeSessionMemberMutation.mutate({ sessionId, userId })
  }

  const buildTeamSubscriptionPayload = () => {
    if (!selectedTeamId) {
      throw new Error('Select a team before managing its subscription')
    }

    if (!teamSubscriptionForm) {
      throw new Error('Subscription editor is not ready yet')
    }

    const planId = teamSubscriptionForm.planId.trim()
    const interval = teamSubscriptionForm.interval.toUpperCase()
    const metadataText = teamSubscriptionForm.metadataText.trim()

    if (!planId) {
      throw new Error('Select a plan for this team')
    }

    if (
      !SUBSCRIPTION_INTERVAL_OPTIONS.includes(
        interval as (typeof SUBSCRIPTION_INTERVAL_OPTIONS)[number]
      )
    ) {
      throw new Error('Billing interval is invalid')
    }

    return {
      teamId: selectedTeamId,
      planId,
      interval,
      cancelAtPeriodEnd: teamSubscriptionForm.cancelAtPeriodEnd,
      metadata: metadataText
        ? parseOptionalJsonObject(metadataText, 'Subscription metadata')
        : readString(teamSubscription?.id)
          ? null
          : undefined,
    }
  }

  const saveTeamSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const payload = buildTeamSubscriptionPayload()
      const subscriptionId = readString(teamSubscription?.id)
      const currentPlanId = readString(teamSubscription?.planId, teamSubscriptionPlan.id) ?? ''
      const currentInterval = readString(teamSubscription?.interval)?.toUpperCase() ?? 'MONTH'
      const currentCancelAtPeriodEnd = readBoolean(teamSubscription?.cancelAtPeriodEnd) ?? false

      if (!subscriptionId) {
        return requestJsonPath('/api/v1/admin/subscriptions', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      const planChanged = payload.planId !== currentPlanId
      const billingChanged =
        payload.interval !== currentInterval ||
        payload.cancelAtPeriodEnd !== currentCancelAtPeriodEnd

      let latestResponse: unknown = null

      if (planChanged) {
        latestResponse = await requestJsonPath(
          `/api/v1/admin/subscriptions/${encodeURIComponent(subscriptionId)}/upgrade`,
          {
            method: 'PUT',
            body: JSON.stringify({
              planId: payload.planId,
              metadata: payload.metadata,
            }),
          }
        )
      }

      if (!planChanged || billingChanged) {
        latestResponse = await requestJsonPath(
          `/api/v1/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              teamId: payload.teamId,
              ...(planChanged ? {} : { planId: payload.planId }),
              interval: payload.interval,
              cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
              ...(planChanged
                ? {}
                : payload.metadata !== undefined
                  ? { metadata: payload.metadata }
                  : {}),
            }),
          }
        )
      }

      return latestResponse
    },
    onSuccess: () => {
      notifications.show({
        title: readString(teamSubscription?.id) ? 'Subscription updated' : 'Team subscribed',
        message: readString(teamSubscription?.id)
          ? 'The team billing settings are now live.'
          : 'The team is now attached to the selected plan.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Subscription update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildPlanPayload = () => {
    const name = planForm.name.trim()
    const description = planForm.description.trim()
    const normalizedLevel = planForm.planLevel.toUpperCase()

    if (!name) {
      throw new Error('Plan name is required')
    }

    if (name.length < 2 || name.length > 64) {
      throw new Error('Plan name must be between 2 and 64 characters')
    }

    if (!PLAN_LEVEL_OPTIONS.includes(normalizedLevel as (typeof PLAN_LEVEL_OPTIONS)[number])) {
      throw new Error('Plan level is invalid')
    }

    if (!Number.isFinite(planForm.maxCoins) || planForm.maxCoins < 0) {
      throw new Error('Max coins must be zero or greater')
    }

    return {
      name,
      description: description || undefined,
      planLevel: normalizedLevel,
      maxCoins: Math.trunc(planForm.maxCoins),
      isActive: planForm.isActive,
    }
  }
  const createPlanMutation = useMutation({
    mutationFn: () =>
      requestJsonPath('/api/v1/admin/plans', {
        method: 'POST',
        body: JSON.stringify(buildPlanPayload()),
      }),
    onSuccess: (createdPlan) => {
      const planId = isRecord(createdPlan) ? readString(createdPlan.id) : null
      setIsCreatingPlan(false)
      if (planId) {
        setSelectedPlanId(planId)
      }
      notifications.show({
        title: 'Plan created',
        message: 'The plans surface is refreshing now.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Create plan failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })
  const updatePlanMutation = useMutation({
    mutationFn: (planId: string) =>
      requestJsonPath(`/api/v1/admin/plans/${encodeURIComponent(planId)}`, {
        method: 'PUT',
        body: JSON.stringify(buildPlanPayload()),
      }),
    onSuccess: () => {
      closePlanInspector()
      notifications.show({
        title: 'Plan updated',
        message: 'Saved changes are now live.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Update plan failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })
  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) =>
      requestJsonPath(`/api/v1/admin/plans/${encodeURIComponent(planId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setSelectedPlanId(null)
      setIsCreatingPlan(false)
      setPlanForm(EMPTY_PLAN_FORM)
      notifications.show({
        title: 'Plan deactivated',
        message: 'The plan is now inactive in the admin catalog.',
        color: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-console'] })
    },
    onError: (error) => {
      notifications.show({
        title: 'Delete plan failed',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'brand',
      })
    },
  })

  const buildAdminEntityHref = (targetView: AdminEntityView, entityId?: string | null) => {
    const params = new URLSearchParams()

    if (entityId) {
      params.set(
        targetView === 'users' ? 'userId' : targetView === 'teams' ? 'teamId' : 'sessionId',
        entityId
      )
    }

    const query = params.toString()
    return `/studio/admin/${targetView}${query ? `?${query}` : ''}`
  }

  const replaceAdminEntitySelection = (targetView: AdminEntityView, entityId?: string | null) => {
    router.replace(buildAdminEntityHref(targetView, entityId), { scroll: false })
  }

  const pushAdminEntitySelection = (targetView: AdminEntityView, entityId: string) => {
    router.push(buildAdminEntityHref(targetView, entityId))
  }

  const openAdminUser = (userId: string, navigation: 'push' | 'replace' = 'push') => {
    if (view === 'users') {
      setIsCreatingUser(false)
      setIsInvitingUser(false)
      setSelectedUserId(userId)
      setUserInspectorReturnMode('user')
      setUserInspectorMode('user')
    }

    if (navigation === 'replace') {
      replaceAdminEntitySelection('users', userId)
      return
    }

    pushAdminEntitySelection('users', userId)
  }

  const openAdminTeam = (teamId: string, navigation: 'push' | 'replace' = 'push') => {
    if (view === 'teams') {
      setIsCreatingTeam(false)
      setSelectedSessionId(null)
      setTeamInspectorMode('team')
      setSelectedTeamId(teamId)
    }

    if (navigation === 'replace') {
      replaceAdminEntitySelection('teams', teamId)
      return
    }

    pushAdminEntitySelection('teams', teamId)
  }

  const openAdminSession = (sessionId: string, navigation: 'push' | 'replace' = 'push') => {
    if (view === 'sessions') {
      setIsCreatingSession(false)
      setSelectedSessionId(sessionId)
    }

    if (navigation === 'replace') {
      replaceAdminEntitySelection('sessions', sessionId)
      return
    }

    pushAdminEntitySelection('sessions', sessionId)
  }

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-console'] })
  }

  const closeUserInspector = () => {
    setIsCreatingUser(false)
    setIsInvitingUser(false)
    setCreateUserForm(EMPTY_USER_CREATE_FORM)
    setInviteUserForm(EMPTY_USER_INVITE_FORM)
    setSelectedUserId(null)
    setUserInspectorMode('user')
    setUserInspectorReturnMode('user')
    setUserInspectorSections({})
    if (view === 'users') {
      replaceAdminEntitySelection('users')
    }
  }

  const isUserInspectorSectionExpanded = (sectionId: string) =>
    userInspectorSections[sectionId] === true

  const toggleUserInspectorSection = (sectionId: string) => {
    setUserInspectorSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }))
  }

  const closeTeamInspector = () => {
    setIsCreatingTeam(false)
    setSelectedTeamId(null)
    setSelectedSessionId(null)
    setTeamInspectorMode('team')
    setTeamInspectorSections({})
    if (view === 'teams') {
      replaceAdminEntitySelection('teams')
    }
  }

  const isTeamInspectorSectionExpanded = (sectionId: string) =>
    teamInspectorSections[sectionId] === true

  const toggleTeamInspectorSection = (sectionId: string) => {
    setTeamInspectorSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }))
  }

  const closePlanInspector = () => {
    setIsCreatingPlan(false)
    setSelectedPlanId(null)
    setPlanForm(EMPTY_PLAN_FORM)
  }

  const openCreatePlanInspector = () => {
    closePlanInspector()
    setPlanForm(EMPTY_PLAN_FORM)
    setIsCreatingPlan(true)
  }

  const closeSessionInspector = () => {
    setIsCreatingSession(false)
    setSelectedSessionId(null)
    setSessionInspectorSections({})
    if (view === 'sessions') {
      replaceAdminEntitySelection('sessions')
    }
  }

  const isSessionInspectorSectionExpanded = (sectionId: string) =>
    sessionInspectorSections[sectionId] === true

  const toggleSessionInspectorSection = (sectionId: string) => {
    setSessionInspectorSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }))
  }

  const overviewData = isRecord(overviewQuery.data) ? overviewQuery.data : {}
  const authMeData = isRecord(authMeQuery.data) ? authMeQuery.data : {}
  const runtimeConfig = isRecord(runtimeConfigQuery.data) ? runtimeConfigQuery.data : {}
  const runtimeApp = isRecord(runtimeConfig.app) ? runtimeConfig.app : {}
  const runtimeAuth = isRecord(runtimeConfig.auth) ? runtimeConfig.auth : {}
  const runtimeIntegrations = isRecord(runtimeConfig.integrations) ? runtimeConfig.integrations : {}
  const versionData = isRecord(versionQuery.data) ? versionQuery.data : {}
  const versionApi = isRecord(versionData.api) ? versionData.api : {}
  const versionBuild = isRecord(versionData.build) ? versionData.build : {}
  const buildBranch = readString(versionBuild.branch)
  const buildBranchUrl = readString(versionBuild.branchUrl)
  const dependenciesData = isRecord(dependenciesQuery.data) ? dependenciesQuery.data : {}
  const overviewTotals = isRecord(overviewData.totals) ? overviewData.totals : {}
  const dependencies = isRecord(dependenciesData.dependencies) ? dependenciesData.dependencies : {}
  const users = extractArray(usersQuery.data)
  const studioAccessRequests = useMemo(
    () =>
      extractArray(studioAccessRequestsQuery.data)
        .map((request) => toStudioAccessRequest(request))
        .filter((request): request is StudioAccessRequest => request !== null),
    [studioAccessRequestsQuery.data]
  )
  const studioAccessRequestUserIds = useMemo(
    () => new Set(studioAccessRequests.map((request) => request.userId)),
    [studioAccessRequests]
  )
  const selectedUserStudioAccessRequest = useMemo(
    () =>
      selectedUserId
        ? (studioAccessRequests.find((request) => request.userId === selectedUserId) ?? null)
        : null,
    [selectedUserId, studioAccessRequests]
  )
  const teams = extractArray(teamsQuery.data)
  const plans = extractArray(plansQuery.data)
  const subscriptions = extractArray(subscriptionsQuery.data)
  const sessions = extractArray(sessionsQuery.data)
  const userSelectOptions = useMemo(
    () =>
      users
        .map((user) => {
          const value = getRecordId(user)
          if (!value) return null

          return {
            value,
            label: `${getUserLabel(user)} • ${truncateMiddle(readString(user.email, value), 48)}`,
          }
        })
        .filter((option): option is { value: string; label: string } => option !== null),
    [users]
  )
  const filteredUsers = useMemo(() => {
    const needle = userFilter.trim().toLowerCase()
    return users.filter((user) => {
      const userId = getRecordId(user)
      const matchesMode =
        userListMode === 'all' || (userId ? studioAccessRequestUserIds.has(userId) : false)

      if (!matchesMode) {
        return false
      }

      if (!needle) {
        return true
      }

      return [
        user.name,
        user.email,
        user.id,
        user.role,
        getUserStatus(user),
        getStudioAccessStatus(user),
        getStudioAccessSettings(user).role,
        getStudioAccessRequestedAt(user),
        studioAccessRequestUserIds.has(userId ?? '') ? 'requested access' : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [studioAccessRequestUserIds, userFilter, userListMode, users])
  const userListModeOptions = useMemo(
    () => [
      {
        label: `All users (${formatNumber(users.length)})`,
        value: 'all',
      },
      {
        label: `Requested access (${formatNumber(studioAccessRequests.length)})`,
        value: 'access-requests',
      },
    ],
    [studioAccessRequests.length, users.length]
  )
  const filteredTeams = useMemo(() => {
    const needle = teamFilter.trim().toLowerCase()
    if (!needle) return teams
    return teams.filter((team) =>
      [team.name, team.slug, team.id, team.billingEmail].join(' ').toLowerCase().includes(needle)
    )
  }, [teamFilter, teams])
  const filteredPlans = useMemo(() => {
    const needle = planFilter.trim().toLowerCase()
    if (!needle) return plans
    return plans.filter((plan) =>
      [
        plan.name,
        plan.description,
        plan.id,
        plan.planLevel,
        String(readNumber(plan.maxCoins) ?? ''),
        plan.isActive === false ? 'inactive' : 'active',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
  }, [planFilter, plans])
  const filteredSessions = useMemo(() => {
    const needle = sessionFilter.trim().toLowerCase()
    if (!needle) return sessions
    return sessions.filter((session) =>
      [
        session.name,
        session.id,
        session.status,
        session.type,
        isRecord(session.scenario) ? session.scenario.name : '',
        isRecord(session.persona) ? session.persona.name : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
  }, [sessionFilter, sessions])
  const personas = extractArray(personasQuery.data)
  const scenarios = extractArray(scenariosQuery.data)
  const createSessionTeamOptions = useMemo(
    () =>
      teams
        .map((team) => {
          const value = getRecordId(team)
          if (!value) return null

          return {
            value,
            label: `${getTeamLabel(team)} • ${truncateMiddle(value, 32)}`,
          }
        })
        .filter((option): option is { value: string; label: string } => option !== null),
    [teams]
  )
  const teamSubscriptionPlanOptions = useMemo(
    () =>
      plans
        .map((plan) => {
          const value = getRecordId(plan)
          if (!value) return null

          const level = readString(plan.planLevel)?.toUpperCase() ?? 'FREE'
          const coins = formatNumber(readNumber(plan.maxCoins) ?? 0)
          const activeState = readBoolean(plan.isActive) === false ? 'inactive' : 'active'

          return {
            value,
            label: `${getPlanLabel(plan)} • ${level} • ${coins} coins • ${activeState}`,
          }
        })
        .filter((option): option is { value: string; label: string } => option !== null),
    [plans]
  )
  const createSessionScenarioOptions = useMemo(
    () =>
      scenarios
        .map((scenario) => {
          const value = getRecordId(scenario)
          if (!value) return null

          return {
            value,
            label: readString(scenario.name, scenario.title, value) ?? value,
          }
        })
        .filter((option): option is { value: string; label: string } => option !== null),
    [scenarios]
  )
  const createSessionPersonaOptions = useMemo(
    () =>
      personas
        .map((persona) => {
          const value = getRecordId(persona)
          if (!value) return null

          return {
            value,
            label: readString(persona.name, persona.title, value) ?? value,
          }
        })
        .filter((option): option is { value: string; label: string } => option !== null),
    [personas]
  )
  const llmProviders = extractArray(llmProvidersQuery.data)
  const ttsProviders = extractArray(ttsProvidersQuery.data)
  const challenges = extractArray(challengesQuery.data)
  const jobs = extractArray(jobsQuery.data)
  const queuesPayload = isRecord(queuesQuery.data) ? queuesQuery.data : {}
  const queues = extractArray(queuesPayload.queues)
  const queueMetrics = isRecord(queuesPayload.metrics) ? queuesPayload.metrics : {}
  const microserviceQueues = useMemo(
    () =>
      queues
        .filter((queue) => readString(queue.name))
        .sort((left, right) => getQueueLabel(left).localeCompare(getQueueLabel(right))),
    [queues]
  )
  const systemEndpointChecks = [
    {
      key: 'gateway-http',
      label: 'Gateway HTTP',
      path: '/api/v1/health',
      data: healthQuery.data,
      loading: healthQuery.isLoading,
      error: healthQuery.error instanceof Error ? healthQuery.error.message : null,
    },
    {
      key: 'auth-validate',
      label: 'JWT auth pipeline',
      path: '/api/v1/auth/validate',
      data: authValidateQuery.data,
      loading: authValidateQuery.isLoading,
      error: authValidateQuery.error instanceof Error ? authValidateQuery.error.message : null,
      detail: summarizeAuthValidationDetail(authValidateQuery.data),
    },
    {
      key: 'simulation-sessions-http',
      label: 'Sessions HTTP',
      path: '/api/v1/simulation/sessions/health',
      data: sessionServiceHealthQuery.data,
      loading: sessionServiceHealthQuery.isLoading,
      error:
        sessionServiceHealthQuery.error instanceof Error
          ? sessionServiceHealthQuery.error.message
          : null,
    },
    {
      key: 'simulation-llm-http',
      label: 'LLM HTTP',
      path: '/api/v1/simulation/llm/health',
      data: llmServiceHealthQuery.data,
      loading: llmServiceHealthQuery.isLoading,
      error:
        llmServiceHealthQuery.error instanceof Error ? llmServiceHealthQuery.error.message : null,
    },
  ]
  const systemDependencyChecks = Object.entries(dependencies).map(([key, value]) => ({
    key,
    label: SYSTEM_DEPENDENCY_LABELS[key] ?? formatAdminLabel(key),
    data: value,
    loading: dependenciesQuery.isLoading,
    error: null,
  }))
  const systemQueueChecks = microserviceQueues.map((queue) => {
    const queueName = readString(queue.name) ?? 'unknown-queue'

    return {
      key: queueName,
      label: getQueueLabel(queue),
      data: queue,
      loading: queuesQuery.isLoading,
      error: null,
      status: getQueueStatus(queue),
      detail: `${queueName} • ${getQueueSummary(queue)}`,
    }
  })
  const systemIntegrationChecks = [
    ...Object.entries(SYSTEM_INTEGRATION_LABELS).map(([key, label]) => {
      const configured = readBoolean(runtimeIntegrations[key]) ?? false

      return {
        key,
        label,
        data: {
          status: configured ? 'ok' : 'not_configured',
          configured,
        },
        loading: runtimeConfigQuery.isLoading,
        error: null,
        detail: configured ? 'Configured in runtime environment' : 'Not configured in runtime',
      }
    }),
    {
      key: 'salesforce-connection',
      label: 'Salesforce connection',
      data: salesforceStatusQuery.data,
      loading: salesforceStatusQuery.isLoading,
      error:
        salesforceStatusQuery.error instanceof Error ? salesforceStatusQuery.error.message : null,
      detail:
        salesforceStatusQuery.error instanceof Error ? salesforceStatusQuery.error.message : null,
    },
  ]
  const endpointHealthyCount = systemEndpointChecks.filter((entry) =>
    isHealthySystemStatus(
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
      })
    )
  ).length
  const dependencyHealthyCount = systemDependencyChecks.filter((entry) =>
    isHealthySystemStatus(
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
      })
    )
  ).length
  const queueHealthyCount = systemQueueChecks.filter((entry) =>
    isHealthySystemStatus(
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
        status: entry.status,
      })
    )
  ).length
  const integrationConfiguredCount = Object.keys(SYSTEM_INTEGRATION_LABELS).filter(
    (key) => readBoolean(runtimeIntegrations[key]) === true
  ).length
  const systemStatuses = [
    ...systemEndpointChecks.map((entry) =>
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
      })
    ),
    ...systemDependencyChecks.map((entry) =>
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
      })
    ),
    ...systemQueueChecks.map((entry) =>
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
        status: entry.status,
      })
    ),
  ]
  const overallSystemStatus = combineSystemStatuses(systemStatuses)
  const dependencyCompositeStatus = combineSystemStatuses(
    systemDependencyChecks.map((entry) =>
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
      })
    )
  )
  const queueCompositeStatus = combineSystemStatuses(
    systemQueueChecks.map((entry) =>
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
        status: entry.status,
      })
    )
  )
  const integrationCompositeStatus = combineSystemStatuses(
    systemIntegrationChecks.map((entry) =>
      resolveHealthRowStatus({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
      })
    )
  )
  const dashboardHealthRows = [
    {
      key: 'overall-platform',
      label: 'Overall platform',
      data: { status: overallSystemStatus },
      loading: false,
      error: null,
      status: overallSystemStatus,
      detail: `${endpointHealthyCount}/${systemEndpointChecks.length} endpoints • ${dependencyHealthyCount}/${systemDependencyChecks.length} dependencies • ${queueHealthyCount}/${systemQueueChecks.length} queues`,
    },
    {
      key: 'gateway-http',
      label: 'Gateway HTTP',
      data: healthQuery.data,
      loading: healthQuery.isLoading,
      error: healthQuery.error instanceof Error ? healthQuery.error.message : null,
      detail: resolveHealthRowDetail({
        data: healthQuery.data,
        error: healthQuery.error instanceof Error ? healthQuery.error.message : null,
      }),
    },
    {
      key: 'sessions-http',
      label: 'Sessions HTTP',
      data: sessionServiceHealthQuery.data,
      loading: sessionServiceHealthQuery.isLoading,
      error:
        sessionServiceHealthQuery.error instanceof Error
          ? sessionServiceHealthQuery.error.message
          : null,
      detail: resolveHealthRowDetail({
        data: sessionServiceHealthQuery.data,
        error:
          sessionServiceHealthQuery.error instanceof Error
            ? sessionServiceHealthQuery.error.message
            : null,
      }),
    },
    {
      key: 'dependencies',
      label: 'Dependencies',
      data: dependenciesQuery.data,
      loading: dependenciesQuery.isLoading,
      error: dependenciesQuery.error instanceof Error ? dependenciesQuery.error.message : null,
      status: dependencyCompositeStatus,
      detail: `${dependencyHealthyCount}/${systemDependencyChecks.length} healthy • user DB, simulation DB, Redis, RabbitMQ, MongoDB`,
    },
    {
      key: 'worker-queues',
      label: 'Worker queues',
      data: queuesQuery.data,
      loading: queuesQuery.isLoading,
      error: queuesQuery.error instanceof Error ? queuesQuery.error.message : null,
      status: queueCompositeStatus,
      detail: `${queueHealthyCount}/${systemQueueChecks.length} ready • ${formatNumber(readNumber(queueMetrics.assessmentQueueDepth) ?? 0)} assessment backlog`,
    },
    {
      key: 'integrations',
      label: 'Integrations',
      data: runtimeIntegrations,
      loading: runtimeConfigQuery.isLoading,
      error: null,
      status: integrationCompositeStatus,
      detail: `${integrationConfiguredCount}/${Object.keys(SYSTEM_INTEGRATION_LABELS).length} configured • Salesforce ${resolveHealthRowStatus(
        {
          data: salesforceStatusQuery.data,
          loading: salesforceStatusQuery.isLoading,
          error:
            salesforceStatusQuery.error instanceof Error
              ? salesforceStatusQuery.error.message
              : null,
        }
      )}`,
    },
  ]
  const dashboardAttentionItems = [
    ...systemEndpointChecks
      .map((entry) => ({
        key: `endpoint-${entry.key}`,
        label: entry.label,
        status: resolveHealthRowStatus({
          data: entry.data,
          loading: entry.loading,
          error: entry.error,
        }),
        detail: resolveHealthRowDetail({
          data: entry.data,
          error: entry.error,
        }),
      }))
      .filter((entry) => isAttentionStatus(entry.status)),
    ...systemDependencyChecks
      .map((entry) => ({
        key: `dependency-${entry.key}`,
        label: entry.label,
        status: resolveHealthRowStatus({
          data: entry.data,
          loading: entry.loading,
          error: entry.error,
        }),
        detail: resolveHealthRowDetail({
          data: entry.data,
          error: entry.error,
        }),
      }))
      .filter((entry) => isAttentionStatus(entry.status)),
    ...systemQueueChecks
      .map((entry) => ({
        key: `queue-${entry.key}`,
        label: entry.label,
        status: resolveHealthRowStatus({
          data: entry.data,
          loading: entry.loading,
          error: entry.error,
          status: entry.status,
        }),
        detail: entry.detail,
      }))
      .filter((entry) => isAttentionStatus(entry.status)),
  ]
  const userDetail = isRecord(userDetailQuery.data) ? userDetailQuery.data : {}
  const userActivity = isRecord(userActivityQuery.data) ? userActivityQuery.data : {}
  const userActivityUser = isRecord(userActivity.user) ? userActivity.user : {}
  const userActivityStats = isRecord(userActivity.activity) ? userActivity.activity : {}
  const userMemberships = Array.isArray(userActivityUser.memberships)
    ? userActivityUser.memberships.filter(isRecord)
    : []
  const userOauthAccounts = Array.isArray(userActivityUser.oauthAccounts)
    ? userActivityUser.oauthAccounts.filter(isRecord)
    : []
  const userRefreshTokens = Array.isArray(userActivityUser.refreshTokens)
    ? userActivityUser.refreshTokens.filter(isRecord)
    : []
  const userRecentSessions = extractArray(userActivity.recentSessions)
  const userSessionsPayload = isRecord(userSessionsQuery.data) ? userSessionsQuery.data : {}
  const userSessions = extractArray(userSessionsPayload.sessions)
  const userOpenSessions = userSessions.filter((session) => getSessionStatus(session) !== 'ended')
  const userCompletedSessions = userSessions.filter(
    (session) => getSessionStatus(session) === 'ended'
  )
  const userMembershipTeamSnapshots = Array.isArray(userMembershipTeamsQuery.data)
    ? userMembershipTeamsQuery.data.filter(isRecord)
    : EMPTY_RECORD_ARRAY
  const userMembershipTeamSnapshotById = useMemo(() => {
    const next = new Map<string, JsonRecord>()

    userMembershipTeamSnapshots.forEach((snapshot) => {
      const teamId = readString(snapshot.teamId)
      if (teamId) {
        next.set(teamId, snapshot)
      }
    })

    return next
  }, [userMembershipTeamSnapshots])
  const planDetail = isRecord(planDetailQuery.data) ? planDetailQuery.data : {}
  const planSubscriptionCounts = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>()

    subscriptions.forEach((subscription) => {
      const linkedPlan = isRecord(subscription.plan) ? subscription.plan : {}
      const planId = readString(subscription.planId, linkedPlan.id)
      if (!planId) return

      const current = counts.get(planId) ?? { total: 0, active: 0 }
      current.total += 1
      if (getSubscriptionStatus(subscription) === 'active') {
        current.active += 1
      }
      counts.set(planId, current)
    })

    return counts
  }, [subscriptions])
  const selectedPlanListItem = plans.find((plan) => getRecordId(plan) === selectedPlanId) ?? null
  const selectedPlanSnapshot =
    Object.keys(planDetail).length > 0
      ? planDetail
      : selectedPlanListItem && isRecord(selectedPlanListItem)
        ? selectedPlanListItem
        : null
  const teamDetail = isRecord(teamDetailQuery.data) ? teamDetailQuery.data : {}
  const teamUsage = isRecord(teamUsageQuery.data) ? teamUsageQuery.data : {}
  const teamUsageTeam = isRecord(teamUsage.team) ? teamUsage.team : {}
  const teamUsageStats = isRecord(teamUsage.usage) ? teamUsage.usage : {}
  const teamUsageSessions = isRecord(teamUsageStats.sessions) ? teamUsageStats.sessions : {}
  const teamUsageMembers = isRecord(teamUsageStats.members) ? teamUsageStats.members : {}
  const teamUsageTokens = isRecord(teamUsageStats.tokens) ? teamUsageStats.tokens : {}
  const teamUsageLlm = isRecord(teamUsageStats.llm) ? teamUsageStats.llm : {}
  const teamMemberships = Array.isArray(teamDetail.memberships)
    ? teamDetail.memberships.filter(isRecord)
    : Array.isArray(teamUsageTeam.memberships)
      ? teamUsageTeam.memberships.filter(isRecord)
      : EMPTY_RECORD_ARRAY
  const availableTeamMemberOptions = useMemo(() => {
    const existingMemberIds = new Set(
      teamMemberships
        .map((membership) =>
          readString(membership.userId, isRecord(membership.user) ? membership.user.id : null)
        )
        .filter((value): value is string => Boolean(value))
    )

    return userSelectOptions.filter(
      (option) =>
        option.value === teamMemberCreateForm.userId || !existingMemberIds.has(option.value)
    )
  }, [teamMemberships, teamMemberCreateForm.userId, userSelectOptions])
  const teamSessionsPayload = isRecord(teamSessionsQuery.data) ? teamSessionsQuery.data : {}
  const teamSessions = extractArray(teamSessionsPayload.sessions)
  const teamSubscription = isRecord(teamSubscriptionQuery.data) ? teamSubscriptionQuery.data : null
  const teamSubscriptionPlan = isRecord(teamSubscription?.plan) ? teamSubscription.plan : {}
  const teamSubscriptionStatus = getSubscriptionStatus(teamSubscription ?? {})
  const teamSubscriptionId = readString(teamSubscription?.id)
  const defaultActiveTeamSubscriptionPlan =
    plans.find((plan) => {
      const planId = getRecordId(plan)
      return Boolean(planId) && readBoolean(plan.isActive) !== false
    }) ?? null
  const defaultTeamSubscriptionPlanId =
    getRecordId(defaultActiveTeamSubscriptionPlan) ?? teamSubscriptionPlanOptions[0]?.value ?? ''
  const teamSubscriptionBaseline = useMemo(
    () =>
      selectedTeamId
        ? toTeamSubscriptionFormState(
            teamSubscriptionId ? teamSubscription : null,
            defaultTeamSubscriptionPlanId
          )
        : null,
    [defaultTeamSubscriptionPlanId, selectedTeamId, teamSubscription, teamSubscriptionId]
  )
  const sessionDetail = isRecord(sessionDetailQuery.data) ? sessionDetailQuery.data : EMPTY_RECORD
  const sessionMembers = extractArray(sessionMembersQuery.data)
  const availableSessionMemberOptions = useMemo(() => {
    const existingMemberIds = new Set(
      sessionMembers
        .map((member) => readString(member.userId, isRecord(member.user) ? member.user.id : null))
        .filter((value): value is string => Boolean(value))
    )

    return userSelectOptions.filter(
      (option) =>
        sessionMemberCreateForm.userIds.includes(option.value) ||
        !existingMemberIds.has(option.value)
    )
  }, [sessionMemberCreateForm.userIds, sessionMembers, userSelectOptions])
  const sessionTimeline = extractArray(sessionTimelineQuery.data)
  const sessionInvitations = extractArray(sessionInvitationsQuery.data)
  const sessionAssessment = isRecord(sessionAssessmentQuery.data) ? sessionAssessmentQuery.data : {}
  const sessionTranscript = isRecord(sessionTranscriptQuery.data) ? sessionTranscriptQuery.data : {}
  const transcriptRows = extractArray(sessionTranscript.transcripts)
  const transcriptSegments = extractTranscriptSegments(sessionTranscript.transcripts)
  const sessionEvents = extractArray(
    isRecord(sessionEventsQuery.data) ? sessionEventsQuery.data.events : []
  )
  const sessionLlm = isRecord(sessionLlmCallsQuery.data) ? sessionLlmCallsQuery.data : {}
  const sessionLlmSummary = isRecord(sessionLlm.summary) ? sessionLlm.summary : {}
  const sessionLlmTraces = extractArray(sessionLlm.traces)
  const sessionActivityItems = useMemo(
    () =>
      [...sessionEvents, ...sessionTimeline].map((item, index) => ({
        key:
          readString(item.id, item.traceId, item.mongoEventLogId, item.iterationId) ??
          `activity-${index}`,
        payload: item,
      })),
    [sessionEvents, sessionTimeline]
  )
  const transcriptItems = useMemo(
    () =>
      transcriptSegments.map((segment, index) => ({
        key: readString(segment.id, segment.transcriptId, segment.assetId) ?? `segment-${index}`,
        payload: segment,
      })),
    [transcriptSegments]
  )
  const sessionTraceItems = useMemo(
    () =>
      sessionLlmTraces.map((trace, index) => ({
        key:
          readString(trace.id, trace.traceId, trace.requestId, trace.responseId) ??
          `trace-${index}`,
        payload: trace,
      })),
    [sessionLlmTraces]
  )
  const selectedSessionActivity =
    sessionActivityItems.find((item) => item.key === selectedSessionActivityKey) ??
    sessionActivityItems[0] ??
    null
  const selectedTranscriptSegment =
    transcriptItems.find((item) => item.key === selectedTranscriptKey) ?? transcriptItems[0] ?? null
  const selectedSessionTrace =
    sessionTraceItems.find((item) => item.key === selectedTraceKey) ?? sessionTraceItems[0] ?? null
  const selectedUserListItem = users.find((user) => getRecordId(user) === selectedUserId) ?? null
  const selectedTeamListItem = teams.find((team) => getRecordId(team) === selectedTeamId) ?? null
  const selectedTeamSnapshot =
    Object.keys(teamDetail).length > 0
      ? teamDetail
      : selectedTeamListItem && isRecord(selectedTeamListItem)
        ? selectedTeamListItem
        : teamUsageTeam
  const selectedUserSnapshot =
    Object.keys(userDetail).length > 0
      ? userDetail
      : selectedUserListItem && isRecord(selectedUserListItem)
        ? selectedUserListItem
        : userActivityUser
  const selectedUserStatus = getUserStatus(
    Object.keys(userDetail).length > 0 ? userDetail : (selectedUserListItem ?? userActivityUser)
  )
  const selectedUserHasPendingStudioAccess = selectedUserStudioAccessRequest !== null
  const selectedUserPendingCoinRefillRequest = toPendingCoinRefillRequest(selectedUserSnapshot)
  const selectedUserHasPendingCoinRefill = selectedUserPendingCoinRefillRequest !== null
  const selectedUserVisibleCompletedSessions =
    userCompletedSessions.length > 0 ? userCompletedSessions : userRecentSessions
  const selectedUserTeamMembership = teamMemberships.find(
    (membership) => readString(membership.userId) === selectedUserId
  )
  const selectedUserTeamMembershipRole = readString(selectedUserTeamMembership?.role) ?? 'member'
  const selectedUserTeamMembershipStatus =
    selectedUserTeamMembership?.isActive === false
      ? 'inactive'
      : readBoolean(teamDetail.isActive, teamUsageTeam.isActive) === false
        ? 'team inactive'
        : 'active'
  const selectedUserTeamMembershipLimit = readNumber(
    selectedUserTeamMembership?.tokenLimit,
    teamUsageTeam.tokenLimit
  )
  const teamEditBaseline = useMemo(
    () => (selectedTeamId ? toTeamEditFormState(selectedTeamSnapshot) : null),
    [selectedTeamId, selectedTeamSnapshot]
  )
  const teamSubscriptionHasChanges =
    Boolean(teamSubscriptionForm) &&
    Boolean(teamSubscriptionBaseline) &&
    JSON.stringify(teamSubscriptionForm) !== JSON.stringify(teamSubscriptionBaseline)
  const sessionEditBaseline = useMemo(
    () =>
      selectedSessionId && Object.keys(sessionDetail).length > 0
        ? toSessionEditFormState(sessionDetail)
        : null,
    [selectedSessionId, sessionDetail]
  )
  const userEditBaseline = useMemo(
    () => (selectedUserId ? toUserEditFormState(selectedUserSnapshot) : null),
    [selectedUserId, selectedUserSnapshot]
  )
  const teamMembershipEditBaseline = useMemo(
    () =>
      selectedUserId && selectedTeamId
        ? toTeamMembershipEditFormState(selectedUserTeamMembership, selectedUserTeamMembershipLimit)
        : null,
    [selectedTeamId, selectedUserId, selectedUserTeamMembership, selectedUserTeamMembershipLimit]
  )
  const userEditHasChanges =
    Boolean(userEditForm) &&
    Boolean(userEditBaseline) &&
    JSON.stringify(userEditForm) !== JSON.stringify(userEditBaseline)
  const teamEditHasChanges =
    Boolean(teamEditForm) &&
    Boolean(teamEditBaseline) &&
    JSON.stringify(teamEditForm) !== JSON.stringify(teamEditBaseline)
  const sessionEditHasChanges =
    Boolean(sessionEditForm) &&
    Boolean(sessionEditBaseline) &&
    JSON.stringify(sessionEditForm) !== JSON.stringify(sessionEditBaseline)
  const teamMembershipEditHasChanges =
    Boolean(teamMembershipEditForm) &&
    Boolean(teamMembershipEditBaseline) &&
    JSON.stringify(teamMembershipEditForm) !== JSON.stringify(teamMembershipEditBaseline)

  useEffect(() => {
    if (view !== 'users' || !requestedUserId) return

    if (isCreatingUser) {
      setIsCreatingUser(false)
    }

    if (isInvitingUser) {
      setIsInvitingUser(false)
    }

    if (selectedUserId !== requestedUserId) {
      setSelectedUserId(requestedUserId)
    }

    if (userInspectorMode !== 'user') {
      setUserInspectorMode('user')
    }

    if (userInspectorReturnMode !== 'user') {
      setUserInspectorReturnMode('user')
    }
  }, [
    isCreatingUser,
    isInvitingUser,
    requestedUserId,
    selectedUserId,
    userInspectorMode,
    userInspectorReturnMode,
    view,
  ])

  useEffect(() => {
    if (view !== 'teams' || !requestedTeamId) return

    if (isCreatingTeam) {
      setIsCreatingTeam(false)
    }

    if (selectedSessionId) {
      setSelectedSessionId(null)
    }

    if (selectedTeamId !== requestedTeamId) {
      setSelectedTeamId(requestedTeamId)
    }

    if (teamInspectorMode !== 'team') {
      setTeamInspectorMode('team')
    }
  }, [isCreatingTeam, requestedTeamId, selectedSessionId, selectedTeamId, teamInspectorMode, view])

  useEffect(() => {
    if (view !== 'sessions' || !requestedSessionId) return

    if (isCreatingSession) {
      setIsCreatingSession(false)
    }

    if (selectedSessionId !== requestedSessionId) {
      setSelectedSessionId(requestedSessionId)
    }
  }, [isCreatingSession, requestedSessionId, selectedSessionId, view])

  useEffect(() => {
    if (requestedUserId) return

    if (filteredUsers.length === 0) {
      if (selectedUserId) setSelectedUserId(null)
      return
    }

    if (selectedUserId && !filteredUsers.some((user) => getRecordId(user) === selectedUserId)) {
      setSelectedUserId(null)
    }
  }, [filteredUsers, requestedUserId, selectedUserId])

  useEffect(() => {
    if (!selectedUserId && userInspectorMode !== 'user') {
      setUserInspectorMode('user')
    }
  }, [selectedUserId, userInspectorMode])

  useEffect(() => {
    if (!selectedUserId && userInspectorReturnMode !== 'user') {
      setUserInspectorReturnMode('user')
    }
  }, [selectedUserId, userInspectorReturnMode])

  useEffect(() => {
    setStudioAccessQuotas((current) => {
      const next: Record<string, number> = {}

      studioAccessRequests.forEach((request) => {
        next[request.userId] = current[request.userId] ?? request.quota ?? 5000
      })

      return next
    })

    setStudioAccessRoles((current) => {
      const next: Record<string, ReviewRole> = {}

      studioAccessRequests.forEach((request) => {
        next[request.userId] =
          current[request.userId] ?? (request.role === 'ADMIN' ? 'ADMIN' : 'MEMBER')
      })

      return next
    })
  }, [studioAccessRequests])

  useEffect(() => {
    if (userListMode !== 'access-requests') return
    if (studioAccessRequestsQuery.isLoading) return
    if (studioAccessRequests.length > 0) return

    setUserListMode('all')
  }, [studioAccessRequests.length, studioAccessRequestsQuery.isLoading, userListMode])

  useEffect(() => {
    if (!selectedUserId) {
      setUserInspectorSections((current) => (Object.keys(current).length === 0 ? current : {}))
      return
    }

    if (userInspectorMode === 'user') {
      const nextSections: Record<string, boolean> = {}

      if (requestedUserPanel === 'access' || selectedUserHasPendingStudioAccess) {
        nextSections['user:access'] = true
      }

      if (requestedUserPanel === 'topup' || selectedUserHasPendingCoinRefill) {
        nextSections['user:topup'] = true
      }

      setUserInspectorSections((current) =>
        areBooleanRecordValuesEqual(current, nextSections) ? current : nextSections
      )
      return
    }

    if (userInspectorMode === 'team') {
      setUserInspectorSections((current) =>
        areBooleanRecordValuesEqual(current, { 'team:selected-user': true })
          ? current
          : { 'team:selected-user': true }
      )
      return
    }

    setUserInspectorSections((current) => (Object.keys(current).length === 0 ? current : {}))
  }, [
    requestedUserPanel,
    selectedUserHasPendingCoinRefill,
    selectedSessionId,
    selectedTeamId,
    selectedUserHasPendingStudioAccess,
    selectedUserId,
    userInspectorMode,
  ])

  useEffect(() => {
    setUserEditForm((current) =>
      areSerializedValuesEqual(current, userEditBaseline) ? current : userEditBaseline
    )
  }, [userEditBaseline])

  useEffect(() => {
    setTeamEditForm((current) =>
      areSerializedValuesEqual(current, teamEditBaseline) ? current : teamEditBaseline
    )
  }, [teamEditBaseline])

  useEffect(() => {
    setTeamSubscriptionForm((current) =>
      areSerializedValuesEqual(current, teamSubscriptionBaseline)
        ? current
        : teamSubscriptionBaseline
    )
  }, [teamSubscriptionBaseline])

  useEffect(() => {
    setSessionEditForm((current) =>
      areSerializedValuesEqual(current, sessionEditBaseline) ? current : sessionEditBaseline
    )
  }, [sessionEditBaseline])

  useEffect(() => {
    setTeamMembershipEditForm((current) =>
      areSerializedValuesEqual(current, teamMembershipEditBaseline)
        ? current
        : teamMembershipEditBaseline
    )
  }, [teamMembershipEditBaseline])

  useEffect(() => {
    if (view !== 'users' && isCreatingUser) {
      setIsCreatingUser(false)
    }

    if (view !== 'users' && isInvitingUser) {
      setIsInvitingUser(false)
    }

    if (view !== 'teams' && isCreatingTeam) {
      setIsCreatingTeam(false)
    }

    if (view !== 'sessions' && isCreatingSession) {
      setIsCreatingSession(false)
    }
  }, [isCreatingSession, isCreatingTeam, isCreatingUser, isInvitingUser, view])

  useEffect(() => {
    setTeamMemberCreateForm(EMPTY_TEAM_MEMBER_CREATE_FORM)
    setTeamMemberInviteForm(EMPTY_TEAM_MEMBER_INVITE_FORM)
  }, [selectedTeamId])

  useEffect(() => {
    setSessionMemberCreateForm(EMPTY_SESSION_MEMBER_CREATE_FORM)
  }, [selectedSessionId])

  useEffect(() => {
    if (view !== 'teams') return

    if (requestedTeamId) return

    if (filteredTeams.length === 0) {
      if (selectedTeamId) setSelectedTeamId(null)
      return
    }

    if (selectedTeamId && !filteredTeams.some((team) => getRecordId(team) === selectedTeamId)) {
      setSelectedTeamId(null)
    }
  }, [filteredTeams, requestedTeamId, selectedTeamId, view])

  useEffect(() => {
    if (view !== 'teams') return

    setTeamInspectorSections({})
  }, [selectedTeamId, view])

  useEffect(() => {
    if (view !== 'teams') return

    if (!selectedTeamId && selectedSessionId) {
      setSelectedSessionId(null)
    }
  }, [selectedSessionId, selectedTeamId, view])

  useEffect(() => {
    if (view !== 'teams') return

    if (!selectedTeamId && teamInspectorMode !== 'team') {
      setTeamInspectorMode('team')
    }
  }, [selectedTeamId, teamInspectorMode, view])

  useEffect(() => {
    if (view !== 'teams') return

    setTeamInspectorSections({})
  }, [selectedSessionId, teamInspectorMode, view])

  useEffect(() => {
    if (view !== 'plans' || isCreatingPlan) return

    if (filteredPlans.length === 0) {
      if (selectedPlanId) setSelectedPlanId(null)
      return
    }

    if (selectedPlanId && !filteredPlans.some((plan) => getRecordId(plan) === selectedPlanId)) {
      setSelectedPlanId(null)
    }
  }, [filteredPlans, isCreatingPlan, selectedPlanId, view])

  useEffect(() => {
    if (isCreatingPlan) {
      setPlanForm((current) =>
        areSerializedValuesEqual(current, EMPTY_PLAN_FORM) ? current : EMPTY_PLAN_FORM
      )
      return
    }

    const nextPlanForm = toPlanFormState(selectedPlanSnapshot)
    setPlanForm((current) =>
      areSerializedValuesEqual(current, nextPlanForm) ? current : nextPlanForm
    )
  }, [isCreatingPlan, selectedPlanSnapshot])

  useEffect(() => {
    if (view !== 'sessions') return

    if (requestedSessionId) return

    if (filteredSessions.length === 0) {
      if (selectedSessionId) setSelectedSessionId(null)
      return
    }

    if (
      selectedSessionId &&
      !filteredSessions.some((session) => getRecordId(session) === selectedSessionId)
    ) {
      setSelectedSessionId(null)
    }
  }, [filteredSessions, requestedSessionId, selectedSessionId, view])

  useEffect(() => {
    if (view !== 'sessions' && view !== 'teams') return

    setSessionInspectorSections({})
  }, [selectedSessionId, view])

  useEffect(() => {
    if (sessionActivityItems.length === 0) {
      if (selectedSessionActivityKey) setSelectedSessionActivityKey(null)
      return
    }

    if (
      !selectedSessionActivityKey ||
      !sessionActivityItems.some((item) => item.key === selectedSessionActivityKey)
    ) {
      setSelectedSessionActivityKey(sessionActivityItems[0].key)
    }
  }, [selectedSessionActivityKey, sessionActivityItems])

  useEffect(() => {
    if (transcriptItems.length === 0) {
      if (selectedTranscriptKey) setSelectedTranscriptKey(null)
      return
    }

    if (
      !selectedTranscriptKey ||
      !transcriptItems.some((item) => item.key === selectedTranscriptKey)
    ) {
      setSelectedTranscriptKey(transcriptItems[0].key)
    }
  }, [selectedTranscriptKey, transcriptItems])

  useEffect(() => {
    if (sessionTraceItems.length === 0) {
      if (selectedTraceKey) setSelectedTraceKey(null)
      return
    }

    if (!selectedTraceKey || !sessionTraceItems.some((item) => item.key === selectedTraceKey)) {
      setSelectedTraceKey(sessionTraceItems[0].key)
    }
  }, [selectedTraceKey, sessionTraceItems])

  const heroStats = [
    {
      label: 'System Status',
      value: overallSystemStatus.toUpperCase(),
      note:
        dashboardAttentionItems.length > 0
          ? `${formatNumber(dashboardAttentionItems.length)} items need attention`
          : 'All core checks are healthy',
    },
    {
      label: 'Endpoint Checks',
      value: `${endpointHealthyCount}/${systemEndpointChecks.length}`,
      note: 'Gateway, auth, sessions, and LLM routes',
    },
    {
      label: 'Dependencies',
      value: `${dependencyHealthyCount}/${systemDependencyChecks.length}`,
      note: 'DB, cache, broker, and document store',
    },
    {
      label: 'Queues Ready',
      value: `${queueHealthyCount}/${systemQueueChecks.length}`,
      note: `${formatNumber(readNumber(queueMetrics.assessmentQueueDepth) ?? 0)} assessments waiting`,
    },
    {
      label: 'Active Sessions',
      value: formatNumber(readNumber(overviewTotals.activeSessions) ?? 0),
      note: `${formatNumber(readNumber(overviewTotals.sessions) ?? getCollectionCount(sessionsQuery.data))} total tracked`,
    },
  ]

  if (isCheckingAccess) {
    return (
      <Center style={{ minHeight: '70vh' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Verifying system-admin access…
          </Text>
        </Stack>
      </Center>
    )
  }

  if (!isSystemAdmin) {
    return (
      <Center style={{ minHeight: '70vh' }}>
        <Stack maw={560} gap="lg">
          <Alert color="brand" title="Admin access required" icon={<IconAlertTriangle size={16} />}>
            This page is only available to users allowed by the backend SUPER_ADMIN_EMAILS gate. The
            current account is not permitted to open the admin console.
            {accessError instanceof Error ? ` ${accessError.message}` : ''}
          </Alert>
          <Group>
            <Button
              leftSection={<IconShield size={16} />}
              onClick={() => router.push('/studio/home')}
            >
              Return to Studio
            </Button>
          </Group>
        </Stack>
      </Center>
    )
  }

  return (
    <Box className={classes.page}>
      <Stack gap="lg" className={classes.pageInner}>
        {view === 'dashboard' ? (
          <section className={classes.hero}>
            <div className={classes.heroGrid}>
              <Box>
                <Group gap="xs" mb="sm">
                  <Badge color="brand" variant="filled">
                    SUPER ADMIN
                  </Badge>
                  <Badge color="selected" variant="light">
                    Guarded by backend allowlist
                  </Badge>
                  {readString(overviewData.status) ? (
                    <StatusBadge status={String(overviewData.status)} />
                  ) : null}
                </Group>
                <Group gap="sm" mb="sm" wrap="nowrap">
                  <ThemeIcon size={42} radius="xl" color="brand" variant="light">
                    <IconShield size={22} />
                  </ThemeIcon>
                  <Box>
                    <Title order={2}>Admin Mission Control</Title>
                    <Text className={classes.mutedText}>
                      Spacious internal control plane for platform health, access, users, teams,
                      sessions, billing, and backend observability.
                    </Text>
                  </Box>
                </Group>
                <Group gap="sm" mt="md">
                  <Button leftSection={<IconRefresh size={16} />} onClick={handleRefreshAll}>
                    Refresh snapshot
                  </Button>
                  <Switch
                    checked={autoRefresh}
                    onChange={(event) => setAutoRefresh(event.currentTarget.checked)}
                    label="Auto-refresh live cards every 30s"
                  />
                </Group>
              </Box>

              <div className={classes.heroPanel}>
                <Stack gap="sm">
                  <div className={classes.pill}>
                    <Text size="xs" className={classes.pillLabel}>
                      Signed in as
                    </Text>
                    <Text size="sm" fw={700} className={classes.consoleText}>
                      {readString(adminIdentity?.email, authMeData.email) ?? 'n/a'}
                    </Text>
                  </div>
                  <div className={classes.pill}>
                    <Text size="xs" className={classes.pillLabel}>
                      Last sync
                    </Text>
                    <Text size="sm" fw={700} className={classes.consoleText}>
                      {formatDateTime(overviewData.timestamp ?? new Date().toISOString())}
                    </Text>
                  </div>
                  <div className={classes.pill}>
                    <Text size="xs" className={classes.pillLabel}>
                      Build branch
                    </Text>
                    <Text size="sm" fw={700} className={classes.consoleText}>
                      {buildBranch && buildBranchUrl ? (
                        <a
                          href={buildBranchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`${classes.consoleText} ${classes.consoleLink}`}
                        >
                          {truncate(buildBranch, 24)}
                        </a>
                      ) : (
                        truncate(buildBranch, 24)
                      )}
                    </Text>
                  </div>
                </Stack>
              </div>
            </div>

            <div className={classes.kpiGrid}>
              {heroStats.map((stat) => (
                <MetricCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  note={stat.note}
                />
              ))}
            </div>
          </section>
        ) : null}

        {view === 'system' ? (
          <>
            <section className={classes.panel}>
              <Group justify="space-between" align="flex-start" mb="md" gap="md">
                <Box maw={760}>
                  <Group gap="xs" mb={4}>
                    <ThemeIcon color="brand" variant="light">
                      <IconClock size={16} />
                    </ThemeIcon>
                    <Title order={4}>Runtime Snapshot</Title>
                  </Group>
                  <Text size="sm" className={classes.mutedText}>
                    Current runtime metadata exposed by the admin API for debugging config and
                    deployment state.
                  </Text>
                </Box>
                <Badge color="brand" variant="light">
                  safe config view
                </Badge>
              </Group>

              <div className={classes.miniGrid}>
                <div className={classes.miniCard}>
                  <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                    Environment
                  </Text>
                  <Text mt={6} fw={700}>
                    {readString(versionApi.environment) ?? 'unknown'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Node {readString(versionApi.nodeVersion) ?? 'n/a'}
                  </Text>
                </div>
                <div className={classes.miniCard}>
                  <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                    API Version
                  </Text>
                  <Text mt={6} fw={700}>
                    {readString(versionApi.version) ?? 'unknown'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Branch{' '}
                    {buildBranch && buildBranchUrl ? (
                      <a
                        href={buildBranchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={classes.consoleLink}
                      >
                        {truncate(buildBranch, 28)}
                      </a>
                    ) : (
                      truncate(buildBranch, 28)
                    )}
                  </Text>
                </div>
                <div className={classes.miniCard}>
                  <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                    Uptime
                  </Text>
                  <Text mt={6} fw={700}>
                    {formatNumber(readNumber(versionApi.uptimeSeconds) ?? 0)} s
                  </Text>
                  <Text size="xs" c="dimmed">
                    API process lifetime
                  </Text>
                </div>
                <div className={classes.miniCard}>
                  <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                    Frontend URL
                  </Text>
                  <Text mt={6} fw={700} lineClamp={2}>
                    {truncate(readString(runtimeApp.frontendUrl), 42)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    API default version {readString(runtimeApp.defaultApiVersion) ?? '1'}
                  </Text>
                </div>
                <div className={classes.miniCard}>
                  <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                    Super Admins
                  </Text>
                  <Text mt={6} fw={700}>
                    {formatNumber(readNumber(runtimeAuth.superAdminCount) ?? 0)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    DEV bypass {readBoolean(runtimeAuth.devBypassEnabled) ? 'enabled' : 'disabled'}
                  </Text>
                </div>
              </div>
            </section>

            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, xl: 4 }}>
                <section className={classes.panel}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <ThemeIcon color="info" variant="light">
                        <IconServer size={16} />
                      </ThemeIcon>
                      <Title order={4}>Endpoint Checks</Title>
                    </Group>
                    <Badge color="info" variant="light">
                      real health routes
                    </Badge>
                  </Group>
                  <Text size="sm" className={classes.mutedText} mb="md">
                    These rows are directly connected to health or validation endpoints.
                  </Text>
                  <Stack gap="sm" className={classes.statusList}>
                    {systemEndpointChecks.map((entry) => {
                      const detail = entry.detail
                        ? entry.detail
                        : resolveHealthRowDetail({
                            data: entry.data,
                            error: entry.error,
                          })
                      const endpointPath = formatSystemEndpointPath(entry.path)

                      return (
                        <HealthRow
                          key={entry.key}
                          label={entry.label}
                          data={entry.data}
                          loading={entry.loading}
                          error={entry.error}
                          detail={`GET ${endpointPath} • ${detail}`}
                        />
                      )
                    })}
                  </Stack>
                </section>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 4 }}>
                <section className={classes.panel}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <ThemeIcon color="brand" variant="light">
                        <IconSettings size={16} />
                      </ThemeIcon>
                      <Title order={4}>Dependency Status</Title>
                    </Group>
                    <Badge color="brand" variant="light">
                      admin dependency probe
                    </Badge>
                  </Group>
                  <Text size="sm" className={classes.mutedText} mb="md">
                    Database, cache, broker, and document-store health returned by the admin API.
                  </Text>
                  <Stack gap="sm" className={classes.statusList}>
                    {systemDependencyChecks.length === 0 ? (
                      <Text size="sm" className={classes.mutedText}>
                        {dependenciesQuery.isLoading
                          ? 'Loading dependency health snapshot.'
                          : 'No dependency data is currently available.'}
                      </Text>
                    ) : (
                      systemDependencyChecks.map((entry) => (
                        <HealthRow
                          key={entry.key}
                          label={entry.label}
                          data={entry.data}
                          loading={entry.loading}
                          error={entry.error}
                        />
                      ))
                    )}
                  </Stack>
                </section>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 4 }}>
                <section className={classes.panel}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <ThemeIcon color="selected" variant="light">
                        <IconBolt size={16} />
                      </ThemeIcon>
                      <Title order={4}>Worker Queues</Title>
                    </Group>
                    <Badge color="selected" variant="light">
                      RabbitMQ readiness
                    </Badge>
                  </Group>
                  <Text size="sm" className={classes.mutedText} mb="md">
                    These rows reflect queue presence, consumer count, backlog, and DLQ pressure.
                    They are worker readiness signals, not HTTP health endpoints.
                  </Text>
                  <Stack gap="sm" className={classes.statusList}>
                    {systemQueueChecks.length === 0 ? (
                      <Text size="sm" className={classes.mutedText}>
                        {queuesQuery.isLoading
                          ? 'Loading queue readiness snapshot.'
                          : 'No RabbitMQ queue metadata is currently available.'}
                      </Text>
                    ) : (
                      systemQueueChecks.map((entry) => (
                        <HealthRow
                          key={entry.key}
                          label={entry.label}
                          data={entry.data}
                          loading={entry.loading}
                          error={entry.error}
                          status={entry.status}
                          detail={entry.detail}
                        />
                      ))
                    )}
                  </Stack>
                </section>
              </Grid.Col>
            </Grid>
          </>
        ) : null}

        {view === 'dashboard' ? (
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <section className={classes.panel}>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Box>
                    <Group gap="xs" mb={4}>
                      <ThemeIcon color="info" variant="light">
                        <IconServer size={16} />
                      </ThemeIcon>
                      <Title order={4}>Core Health</Title>
                    </Group>
                    <Text size="sm" className={classes.mutedText}>
                      One-look summary of the platform health surfaces that matter most right now.
                    </Text>
                  </Box>
                  <StatusBadge status={overallSystemStatus} />
                </Group>
                <Stack gap="sm" className={classes.statusList}>
                  {dashboardHealthRows.map((row) => (
                    <HealthRow
                      key={row.key}
                      label={row.label}
                      data={row.data}
                      loading={row.loading}
                      error={row.error}
                      status={row.status}
                      detail={row.detail}
                    />
                  ))}
                </Stack>
              </section>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <section className={classes.panel}>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Box>
                    <Group gap="xs" mb={4}>
                      <ThemeIcon color="brand" variant="light">
                        <IconListDetails size={16} />
                      </ThemeIcon>
                      <Title order={4}>Platform Snapshot</Title>
                    </Group>
                    <Text size="sm" className={classes.mutedText}>
                      Live counts across the main operating surfaces, so you can correlate system
                      health with product activity.
                    </Text>
                  </Box>
                  <Badge color="brand" variant="light">
                    live inventory
                  </Badge>
                </Group>

                <div className={classes.miniGrid}>
                  <div className={classes.miniCard}>
                    <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                      Users
                    </Text>
                    <Text mt={6} fw={800} size="lg">
                      {formatNumber(readNumber(overviewTotals.users) ?? users.length)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatNumber(readNumber(overviewTotals.activeUsers) ?? 0)} active
                    </Text>
                  </div>
                  <div className={classes.miniCard}>
                    <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                      Teams
                    </Text>
                    <Text mt={6} fw={800} size="lg">
                      {formatNumber(readNumber(overviewTotals.teams) ?? teams.length)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Org control plane
                    </Text>
                  </div>
                  <div className={classes.miniCard}>
                    <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                      Subscriptions
                    </Text>
                    <Text mt={6} fw={800} size="lg">
                      {formatNumber(
                        readNumber(overviewTotals.subscriptions) ?? subscriptions.length
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Billing surface
                    </Text>
                  </div>
                  <div className={classes.miniCard}>
                    <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                      Sessions
                    </Text>
                    <Text mt={6} fw={800} size="lg">
                      {formatNumber(
                        readNumber(overviewTotals.sessions) ??
                          getCollectionCount(sessionsQuery.data)
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatNumber(readNumber(overviewTotals.activeSessions) ?? 0)} active now
                    </Text>
                  </div>
                  <div className={classes.miniCard}>
                    <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                      Providers
                    </Text>
                    <Text mt={6} fw={800} size="lg">
                      {formatNumber(llmProviders.length + ttsProviders.length)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatNumber(llmProviders.length)} LLM • {formatNumber(ttsProviders.length)}{' '}
                      TTS
                    </Text>
                  </div>
                  <div className={classes.miniCard}>
                    <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                      Admin Jobs
                    </Text>
                    <Text mt={6} fw={800} size="lg">
                      {formatNumber(getCollectionCount(jobsQuery.data))}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatNumber(readNumber(queueMetrics.assessmentQueueDepth) ?? 0)} queued
                      assessments
                    </Text>
                  </div>
                </div>
              </section>
            </Grid.Col>
          </Grid>
        ) : null}

        {view === 'users' || view === 'teams' ? (
          <Grid gutter="lg">
            {view === 'users' ? (
              <Grid.Col span={{ base: 12, xl: 12 }}>
                <section className={classes.panel}>
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Box>
                      <Group gap="xs" mb={4}>
                        <ThemeIcon color="info" variant="light">
                          <IconUser size={16} />
                        </ThemeIcon>
                        <Title order={4}>User Explorer</Title>
                      </Group>
                      <Text size="sm" className={classes.mutedText}>
                        Browse the full user list on the left, then inspect account state, team
                        context, active work, and completed sessions in a dedicated pane on the
                        right.
                      </Text>
                    </Box>
                    <Group gap="sm">
                      <Badge color="info" variant="light">
                        {userListMode === 'access-requests'
                          ? `${filteredUsers.length} of ${studioAccessRequests.length} requesters`
                          : userFilter.trim()
                            ? `${filteredUsers.length} of ${users.length} users`
                            : `${filteredUsers.length} users`}
                      </Badge>
                      <Badge
                        color={studioAccessRequests.length > 0 ? 'yellow' : 'gray'}
                        variant="light"
                      >
                        {formatNumber(studioAccessRequests.length)} requested access
                      </Badge>
                      <Button
                        variant={isInvitingUser ? 'filled' : 'light'}
                        leftSection={<IconPlus size={16} />}
                        onClick={() => {
                          if (isInvitingUser) {
                            closeUserInspector()
                            return
                          }

                          closeUserInspector()
                          setInviteUserForm(EMPTY_USER_INVITE_FORM)
                          setIsInvitingUser(true)
                        }}
                      >
                        {isInvitingUser ? 'Inviting user' : 'Invite user'}
                      </Button>
                    </Group>
                  </Group>

                  <div className={classes.logArea}>
                    <div className={classes.logToolbar}>
                      <TextInput
                        value={userFilter}
                        onChange={(event) => setUserFilter(event.currentTarget.value)}
                        placeholder={
                          userListMode === 'access-requests'
                            ? 'Search requesters by name, email, id, or access state'
                            : 'Search users by name, email, id, status, or access state'
                        }
                        leftSection={<IconSearch size={16} />}
                      />
                      <SegmentedControl
                        value={userListMode}
                        onChange={(value) => setUserListMode(value as 'all' | 'access-requests')}
                        data={userListModeOptions}
                      />
                    </div>

                    <div
                      className={`${classes.logLayout} ${
                        selectedUserId || isCreatingUser || isInvitingUser
                          ? classes.logLayoutSplit
                          : classes.logLayoutSingle
                      }`}
                    >
                      <div className={classes.logTable}>
                        {filteredUsers.length === 0 ? (
                          <div className={classes.logEmptyState}>
                            <Text fw={700}>
                              {userListMode === 'access-requests'
                                ? 'No access requests matched this filter'
                                : 'No users matched this filter'}
                            </Text>
                            <Text size="sm" className={classes.mutedText}>
                              {userListMode === 'access-requests'
                                ? 'Try a broader search by requester name, email, or switch back to all users.'
                                : 'Try a broader search by email, id, or account state.'}
                            </Text>
                          </div>
                        ) : (
                          <ScrollArea h={640}>
                            <div className={classes.logTableBody}>
                              <div
                                className={`${classes.logTableHeader} ${classes.userLogTableCompact}`}
                              >
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  User ({formatNumber(filteredUsers.length)})
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Status
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Identity
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Activity
                                </Text>
                              </div>

                              {filteredUsers.map((user) => {
                                const userId = getRecordId(user)
                                if (!userId) return null

                                const status = getUserStatus(user)
                                const studioAccessStatus = getStudioAccessStatus(user)
                                const hasPendingStudioAccess = studioAccessStatus === 'pending'
                                const studioAccessRequestedAt = getStudioAccessRequestedAt(user)

                                return (
                                  <button
                                    key={userId}
                                    type="button"
                                    className={`${classes.logTableRow} ${classes.userLogTableCompact} ${
                                      selectedUserId === userId ? classes.logTableRowActive : ''
                                    }`}
                                    onClick={() => {
                                      if (selectedUserId === userId) {
                                        closeUserInspector()
                                        return
                                      }

                                      openAdminUser(userId, 'replace')
                                    }}
                                  >
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableTime}`}
                                    >
                                      <Text size="sm" fw={700}>
                                        {getUserLabel(user)}
                                      </Text>
                                      <Text size="xs" className={classes.mutedText}>
                                        Seen{' '}
                                        {formatCompactDate(
                                          user.lastSeen ?? user.updatedAt ?? user.createdAt
                                        ) ?? 'n/a'}
                                      </Text>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableSource}`}
                                    >
                                      <Group gap="xs" wrap="nowrap">
                                        <span
                                          className={`${classes.logDot} ${
                                            status === 'active'
                                              ? classes.logDotSuccess
                                              : status.includes('pending')
                                                ? classes.logDotWarning
                                                : classes.logDotError
                                          }`}
                                        />
                                        <Box style={{ minWidth: 0 }}>
                                          <Text fw={700} size="sm">
                                            {status}
                                          </Text>
                                        </Box>
                                      </Group>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableEvent}`}
                                    >
                                      <Text fw={700} size="sm" className={classes.logTableTitle}>
                                        {readString(user.email) ?? 'No email'}
                                      </Text>
                                      <Text
                                        size="xs"
                                        className={`${classes.consoleText} ${classes.mutedText} ${classes.logTableSubtitle}`}
                                      >
                                        {truncateMiddle(readString(user.id), 42)}
                                      </Text>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableSummary}`}
                                    >
                                      <Text size="sm" className={classes.logSummaryText}>
                                        {hasPendingStudioAccess
                                          ? `Requested ${formatCompactDate(studioAccessRequestedAt) ?? 'recently'}`
                                          : `Updated ${formatCompactDate(user.updatedAt ?? user.createdAt) ?? 'n/a'}`}
                                      </Text>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>

                      {selectedUserId || isCreatingUser || isInvitingUser ? (
                        <div className={`${classes.logDetailPane} ${classes.logDetailSection}`}>
                          {isCreatingUser ? (
                            <Stack gap="md">
                              <div className={classes.logDetailHeader}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Box style={{ minWidth: 0, flex: 1 }}>
                                    <Group gap="xs" mb={6} wrap="wrap">
                                      <Badge color="selected" variant="light">
                                        draft
                                      </Badge>
                                      <Badge color="gray" variant="light">
                                        admin create
                                      </Badge>
                                    </Group>
                                    <Text fw={700}>Create user</Text>
                                    <Text
                                      size="sm"
                                      className={`${classes.consoleText} ${classes.mutedText}`}
                                    >
                                      Provision a new account, then jump straight into the normal
                                      user inspector to keep editing.
                                    </Text>
                                  </Box>
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Close create user panel"
                                    onClick={closeUserInspector}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Group>
                              </div>

                              <DetailSection title="New account" icon={<IconPlus size={16} />}>
                                <Stack gap="md">
                                  <Grid gutter="md">
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                      <TextInput
                                        label="Name"
                                        value={createUserForm.name}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateUserForm((current) => ({
                                            ...current,
                                            name: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                      <TextInput
                                        label="Email"
                                        value={createUserForm.email}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateUserForm((current) => ({
                                            ...current,
                                            email: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                      <TextInput
                                        label="Avatar URL"
                                        placeholder="https://example.com/avatar.png"
                                        value={createUserForm.avatar}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateUserForm((current) => ({
                                            ...current,
                                            avatar: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                      <Switch
                                        checked={createUserForm.isActive}
                                        label="Account starts active"
                                        onChange={(event) => {
                                          const checked = event.currentTarget.checked
                                          setCreateUserForm((current) => ({
                                            ...current,
                                            isActive: checked,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                  </Grid>

                                  <Group justify="space-between" align="flex-end" wrap="wrap">
                                    <Text size="sm" className={classes.mutedText}>
                                      Core account settings are created here. Advanced JSON settings
                                      can be edited right after the account is provisioned.
                                    </Text>
                                    <Button
                                      loading={createUserMutation.isPending}
                                      onClick={() => createUserMutation.mutate()}
                                    >
                                      Create user
                                    </Button>
                                  </Group>
                                </Stack>
                              </DetailSection>
                            </Stack>
                          ) : isInvitingUser ? (
                            <Stack gap="md">
                              <div className={classes.logDetailHeader}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Box style={{ minWidth: 0, flex: 1 }}>
                                    <Group gap="xs" mb={6} wrap="wrap">
                                      <Badge color="selected" variant="light">
                                        invite
                                      </Badge>
                                      <Badge color="gray" variant="light">
                                        email signup
                                      </Badge>
                                    </Group>
                                    <Text fw={700}>Invite user by email</Text>
                                    <Text
                                      size="sm"
                                      className={`${classes.consoleText} ${classes.mutedText}`}
                                    >
                                      Send a signup invitation into a team workspace. The user
                                      record is created when they accept and complete signup.
                                    </Text>
                                  </Box>
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Close invite user panel"
                                    onClick={closeUserInspector}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Group>
                              </div>

                              <DetailSection title="Invite email" icon={<IconPlus size={16} />}>
                                <Stack gap="md">
                                  <Grid gutter="md">
                                    <Grid.Col span={{ base: 12, md: 7 }}>
                                      <TextInput
                                        label="Email"
                                        placeholder="new-member@example.com"
                                        value={inviteUserForm.email}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setInviteUserForm((current) => ({
                                            ...current,
                                            email: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 5 }}>
                                      <Select
                                        label="Role"
                                        data={TEAM_ROLE_OPTIONS.filter(
                                          (role) => role !== 'OWNER'
                                        ).map((value) => ({
                                          value,
                                          label: value,
                                        }))}
                                        value={inviteUserForm.role}
                                        onChange={(value) =>
                                          setInviteUserForm((current) => ({
                                            ...current,
                                            role: value ?? 'MEMBER',
                                          }))
                                        }
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                      <Select
                                        label="Team"
                                        searchable
                                        data={createSessionTeamOptions}
                                        value={inviteUserForm.teamId || null}
                                        onChange={(value) =>
                                          setInviteUserForm((current) => ({
                                            ...current,
                                            teamId: value ?? '',
                                          }))
                                        }
                                        nothingFoundMessage="No teams found"
                                      />
                                    </Grid.Col>
                                  </Grid>

                                  <Group justify="space-between" align="flex-end" wrap="wrap">
                                    <Text size="sm" className={classes.mutedText}>
                                      This sends the existing team signup invite email flow and lets
                                      the user create their account from the invite link.
                                    </Text>
                                    <Button
                                      loading={inviteUserMutation.isPending}
                                      onClick={() => inviteUserMutation.mutate()}
                                    >
                                      Send invite
                                    </Button>
                                  </Group>
                                </Stack>
                              </DetailSection>
                            </Stack>
                          ) : userInspectorMode === 'team' ? (
                            !selectedTeamId ? (
                              <div className={classes.explorerEmptyState}>
                                <Text fw={700}>No team selected</Text>
                                <Text size="sm" className={classes.mutedText}>
                                  Choose a team row from the user detail to inspect it here.
                                </Text>
                              </div>
                            ) : teamDetailQuery.isLoading ||
                              teamUsageQuery.isLoading ||
                              teamSessionsQuery.isLoading ||
                              teamSubscriptionQuery.isLoading ? (
                              <Center py="xl">
                                <Loader size="sm" />
                              </Center>
                            ) : (
                              <Stack gap="md">
                                <div className={classes.logDetailHeader}>
                                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                                    <Box style={{ minWidth: 0, flex: 1 }}>
                                      <Button
                                        variant="subtle"
                                        size="xs"
                                        leftSection={<IconArrowLeft size={14} />}
                                        mb="sm"
                                        onClick={() => {
                                          setUserInspectorReturnMode('user')
                                          setUserInspectorMode('user')
                                        }}
                                      >
                                        Back to user
                                      </Button>
                                      <Group gap="xs" mb={6} wrap="wrap">
                                        <Badge
                                          color={
                                            readBoolean(
                                              teamDetail.isActive,
                                              teamUsageTeam.isActive
                                            ) === false
                                              ? 'brand'
                                              : 'selected'
                                          }
                                          variant="light"
                                        >
                                          {readBoolean(
                                            teamDetail.isActive,
                                            teamUsageTeam.isActive
                                          ) === false
                                            ? 'inactive'
                                            : 'active'}
                                        </Badge>
                                        <Badge
                                          color="gray"
                                          variant="light"
                                          className={classes.consoleText}
                                        >
                                          {selectedTeamId}
                                        </Badge>
                                      </Group>
                                      <Text fw={700}>
                                        {readString(
                                          teamDetail.name,
                                          teamUsageTeam.name,
                                          selectedTeamListItem?.name
                                        ) ?? 'Unknown team'}
                                      </Text>
                                      <Text
                                        size="sm"
                                        className={`${classes.consoleText} ${classes.mutedText}`}
                                      >
                                        {readString(
                                          teamDetail.slug,
                                          teamUsageTeam.slug,
                                          selectedTeamListItem?.slug,
                                          teamDetail.billingEmail
                                        ) ?? 'No slug available'}
                                      </Text>
                                    </Box>
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      aria-label="Close user details"
                                      onClick={closeUserInspector}
                                    >
                                      <IconX size={16} />
                                    </ActionIcon>
                                  </Group>
                                </div>

                                <div className={classes.logMetaGrid}>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Your role
                                    </Text>
                                    <Text fw={700}>{selectedUserTeamMembershipRole}</Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Membership status
                                    </Text>
                                    <Text fw={700}>{selectedUserTeamMembershipStatus}</Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Coins left
                                    </Text>
                                    <Text fw={700}>
                                      {formatNumber(readNumber(teamUsageTokens.available) ?? 0)}
                                    </Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Current plan
                                    </Text>
                                    <Text fw={700}>
                                      {readString(
                                        teamSubscriptionPlan.name,
                                        teamSubscriptionPlan.planLevel,
                                        teamSubscription?.status
                                      ) ?? 'n/a'}
                                    </Text>
                                  </div>
                                </div>

                                <TeamEditorSection
                                  form={teamEditForm}
                                  setForm={setTeamEditForm}
                                  baseline={teamEditBaseline}
                                  hasChanges={teamEditHasChanges}
                                  saving={updateTeamMutation.isPending}
                                  onReset={() => setTeamEditForm(teamEditBaseline)}
                                  onSave={() => {
                                    if (!selectedTeamId) return
                                    updateTeamMutation.mutate(selectedTeamId)
                                  }}
                                  expanded={isUserInspectorSectionExpanded('team:editor')}
                                  onToggle={() => toggleUserInspectorSection('team:editor')}
                                />

                                <DetailSection
                                  title="Selected user in team"
                                  icon={<IconUser size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('team:selected-user')}
                                  onToggle={() => toggleUserInspectorSection('team:selected-user')}
                                  action={
                                    <Group gap="xs" wrap="nowrap">
                                      <Badge
                                        color={getStatusColor(
                                          selectedUserTeamMembershipStatus,
                                          'selected'
                                        )}
                                        variant="light"
                                      >
                                        {selectedUserTeamMembershipStatus}
                                      </Badge>
                                      <Badge
                                        color={teamMembershipEditHasChanges ? 'selected' : 'gray'}
                                        variant="light"
                                      >
                                        {teamMembershipEditHasChanges ? 'unsaved' : 'saved'}
                                      </Badge>
                                    </Group>
                                  }
                                >
                                  {teamMembershipEditForm ? (
                                    <Stack gap="md">
                                      <Grid gutter="md">
                                        <Grid.Col span={{ base: 12, md: 5 }}>
                                          <Select
                                            label="Role"
                                            data={TEAM_ROLE_OPTIONS.map((value) => ({
                                              label: value,
                                              value,
                                            }))}
                                            value={teamMembershipEditForm.role}
                                            allowDeselect={false}
                                            onChange={(value) =>
                                              setTeamMembershipEditForm((current) =>
                                                current
                                                  ? {
                                                      ...current,
                                                      role: value ?? 'MEMBER',
                                                    }
                                                  : current
                                              )
                                            }
                                          />
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, md: 4 }}>
                                          <NumberInput
                                            label="Token limit"
                                            min={0}
                                            allowDecimal={false}
                                            thousandSeparator=","
                                            value={teamMembershipEditForm.tokenLimit}
                                            onChange={(value) =>
                                              setTeamMembershipEditForm((current) =>
                                                current
                                                  ? {
                                                      ...current,
                                                      tokenLimit:
                                                        typeof value === 'number' &&
                                                        Number.isFinite(value)
                                                          ? value
                                                          : 0,
                                                    }
                                                  : current
                                              )
                                            }
                                          />
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, md: 3 }}>
                                          <Box style={{ paddingTop: '1.8rem' }}>
                                            <Switch
                                              checked={teamMembershipEditForm.isActive}
                                              label="Membership active"
                                              onChange={(event) => {
                                                const checked = event.currentTarget.checked
                                                setTeamMembershipEditForm((current) =>
                                                  current
                                                    ? {
                                                        ...current,
                                                        isActive: checked,
                                                      }
                                                    : current
                                                )
                                              }}
                                            />
                                          </Box>
                                        </Grid.Col>
                                      </Grid>

                                      <Group justify="space-between" align="flex-end" wrap="wrap">
                                        <Text size="sm" className={classes.mutedText}>
                                          Update this user&apos;s role, token cap, and active state
                                          in the selected team. Setting the role to `OWNER`
                                          transfers ownership.
                                        </Text>
                                        <Group gap="sm" wrap="wrap">
                                          <Button
                                            variant="light"
                                            disabled={
                                              !teamMembershipEditHasChanges ||
                                              !teamMembershipEditBaseline
                                            }
                                            onClick={() =>
                                              setTeamMembershipEditForm(teamMembershipEditBaseline)
                                            }
                                          >
                                            Reset
                                          </Button>
                                          <Button
                                            loading={updateTeamMembershipMutation.isPending}
                                            onClick={() => {
                                              if (!selectedTeamId || !selectedUserId) return
                                              updateTeamMembershipMutation.mutate({
                                                teamId: selectedTeamId,
                                                userId: selectedUserId,
                                              })
                                            }}
                                          >
                                            Save membership
                                          </Button>
                                        </Group>
                                      </Group>
                                    </Stack>
                                  ) : (
                                    <Text size="sm" className={classes.mutedText}>
                                      Membership details are unavailable for this user in the
                                      selected team.
                                    </Text>
                                  )}
                                </DetailSection>

                                <TeamMemberAssignmentSection
                                  form={teamMemberCreateForm}
                                  setForm={setTeamMemberCreateForm}
                                  inviteForm={teamMemberInviteForm}
                                  setInviteForm={setTeamMemberInviteForm}
                                  userOptions={availableTeamMemberOptions}
                                  saving={addTeamMemberMutation.isPending}
                                  inviteSaving={inviteTeamMemberMutation.isPending}
                                  onAssign={() => {
                                    if (!selectedTeamId) return
                                    addTeamMemberMutation.mutate(selectedTeamId)
                                  }}
                                  onInvite={() => {
                                    if (!selectedTeamId) return
                                    inviteTeamMemberMutation.mutate(selectedTeamId)
                                  }}
                                  expanded={isUserInspectorSectionExpanded('team:add-member')}
                                  onToggle={() => toggleUserInspectorSection('team:add-member')}
                                />

                                <DetailSection
                                  title="Team members"
                                  icon={<IconUsersGroup size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('team:members')}
                                  onToggle={() => toggleUserInspectorSection('team:members')}
                                  action={
                                    <Badge color="selected" variant="light">
                                      {teamMemberships.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {teamMemberships.length === 0 ? (
                                      <Text size="sm" className={classes.mutedText}>
                                        No memberships returned for this team.
                                      </Text>
                                    ) : (
                                      teamMemberships.map((membership, index) => {
                                        const user = isRecord(membership.user)
                                          ? membership.user
                                          : {}
                                        const memberUserId = readString(user.id, membership.userId)
                                        const teamId = readString(membership.teamId, selectedTeamId)
                                        const membershipRole = readString(membership.role)
                                        const isRemovingMember =
                                          removeTeamMemberMutation.isPending &&
                                          removeTeamMemberMutation.variables?.teamId === teamId &&
                                          removeTeamMemberMutation.variables?.userId ===
                                            memberUserId

                                        return (
                                          <ExplorerRow
                                            key={
                                              readString(
                                                membership.id,
                                                membership.userId,
                                                String(index)
                                              ) ?? String(index)
                                            }
                                            title={getUserLabel(user)}
                                            subtitle={`Role: ${readString(membership.role) ?? 'member'}`}
                                            meta={formatCompactDate(
                                              membership.acceptedAt ?? membership.invitedAt
                                            )}
                                            badges={
                                              <>
                                                <Badge color="selected" variant="light">
                                                  {readString(membership.role) ?? 'member'}
                                                </Badge>
                                                {memberUserId === selectedUserId ? (
                                                  <Badge color="brand" variant="light">
                                                    selected user
                                                  </Badge>
                                                ) : null}
                                                {membership.isActive === false ? (
                                                  <Badge color="brand" variant="light">
                                                    inactive
                                                  </Badge>
                                                ) : null}
                                              </>
                                            }
                                            actions={
                                              memberUserId &&
                                              teamId &&
                                              membership.isActive !== false ? (
                                                <ActionIcon
                                                  variant="subtle"
                                                  color="brand"
                                                  aria-label={`Remove ${getUserLabel(user)} from team`}
                                                  disabled={removeTeamMemberMutation.isPending}
                                                  onClick={() =>
                                                    requestTeamMemberRemoval({
                                                      teamId,
                                                      userId: memberUserId,
                                                      role: membershipRole,
                                                      label: getUserLabel(user),
                                                    })
                                                  }
                                                >
                                                  {isRemovingMember ? (
                                                    <Loader size={14} color="currentColor" />
                                                  ) : (
                                                    <IconTrash size={15} />
                                                  )}
                                                </ActionIcon>
                                              ) : null
                                            }
                                            onClick={() => {
                                              if (memberUserId) {
                                                openAdminUser(memberUserId, 'replace')
                                              }
                                            }}
                                          />
                                        )
                                      })
                                    )}
                                  </Stack>
                                </DetailSection>

                                <DetailSection
                                  title="Team sessions"
                                  icon={<IconClock size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('team:sessions')}
                                  onToggle={() => toggleUserInspectorSection('team:sessions')}
                                  action={
                                    <Badge color="info" variant="light">
                                      {teamSessions.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {teamSessions.length === 0 ? (
                                      <Text size="sm" className={classes.mutedText}>
                                        No sessions returned for this team.
                                      </Text>
                                    ) : (
                                      teamSessions.slice(0, 10).map((session) => {
                                        const sessionId = getRecordId(session)
                                        if (!sessionId) return null

                                        return (
                                          <ExplorerRow
                                            key={sessionId}
                                            title={getSessionLabel(session)}
                                            subtitle={`${getSessionType(session)} • ${getSessionStatus(session)}`}
                                            meta={getSessionDate(session)}
                                            badges={
                                              <Badge
                                                color={
                                                  getSessionStatus(session) === 'ended'
                                                    ? 'success'
                                                    : 'info'
                                                }
                                                variant="light"
                                              >
                                                {getSessionStatus(session)}
                                              </Badge>
                                            }
                                            onClick={() => {
                                              openAdminSession(sessionId)
                                            }}
                                          />
                                        )
                                      })
                                    )}
                                  </Stack>
                                </DetailSection>

                                <DetailSection
                                  title="Usage + subscription detail"
                                  icon={<IconListDetails size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('team:payload')}
                                  onToggle={() => toggleUserInspectorSection('team:payload')}
                                >
                                  <JsonBlock
                                    value={{
                                      team: teamDetail,
                                      usage: teamUsageStats,
                                      subscription: teamSubscription,
                                      llm: teamUsageLlm,
                                      selectedUserMembership: selectedUserTeamMembership,
                                    }}
                                  />
                                </DetailSection>
                              </Stack>
                            )
                          ) : userInspectorMode === 'session' ? (
                            !selectedSessionId ? (
                              <div className={classes.explorerEmptyState}>
                                <Text fw={700}>No session selected</Text>
                                <Text size="sm" className={classes.mutedText}>
                                  Choose a session row from the user detail to inspect it here.
                                </Text>
                              </div>
                            ) : sessionDetailQuery.isLoading ||
                              sessionTranscriptQuery.isLoading ||
                              sessionMembersQuery.isLoading ||
                              sessionEventsQuery.isLoading ||
                              sessionTimelineQuery.isLoading ||
                              sessionLlmCallsQuery.isLoading ? (
                              <Center py="xl">
                                <Loader size="sm" />
                              </Center>
                            ) : (
                              <Stack gap="md">
                                <div className={classes.logDetailHeader}>
                                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                                    <Box style={{ minWidth: 0, flex: 1 }}>
                                      <Button
                                        variant="subtle"
                                        size="xs"
                                        leftSection={<IconArrowLeft size={14} />}
                                        mb="sm"
                                        onClick={() =>
                                          setUserInspectorMode(userInspectorReturnMode)
                                        }
                                      >
                                        {userInspectorReturnMode === 'team'
                                          ? 'Back to team'
                                          : 'Back to user'}
                                      </Button>
                                      <Group gap="xs" mb={6} wrap="wrap">
                                        <Badge
                                          color={
                                            getSessionStatus(sessionDetail) === 'ended'
                                              ? 'success'
                                              : 'info'
                                          }
                                          variant="light"
                                        >
                                          {getSessionStatus(sessionDetail)}
                                        </Badge>
                                        <Badge color="selected" variant="light">
                                          {getSessionType(sessionDetail)}
                                        </Badge>
                                        <Badge
                                          color="gray"
                                          variant="light"
                                          className={classes.consoleText}
                                        >
                                          {selectedSessionId}
                                        </Badge>
                                      </Group>
                                      <Text fw={700}>{getSessionLabel(sessionDetail)}</Text>
                                      <Text
                                        size="sm"
                                        className={`${classes.consoleText} ${classes.mutedText}`}
                                      >
                                        Created {formatDateTime(sessionDetail.createdAt)} • Updated{' '}
                                        {formatDateTime(sessionDetail.updatedAt)}
                                      </Text>
                                    </Box>
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      aria-label="Close user details"
                                      onClick={closeUserInspector}
                                    >
                                      <IconX size={16} />
                                    </ActionIcon>
                                  </Group>
                                </div>

                                <div className={classes.logMetaGrid}>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Members
                                    </Text>
                                    <Text fw={700}>{formatNumber(sessionMembers.length)}</Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Transcript
                                    </Text>
                                    <Text fw={700}>
                                      {formatNumber(transcriptSegments.length)} segments
                                    </Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Events
                                    </Text>
                                    <Text fw={700}>{formatNumber(sessionEvents.length)}</Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      LLM traces
                                    </Text>
                                    <Text fw={700}>{formatNumber(sessionLlmTraces.length)}</Text>
                                  </div>
                                </div>

                                <SessionEditorSection
                                  form={sessionEditForm}
                                  setForm={setSessionEditForm}
                                  baseline={sessionEditBaseline}
                                  hasChanges={sessionEditHasChanges}
                                  saving={updateSessionMutation.isPending}
                                  onReset={() => setSessionEditForm(sessionEditBaseline)}
                                  onSave={() => {
                                    if (!selectedSessionId) return
                                    updateSessionMutation.mutate(selectedSessionId)
                                  }}
                                  expanded={isUserInspectorSectionExpanded('session:editor')}
                                  onToggle={() => toggleUserInspectorSection('session:editor')}
                                  teams={teams}
                                  scenarios={scenarios}
                                  personas={personas}
                                />

                                <SessionMemberAssignmentSection
                                  form={sessionMemberCreateForm}
                                  setForm={setSessionMemberCreateForm}
                                  userOptions={availableSessionMemberOptions}
                                  saving={addSessionMembersMutation.isPending}
                                  onAssign={() => {
                                    if (!selectedSessionId) return
                                    addSessionMembersMutation.mutate(selectedSessionId)
                                  }}
                                  expanded={isUserInspectorSectionExpanded('session:add-members')}
                                  onToggle={() => toggleUserInspectorSection('session:add-members')}
                                />

                                <DetailSection
                                  title="Members / assignees"
                                  icon={<IconUsersGroup size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('session:members')}
                                  onToggle={() => toggleUserInspectorSection('session:members')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="selected" variant="light">
                                      {sessionMembers.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {sessionMembers.length === 0 ? (
                                      <Text size="sm" className={classes.mutedText}>
                                        No session members returned.
                                      </Text>
                                    ) : (
                                      sessionMembers.map((member, index) => {
                                        const memberUser = isRecord(member.user) ? member.user : {}
                                        const memberUserId = readString(
                                          member.userId,
                                          memberUser.id
                                        )
                                        const sessionId = readString(
                                          member.sessionId,
                                          selectedSessionId
                                        )
                                        const memberRole = readString(member.role)
                                        const memberLabel =
                                          readString(
                                            memberUser.name,
                                            memberUser.email,
                                            member.userId,
                                            member.id
                                          ) ?? 'Session member'
                                        const isRemovingMember =
                                          removeSessionMemberMutation.isPending &&
                                          removeSessionMemberMutation.variables?.sessionId ===
                                            sessionId &&
                                          removeSessionMemberMutation.variables?.userId ===
                                            memberUserId

                                        return (
                                          <ExplorerRow
                                            key={
                                              readString(member.id, member.userId, String(index)) ??
                                              String(index)
                                            }
                                            title={memberLabel}
                                            subtitle={`Role: ${readString(member.role) ?? 'member'}`}
                                            meta={formatCompactDate(member.joinedAt)}
                                            badges={
                                              <>
                                                <Badge color="selected" variant="light">
                                                  {readString(member.userId, memberUser.id) ??
                                                    'unknown user'}
                                                </Badge>
                                                {memberUserId === selectedUserId ? (
                                                  <Badge color="brand" variant="light">
                                                    selected user
                                                  </Badge>
                                                ) : null}
                                              </>
                                            }
                                            actions={
                                              memberUserId && sessionId ? (
                                                <ActionIcon
                                                  variant="subtle"
                                                  color="brand"
                                                  aria-label={`Remove ${memberLabel} from session`}
                                                  disabled={removeSessionMemberMutation.isPending}
                                                  onClick={() =>
                                                    requestSessionMemberRemoval({
                                                      sessionId,
                                                      userId: memberUserId,
                                                      role: memberRole,
                                                      label: memberLabel,
                                                    })
                                                  }
                                                >
                                                  {isRemovingMember ? (
                                                    <Loader size={14} color="currentColor" />
                                                  ) : (
                                                    <IconTrash size={15} />
                                                  )}
                                                </ActionIcon>
                                              ) : null
                                            }
                                            onClick={() => {
                                              if (memberUserId) {
                                                openAdminUser(memberUserId, 'replace')
                                              }
                                            }}
                                          />
                                        )
                                      })
                                    )}
                                  </Stack>
                                </DetailSection>

                                <DetailSection
                                  title="Timeline + events"
                                  icon={<IconClock size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('session:timeline')}
                                  onToggle={() => toggleUserInspectorSection('session:timeline')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="info" variant="light">
                                      {sessionEvents.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {sessionActivityItems.slice(0, 10).map((item) => (
                                      <ExplorerRow
                                        key={item.key}
                                        title={
                                          readString(
                                            item.payload.type,
                                            item.payload.eventType,
                                            item.payload.role,
                                            item.payload.status
                                          ) ?? 'Session event'
                                        }
                                        subtitle={truncate(
                                          readString(
                                            item.payload.message,
                                            item.payload.text,
                                            item.payload.traceId,
                                            item.payload.id
                                          ),
                                          90
                                        )}
                                        meta={formatCompactDate(
                                          item.payload.createdAt ?? item.payload.timestamp
                                        )}
                                        badges={
                                          <Badge color="info" variant="light">
                                            {readString(
                                              item.payload.type,
                                              item.payload.role,
                                              'event'
                                            ) ?? 'event'}
                                          </Badge>
                                        }
                                        active={selectedSessionActivity?.key === item.key}
                                        onClick={() => setSelectedSessionActivityKey(item.key)}
                                      />
                                    ))}
                                  </Stack>
                                  {selectedSessionActivity ? (
                                    <JsonBlock value={selectedSessionActivity.payload} />
                                  ) : null}
                                </DetailSection>

                                <DetailSection
                                  title="Transcript"
                                  icon={<IconFileText size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('session:transcript')}
                                  onToggle={() => toggleUserInspectorSection('session:transcript')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="success" variant="light">
                                      {transcriptSegments.length}
                                    </Badge>
                                  }
                                >
                                  {transcriptSegments.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No transcript segments returned for this session.
                                    </Text>
                                  ) : (
                                    <div className={classes.transcriptList}>
                                      {transcriptItems.slice(0, 12).map(({ key, payload }) => (
                                        <button
                                          key={key}
                                          type="button"
                                          className={`${classes.transcriptSegment} ${
                                            selectedTranscriptSegment?.key === key
                                              ? classes.transcriptSegmentActive
                                              : ''
                                          }`}
                                          onClick={() => setSelectedTranscriptKey(key)}
                                        >
                                          <Group justify="space-between" mb={6} wrap="wrap">
                                            <Badge color="selected" variant="light">
                                              {readString(
                                                payload.speakerTag,
                                                payload.speakerId,
                                                'speaker'
                                              ) ?? 'speaker'}
                                            </Badge>
                                            <Text size="xs" className={classes.mutedText}>
                                              {readString(
                                                payload.startMs,
                                                payload.startTimeMs,
                                                payload.offsetMs
                                              ) ?? formatCompactDate(payload.createdAt)}
                                            </Text>
                                          </Group>
                                          <Text size="sm">
                                            {readString(payload.text, payload.content) ??
                                              'No transcript text'}
                                          </Text>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {selectedTranscriptSegment ? (
                                    <JsonBlock value={selectedTranscriptSegment.payload} />
                                  ) : null}
                                </DetailSection>

                                <DetailSection
                                  title="LLM traces"
                                  icon={<IconBolt size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('session:llm')}
                                  onToggle={() => toggleUserInspectorSection('session:llm')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="brand" variant="light">
                                      {sessionLlmTraces.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {sessionLlmTraces.length === 0 ? (
                                      <Text size="sm" className={classes.mutedText}>
                                        No LLM traces returned.
                                      </Text>
                                    ) : (
                                      sessionTraceItems.slice(0, 8).map(({ key, payload }) => {
                                        const traceContext = isRecord(payload.context)
                                          ? payload.context
                                          : {}
                                        const traceUsage = isRecord(payload.usage)
                                          ? payload.usage
                                          : {}

                                        return (
                                          <ExplorerRow
                                            key={key}
                                            title={
                                              readString(
                                                payload.provider,
                                                payload.model,
                                                payload.name
                                              ) ?? 'LLM trace'
                                            }
                                            subtitle={truncate(
                                              readString(
                                                payload.purpose,
                                                payload.requestId,
                                                payload.responseId,
                                                traceContext.purpose
                                              ),
                                              80
                                            )}
                                            meta={formatCompactDate(payload.createdAt)}
                                            badges={
                                              <Badge color="brand" variant="light">
                                                {formatNumber(
                                                  readNumber(
                                                    traceUsage.totalTokens,
                                                    traceUsage.promptTokens
                                                  ) ?? 0
                                                )}{' '}
                                                tokens
                                              </Badge>
                                            }
                                            active={selectedSessionTrace?.key === key}
                                            onClick={() => setSelectedTraceKey(key)}
                                          />
                                        )
                                      })
                                    )}
                                  </Stack>
                                  {selectedSessionTrace ? (
                                    <JsonBlock value={selectedSessionTrace.payload} />
                                  ) : null}
                                </DetailSection>

                                <DetailSection
                                  title="Assessment + raw detail"
                                  icon={<IconListDetails size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('session:assessment')}
                                  onToggle={() => toggleUserInspectorSection('session:assessment')}
                                  bodyClassName={classes.inspectorSectionBody}
                                >
                                  <JsonBlock
                                    value={{
                                      session: sessionDetail,
                                      assessment: sessionAssessment,
                                      llmSummary: sessionLlmSummary,
                                      invitations: sessionInvitations,
                                    }}
                                  />
                                </DetailSection>
                              </Stack>
                            )
                          ) : userDetailQuery.isLoading || userActivityQuery.isLoading ? (
                            <Center py="xl">
                              <Loader size="sm" />
                            </Center>
                          ) : (
                            <Stack gap="md">
                              <div className={classes.logDetailHeader}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Box style={{ minWidth: 0, flex: 1 }}>
                                    <Group gap="xs" mb={6} wrap="wrap">
                                      <Badge
                                        color={getStatusColor(selectedUserStatus, 'success')}
                                        variant="light"
                                      >
                                        {selectedUserStatus}
                                      </Badge>
                                      <Badge
                                        color="gray"
                                        variant="light"
                                        className={classes.consoleText}
                                        title={selectedUserId ?? undefined}
                                      >
                                        {truncateMiddle(selectedUserId, 18)}
                                      </Badge>
                                    </Group>
                                    <Text fw={700}>
                                      {readString(
                                        selectedUserSnapshot.name,
                                        userActivityUser.name,
                                        selectedUserListItem?.name
                                      ) ?? 'Unknown user'}
                                    </Text>
                                    <Text
                                      size="sm"
                                      className={`${classes.consoleText} ${classes.mutedText}`}
                                    >
                                      {readString(
                                        selectedUserSnapshot.email,
                                        userActivityUser.email,
                                        selectedUserListItem?.email
                                      ) ?? 'No email available'}
                                    </Text>
                                  </Box>
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Close user details"
                                    onClick={closeUserInspector}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Group>
                              </div>

                              <div className={classes.logMetaGrid}>
                                <div className={classes.logMetaCard}>
                                  <Text
                                    size="xs"
                                    tt="uppercase"
                                    fw={700}
                                    className={classes.metaLabel}
                                  >
                                    Last seen
                                  </Text>
                                  <Text fw={700}>
                                    {formatCompactDate(
                                      userActivityStats.lastSeen ?? selectedUserSnapshot.lastSeen
                                    ) ?? 'n/a'}
                                  </Text>
                                </div>
                                <div className={classes.logMetaCard}>
                                  <Text
                                    size="xs"
                                    tt="uppercase"
                                    fw={700}
                                    className={classes.metaLabel}
                                  >
                                    Joined
                                  </Text>
                                  <Text fw={700}>
                                    {formatCompactDate(
                                      selectedUserSnapshot.createdAt ?? userActivityUser.createdAt
                                    ) ?? 'n/a'}
                                  </Text>
                                </div>
                              </div>

                              {selectedUserStudioAccessRequest ? (
                                <DetailSection
                                  title="Access request"
                                  icon={<IconShield size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('user:access')}
                                  onToggle={() => toggleUserInspectorSection('user:access')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="yellow" variant="light">
                                      pending access
                                    </Badge>
                                  }
                                >
                                  <Stack gap="md">
                                    <Group justify="space-between" align="flex-start" wrap="wrap">
                                      <Box style={{ minWidth: 0, flex: 1 }}>
                                        <Text fw={700}>
                                          {selectedUserStudioAccessRequest.email}
                                        </Text>
                                        <Text size="sm" className={classes.mutedText}>
                                          Requested on{' '}
                                          {formatCompactDate(
                                            selectedUserStudioAccessRequest.requestedAt
                                          ) ??
                                            new Date(
                                              selectedUserStudioAccessRequest.requestedAt
                                            ).toLocaleString()}
                                        </Text>
                                      </Box>
                                      <Badge
                                        color="gray"
                                        variant="light"
                                        className={classes.consoleText}
                                      >
                                        {truncateMiddle(selectedUserStudioAccessRequest.userId, 18)}
                                      </Badge>
                                    </Group>

                                    <Grid gutter="md">
                                      <Grid.Col span={{ base: 12, md: 6 }}>
                                        <NumberInput
                                          label="Quota"
                                          min={1}
                                          step={100}
                                          thousandSeparator=","
                                          value={
                                            studioAccessQuotas[
                                              selectedUserStudioAccessRequest.userId
                                            ] ??
                                            selectedUserStudioAccessRequest.quota ??
                                            5000
                                          }
                                          onChange={(value) =>
                                            setStudioAccessQuotas((current) => ({
                                              ...current,
                                              [selectedUserStudioAccessRequest.userId]:
                                                typeof value === 'number' && Number.isFinite(value)
                                                  ? value
                                                  : 0,
                                            }))
                                          }
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={{ base: 12, md: 6 }}>
                                        <Select
                                          label="Role"
                                          data={[
                                            { value: 'MEMBER', label: 'Regular user' },
                                            { value: 'ADMIN', label: 'Admin user' },
                                          ]}
                                          value={
                                            studioAccessRoles[
                                              selectedUserStudioAccessRequest.userId
                                            ] ??
                                            (selectedUserStudioAccessRequest.role === 'ADMIN'
                                              ? 'ADMIN'
                                              : 'MEMBER')
                                          }
                                          onChange={(value) =>
                                            setStudioAccessRoles((current) => ({
                                              ...current,
                                              [selectedUserStudioAccessRequest.userId]:
                                                value === 'ADMIN' ? 'ADMIN' : 'MEMBER',
                                            }))
                                          }
                                        />
                                      </Grid.Col>
                                    </Grid>

                                    <Group justify="space-between" align="flex-end" wrap="wrap">
                                      <Text size="sm" className={classes.mutedText}>
                                        Review and resolve this Studio access request directly from
                                        the selected user profile.
                                      </Text>
                                      <Group gap="sm" wrap="wrap">
                                        <Button
                                          variant="light"
                                          color="yellow"
                                          loading={
                                            reviewingStudioAccessUserId ===
                                            selectedUserStudioAccessRequest.userId
                                          }
                                          onClick={() =>
                                            handleDenyStudioAccess(selectedUserStudioAccessRequest)
                                          }
                                        >
                                          Deny
                                        </Button>
                                        <Button
                                          loading={
                                            reviewingStudioAccessUserId ===
                                            selectedUserStudioAccessRequest.userId
                                          }
                                          onClick={() =>
                                            handleApproveStudioAccess(
                                              selectedUserStudioAccessRequest
                                            )
                                          }
                                        >
                                          Approve
                                        </Button>
                                      </Group>
                                    </Group>
                                  </Stack>
                                </DetailSection>
                              ) : null}

                              {selectedUserPendingCoinRefillRequest ? (
                                <DetailSection
                                  title="Personal coin top-up"
                                  icon={<IconBolt size={16} />}
                                  collapsible
                                  expanded={isUserInspectorSectionExpanded('user:topup')}
                                  onToggle={() => toggleUserInspectorSection('user:topup')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="yellow" variant="light">
                                      pending top-up
                                    </Badge>
                                  }
                                >
                                  <Stack gap="md">
                                    <Group justify="space-between" align="flex-start" wrap="wrap">
                                      <Box style={{ minWidth: 0, flex: 1 }}>
                                        <Text fw={700}>
                                          {selectedUserPendingCoinRefillRequest.email}
                                        </Text>
                                        <Text size="sm" className={classes.mutedText}>
                                          Requested on{' '}
                                          {formatCompactDate(
                                            selectedUserPendingCoinRefillRequest.requestedAt
                                          ) ??
                                            new Date(
                                              selectedUserPendingCoinRefillRequest.requestedAt
                                            ).toLocaleString()}
                                        </Text>
                                      </Box>
                                      <Badge
                                        color="gray"
                                        variant="light"
                                        className={classes.consoleText}
                                      >
                                        {truncateMiddle(
                                          selectedUserPendingCoinRefillRequest.userId,
                                          18
                                        )}
                                      </Badge>
                                    </Group>

                                    <div className={classes.logMetaGrid}>
                                      <div className={classes.logMetaCard}>
                                        <Text
                                          size="xs"
                                          tt="uppercase"
                                          fw={700}
                                          className={classes.metaLabel}
                                        >
                                          Requested credits
                                        </Text>
                                        <Text fw={700}>
                                          {formatNumber(
                                            selectedUserPendingCoinRefillRequest.requestedCoins
                                          )}
                                        </Text>
                                      </div>
                                      <div className={classes.logMetaCard}>
                                        <Text
                                          size="xs"
                                          tt="uppercase"
                                          fw={700}
                                          className={classes.metaLabel}
                                        >
                                          Personal workspace
                                        </Text>
                                        <Text
                                          fw={700}
                                          className={classes.consoleText}
                                          title={
                                            selectedUserPendingCoinRefillRequest.teamId ?? undefined
                                          }
                                        >
                                          {truncateMiddle(
                                            selectedUserPendingCoinRefillRequest.teamId,
                                            18
                                          )}
                                        </Text>
                                      </div>
                                    </div>

                                    <Group justify="space-between" align="flex-end" wrap="wrap">
                                      <Box style={{ minWidth: 220, flex: '1 1 220px' }}>
                                        <NumberInput
                                          label="Approve amount"
                                          min={1}
                                          step={100}
                                          thousandSeparator=","
                                          value={
                                            coinRefillApprovedAmounts[
                                              selectedUserPendingCoinRefillRequest.userId
                                            ] ?? selectedUserPendingCoinRefillRequest.requestedCoins
                                          }
                                          onChange={(value) =>
                                            setCoinRefillApprovedAmounts((current) => ({
                                              ...current,
                                              [selectedUserPendingCoinRefillRequest.userId]:
                                                typeof value === 'number' && Number.isFinite(value)
                                                  ? value
                                                  : 0,
                                            }))
                                          }
                                        />
                                      </Box>
                                      <Group gap="sm" wrap="wrap">
                                        <Button
                                          variant="light"
                                          color="yellow"
                                          loading={
                                            reviewingCoinRefillUserId ===
                                            selectedUserPendingCoinRefillRequest.userId
                                          }
                                          onClick={() =>
                                            handleDenyCoinRefill(
                                              selectedUserPendingCoinRefillRequest
                                            )
                                          }
                                        >
                                          Deny
                                        </Button>
                                        <Button
                                          loading={
                                            reviewingCoinRefillUserId ===
                                            selectedUserPendingCoinRefillRequest.userId
                                          }
                                          onClick={() =>
                                            handleApproveCoinRefill(
                                              selectedUserPendingCoinRefillRequest
                                            )
                                          }
                                        >
                                          Approve
                                        </Button>
                                      </Group>
                                    </Group>
                                  </Stack>
                                </DetailSection>
                              ) : null}

                              <DetailSection
                                title="User editor"
                                icon={<IconSettings size={16} />}
                                collapsible
                                expanded={isUserInspectorSectionExpanded('user:editor')}
                                onToggle={() => toggleUserInspectorSection('user:editor')}
                                action={
                                  <Group gap="xs" wrap="nowrap">
                                    <Badge
                                      color={getStatusColor(
                                        userEditForm?.isActive ? 'active' : 'inactive',
                                        'selected'
                                      )}
                                      variant="light"
                                    >
                                      {userEditForm?.isActive ? 'active' : 'inactive'}
                                    </Badge>
                                    <Badge
                                      color={userEditHasChanges ? 'selected' : 'gray'}
                                      variant="light"
                                    >
                                      {userEditHasChanges ? 'unsaved' : 'saved'}
                                    </Badge>
                                  </Group>
                                }
                              >
                                {userEditForm ? (
                                  <Stack gap="md">
                                    <Grid gutter="md">
                                      <Grid.Col span={{ base: 12, md: 6 }}>
                                        <TextInput
                                          label="Name"
                                          value={userEditForm.name}
                                          onChange={(event) => {
                                            const value = event.currentTarget.value
                                            setUserEditForm((current) =>
                                              current
                                                ? {
                                                    ...current,
                                                    name: value,
                                                  }
                                                : current
                                            )
                                          }}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={{ base: 12, md: 6 }}>
                                        <TextInput
                                          label="Email"
                                          value={userEditForm.email}
                                          onChange={(event) => {
                                            const value = event.currentTarget.value
                                            setUserEditForm((current) =>
                                              current
                                                ? {
                                                    ...current,
                                                    email: value,
                                                  }
                                                : current
                                            )
                                          }}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={12}>
                                        <TextInput
                                          label="Avatar URL"
                                          placeholder="https://example.com/avatar.png"
                                          value={userEditForm.avatar}
                                          onChange={(event) => {
                                            const value = event.currentTarget.value
                                            setUserEditForm((current) =>
                                              current
                                                ? {
                                                    ...current,
                                                    avatar: value,
                                                  }
                                                : current
                                            )
                                          }}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={12}>
                                        <Switch
                                          checked={userEditForm.isActive}
                                          label="Account is active"
                                          onChange={(event) => {
                                            const checked = event.currentTarget.checked
                                            setUserEditForm((current) =>
                                              current
                                                ? {
                                                    ...current,
                                                    isActive: checked,
                                                  }
                                                : current
                                            )
                                          }}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={12}>
                                        <Textarea
                                          label="Settings JSON"
                                          minRows={10}
                                          autosize
                                          value={userEditForm.settingsText}
                                          onChange={(event) => {
                                            const value = event.currentTarget.value
                                            setUserEditForm((current) =>
                                              current
                                                ? {
                                                    ...current,
                                                    settingsText: value,
                                                  }
                                                : current
                                            )
                                          }}
                                          classNames={{ input: classes.consoleText }}
                                        />
                                      </Grid.Col>
                                    </Grid>

                                    <Group justify="space-between" align="flex-end" wrap="wrap">
                                      <Text size="sm" className={classes.mutedText}>
                                        Edit the core user record, access state, avatar, and raw
                                        settings payload from here.
                                      </Text>
                                      <Group gap="sm" wrap="wrap">
                                        <Button
                                          variant="light"
                                          disabled={!userEditHasChanges || !userEditBaseline}
                                          onClick={() => setUserEditForm(userEditBaseline)}
                                        >
                                          Reset
                                        </Button>
                                        <Button
                                          color="brand"
                                          variant="light"
                                          loading={deleteUserMutation.isPending}
                                          onClick={() => {
                                            if (!selectedUserId) return
                                            if (
                                              typeof window !== 'undefined' &&
                                              !window.confirm(
                                                `Delete ${readString(selectedUserSnapshot.email, selectedUserSnapshot.name, selectedUserId) ?? 'this user'}? This permanently removes the account.`
                                              )
                                            ) {
                                              return
                                            }

                                            deleteUserMutation.mutate(selectedUserId)
                                          }}
                                        >
                                          Delete user
                                        </Button>
                                        <Button
                                          loading={updateUserMutation.isPending}
                                          onClick={() => {
                                            if (!selectedUserId) return
                                            updateUserMutation.mutate(selectedUserId)
                                          }}
                                        >
                                          Save changes
                                        </Button>
                                      </Group>
                                    </Group>
                                  </Stack>
                                ) : (
                                  <Text size="sm" className={classes.mutedText}>
                                    Loading editable user details.
                                  </Text>
                                )}
                              </DetailSection>

                              <DetailSection
                                title="Team"
                                icon={<IconBuilding size={16} />}
                                collapsible
                                expanded={isUserInspectorSectionExpanded('user:team')}
                                onToggle={() => toggleUserInspectorSection('user:team')}
                                action={
                                  <Badge color="gray" variant="light">
                                    {userMemberships.length}
                                  </Badge>
                                }
                              >
                                {userMembershipTeamsQuery.isLoading &&
                                userMemberships.length > 0 ? (
                                  <Alert color="info" variant="light">
                                    Loading team usage and coin balances for this user’s
                                    memberships.
                                  </Alert>
                                ) : null}
                                <Stack gap="xs">
                                  {userMemberships.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No team memberships returned for this user.
                                    </Text>
                                  ) : (
                                    userMemberships.map((membership, index) => {
                                      const membershipTeam = isRecord(membership.team)
                                        ? membership.team
                                        : {}
                                      const teamId = readString(
                                        membership.teamId,
                                        membershipTeam.id
                                      )
                                      const teamSnapshot = teamId
                                        ? (userMembershipTeamSnapshotById.get(teamId) ?? null)
                                        : null
                                      const teamUsagePayload =
                                        teamSnapshot && isRecord(teamSnapshot.usage)
                                          ? teamSnapshot.usage
                                          : {}
                                      const teamUsageTeam = isRecord(teamUsagePayload.team)
                                        ? teamUsagePayload.team
                                        : membershipTeam
                                      const teamUsageStats = isRecord(teamUsagePayload.usage)
                                        ? teamUsagePayload.usage
                                        : {}
                                      const teamUsageTokens = isRecord(teamUsageStats.tokens)
                                        ? teamUsageStats.tokens
                                        : {}
                                      const teamUsageSessions = isRecord(teamUsageStats.sessions)
                                        ? teamUsageStats.sessions
                                        : {}
                                      const teamSubscriptions = Array.isArray(
                                        teamUsageTeam.subscriptions
                                      )
                                        ? teamUsageTeam.subscriptions.filter(isRecord)
                                        : []
                                      const teamPlan =
                                        teamSubscriptions.length > 0 &&
                                        isRecord(teamSubscriptions[0].plan)
                                          ? teamSubscriptions[0].plan
                                          : {}
                                      const currentMembership = Array.isArray(
                                        teamUsageTeam.memberships
                                      )
                                        ? teamUsageTeam.memberships
                                            .filter(isRecord)
                                            .find(
                                              (item) => readString(item.userId) === selectedUserId
                                            )
                                        : null
                                      const availableCoins = readNumber(
                                        teamUsageTokens.available,
                                        teamUsageTeam.availableTokens
                                      )
                                      const usedCoins = readNumber(
                                        teamUsageTokens.used,
                                        teamUsageTeam.usedTokens
                                      )
                                      const membershipLimit = readNumber(
                                        currentMembership && isRecord(currentMembership)
                                          ? currentMembership.tokenLimit
                                          : null,
                                        membership.tokenLimit
                                      )
                                      const membershipStatus =
                                        membership.isActive === false
                                          ? 'inactive'
                                          : readBoolean(teamUsageTeam.isActive) === false
                                            ? 'team inactive'
                                            : 'active'

                                      return (
                                        <ExplorerRow
                                          key={
                                            readString(
                                              membership.id,
                                              membership.userId,
                                              String(index)
                                            ) ?? String(index)
                                          }
                                          title={
                                            readString(
                                              teamUsageTeam.name,
                                              teamUsageTeam.slug,
                                              membershipTeam.name,
                                              teamId
                                            ) ?? 'Unknown team'
                                          }
                                          subtitle={
                                            [
                                              availableCoins !== null
                                                ? `${formatNumber(availableCoins)} coins left`
                                                : null,
                                              usedCoins !== null
                                                ? `${formatNumber(usedCoins)} used`
                                                : null,
                                              teamSnapshot && readString(teamSnapshot.error)
                                                ? 'Usage snapshot unavailable'
                                                : null,
                                            ]
                                              .filter(Boolean)
                                              .join(' • ') || null
                                          }
                                          meta={formatCompactDate(
                                            membership.acceptedAt ?? membership.invitedAt
                                          )}
                                          badges={
                                            <>
                                              <Badge
                                                color={getStatusColor(membershipStatus, 'success')}
                                                variant="light"
                                              >
                                                {membershipStatus}
                                              </Badge>
                                              {readString(
                                                currentMembership && isRecord(currentMembership)
                                                  ? currentMembership.role
                                                  : null,
                                                membership.role
                                              ) ? (
                                                <Badge color="selected" variant="light">
                                                  {readString(
                                                    currentMembership && isRecord(currentMembership)
                                                      ? currentMembership.role
                                                      : null,
                                                    membership.role
                                                  )}
                                                </Badge>
                                              ) : null}
                                              {readString(teamPlan.planLevel) ? (
                                                <Badge
                                                  color={getPlanLevelColor(teamPlan.planLevel)}
                                                  variant="light"
                                                >
                                                  {readString(teamPlan.planLevel)}
                                                </Badge>
                                              ) : null}
                                              {membershipLimit !== null ? (
                                                <Badge color="gray" variant="light">
                                                  Limit {formatNumber(membershipLimit)}
                                                </Badge>
                                              ) : null}
                                              {readNumber(teamUsageSessions.total) !== null ? (
                                                <Badge color="info" variant="light">
                                                  {formatNumber(
                                                    readNumber(teamUsageSessions.total) ?? 0
                                                  )}{' '}
                                                  sessions
                                                </Badge>
                                              ) : null}
                                              {teamSnapshot && readString(teamSnapshot.error) ? (
                                                <Badge color="selected" variant="light">
                                                  usage unavailable
                                                </Badge>
                                              ) : null}
                                            </>
                                          }
                                          onClick={() => {
                                            if (!teamId) return
                                            openAdminTeam(teamId)
                                          }}
                                        />
                                      )
                                    })
                                  )}
                                </Stack>
                              </DetailSection>

                              <DetailSection
                                title="Assigned / open sessions"
                                icon={<IconClock size={16} />}
                                collapsible
                                expanded={isUserInspectorSectionExpanded('user:open-sessions')}
                                onToggle={() => toggleUserInspectorSection('user:open-sessions')}
                                action={
                                  <Badge color="gray" variant="light">
                                    {userOpenSessions.length}
                                  </Badge>
                                }
                              >
                                <Stack gap="xs">
                                  {userOpenSessions.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No open sessions for this user right now.
                                    </Text>
                                  ) : (
                                    userOpenSessions.slice(0, 10).map((session) => {
                                      const sessionId = getRecordId(session)
                                      if (!sessionId) return null

                                      return (
                                        <ExplorerRow
                                          key={sessionId}
                                          title={getSessionLabel(session)}
                                          subtitle={[
                                            getSessionType(session),
                                            readString(session.orgId)
                                              ? `Team ${truncateMiddle(readString(session.orgId), 16)}`
                                              : null,
                                          ]
                                            .filter(Boolean)
                                            .join(' • ')}
                                          meta={getSessionDate(session)}
                                          badges={
                                            <>
                                              <Badge color="info" variant="light">
                                                {getSessionStatus(session)}
                                              </Badge>
                                              {isRecord(session.scenario) &&
                                              readString(session.scenario.name) ? (
                                                <Badge color="selected" variant="light">
                                                  {readString(session.scenario.name)}
                                                </Badge>
                                              ) : null}
                                            </>
                                          }
                                          onClick={() => {
                                            openAdminSession(sessionId)
                                          }}
                                        />
                                      )
                                    })
                                  )}
                                </Stack>
                              </DetailSection>

                              <DetailSection
                                title="Completed sessions"
                                icon={<IconFileText size={16} />}
                                collapsible
                                expanded={isUserInspectorSectionExpanded('user:completed-sessions')}
                                onToggle={() =>
                                  toggleUserInspectorSection('user:completed-sessions')
                                }
                                action={
                                  <Badge color="gray" variant="light">
                                    {selectedUserVisibleCompletedSessions.length}
                                  </Badge>
                                }
                              >
                                <Stack gap="xs">
                                  {selectedUserVisibleCompletedSessions.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No completed or recent sessions returned for this user.
                                    </Text>
                                  ) : (
                                    selectedUserVisibleCompletedSessions
                                      .slice(0, 10)
                                      .map((session) => {
                                        const sessionId = getRecordId(session)
                                        if (!sessionId) return null

                                        return (
                                          <ExplorerRow
                                            key={sessionId}
                                            title={getSessionLabel(session)}
                                            subtitle={[
                                              getSessionType(session),
                                              readString(session.orgId)
                                                ? `Team ${truncateMiddle(readString(session.orgId), 16)}`
                                                : null,
                                            ]
                                              .filter(Boolean)
                                              .join(' • ')}
                                            meta={getSessionDate(session)}
                                            badges={
                                              <>
                                                <Badge
                                                  color={
                                                    getSessionStatus(session) === 'ended'
                                                      ? 'success'
                                                      : 'selected'
                                                  }
                                                  variant="light"
                                                >
                                                  {getSessionStatus(session)}
                                                </Badge>
                                                {isRecord(session.persona) &&
                                                readString(session.persona.name) ? (
                                                  <Badge color="brand" variant="light">
                                                    {readString(session.persona.name)}
                                                  </Badge>
                                                ) : null}
                                              </>
                                            }
                                            onClick={() => {
                                              openAdminSession(sessionId)
                                            }}
                                          />
                                        )
                                      })
                                  )}
                                </Stack>
                              </DetailSection>

                              <DetailSection
                                title="Account detail payload"
                                icon={<IconListDetails size={16} />}
                                collapsible
                                expanded={isUserInspectorSectionExpanded('user:payload')}
                                onToggle={() => toggleUserInspectorSection('user:payload')}
                              >
                                <JsonBlock
                                  value={{
                                    profile: userDetail,
                                    activity: userActivityStats,
                                    memberships: userMemberships,
                                    oauthAccounts: userOauthAccounts,
                                    refreshTokens: userRefreshTokens,
                                    teamSnapshots: userMembershipTeamSnapshots,
                                  }}
                                />
                              </DetailSection>
                            </Stack>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              </Grid.Col>
            ) : null}

            {view === 'teams' ? (
              <Grid.Col span={{ base: 12, xl: 12 }}>
                <section className={classes.panel}>
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Box>
                      <Group gap="xs" mb={4}>
                        <ThemeIcon color="selected" variant="light">
                          <IconBuilding size={16} />
                        </ThemeIcon>
                        <Title order={4}>Team Explorer</Title>
                      </Group>
                      <Text size="sm" className={classes.mutedText}>
                        Browse the full team list on the left, then inspect membership, usage,
                        billing state, and linked sessions in a dedicated pane on the right.
                      </Text>
                    </Box>
                    <Group gap="sm">
                      <Badge color="selected" variant="light">
                        {teamFilter.trim()
                          ? `${filteredTeams.length} of ${teams.length} teams`
                          : `${filteredTeams.length} teams`}
                      </Badge>
                      <Button
                        variant={isCreatingTeam ? 'filled' : 'light'}
                        leftSection={<IconPlus size={16} />}
                        onClick={() => {
                          if (isCreatingTeam) {
                            closeTeamInspector()
                            return
                          }

                          closeTeamInspector()
                          setCreateTeamForm(EMPTY_TEAM_CREATE_FORM)
                          setIsCreatingTeam(true)
                        }}
                      >
                        {isCreatingTeam ? 'Creating team' : 'New team'}
                      </Button>
                    </Group>
                  </Group>

                  <div className={classes.logArea}>
                    <div className={classes.logToolbar}>
                      <TextInput
                        value={teamFilter}
                        onChange={(event) => setTeamFilter(event.currentTarget.value)}
                        placeholder="Search teams by name, slug, id, or billing email"
                        leftSection={<IconSearch size={16} />}
                      />
                    </div>

                    <div
                      className={`${classes.logLayout} ${
                        selectedTeamId || isCreatingTeam
                          ? classes.logLayoutSplit
                          : classes.logLayoutSingle
                      }`}
                    >
                      <div className={classes.logTable}>
                        {filteredTeams.length === 0 ? (
                          <div className={classes.logEmptyState}>
                            <Text fw={700}>No teams matched this filter</Text>
                            <Text size="sm" className={classes.mutedText}>
                              Try a broader search by name, slug, billing email, or id.
                            </Text>
                          </div>
                        ) : (
                          <ScrollArea h={640}>
                            <div className={classes.logTableBody}>
                              <div className={classes.logTableHeader}>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Team ({formatNumber(filteredTeams.length)})
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Status
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Identity
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Activity
                                </Text>
                                <Text
                                  size="xs"
                                  tt="uppercase"
                                  fw={700}
                                  className={classes.metaLabel}
                                >
                                  Flags
                                </Text>
                              </div>

                              {filteredTeams.slice(0, 80).map((team) => {
                                const teamId = getRecordId(team)
                                if (!teamId) return null

                                const teamStatus = team.isActive === false ? 'inactive' : 'active'

                                return (
                                  <button
                                    key={teamId}
                                    type="button"
                                    className={`${classes.logTableRow} ${
                                      selectedTeamId === teamId ? classes.logTableRowActive : ''
                                    }`}
                                    onClick={() => {
                                      if (selectedTeamId === teamId) {
                                        closeTeamInspector()
                                        return
                                      }

                                      openAdminTeam(teamId, 'replace')
                                    }}
                                  >
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableTime}`}
                                    >
                                      <Text size="sm" fw={700}>
                                        {getTeamLabel(team)}
                                      </Text>
                                      <Text size="xs" className={classes.mutedText}>
                                        Updated{' '}
                                        {formatCompactDate(team.updatedAt ?? team.createdAt) ??
                                          'n/a'}
                                      </Text>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableSource}`}
                                    >
                                      <Group gap="xs" wrap="nowrap">
                                        <span
                                          className={`${classes.logDot} ${
                                            teamStatus === 'active'
                                              ? classes.logDotSuccess
                                              : classes.logDotError
                                          }`}
                                        />
                                        <Box style={{ minWidth: 0 }}>
                                          <Text fw={700} size="sm">
                                            {teamStatus}
                                          </Text>
                                          <Text size="xs" className={classes.mutedText}>
                                            {team.isActive === false
                                              ? 'Team disabled'
                                              : 'Workspace available'}
                                          </Text>
                                        </Box>
                                      </Group>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableEvent}`}
                                    >
                                      <Text fw={700} size="sm" className={classes.logTableTitle}>
                                        {readString(team.slug, team.billingEmail, team.id) ??
                                          'No slug available'}
                                      </Text>
                                      <Text
                                        size="xs"
                                        className={`${classes.consoleText} ${classes.mutedText} ${classes.logTableSubtitle}`}
                                      >
                                        {truncateMiddle(readString(team.id), 42)}
                                      </Text>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableSummary}`}
                                    >
                                      <Text size="sm" className={classes.logSummaryText}>
                                        Created {formatCompactDate(team.createdAt) ?? 'n/a'}
                                      </Text>
                                    </div>
                                    <div
                                      className={`${classes.logTableCell} ${classes.logTableBadges}`}
                                    >
                                      <Group gap="xs" wrap="wrap">
                                        <Badge
                                          color={teamStatus === 'active' ? 'selected' : 'brand'}
                                          variant="light"
                                        >
                                          {teamStatus}
                                        </Badge>
                                        {readString(team.billingEmail) ? (
                                          <Badge color="gray" variant="light">
                                            billing
                                          </Badge>
                                        ) : null}
                                      </Group>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>

                      {selectedTeamId || isCreatingTeam ? (
                        <div className={`${classes.logDetailPane} ${classes.logDetailSection}`}>
                          {isCreatingTeam ? (
                            <Stack gap="md">
                              <div className={classes.logDetailHeader}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Box style={{ minWidth: 0, flex: 1 }}>
                                    <Group gap="xs" mb={6} wrap="wrap">
                                      <Badge color="selected" variant="light">
                                        draft
                                      </Badge>
                                      <Badge color="gray" variant="light">
                                        admin create
                                      </Badge>
                                    </Group>
                                    <Text fw={700}>Create team</Text>
                                    <Text
                                      size="sm"
                                      className={`${classes.consoleText} ${classes.mutedText}`}
                                    >
                                      Stand up a new workspace, then add members and assign sessions
                                      from the normal team inspector.
                                    </Text>
                                  </Box>
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Close create team panel"
                                    onClick={closeTeamInspector}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Group>
                              </div>

                              <DetailSection title="New team" icon={<IconPlus size={16} />}>
                                <Stack gap="md">
                                  <Grid gutter="md">
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                      <TextInput
                                        label="Team name"
                                        value={createTeamForm.name}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateTeamForm((current) => ({
                                            ...current,
                                            name: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                      <TextInput
                                        label="Slug"
                                        placeholder="team-slug"
                                        value={createTeamForm.slug}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateTeamForm((current) => ({
                                            ...current,
                                            slug: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                      <TextInput
                                        label="Billing email"
                                        placeholder="billing@example.com"
                                        value={createTeamForm.billingEmail}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateTeamForm((current) => ({
                                            ...current,
                                            billingEmail: value,
                                          }))
                                        }}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                      <Textarea
                                        label="Billing address JSON"
                                        placeholder='{"street":"123 Main St","city":"Calgary"}'
                                        minRows={6}
                                        value={createTeamForm.billingAddressText}
                                        onChange={(event) => {
                                          const value = event.currentTarget.value
                                          setCreateTeamForm((current) => ({
                                            ...current,
                                            billingAddressText: value,
                                          }))
                                        }}
                                        classNames={{ input: classes.consoleText }}
                                      />
                                    </Grid.Col>
                                  </Grid>

                                  <Group justify="space-between" align="flex-end" wrap="wrap">
                                    <Text size="sm" className={classes.mutedText}>
                                      Teams are created active by default. Use the team inspector
                                      right after creation to add members and adjust billing.
                                    </Text>
                                    <Button
                                      loading={createTeamMutation.isPending}
                                      onClick={() => createTeamMutation.mutate()}
                                    >
                                      Create team
                                    </Button>
                                  </Group>
                                </Stack>
                              </DetailSection>
                            </Stack>
                          ) : teamInspectorMode === 'session' ? (
                            !selectedSessionId ? (
                              <div className={classes.explorerEmptyState}>
                                <Text fw={700}>No session selected</Text>
                                <Text size="sm" className={classes.mutedText}>
                                  Choose a team session row to inspect it here.
                                </Text>
                              </div>
                            ) : sessionDetailQuery.isLoading ||
                              sessionTranscriptQuery.isLoading ||
                              sessionMembersQuery.isLoading ||
                              sessionEventsQuery.isLoading ||
                              sessionTimelineQuery.isLoading ||
                              sessionLlmCallsQuery.isLoading ? (
                              <Center py="xl">
                                <Loader size="sm" />
                              </Center>
                            ) : (
                              <Stack gap="md">
                                <div className={classes.logDetailHeader}>
                                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                                    <Box style={{ minWidth: 0, flex: 1 }}>
                                      <Button
                                        variant="subtle"
                                        size="xs"
                                        leftSection={<IconArrowLeft size={14} />}
                                        mb="sm"
                                        onClick={() => {
                                          setSelectedSessionId(null)
                                          setTeamInspectorMode('team')
                                        }}
                                      >
                                        Back to team
                                      </Button>
                                      <Group gap="xs" mb={6} wrap="wrap">
                                        <Badge
                                          color={
                                            getSessionStatus(sessionDetail) === 'ended'
                                              ? 'success'
                                              : 'info'
                                          }
                                          variant="light"
                                        >
                                          {getSessionStatus(sessionDetail)}
                                        </Badge>
                                        <Badge color="selected" variant="light">
                                          {getSessionType(sessionDetail)}
                                        </Badge>
                                        <Badge
                                          color="gray"
                                          variant="light"
                                          className={classes.consoleText}
                                        >
                                          {selectedSessionId}
                                        </Badge>
                                      </Group>
                                      <Text fw={700}>{getSessionLabel(sessionDetail)}</Text>
                                      <Text
                                        size="sm"
                                        className={`${classes.consoleText} ${classes.mutedText}`}
                                      >
                                        Created {formatDateTime(sessionDetail.createdAt)} • Updated{' '}
                                        {formatDateTime(sessionDetail.updatedAt)}
                                      </Text>
                                    </Box>
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      aria-label="Close team details"
                                      onClick={closeTeamInspector}
                                    >
                                      <IconX size={16} />
                                    </ActionIcon>
                                  </Group>
                                </div>

                                <div className={classes.logMetaGrid}>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Members
                                    </Text>
                                    <Text fw={700}>{formatNumber(sessionMembers.length)}</Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Transcript
                                    </Text>
                                    <Text fw={700}>
                                      {formatNumber(transcriptSegments.length)} segments
                                    </Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      Events
                                    </Text>
                                    <Text fw={700}>{formatNumber(sessionEvents.length)}</Text>
                                  </div>
                                  <div className={classes.logMetaCard}>
                                    <Text
                                      size="xs"
                                      tt="uppercase"
                                      fw={700}
                                      className={classes.metaLabel}
                                    >
                                      LLM traces
                                    </Text>
                                    <Text fw={700}>{formatNumber(sessionLlmTraces.length)}</Text>
                                  </div>
                                </div>

                                <SessionEditorSection
                                  form={sessionEditForm}
                                  setForm={setSessionEditForm}
                                  baseline={sessionEditBaseline}
                                  hasChanges={sessionEditHasChanges}
                                  saving={updateSessionMutation.isPending}
                                  onReset={() => setSessionEditForm(sessionEditBaseline)}
                                  onSave={() => {
                                    if (!selectedSessionId) return
                                    updateSessionMutation.mutate(selectedSessionId)
                                  }}
                                  expanded={isTeamInspectorSectionExpanded('session:editor')}
                                  onToggle={() => toggleTeamInspectorSection('session:editor')}
                                  teams={teams}
                                  scenarios={scenarios}
                                  personas={personas}
                                />

                                <SessionMemberAssignmentSection
                                  form={sessionMemberCreateForm}
                                  setForm={setSessionMemberCreateForm}
                                  userOptions={availableSessionMemberOptions}
                                  saving={addSessionMembersMutation.isPending}
                                  onAssign={() => {
                                    if (!selectedSessionId) return
                                    addSessionMembersMutation.mutate(selectedSessionId)
                                  }}
                                  expanded={isTeamInspectorSectionExpanded('session:add-members')}
                                  onToggle={() => toggleTeamInspectorSection('session:add-members')}
                                />

                                <DetailSection
                                  title="Members / assignees"
                                  icon={<IconUsersGroup size={16} />}
                                  collapsible
                                  expanded={isTeamInspectorSectionExpanded('session:members')}
                                  onToggle={() => toggleTeamInspectorSection('session:members')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="selected" variant="light">
                                      {sessionMembers.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {sessionMembers.length === 0 ? (
                                      <Text size="sm" className={classes.mutedText}>
                                        No session members returned.
                                      </Text>
                                    ) : (
                                      sessionMembers.map((member, index) => {
                                        const memberUser = isRecord(member.user) ? member.user : {}
                                        const memberUserId = readString(
                                          member.userId,
                                          memberUser.id
                                        )
                                        const sessionId = readString(
                                          member.sessionId,
                                          selectedSessionId
                                        )
                                        const memberRole = readString(member.role)
                                        const memberLabel =
                                          readString(
                                            memberUser.name,
                                            memberUser.email,
                                            member.userId,
                                            member.id
                                          ) ?? 'Session member'
                                        const isRemovingMember =
                                          removeSessionMemberMutation.isPending &&
                                          removeSessionMemberMutation.variables?.sessionId ===
                                            sessionId &&
                                          removeSessionMemberMutation.variables?.userId ===
                                            memberUserId

                                        return (
                                          <ExplorerRow
                                            key={
                                              readString(member.id, member.userId, String(index)) ??
                                              String(index)
                                            }
                                            title={memberLabel}
                                            subtitle={`Role: ${readString(member.role) ?? 'member'}`}
                                            meta={formatCompactDate(member.joinedAt)}
                                            badges={
                                              <Badge color="selected" variant="light">
                                                {readString(member.userId, memberUser.id) ??
                                                  'unknown user'}
                                              </Badge>
                                            }
                                            actions={
                                              memberUserId && sessionId ? (
                                                <ActionIcon
                                                  variant="subtle"
                                                  color="brand"
                                                  aria-label={`Remove ${memberLabel} from session`}
                                                  disabled={removeSessionMemberMutation.isPending}
                                                  onClick={() =>
                                                    requestSessionMemberRemoval({
                                                      sessionId,
                                                      userId: memberUserId,
                                                      role: memberRole,
                                                      label: memberLabel,
                                                    })
                                                  }
                                                >
                                                  {isRemovingMember ? (
                                                    <Loader size={14} color="currentColor" />
                                                  ) : (
                                                    <IconTrash size={15} />
                                                  )}
                                                </ActionIcon>
                                              ) : null
                                            }
                                            onClick={() => {
                                              if (memberUserId) {
                                                openAdminUser(memberUserId)
                                              }
                                            }}
                                          />
                                        )
                                      })
                                    )}
                                  </Stack>
                                </DetailSection>

                                <DetailSection
                                  title="Timeline + events"
                                  icon={<IconClock size={16} />}
                                  collapsible
                                  expanded={isTeamInspectorSectionExpanded('session:timeline')}
                                  onToggle={() => toggleTeamInspectorSection('session:timeline')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="info" variant="light">
                                      {sessionEvents.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {sessionActivityItems.slice(0, 10).map((item) => (
                                      <ExplorerRow
                                        key={item.key}
                                        title={
                                          readString(
                                            item.payload.type,
                                            item.payload.eventType,
                                            item.payload.role,
                                            item.payload.status
                                          ) ?? 'Session event'
                                        }
                                        subtitle={truncate(
                                          readString(
                                            item.payload.message,
                                            item.payload.text,
                                            item.payload.traceId,
                                            item.payload.id
                                          ),
                                          90
                                        )}
                                        meta={formatCompactDate(
                                          item.payload.createdAt ?? item.payload.timestamp
                                        )}
                                        badges={
                                          <Badge color="info" variant="light">
                                            {readString(
                                              item.payload.type,
                                              item.payload.role,
                                              'event'
                                            ) ?? 'event'}
                                          </Badge>
                                        }
                                        active={selectedSessionActivity?.key === item.key}
                                        onClick={() => setSelectedSessionActivityKey(item.key)}
                                      />
                                    ))}
                                  </Stack>
                                  {selectedSessionActivity ? (
                                    <JsonBlock value={selectedSessionActivity.payload} />
                                  ) : null}
                                </DetailSection>

                                <DetailSection
                                  title="Transcript"
                                  icon={<IconFileText size={16} />}
                                  collapsible
                                  expanded={isTeamInspectorSectionExpanded('session:transcript')}
                                  onToggle={() => toggleTeamInspectorSection('session:transcript')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="success" variant="light">
                                      {transcriptSegments.length}
                                    </Badge>
                                  }
                                >
                                  {transcriptSegments.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No transcript segments returned for this session.
                                    </Text>
                                  ) : (
                                    <div className={classes.transcriptList}>
                                      {transcriptItems.slice(0, 12).map(({ key, payload }) => (
                                        <button
                                          key={key}
                                          type="button"
                                          className={`${classes.transcriptSegment} ${
                                            selectedTranscriptSegment?.key === key
                                              ? classes.transcriptSegmentActive
                                              : ''
                                          }`}
                                          onClick={() => setSelectedTranscriptKey(key)}
                                        >
                                          <Group justify="space-between" mb={6} wrap="wrap">
                                            <Badge color="selected" variant="light">
                                              {readString(
                                                payload.speakerTag,
                                                payload.speakerId,
                                                'speaker'
                                              ) ?? 'speaker'}
                                            </Badge>
                                            <Text size="xs" className={classes.mutedText}>
                                              {readString(
                                                payload.startMs,
                                                payload.startTimeMs,
                                                payload.offsetMs
                                              ) ?? formatCompactDate(payload.createdAt)}
                                            </Text>
                                          </Group>
                                          <Text size="sm">
                                            {readString(payload.text, payload.content) ??
                                              'No transcript text'}
                                          </Text>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {selectedTranscriptSegment ? (
                                    <JsonBlock value={selectedTranscriptSegment.payload} />
                                  ) : null}
                                </DetailSection>

                                <DetailSection
                                  title="LLM traces"
                                  icon={<IconBolt size={16} />}
                                  collapsible
                                  expanded={isTeamInspectorSectionExpanded('session:llm')}
                                  onToggle={() => toggleTeamInspectorSection('session:llm')}
                                  bodyClassName={classes.inspectorSectionBody}
                                  action={
                                    <Badge color="brand" variant="light">
                                      {sessionLlmTraces.length}
                                    </Badge>
                                  }
                                >
                                  <Stack gap="xs">
                                    {sessionLlmTraces.length === 0 ? (
                                      <Text size="sm" className={classes.mutedText}>
                                        No LLM traces returned.
                                      </Text>
                                    ) : (
                                      sessionTraceItems.slice(0, 8).map(({ key, payload }) => {
                                        const traceContext = isRecord(payload.context)
                                          ? payload.context
                                          : {}
                                        const traceUsage = isRecord(payload.usage)
                                          ? payload.usage
                                          : {}

                                        return (
                                          <ExplorerRow
                                            key={key}
                                            title={
                                              readString(
                                                payload.provider,
                                                payload.model,
                                                payload.name
                                              ) ?? 'LLM trace'
                                            }
                                            subtitle={truncate(
                                              readString(
                                                payload.purpose,
                                                payload.requestId,
                                                payload.responseId,
                                                traceContext.purpose
                                              ),
                                              80
                                            )}
                                            meta={formatCompactDate(payload.createdAt)}
                                            badges={
                                              <Badge color="brand" variant="light">
                                                {formatNumber(
                                                  readNumber(
                                                    traceUsage.totalTokens,
                                                    traceUsage.promptTokens
                                                  ) ?? 0
                                                )}{' '}
                                                tokens
                                              </Badge>
                                            }
                                            active={selectedSessionTrace?.key === key}
                                            onClick={() => setSelectedTraceKey(key)}
                                          />
                                        )
                                      })
                                    )}
                                  </Stack>
                                  {selectedSessionTrace ? (
                                    <JsonBlock value={selectedSessionTrace.payload} />
                                  ) : null}
                                </DetailSection>

                                <DetailSection
                                  title="Assessment + raw detail"
                                  icon={<IconListDetails size={16} />}
                                  collapsible
                                  expanded={isTeamInspectorSectionExpanded('session:assessment')}
                                  onToggle={() => toggleTeamInspectorSection('session:assessment')}
                                  bodyClassName={classes.inspectorSectionBody}
                                >
                                  <JsonBlock
                                    value={{
                                      session: sessionDetail,
                                      assessment: sessionAssessment,
                                      llmSummary: sessionLlmSummary,
                                      invitations: sessionInvitations,
                                    }}
                                  />
                                </DetailSection>
                              </Stack>
                            )
                          ) : teamDetailQuery.isLoading || teamUsageQuery.isLoading ? (
                            <Center py="xl">
                              <Loader size="sm" />
                            </Center>
                          ) : (
                            <Stack gap="md">
                              <div className={classes.logDetailHeader}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Box style={{ minWidth: 0, flex: 1 }}>
                                    <Group gap="xs" mb={6} wrap="wrap">
                                      <Badge
                                        color={
                                          readBoolean(
                                            selectedTeamSnapshot.isActive,
                                            teamUsageTeam.isActive
                                          ) === false
                                            ? 'brand'
                                            : 'selected'
                                        }
                                        variant="light"
                                      >
                                        {readBoolean(
                                          selectedTeamSnapshot.isActive,
                                          teamUsageTeam.isActive
                                        ) === false
                                          ? 'inactive'
                                          : 'active'}
                                      </Badge>
                                      <Badge
                                        color="gray"
                                        variant="light"
                                        className={classes.consoleText}
                                      >
                                        {selectedTeamId}
                                      </Badge>
                                      {readString(teamSubscription?.status) ? (
                                        <Badge
                                          color={getStatusColor(teamSubscription?.status, 'info')}
                                          variant="light"
                                        >
                                          {readString(teamSubscription?.status)}
                                        </Badge>
                                      ) : null}
                                    </Group>
                                    <Text fw={700}>
                                      {readString(
                                        selectedTeamSnapshot.name,
                                        teamUsageTeam.name,
                                        selectedTeamListItem?.name
                                      ) ?? 'Unknown team'}
                                    </Text>
                                    <Text
                                      size="sm"
                                      className={`${classes.consoleText} ${classes.mutedText}`}
                                    >
                                      {readString(
                                        selectedTeamSnapshot.slug,
                                        selectedTeamSnapshot.billingEmail,
                                        teamUsageTeam.slug,
                                        selectedTeamListItem?.slug
                                      ) ?? 'No slug available'}
                                    </Text>
                                  </Box>
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Close team details"
                                    onClick={closeTeamInspector}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Group>
                              </div>

                              <div className={classes.logMetaGrid}>
                                <div className={classes.logMetaCard}>
                                  <Text
                                    size="xs"
                                    tt="uppercase"
                                    fw={700}
                                    className={classes.metaLabel}
                                  >
                                    Members
                                  </Text>
                                  <Text fw={700}>
                                    {formatNumber(
                                      readNumber(teamUsageMembers.total) ?? teamMemberships.length
                                    )}
                                  </Text>
                                </div>
                                <div className={classes.logMetaCard}>
                                  <Text
                                    size="xs"
                                    tt="uppercase"
                                    fw={700}
                                    className={classes.metaLabel}
                                  >
                                    Sessions
                                  </Text>
                                  <Text fw={700}>
                                    {formatNumber(
                                      readNumber(teamUsageSessions.total) ?? teamSessions.length
                                    )}
                                  </Text>
                                </div>
                                <div className={classes.logMetaCard}>
                                  <Text
                                    size="xs"
                                    tt="uppercase"
                                    fw={700}
                                    className={classes.metaLabel}
                                  >
                                    Coins left
                                  </Text>
                                  <Text fw={700}>
                                    {formatNumber(readNumber(teamUsageTokens.available) ?? 0)}
                                  </Text>
                                </div>
                                <div className={classes.logMetaCard}>
                                  <Text
                                    size="xs"
                                    tt="uppercase"
                                    fw={700}
                                    className={classes.metaLabel}
                                  >
                                    Subscription
                                  </Text>
                                  <Text fw={700}>
                                    {readString(
                                      teamSubscriptionPlan.name,
                                      teamSubscription?.status,
                                      teamSubscription?.planId
                                    ) ?? 'n/a'}
                                  </Text>
                                </div>
                              </div>

                              <TeamEditorSection
                                form={teamEditForm}
                                setForm={setTeamEditForm}
                                baseline={teamEditBaseline}
                                hasChanges={teamEditHasChanges}
                                saving={updateTeamMutation.isPending}
                                onReset={() => setTeamEditForm(teamEditBaseline)}
                                onSave={() => {
                                  if (!selectedTeamId) return
                                  updateTeamMutation.mutate(selectedTeamId)
                                }}
                                expanded={isTeamInspectorSectionExpanded('team:editor')}
                                onToggle={() => toggleTeamInspectorSection('team:editor')}
                              />

                              <TeamSubscriptionSection
                                form={teamSubscriptionForm}
                                setForm={setTeamSubscriptionForm}
                                baseline={teamSubscriptionBaseline}
                                hasChanges={teamSubscriptionHasChanges}
                                saving={saveTeamSubscriptionMutation.isPending}
                                onReset={() => setTeamSubscriptionForm(teamSubscriptionBaseline)}
                                onSave={() => saveTeamSubscriptionMutation.mutate()}
                                expanded={isTeamInspectorSectionExpanded('team:subscription')}
                                onToggle={() => toggleTeamInspectorSection('team:subscription')}
                                planOptions={teamSubscriptionPlanOptions}
                                hasExistingSubscription={Boolean(teamSubscriptionId)}
                                subscriptionStatus={teamSubscriptionStatus}
                                currentPeriodEnd={teamSubscription?.currentPeriodEnd}
                              />

                              <TeamMemberAssignmentSection
                                form={teamMemberCreateForm}
                                setForm={setTeamMemberCreateForm}
                                inviteForm={teamMemberInviteForm}
                                setInviteForm={setTeamMemberInviteForm}
                                userOptions={availableTeamMemberOptions}
                                saving={addTeamMemberMutation.isPending}
                                inviteSaving={inviteTeamMemberMutation.isPending}
                                onAssign={() => {
                                  if (!selectedTeamId) return
                                  addTeamMemberMutation.mutate(selectedTeamId)
                                }}
                                onInvite={() => {
                                  if (!selectedTeamId) return
                                  inviteTeamMemberMutation.mutate(selectedTeamId)
                                }}
                                expanded={isTeamInspectorSectionExpanded('team:add-member')}
                                onToggle={() => toggleTeamInspectorSection('team:add-member')}
                              />

                              <DetailSection
                                title="Members"
                                icon={<IconUsersGroup size={16} />}
                                collapsible
                                expanded={isTeamInspectorSectionExpanded('team:members')}
                                onToggle={() => toggleTeamInspectorSection('team:members')}
                                bodyClassName={classes.inspectorSectionBody}
                                action={
                                  <Badge color="selected" variant="light">
                                    {teamMemberships.length}
                                  </Badge>
                                }
                              >
                                <Stack gap="xs">
                                  {teamMemberships.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No memberships returned for this team.
                                    </Text>
                                  ) : (
                                    teamMemberships.map((membership, index) => {
                                      const user = isRecord(membership.user) ? membership.user : {}
                                      const userId = readString(user.id, membership.userId)
                                      const teamId = readString(membership.teamId, selectedTeamId)
                                      const membershipRole = readString(membership.role)
                                      const isRemovingMember =
                                        removeTeamMemberMutation.isPending &&
                                        removeTeamMemberMutation.variables?.teamId === teamId &&
                                        removeTeamMemberMutation.variables?.userId === userId

                                      return (
                                        <ExplorerRow
                                          key={
                                            readString(
                                              membership.id,
                                              membership.userId,
                                              String(index)
                                            ) ?? String(index)
                                          }
                                          title={getUserLabel(user)}
                                          subtitle={`Role: ${readString(membership.role) ?? 'member'}`}
                                          meta={formatCompactDate(
                                            membership.acceptedAt ?? membership.invitedAt
                                          )}
                                          badges={
                                            <>
                                              <Badge color="selected" variant="light">
                                                {readString(membership.role) ?? 'member'}
                                              </Badge>
                                              {membership.isActive === false ? (
                                                <Badge color="brand" variant="light">
                                                  inactive
                                                </Badge>
                                              ) : null}
                                            </>
                                          }
                                          actions={
                                            userId && teamId && membership.isActive !== false ? (
                                              <ActionIcon
                                                variant="subtle"
                                                color="brand"
                                                aria-label={`Remove ${getUserLabel(user)} from team`}
                                                disabled={removeTeamMemberMutation.isPending}
                                                onClick={() =>
                                                  requestTeamMemberRemoval({
                                                    teamId,
                                                    userId,
                                                    role: membershipRole,
                                                    label: getUserLabel(user),
                                                  })
                                                }
                                              >
                                                {isRemovingMember ? (
                                                  <Loader size={14} color="currentColor" />
                                                ) : (
                                                  <IconTrash size={15} />
                                                )}
                                              </ActionIcon>
                                            ) : null
                                          }
                                          onClick={() => {
                                            if (userId) {
                                              openAdminUser(userId)
                                            }
                                          }}
                                        />
                                      )
                                    })
                                  )}
                                </Stack>
                              </DetailSection>

                              <DetailSection
                                title="Team sessions"
                                icon={<IconClock size={16} />}
                                collapsible
                                expanded={isTeamInspectorSectionExpanded('team:sessions')}
                                onToggle={() => toggleTeamInspectorSection('team:sessions')}
                                bodyClassName={classes.inspectorSectionBody}
                                action={
                                  <Badge color="info" variant="light">
                                    {teamSessions.length}
                                  </Badge>
                                }
                              >
                                <Stack gap="xs">
                                  {teamSessions.length === 0 ? (
                                    <Text size="sm" className={classes.mutedText}>
                                      No sessions returned for this team.
                                    </Text>
                                  ) : (
                                    teamSessions.slice(0, 12).map((session) => {
                                      const sessionId = getRecordId(session)
                                      if (!sessionId) return null

                                      return (
                                        <ExplorerRow
                                          key={sessionId}
                                          title={getSessionLabel(session)}
                                          subtitle={`${getSessionType(session)} • ${getSessionStatus(session)}`}
                                          meta={getSessionDate(session)}
                                          badges={
                                            <Badge
                                              color={
                                                getSessionStatus(session) === 'ended'
                                                  ? 'success'
                                                  : 'info'
                                              }
                                              variant="light"
                                            >
                                              {getSessionStatus(session)}
                                            </Badge>
                                          }
                                          onClick={() => {
                                            openAdminSession(sessionId)
                                          }}
                                        />
                                      )
                                    })
                                  )}
                                </Stack>
                              </DetailSection>

                              <DetailSection
                                title="Usage + subscription detail"
                                icon={<IconListDetails size={16} />}
                                collapsible
                                expanded={isTeamInspectorSectionExpanded('team:payload')}
                                onToggle={() => toggleTeamInspectorSection('team:payload')}
                                bodyClassName={classes.inspectorSectionBody}
                              >
                                <JsonBlock
                                  value={{
                                    team: selectedTeamSnapshot,
                                    usage: teamUsageStats,
                                    subscription: teamSubscription,
                                    llm: teamUsageLlm,
                                  }}
                                />
                              </DetailSection>
                            </Stack>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              </Grid.Col>
            ) : null}
          </Grid>
        ) : null}

        {view === 'plans' ? (
          <section className={classes.panel}>
            <Group justify="space-between" align="flex-start" mb="md">
              <Box>
                <Group gap="xs" mb={4}>
                  <ThemeIcon color="brand" variant="light">
                    <IconBolt size={16} />
                  </ThemeIcon>
                  <Title order={4}>Plan Catalog</Title>
                </Group>
                <Text size="sm" className={classes.mutedText}>
                  Create, tune, and retire billing plans with tier-aware catalog cards and a focused
                  inline editor.
                </Text>
              </Box>
              <Badge color="brand" variant="light">
                {planFilter.trim()
                  ? `${filteredPlans.length} of ${plans.length} plans`
                  : `${filteredPlans.length} plans`}
              </Badge>
            </Group>

            <div className={classes.logArea}>
              <div className={classes.logToolbar}>
                <TextInput
                  value={planFilter}
                  onChange={(event) => setPlanFilter(event.currentTarget.value)}
                  placeholder="Search plans by name, level, description, or id"
                  leftSection={<IconSearch size={16} />}
                />
              </div>

              {plansQuery.isLoading && plans.length === 0 ? (
                <Center py="xl">
                  <Loader size="sm" />
                </Center>
              ) : (
                <div className={classes.planCarouselShell}>
                  <ScrollArea offsetScrollbars scrollbarSize={6}>
                    <div className={classes.planCarousel}>
                      {isCreatingPlan ? (
                        <div
                          className={`${classes.planCard} ${classes.planCardDraft} ${classes.planCardExpanded} ${classes.planCardActive}`}
                        >
                          <div className={classes.planCardEditorHeader}>
                            <Box style={{ minWidth: 0, flex: 1 }}>
                              <Group gap="xs" mb={6} wrap="wrap">
                                <Badge
                                  color="selected"
                                  variant="light"
                                  className={classes.planTierBadge}
                                >
                                  new plan
                                </Badge>
                                <Badge
                                  color="gray"
                                  variant="light"
                                  className={classes.planStatusBadge}
                                >
                                  billing catalog
                                </Badge>
                              </Group>
                              <Text fw={800} size="xl" className={classes.planCardTitle}>
                                Create plan
                              </Text>
                              <Text size="sm" className={classes.planCardDescription}>
                                Add a new billing tier with the core fields only.
                              </Text>
                            </Box>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label="Close create plan card"
                              onClick={closePlanInspector}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </div>

                          <div className={classes.planCardFormGrid}>
                            <TextInput
                              label="Plan name"
                              placeholder="Enterprise Plus"
                              value={planForm.name}
                              onChange={(event) => {
                                const value = event.currentTarget.value
                                setPlanForm((current) => ({
                                  ...current,
                                  name: value,
                                }))
                              }}
                            />
                            <Select
                              label="Plan level"
                              data={PLAN_LEVEL_OPTIONS.map((value) => ({
                                label: value,
                                value,
                              }))}
                              value={planForm.planLevel}
                              onChange={(value) =>
                                setPlanForm((current) => ({
                                  ...current,
                                  planLevel: value ?? 'FREE',
                                }))
                              }
                              allowDeselect={false}
                            />
                            <NumberInput
                              label="Max coins"
                              min={0}
                              allowDecimal={false}
                              thousandSeparator=","
                              value={planForm.maxCoins}
                              onChange={(value) =>
                                setPlanForm((current) => ({
                                  ...current,
                                  maxCoins:
                                    typeof value === 'number' && Number.isFinite(value) ? value : 0,
                                }))
                              }
                            />
                            <div className={classes.planCardSwitchWrap}>
                              <Switch
                                checked={planForm.isActive}
                                label="Plan starts active"
                                onChange={(event) => {
                                  const checked = event.currentTarget.checked
                                  setPlanForm((current) => ({
                                    ...current,
                                    isActive: checked,
                                  }))
                                }}
                              />
                            </div>
                          </div>

                          <Textarea
                            label="Description"
                            placeholder="Who this plan is for, what it unlocks, and when admins should use it."
                            minRows={4}
                            value={planForm.description}
                            onChange={(event) => {
                              const value = event.currentTarget.value
                              setPlanForm((current) => ({
                                ...current,
                                description: value,
                              }))
                            }}
                          />

                          <div className={classes.planCardActionRow}>
                            <Group gap="sm">
                              <Button variant="light" onClick={closePlanInspector}>
                                Discard
                              </Button>
                              <Button
                                loading={createPlanMutation.isPending}
                                onClick={() => createPlanMutation.mutate()}
                              >
                                Create plan
                              </Button>
                            </Group>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={classes.planCreateCard}
                          onClick={openCreatePlanInspector}
                        >
                          <div className={classes.planCreateInner}>
                            <ThemeIcon size={54} radius="xl" color="gray" variant="light">
                              <IconPlus size={26} />
                            </ThemeIcon>
                            <Text fw={800} size="lg">
                              Add plan
                            </Text>
                            <Text size="sm" className={classes.mutedText}>
                              Create a new tier in the shared billing catalog.
                            </Text>
                          </div>
                        </button>
                      )}

                      {filteredPlans.map((plan) => {
                        const planId = getRecordId(plan)
                        if (!planId) return null

                        const planLevel = normalizePlanLevel(plan.planLevel)
                        const planContent = getPlanDisplayContent(planLevel)
                        const subscriptionCounts = planSubscriptionCounts.get(planId) ?? {
                          total: 0,
                          active: 0,
                        }
                        const planMetrics = [
                          {
                            key: 'coins',
                            label: 'Allowance',
                            value: `${formatNumber(readNumber(plan.maxCoins) ?? 0)} coins`,
                          },
                          ...(subscriptionCounts.total > 0
                            ? [
                                {
                                  key: 'assigned',
                                  label: 'Assigned',
                                  value: `${formatNumber(subscriptionCounts.total)} team${
                                    subscriptionCounts.total === 1 ? '' : 's'
                                  }`,
                                },
                              ]
                            : []),
                          ...(subscriptionCounts.active > 0
                            ? [
                                {
                                  key: 'live',
                                  label: 'Live',
                                  value: `${formatNumber(subscriptionCounts.active)} active`,
                                },
                              ]
                            : []),
                        ]
                        const planFeatures = [
                          ...planContent.features,
                          `${formatNumber(readNumber(plan.maxCoins) ?? 0)} coins included`,
                        ]
                        const planLabel = getPlanLabel(plan)
                        const planPriceHeadline = getPlanPriceHeadline(plan)
                        const showPlanTitle = planPriceHeadline !== planLabel
                        const isSelected = selectedPlanId === planId && !isCreatingPlan

                        if (!isSelected) {
                          return (
                            <button
                              key={planId}
                              type="button"
                              className={`${classes.planCard} ${getPlanTierCardClassName(
                                planLevel
                              )} ${isFeaturedPlanLevel(planLevel) ? classes.planCardFeatured : ''}`}
                              onClick={() => {
                                setIsCreatingPlan(false)
                                setSelectedPlanId(planId)
                              }}
                            >
                              <div className={classes.planCardTop}>
                                <Group gap="xs" wrap="wrap" className={classes.planCardBadgeRow}>
                                  <Badge
                                    color={getPlanLevelColor(planLevel)}
                                    variant="light"
                                    className={classes.planTierBadge}
                                  >
                                    {planContent.tierLabel.toUpperCase()}
                                  </Badge>
                                  <Badge
                                    color={getPlanStatusTone(plan)}
                                    variant="light"
                                    className={classes.planStatusBadge}
                                  >
                                    {getPlanStatusLabel(plan)}
                                  </Badge>
                                </Group>
                                <Text size="xs" className={classes.planCardUpdated}>
                                  Updated{' '}
                                  {formatCompactDate(plan.updatedAt ?? plan.createdAt) ?? 'n/a'}
                                </Text>
                              </div>

                              <div className={classes.planCardBody}>
                                <div className={classes.planCardHero}>
                                  <Text size="xs" fw={700} className={classes.planCardEyebrow}>
                                    {planContent.audience}
                                  </Text>
                                  <div className={classes.planCardPriceRow}>
                                    <Text component="span" className={classes.planCardPriceValue}>
                                      {planPriceHeadline}
                                    </Text>
                                    <Text component="span" className={classes.planCardPriceCadence}>
                                      {planContent.pricing.cadence}
                                    </Text>
                                  </div>
                                </div>
                                {showPlanTitle ? (
                                  <Text fw={800} size="lg" className={classes.planCardTitle}>
                                    {planLabel}
                                  </Text>
                                ) : null}
                                <Text size="sm" className={classes.planCardDescription}>
                                  {getPlanDescription(plan)}
                                </Text>
                                <div className={classes.planFeatureList}>
                                  {planFeatures.map((feature) => (
                                    <div key={feature} className={classes.planFeatureItem}>
                                      <span className={classes.planFeatureDot} />
                                      <Text size="sm" className={classes.planFeatureText}>
                                        {feature}
                                      </Text>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {planMetrics.length > 0 ? (
                                <div className={classes.planCardMetrics}>
                                  {planMetrics.map((metric) => (
                                    <div key={metric.key} className={classes.planMetric}>
                                      <Text
                                        size="xs"
                                        tt="uppercase"
                                        fw={700}
                                        className={classes.metaLabel}
                                      >
                                        {metric.label}
                                      </Text>
                                      <Text fw={700} size="sm" className={classes.planMetricValue}>
                                        {metric.value}
                                      </Text>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className={classes.planCardFooter}>
                                <Text size="sm" className={classes.planCardSupportText}>
                                  {getPlanSupportNote(subscriptionCounts)}
                                </Text>
                                <span className={classes.planCardPrimaryCta}>Manage plan</span>
                              </div>
                            </button>
                          )
                        }

                        return (
                          <div
                            key={planId}
                            className={`${classes.planCard} ${getPlanTierCardClassName(
                              selectedPlanSnapshot?.planLevel ?? plan.planLevel
                            )} ${classes.planCardExpanded} ${classes.planCardActive}`}
                          >
                            <div className={classes.planCardEditorHeader}>
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Text fw={800} size="xl" className={classes.planCardTitle}>
                                  Edit plan
                                </Text>
                                <Text size="sm" className={classes.planCardDescription}>
                                  Update only the fields that write back to the shared billing
                                  catalog.
                                </Text>
                              </Box>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                aria-label="Close plan card"
                                onClick={closePlanInspector}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </div>

                            <div className={classes.planCardFormGrid}>
                              <TextInput
                                label="Plan name"
                                placeholder="Enterprise Plus"
                                value={planForm.name}
                                onChange={(event) => {
                                  const value = event.currentTarget.value
                                  setPlanForm((current) => ({
                                    ...current,
                                    name: value,
                                  }))
                                }}
                              />
                              <Select
                                label="Plan level"
                                data={PLAN_LEVEL_OPTIONS.map((value) => ({
                                  label: value,
                                  value,
                                }))}
                                value={planForm.planLevel}
                                onChange={(value) =>
                                  setPlanForm((current) => ({
                                    ...current,
                                    planLevel: value ?? 'FREE',
                                  }))
                                }
                                allowDeselect={false}
                              />
                              <NumberInput
                                label="Max coins"
                                min={0}
                                allowDecimal={false}
                                thousandSeparator=","
                                value={planForm.maxCoins}
                                onChange={(value) =>
                                  setPlanForm((current) => ({
                                    ...current,
                                    maxCoins:
                                      typeof value === 'number' && Number.isFinite(value)
                                        ? value
                                        : 0,
                                  }))
                                }
                              />
                              <div className={classes.planCardSwitchWrap}>
                                <Switch
                                  checked={planForm.isActive}
                                  label="Plan is active"
                                  onChange={(event) => {
                                    const checked = event.currentTarget.checked
                                    setPlanForm((current) => ({
                                      ...current,
                                      isActive: checked,
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <Textarea
                              label="Description"
                              placeholder="Who this plan is for, what it unlocks, and how admins should use it."
                              minRows={4}
                              value={planForm.description}
                              onChange={(event) => {
                                const value = event.currentTarget.value
                                setPlanForm((current) => ({
                                  ...current,
                                  description: value,
                                }))
                              }}
                            />

                            <div className={classes.planCardActionRow}>
                              <Group gap="sm">
                                <Button
                                  variant="light"
                                  onClick={() => setPlanForm(toPlanFormState(selectedPlanSnapshot))}
                                >
                                  Discard
                                </Button>
                                {selectedPlanId ? (
                                  <Button
                                    color="brand"
                                    variant="light"
                                    loading={deletePlanMutation.isPending}
                                    onClick={() => {
                                      if (
                                        typeof window !== 'undefined' &&
                                        !window.confirm(
                                          'Delete this plan? The backend currently deactivates it instead of hard-deleting it.'
                                        )
                                      ) {
                                        return
                                      }
                                      deletePlanMutation.mutate(selectedPlanId)
                                    }}
                                  >
                                    Delete
                                  </Button>
                                ) : null}
                                <Button
                                  loading={updatePlanMutation.isPending}
                                  onClick={() => {
                                    if (selectedPlanId) {
                                      updatePlanMutation.mutate(selectedPlanId)
                                    }
                                  }}
                                >
                                  Save changes
                                </Button>
                              </Group>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {view === 'sessions' ? (
          <section className={classes.panel}>
            <Group justify="space-between" align="flex-start" mb="md">
              <Box>
                <Group gap="xs" mb={4}>
                  <ThemeIcon color="info" variant="light">
                    <IconClock size={16} />
                  </ThemeIcon>
                  <Title order={4}>Recent Sessions</Title>
                </Group>
                <Text size="sm" className={classes.mutedText}>
                  Browse the full session list on the left, then inspect members, transcript,
                  events, invitations, and LLM traces in a dedicated pane on the right.
                </Text>
              </Box>
              <Group gap="sm">
                <Badge color="info" variant="light">
                  {sessionFilter.trim()
                    ? `${filteredSessions.length} of ${sessions.length} sessions`
                    : `${filteredSessions.length} sessions`}
                </Badge>
                <Button
                  variant={isCreatingSession ? 'filled' : 'light'}
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    if (isCreatingSession) {
                      closeSessionInspector()
                      return
                    }

                    closeSessionInspector()
                    setCreateSessionForm(EMPTY_SESSION_CREATE_FORM)
                    setIsCreatingSession(true)
                  }}
                >
                  {isCreatingSession ? 'Creating session' : 'New session'}
                </Button>
              </Group>
            </Group>

            <div className={classes.logArea}>
              <div className={classes.logToolbar}>
                <TextInput
                  value={sessionFilter}
                  onChange={(event) => setSessionFilter(event.currentTarget.value)}
                  placeholder="Search sessions by id, name, status, type, scenario, or persona"
                  leftSection={<IconSearch size={16} />}
                />
              </div>

              <div
                className={`${classes.logLayout} ${
                  selectedSessionId || isCreatingSession
                    ? classes.logLayoutSplit
                    : classes.logLayoutSingle
                }`}
              >
                <div className={classes.logTable}>
                  {filteredSessions.length === 0 ? (
                    <div className={classes.logEmptyState}>
                      <Text fw={700}>No sessions matched this filter</Text>
                      <Text size="sm" className={classes.mutedText}>
                        Try a broader search by scenario, persona, status, type, or id.
                      </Text>
                    </div>
                  ) : (
                    <ScrollArea h={640}>
                      <div className={classes.logTableBody}>
                        <div className={classes.logTableHeader}>
                          <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                            Session ({formatNumber(filteredSessions.length)})
                          </Text>
                          <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                            Status
                          </Text>
                          <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                            Context
                          </Text>
                          <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                            Activity
                          </Text>
                          <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                            Flags
                          </Text>
                        </div>

                        {filteredSessions.slice(0, 80).map((session) => {
                          const sessionId = getRecordId(session)
                          if (!sessionId) return null

                          const sessionStatus = getSessionStatus(session)
                          const scenario = isRecord(session.scenario) ? session.scenario : {}
                          const persona = isRecord(session.persona) ? session.persona : {}

                          return (
                            <button
                              key={sessionId}
                              type="button"
                              className={`${classes.logTableRow} ${
                                selectedSessionId === sessionId ? classes.logTableRowActive : ''
                              }`}
                              onClick={() => {
                                if (selectedSessionId === sessionId) {
                                  closeSessionInspector()
                                  return
                                }

                                openAdminSession(sessionId, 'replace')
                              }}
                            >
                              <div className={`${classes.logTableCell} ${classes.logTableTime}`}>
                                <Text size="sm" fw={700}>
                                  {getSessionLabel(session)}
                                </Text>
                                <Text size="xs" className={classes.mutedText}>
                                  Updated {getSessionDate(session)}
                                </Text>
                              </div>
                              <div className={`${classes.logTableCell} ${classes.logTableSource}`}>
                                <Group gap="xs" wrap="nowrap">
                                  <span
                                    className={`${classes.logDot} ${
                                      sessionStatus === 'ended'
                                        ? classes.logDotSuccess
                                        : sessionStatus === 'queued' || sessionStatus === 'pending'
                                          ? classes.logDotWarning
                                          : classes.logDotInfo
                                    }`}
                                  />
                                  <Box style={{ minWidth: 0 }}>
                                    <Text fw={700} size="sm">
                                      {sessionStatus}
                                    </Text>
                                  </Box>
                                </Group>
                              </div>
                              <div className={`${classes.logTableCell} ${classes.logTableEvent}`}>
                                <Text fw={700} size="sm" className={classes.logTableTitle}>
                                  {readString(scenario.name, persona.name, session.orgId) ??
                                    'No linked scenario'}
                                </Text>
                                <Text
                                  size="xs"
                                  className={`${classes.consoleText} ${classes.mutedText} ${classes.logTableSubtitle}`}
                                >
                                  {truncateMiddle(readString(session.id), 42)}
                                </Text>
                              </div>
                              <div className={`${classes.logTableCell} ${classes.logTableSummary}`}>
                                <Text size="sm" className={classes.logSummaryText}>
                                  Created {formatCompactDate(session.createdAt) ?? 'n/a'}
                                </Text>
                              </div>
                              <div className={`${classes.logTableCell} ${classes.logTableBadges}`}>
                                <Group gap="xs" wrap="wrap">
                                  <Badge
                                    color={sessionStatus === 'ended' ? 'success' : 'info'}
                                    variant="light"
                                  >
                                    {sessionStatus}
                                  </Badge>
                                  <Badge color="selected" variant="light">
                                    {getSessionType(session)}
                                  </Badge>
                                </Group>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {selectedSessionId || isCreatingSession ? (
                  <div className={`${classes.logDetailPane} ${classes.logDetailSection}`}>
                    {isCreatingSession ? (
                      <Stack gap="md">
                        <div className={classes.logDetailHeader}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Box style={{ minWidth: 0, flex: 1 }}>
                              <Group gap="xs" mb={6} wrap="wrap">
                                <Badge color="selected" variant="light">
                                  draft
                                </Badge>
                                <Badge color="gray" variant="light">
                                  admin create
                                </Badge>
                              </Group>
                              <Text fw={700}>Create session</Text>
                              <Text
                                size="sm"
                                className={`${classes.consoleText} ${classes.mutedText}`}
                              >
                                Spin up a new session and optionally pre-assign members before you
                                open the full session inspector.
                              </Text>
                            </Box>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label="Close create session panel"
                              onClick={closeSessionInspector}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </Group>
                        </div>

                        <DetailSection title="New session" icon={<IconPlus size={16} />}>
                          <Stack gap="md">
                            <Grid gutter="md">
                              <Grid.Col span={{ base: 12, md: 6 }}>
                                <Select
                                  label="Team / org"
                                  searchable
                                  data={createSessionTeamOptions}
                                  value={createSessionForm.orgId || null}
                                  onChange={(value) =>
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      orgId: value ?? '',
                                    }))
                                  }
                                  nothingFoundMessage="No teams found"
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 6 }}>
                                <TextInput
                                  label="Session name"
                                  placeholder="Optional session label"
                                  value={createSessionForm.name}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      name: value,
                                    }))
                                  }}
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 6 }}>
                                <Select
                                  label="Type"
                                  data={SESSION_TYPE_OPTIONS.map((value) => ({
                                    value,
                                    label: value.charAt(0).toUpperCase() + value.slice(1),
                                  }))}
                                  value={createSessionForm.type}
                                  onChange={(value) =>
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      type: value ?? 'text',
                                    }))
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 6 }}>
                                <TextInput
                                  label="Language"
                                  placeholder="en-US"
                                  value={createSessionForm.language}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      language: value,
                                    }))
                                  }}
                                />
                              </Grid.Col>
                              <Grid.Col span={12}>
                                <TextInput
                                  label="Tags"
                                  placeholder="priority, enterprise, onboarding"
                                  value={createSessionForm.tagsText}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      tagsText: value,
                                    }))
                                  }}
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 6 }}>
                                <Select
                                  label="Scenario"
                                  searchable
                                  clearable
                                  data={createSessionScenarioOptions}
                                  value={createSessionForm.scenarioId || null}
                                  onChange={(value) =>
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      scenarioId: value ?? '',
                                    }))
                                  }
                                  nothingFoundMessage="No scenarios found"
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 6 }}>
                                <Select
                                  label="Persona"
                                  searchable
                                  clearable
                                  data={createSessionPersonaOptions}
                                  value={createSessionForm.personaId || null}
                                  onChange={(value) =>
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      personaId: value ?? '',
                                    }))
                                  }
                                  nothingFoundMessage="No personas found"
                                />
                              </Grid.Col>
                              <Grid.Col span={12}>
                                <TextInput
                                  label="CRM context ID"
                                  placeholder="crm_context_123"
                                  value={createSessionForm.crmContextId}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      crmContextId: value,
                                    }))
                                  }}
                                />
                              </Grid.Col>
                              <Grid.Col span={12}>
                                <Textarea
                                  label="Session config JSON"
                                  placeholder='{"difficulty":"hard"}'
                                  minRows={8}
                                  value={createSessionForm.sessionConfigText}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      sessionConfigText: value,
                                    }))
                                  }}
                                  classNames={{ input: classes.consoleText }}
                                />
                              </Grid.Col>
                            </Grid>
                          </Stack>
                        </DetailSection>

                        <DetailSection
                          title="Initial members"
                          icon={<IconUsersGroup size={16} />}
                          action={
                            <Badge color="selected" variant="light">
                              {createSessionForm.memberUserIds.length}
                            </Badge>
                          }
                        >
                          <Stack gap="md">
                            <Grid gutter="md">
                              <Grid.Col span={{ base: 12, md: 8 }}>
                                <MultiSelect
                                  label="Users"
                                  searchable
                                  data={userSelectOptions}
                                  value={createSessionForm.memberUserIds}
                                  onChange={(value) =>
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      memberUserIds: value,
                                    }))
                                  }
                                  nothingFoundMessage="No users found"
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 4 }}>
                                <Select
                                  label="Role"
                                  data={SESSION_MEMBER_ROLE_OPTIONS.map((value) => ({
                                    value,
                                    label: value.charAt(0).toUpperCase() + value.slice(1),
                                  }))}
                                  value={createSessionForm.memberRole}
                                  onChange={(value) =>
                                    setCreateSessionForm((current) => ({
                                      ...current,
                                      memberRole: value ?? 'viewer',
                                    }))
                                  }
                                />
                              </Grid.Col>
                            </Grid>

                            <Text size="sm" className={classes.mutedText}>
                              Leave this blank if you just want the session shell first. You can
                              assign more members later from the inspector.
                            </Text>
                          </Stack>
                        </DetailSection>

                        <Group justify="space-between" align="flex-end" wrap="wrap">
                          <Text size="sm" className={classes.mutedText}>
                            New sessions are created active. Ownership stays with the admin account
                            that created the session, and assigned users are added right after
                            creation.
                          </Text>
                          <Button
                            loading={createSessionMutation.isPending}
                            onClick={() => createSessionMutation.mutate()}
                          >
                            Create session
                          </Button>
                        </Group>
                      </Stack>
                    ) : sessionDetailQuery.isLoading ||
                      sessionTranscriptQuery.isLoading ||
                      sessionMembersQuery.isLoading ? (
                      <Center py="xl">
                        <Loader size="sm" />
                      </Center>
                    ) : (
                      <Stack gap="md">
                        <div className={classes.logDetailHeader}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Box style={{ minWidth: 0, flex: 1 }}>
                              <Group gap="xs" mb={6} wrap="wrap">
                                <Badge
                                  color={
                                    getSessionStatus(sessionDetail) === 'ended' ? 'success' : 'info'
                                  }
                                  variant="light"
                                >
                                  {getSessionStatus(sessionDetail)}
                                </Badge>
                                <Badge color="selected" variant="light">
                                  {getSessionType(sessionDetail)}
                                </Badge>
                                <Badge color="gray" variant="light" className={classes.consoleText}>
                                  {selectedSessionId}
                                </Badge>
                              </Group>
                              <Text fw={700}>{getSessionLabel(sessionDetail)}</Text>
                              <Text
                                size="sm"
                                className={`${classes.consoleText} ${classes.mutedText}`}
                              >
                                Created {formatDateTime(sessionDetail.createdAt)} • Updated{' '}
                                {formatDateTime(sessionDetail.updatedAt)}
                              </Text>
                            </Box>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label="Close session details"
                              onClick={closeSessionInspector}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </Group>
                        </div>

                        <div className={classes.logMetaGrid}>
                          <div className={classes.logMetaCard}>
                            <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                              Members
                            </Text>
                            <Text fw={700}>{formatNumber(sessionMembers.length)}</Text>
                          </div>
                          <div className={classes.logMetaCard}>
                            <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                              Transcript
                            </Text>
                            <Text fw={700}>{formatNumber(transcriptSegments.length)} segments</Text>
                          </div>
                          <div className={classes.logMetaCard}>
                            <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                              Events
                            </Text>
                            <Text fw={700}>{formatNumber(sessionEvents.length)}</Text>
                          </div>
                          <div className={classes.logMetaCard}>
                            <Text size="xs" tt="uppercase" fw={700} className={classes.metaLabel}>
                              LLM traces
                            </Text>
                            <Text fw={700}>{formatNumber(sessionLlmTraces.length)}</Text>
                          </div>
                        </div>

                        <SessionEditorSection
                          form={sessionEditForm}
                          setForm={setSessionEditForm}
                          baseline={sessionEditBaseline}
                          hasChanges={sessionEditHasChanges}
                          saving={updateSessionMutation.isPending}
                          onReset={() => setSessionEditForm(sessionEditBaseline)}
                          onSave={() => {
                            if (!selectedSessionId) return
                            updateSessionMutation.mutate(selectedSessionId)
                          }}
                          expanded={isSessionInspectorSectionExpanded('session:editor')}
                          onToggle={() => toggleSessionInspectorSection('session:editor')}
                          teams={teams}
                          scenarios={scenarios}
                          personas={personas}
                        />

                        <SessionMemberAssignmentSection
                          form={sessionMemberCreateForm}
                          setForm={setSessionMemberCreateForm}
                          userOptions={availableSessionMemberOptions}
                          saving={addSessionMembersMutation.isPending}
                          onAssign={() => {
                            if (!selectedSessionId) return
                            addSessionMembersMutation.mutate(selectedSessionId)
                          }}
                          expanded={isSessionInspectorSectionExpanded('session:add-members')}
                          onToggle={() => toggleSessionInspectorSection('session:add-members')}
                        />

                        <DetailSection
                          title="Members / assignees"
                          icon={<IconUsersGroup size={16} />}
                          collapsible
                          expanded={isSessionInspectorSectionExpanded('session:members')}
                          onToggle={() => toggleSessionInspectorSection('session:members')}
                          bodyClassName={classes.inspectorSectionBody}
                          action={
                            <Badge color="selected" variant="light">
                              {sessionMembers.length}
                            </Badge>
                          }
                        >
                          <Stack gap="xs">
                            {sessionMembers.length === 0 ? (
                              <Text size="sm" className={classes.mutedText}>
                                No session members returned.
                              </Text>
                            ) : (
                              sessionMembers.map((member, index) => {
                                const memberUser = isRecord(member.user) ? member.user : {}
                                const memberUserId = readString(member.userId, memberUser.id)
                                const sessionId = readString(member.sessionId, selectedSessionId)
                                const memberRole = readString(member.role)
                                const memberLabel =
                                  readString(
                                    memberUser.name,
                                    memberUser.email,
                                    member.userId,
                                    member.id
                                  ) ?? 'Session member'
                                const isRemovingMember =
                                  removeSessionMemberMutation.isPending &&
                                  removeSessionMemberMutation.variables?.sessionId === sessionId &&
                                  removeSessionMemberMutation.variables?.userId === memberUserId

                                return (
                                  <ExplorerRow
                                    key={
                                      readString(member.id, member.userId, String(index)) ??
                                      String(index)
                                    }
                                    title={memberLabel}
                                    subtitle={`Role: ${readString(member.role) ?? 'member'}`}
                                    meta={formatCompactDate(member.joinedAt)}
                                    badges={
                                      <Badge color="selected" variant="light">
                                        {readString(member.userId, memberUser.id) ?? 'unknown user'}
                                      </Badge>
                                    }
                                    actions={
                                      memberUserId && sessionId ? (
                                        <ActionIcon
                                          variant="subtle"
                                          color="brand"
                                          aria-label={`Remove ${memberLabel} from session`}
                                          disabled={removeSessionMemberMutation.isPending}
                                          onClick={() =>
                                            requestSessionMemberRemoval({
                                              sessionId,
                                              userId: memberUserId,
                                              role: memberRole,
                                              label: memberLabel,
                                            })
                                          }
                                        >
                                          {isRemovingMember ? (
                                            <Loader size={14} color="currentColor" />
                                          ) : (
                                            <IconTrash size={15} />
                                          )}
                                        </ActionIcon>
                                      ) : null
                                    }
                                    onClick={() => {
                                      if (memberUserId) {
                                        openAdminUser(memberUserId)
                                      }
                                    }}
                                  />
                                )
                              })
                            )}
                          </Stack>
                        </DetailSection>

                        <DetailSection
                          title="Timeline + events"
                          icon={<IconClock size={16} />}
                          collapsible
                          expanded={isSessionInspectorSectionExpanded('session:timeline')}
                          onToggle={() => toggleSessionInspectorSection('session:timeline')}
                          bodyClassName={classes.inspectorSectionBody}
                          action={
                            <Badge color="info" variant="light">
                              {sessionEvents.length}
                            </Badge>
                          }
                        >
                          <Stack gap="xs">
                            {sessionActivityItems.slice(0, 10).map((item) => (
                              <ExplorerRow
                                key={item.key}
                                title={
                                  readString(
                                    item.payload.type,
                                    item.payload.eventType,
                                    item.payload.role,
                                    item.payload.status
                                  ) ?? 'Session event'
                                }
                                subtitle={truncate(
                                  readString(
                                    item.payload.message,
                                    item.payload.text,
                                    item.payload.traceId,
                                    item.payload.id
                                  ),
                                  90
                                )}
                                meta={formatCompactDate(
                                  item.payload.createdAt ?? item.payload.timestamp
                                )}
                                badges={
                                  <Badge color="info" variant="light">
                                    {readString(item.payload.type, item.payload.role, 'event') ??
                                      'event'}
                                  </Badge>
                                }
                                active={selectedSessionActivity?.key === item.key}
                                onClick={() => setSelectedSessionActivityKey(item.key)}
                              />
                            ))}
                          </Stack>
                          {selectedSessionActivity ? (
                            <JsonBlock value={selectedSessionActivity.payload} />
                          ) : null}
                        </DetailSection>

                        <DetailSection
                          title="Transcript"
                          icon={<IconFileText size={16} />}
                          collapsible
                          expanded={isSessionInspectorSectionExpanded('session:transcript')}
                          onToggle={() => toggleSessionInspectorSection('session:transcript')}
                          bodyClassName={classes.inspectorSectionBody}
                          action={
                            <Badge color="success" variant="light">
                              {transcriptSegments.length}
                            </Badge>
                          }
                        >
                          {transcriptSegments.length === 0 ? (
                            <Text size="sm" className={classes.mutedText}>
                              No transcript segments returned for this session.
                            </Text>
                          ) : (
                            <div className={classes.transcriptList}>
                              {transcriptItems.slice(0, 12).map(({ key, payload }) => (
                                <button
                                  key={key}
                                  type="button"
                                  className={`${classes.transcriptSegment} ${
                                    selectedTranscriptSegment?.key === key
                                      ? classes.transcriptSegmentActive
                                      : ''
                                  }`}
                                  onClick={() => setSelectedTranscriptKey(key)}
                                >
                                  <Group justify="space-between" mb={6} wrap="wrap">
                                    <Badge color="selected" variant="light">
                                      {readString(
                                        payload.speakerTag,
                                        payload.speakerId,
                                        'speaker'
                                      ) ?? 'speaker'}
                                    </Badge>
                                    <Text size="xs" className={classes.mutedText}>
                                      {readString(
                                        payload.startMs,
                                        payload.startTimeMs,
                                        payload.offsetMs
                                      ) ?? formatCompactDate(payload.createdAt)}
                                    </Text>
                                  </Group>
                                  <Text size="sm">
                                    {readString(payload.text, payload.content) ??
                                      'No transcript text'}
                                  </Text>
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedTranscriptSegment ? (
                            <JsonBlock value={selectedTranscriptSegment.payload} />
                          ) : null}
                        </DetailSection>

                        <DetailSection
                          title="LLM traces"
                          icon={<IconBolt size={16} />}
                          collapsible
                          expanded={isSessionInspectorSectionExpanded('session:llm')}
                          onToggle={() => toggleSessionInspectorSection('session:llm')}
                          bodyClassName={classes.inspectorSectionBody}
                          action={
                            <Badge color="brand" variant="light">
                              {sessionLlmTraces.length}
                            </Badge>
                          }
                        >
                          <Stack gap="xs">
                            {sessionLlmTraces.length === 0 ? (
                              <Text size="sm" className={classes.mutedText}>
                                No LLM traces returned.
                              </Text>
                            ) : (
                              sessionTraceItems.slice(0, 8).map(({ key, payload }) => {
                                const traceContext = isRecord(payload.context)
                                  ? payload.context
                                  : {}
                                const traceUsage = isRecord(payload.usage) ? payload.usage : {}

                                return (
                                  <ExplorerRow
                                    key={key}
                                    title={
                                      readString(payload.provider, payload.model, payload.name) ??
                                      'LLM trace'
                                    }
                                    subtitle={truncate(
                                      readString(
                                        payload.purpose,
                                        payload.requestId,
                                        payload.responseId,
                                        traceContext.purpose
                                      ),
                                      80
                                    )}
                                    meta={formatCompactDate(payload.createdAt)}
                                    badges={
                                      <Badge color="brand" variant="light">
                                        {formatNumber(
                                          readNumber(
                                            traceUsage.totalTokens,
                                            traceUsage.promptTokens
                                          ) ?? 0
                                        )}{' '}
                                        tokens
                                      </Badge>
                                    }
                                    active={selectedSessionTrace?.key === key}
                                    onClick={() => setSelectedTraceKey(key)}
                                  />
                                )
                              })
                            )}
                          </Stack>
                          {selectedSessionTrace ? (
                            <JsonBlock value={selectedSessionTrace.payload} />
                          ) : null}
                        </DetailSection>

                        <DetailSection
                          title="Assessment + raw detail"
                          icon={<IconListDetails size={16} />}
                          collapsible
                          expanded={isSessionInspectorSectionExpanded('session:assessment')}
                          onToggle={() => toggleSessionInspectorSection('session:assessment')}
                          bodyClassName={classes.inspectorSectionBody}
                        >
                          <JsonBlock
                            value={{
                              session: sessionDetail,
                              assessment: sessionAssessment,
                              llmSummary: sessionLlmSummary,
                              invitations: sessionInvitations,
                            }}
                          />
                        </DetailSection>
                      </Stack>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </Stack>
    </Box>
  )
}
