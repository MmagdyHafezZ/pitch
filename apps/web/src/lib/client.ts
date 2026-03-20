import { QueryClient } from '@tanstack/react-query'
import type {
  CreateScenarioInput,
  GenerateScenarioBatchRequest,
  GenerateScenarioRequest,
  Scenario,
  ScenarioDraft,
  ScenarioDraftListResponse,
  ScenarioListParams,
  ScenarioListResponse,
  UpdateScenarioInput,
} from '@/features/scenarios/types/scenario.types'

export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 3
      },
    },
    mutations: {
      retry: false,
    },
  },
})

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
let accessTokenListener: ((token: string | null) => void) | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
  if (accessTokenListener) {
    accessTokenListener(token)
  }
}

export const getAccessToken = () => accessToken

export const setAccessTokenListener = (listener: ((token: string | null) => void) | null) => {
  accessTokenListener = listener
}

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        setAccessToken(null)
        return null
      }

      const data = (await response.json()) as { accessToken: string }
      setAccessToken(data.accessToken)
      return data.accessToken
    } catch {
      setAccessToken(null)
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const url = `${API_CONFIG.baseURL}${endpoint}`
  const allowRefreshRetry = !endpoint.startsWith('/auth/refresh')
  let didRefresh = false
  const { timeoutMs, ...fetchOptions } = options

  const isFormDataBody = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData

  const buildConfig = (token: string | null): RequestInit => ({
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
    credentials: 'include',
    ...fetchOptions,
  })

  const attemptFetch = async (tokenOverride: string | null) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? API_CONFIG.timeout)

    try {
      const response = await fetch(url, {
        ...buildConfig(tokenOverride),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw { response, errorData }
      }
      return response.json() as Promise<T>
    } finally {
      clearTimeout(timeoutId)
    }
  }

  try {
    return await attemptFetch(getAccessToken())
  } catch (error: any) {
    let resolvedError = error
    const initialResponse = resolvedError?.response as Response | undefined
    if (initialResponse?.status === 401 && allowRefreshRetry && !didRefresh) {
      didRefresh = true
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        try {
          return await attemptFetch(refreshedToken)
        } catch (retryError) {
          resolvedError = retryError
        }
      }
    }

    const response = resolvedError?.response as Response | undefined
    if (response) {
      const message =
        resolvedError?.errorData?.message || `HTTP ${response.status}: ${response.statusText}`
      throw new Error(message)
    }

    if (resolvedError instanceof Error && resolvedError.name === 'AbortError') {
      throw new Error('Request timeout')
    }

    throw resolvedError instanceof Error ? resolvedError : new Error('Request failed')
  } finally {
  }
}

const getApiRoot = () => {
  return API_CONFIG.baseURL.replace(/\/v\d+$/, '')
}

export async function apiRequestRoot<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const url = `${getApiRoot()}${endpoint}`
  const allowRefreshRetry = !endpoint.startsWith('/auth/refresh')
  let didRefresh = false
  const { timeoutMs, ...fetchOptions } = options

  const isFormDataBody = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData

  const buildConfig = (token: string | null): RequestInit => ({
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
    credentials: 'include',
    ...fetchOptions,
  })

  const attemptFetch = async (tokenOverride: string | null) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? API_CONFIG.timeout)

    try {
      const response = await fetch(url, {
        ...buildConfig(tokenOverride),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw { response, errorData }
      }

      return response.json() as Promise<T>
    } finally {
      clearTimeout(timeoutId)
    }
  }

  try {
    return await attemptFetch(getAccessToken())
  } catch (error: any) {
    let resolvedError = error
    const initialResponse = resolvedError?.response as Response | undefined
    if (initialResponse?.status === 401 && allowRefreshRetry && !didRefresh) {
      didRefresh = true
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        try {
          return await attemptFetch(refreshedToken)
        } catch (retryError) {
          resolvedError = retryError
        }
      }
    }

    if (resolvedError?.errorData?.message) {
      throw new Error(resolvedError.errorData.message)
    }

    throw resolvedError
  }
}

export const api = {
  users: {
    getAll: () => apiRequest<any[]>('/users'),
    getById: (id: string) => apiRequest<any>(`/users/${id}`),
    getMySettings: () => apiRequest<any>('/users/me/settings'),
    create: (data: any) =>
      apiRequest<any>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateMySettings: (settings: any) =>
      apiRequest<any>('/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    updateMyAvatar: (data: { file?: File; avatarUrl?: string }) => {
      if (data.file) {
        const formData = new FormData()
        formData.append('file', data.file)
        return apiRequest<any>('/users/me/avatar', {
          method: 'PUT',
          body: formData,
        })
      }

      return apiRequest<any>('/users/me/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: data.avatarUrl }),
      })
    },
    update: (id: string, data: any) =>
      apiRequest<any>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<any>(`/users/${id}`, {
        method: 'DELETE',
      }),
  },

  businesses: {
    getAll: () => apiRequest<any[]>('/businesses'),
    getById: (id: string) => apiRequest<any>(`/businesses/${id}`),
    create: (data: any) =>
      apiRequest<any>('/businesses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/businesses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<any>(`/businesses/${id}`, {
        method: 'DELETE',
      }),
  },

  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiRequest<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (userData: { email: string; password: string; name: string }) =>
      apiRequest<{ accessToken: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    logout: () =>
      apiRequest<void>('/auth/logout', {
        method: 'POST',
      }),
    refreshToken: async () => {
      const token = await refreshAccessToken()
      if (!token) {
        throw new Error('Refresh token invalid or expired')
      }
      return { accessToken: token }
    },
    me: () => apiRequest<any>('/auth/me'),
    checkEmail: (email: string) =>
      apiRequest<{
        exists: boolean
        provider?: string
        requiresOAuth?: boolean
        message: string
        providers?: Array<{ provider: string; displayName: string }>
      }>('/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  },

  oauth: {
    getProviders: () =>
      apiRequest<
        Array<{
          name: string
          displayName: string
          icon: string
          color: string
          authUrl: string
        }>
      >('/auth/oauth/providers'),

    getLinkedAccounts: () =>
      apiRequest<
        Array<{
          provider: string
          providerId: string
          email: string
          linkedAt: string
        }>
      >('/auth/oauth/linked-accounts'),

    unlinkAccount: (provider: string) =>
      apiRequest<{ message: string }>(`/auth/oauth/unlink/${provider}`, {
        method: 'DELETE',
      }),

    refreshToken: (refreshToken: string) =>
      apiRequest<{ access_token: string; refresh_token: string }>('/auth/oauth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
  },

  notifications: {
    create: (data: {
      recipientUserId: string
      title: string
      message: string
      type: string
      severity?: string
      sourceType: 'SYSTEM' | 'USER'
      sourceUserId?: string
      metadata?: Record<string, unknown>
    }) =>
      apiRequest<any>('/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createBatch: (data: {
      recipientUserIds: string[]
      title: string
      message: string
      type: string
      severity?: string
      sourceType: 'SYSTEM' | 'USER'
      sourceUserId?: string
      metadata?: Record<string, unknown>
    }) =>
      apiRequest<any>('/notifications/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: (params?: {
      recipientUserId?: string
      unreadOnly?: boolean
      type?: string
      skip?: number
      limit?: number
    }) => {
      const query = new URLSearchParams()
      if (params?.recipientUserId) query.set('recipientUserId', params.recipientUserId)
      if (params?.unreadOnly !== undefined) query.set('unreadOnly', String(params.unreadOnly))
      if (params?.type) query.set('type', params.type)
      if (params?.skip !== undefined) query.set('skip', String(params.skip))
      if (params?.limit !== undefined) query.set('limit', String(params.limit))
      const suffix = query.toString()
      return apiRequest<any>(`/notifications${suffix ? `?${suffix}` : ''}`)
    },
    unreadCount: (userId: string) =>
      apiRequest<{ count: number }>(`/notifications/unread-count/${userId}`),
    markRead: (data: { notificationIds: string[]; recipientUserId?: string }) =>
      apiRequest<{ matched: number; modified: number }>('/notifications/mark-read', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    markAllRead: (userId: string) =>
      apiRequest<{ matched: number; modified: number }>(`/notifications/mark-all-read/${userId}`, {
        method: 'PATCH',
      }),
  },

  teams: {
    getAll: () => apiRequest<any[]>('/teams'),
    getById: (id: string) => apiRequest<any>(`/teams/${id}`),
    getUserTeams: () => apiRequest<any[]>('/teams/user-teams'),
    create: (data: any) =>
      apiRequest<any>('/teams', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/teams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<any>(`/teams/${id}`, {
        method: 'DELETE',
      }),
    addMember: (id: string, data: any) =>
      apiRequest<any>(`/teams/${id}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    inviteMember: (id: string, data: any) =>
      apiRequest<any>(`/teams/${id}/invitations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    sendSignupInvite: (id: string, data: { email: string; signupUrl?: string; role?: string }) =>
      apiRequest<any>(`/teams/${id}/invitations/signup`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    claimInvite: (id: string) =>
      apiRequest<any>(`/teams/${id}/invitations/claim`, {
        method: 'POST',
      }),
    acceptInvite: (id: string) =>
      apiRequest<any>(`/teams/${id}/invitations/accept`, {
        method: 'POST',
      }),
    updateMember: (id: string, userId: string, data: any) =>
      apiRequest<any>(`/teams/${id}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteMember: (id: string, userId: string, data: any) =>
      apiRequest<any>(`/teams/${id}/members/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify(data),
      }),
  },

  plans: {
    getAll: () => apiRequest<any[]>('/plans'),
    getById: (id: string) => apiRequest<any>(`/plans/${id}`),
  },

  subscriptions: {
    getAll: () => apiRequest<any[]>('/subscriptions'),
    getById: (id: string) => apiRequest<any>(`/subscriptions/${id}`),
    getByTeamId: (teamId: string) => apiRequest<any>(`/subscriptions/teams/${teamId}`),
    create: (data: any) =>
      apiRequest<any>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/subscriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    upgrade: (id: string, data: any) =>
      apiRequest<any>(`/subscriptions/${id}/upgrade`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<any>(`/subscriptions/${id}`, {
        method: 'DELETE',
      }),
  },

  s3: {
    presignUpload: (input: { bucket: string; key: string; expiresIn?: number }) =>
      apiRequest<{ url: string }>('/s3/presigned/upload', {
        method: 'POST',
        body: JSON.stringify({
          bucket: input.bucket,
          key: input.key,
          expiresInSeconds: input.expiresIn,
        }),
      }),
  },

  sessions: {
    getAll: (params?: {
      userId?: string
      orgId?: string
      type?: string
      status?: string
      scenarioId?: string
      personaId?: string
      limit?: number
      offset?: number
    }) => {
      const query = new URLSearchParams()
      if (params?.userId) query.set('userId', params.userId)
      if (params?.orgId) query.set('orgId', params.orgId)
      if (params?.type) query.set('type', params.type)
      if (params?.status) query.set('status', params.status)
      if (params?.scenarioId) query.set('scenarioId', params.scenarioId)
      if (params?.personaId) query.set('personaId', params.personaId)
      if (params?.limit) query.set('limit', params.limit.toString())
      if (params?.offset) query.set('offset', params.offset.toString())
      const queryString = query.toString()
      return apiRequest<any>(`/simulation/sessions${queryString ? `?${queryString}` : ''}`)
    },
    getById: (id: string) => apiRequest<any>(`/simulation/sessions/${id}`),
    getUserSessions: (userId: string, params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      query.set('userId', userId)
      if (params?.limit) query.set('limit', params.limit.toString())
      if (params?.offset) query.set('offset', params.offset.toString())
      const queryString = query.toString()
      return apiRequest<any>(`/simulation/sessions?${queryString}`)
    },
    getOrgSessions: (orgId: string, params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      query.set('orgId', orgId)
      if (params?.limit) query.set('limit', params.limit.toString())
      if (params?.offset) query.set('offset', params.offset.toString())
      const queryString = query.toString()
      return apiRequest<any>(`/simulation/sessions?${queryString}`)
    },
    create: (data: any) =>
      apiRequest<any>('/simulation/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/simulation/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    timeline: (id: string, limit?: number) =>
      apiRequest<any>(`/simulation/sessions/${id}/timeline${limit ? `?limit=${limit}` : ''}`),
    end: (id: string, data?: { reason?: string }) =>
      apiRequest<any>(`/simulation/sessions/${id}/end`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    restart: (id: string, data?: { reason?: string }) =>
      apiRequest<any>(`/simulation/sessions/${id}/restart`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    delete: (id: string) =>
      apiRequest<any>(`/simulation/sessions/${id}`, {
        method: 'DELETE',
      }),
  },

  phoneCalls: {
    start: (data: {
      sessionId: string
      phoneNumber?: string
      provider?: string
      fromNumber?: string
    }) =>
      apiRequest<any>('/simulation/phone-calls', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  assessments: {
    run: (data: {
      sessionId?: string
      iterationId?: string
      sessionMemberId?: string
      mode: 'live' | 'final'
      forceRecalculate?: boolean
      configVersion?: string
      requestedBy?: string
    }) =>
      apiRequest<any>('/simulation/assessments/run', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getRunStatus: (runId: string) => apiRequest<any>(`/simulation/assessments/runs/${runId}`),
    getReport: (runId: string) => apiRequest<any>(`/simulation/assessments/runs/${runId}/report`),
    getLatestForSession: (
      sessionId: string,
      params?: { iterationId?: string; sessionMemberId?: string }
    ) => {
      const query = new URLSearchParams()
      if (params?.iterationId) query.set('iterationId', params.iterationId)
      if (params?.sessionMemberId) query.set('sessionMemberId', params.sessionMemberId)
      const queryString = query.toString()
      return apiRequest<any>(
        `/simulation/sessions/${sessionId}/assessments/latest${queryString ? `?${queryString}` : ''}`
      )
    },
  },

  lti: {
    getCredentials: () =>
      apiRequest<{
        v13: {
          launchUrl: string
          oidcLoginUrl: string
          jwksUrl: string
          redirectUri: string
          publicKeyPem: string | null
        }
        v11: { launchUrl: string }
      }>('/lti/platforms/credentials'),

    registerPlatform: (body: {
      name: string
      issuer: string
      clientId: string
      authLoginUrl: string
      authTokenUrl: string
      keysetUrl: string
      deploymentId: string
    }) =>
      apiRequest<{ id: string }>('/lti/platforms', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  scenarios: {
    list: (params?: ScenarioListParams) => {
      const query = new URLSearchParams()
      if (params?.orgId) query.set('orgId', params.orgId)
      if (params?.scope) query.set('scope', params.scope)
      if (params?.query) query.set('query', params.query)
      const queryString = query.toString()
      return apiRequest<ScenarioListResponse>(
        `/simulation/scenarios${queryString ? `?${queryString}` : ''}`
      )
    },
    getAll: (params?: ScenarioListParams) => api.scenarios.list(params),
    getById: (id: string) => apiRequest<Scenario>(`/simulation/scenarios/${id}`),
    generate: (data: GenerateScenarioRequest) =>
      apiRequest<ScenarioDraft>('/simulation/scenarios/generate', {
        method: 'POST',
        body: JSON.stringify(data),
        timeoutMs: 30000,
      }),
    generateBatch: (data: GenerateScenarioBatchRequest) =>
      apiRequest<ScenarioDraftListResponse>('/simulation/scenarios/generate/batch', {
        method: 'POST',
        body: JSON.stringify(data),
        timeoutMs: 30000,
      }),
    create: (data: CreateScenarioInput) =>
      apiRequest<Scenario>('/simulation/scenarios', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateScenarioInput) =>
      apiRequest<Scenario>(`/simulation/scenarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/simulation/scenarios/${id}`, {
        method: 'DELETE',
      }),
  },

  hints: {
    history: (sessionId: string, limit?: number, type?: string) => {
      const query = new URLSearchParams({ sessionId })
      if (limit) query.set('limit', String(limit))
      if (type) query.set('type', type)
      return apiRequest<any>(`/simulation/hints/history?${query.toString()}`)
    },
    generate: (data: any) =>
      apiRequest<any>('/simulation/hints/generate', {
        method: 'POST',
        body: JSON.stringify(data),
        timeoutMs: 15000,
      }),
  },

  crm: {
    salesforce: {
      connect: () => apiRequestRoot<any>('/crm/salesforce/connect'),
      status: () => apiRequestRoot<any>('/crm/salesforce/status'),
      accounts: (limit?: number) =>
        apiRequestRoot<any>(`/crm/salesforce/accounts${limit ? `?limit=${limit}` : ''}`),
      contacts: (limit?: number) =>
        apiRequestRoot<any>(`/crm/salesforce/contacts${limit ? `?limit=${limit}` : ''}`),
      opportunities: (limit?: number) =>
        apiRequestRoot<any>(`/crm/salesforce/opportunities${limit ? `?limit=${limit}` : ''}`),
      leads: (limit?: number) =>
        apiRequestRoot<any>(`/crm/salesforce/leads${limit ? `?limit=${limit}` : ''}`),
      search: (query: string) =>
        apiRequestRoot<any>('/crm/salesforce/search', {
          method: 'POST',
          body: JSON.stringify({ query }),
        }),
    },
  },

  calendar: {
    google: {
      connect: () => apiRequestRoot<{ authUrl: string }>('/calendar/google/connect'),
      status: () => apiRequestRoot<any>('/calendar/google/status'),
      disconnect: () =>
        apiRequestRoot<{ success: boolean }>('/calendar/google/disconnect', { method: 'DELETE' }),
      events: (params?: { from?: string; to?: string; maxResults?: number }) => {
        const query = new URLSearchParams()
        if (params?.from) query.set('from', params.from)
        if (params?.to) query.set('to', params.to)
        if (params?.maxResults) query.set('maxResults', String(params.maxResults))
        const qs = query.toString()
        return apiRequestRoot<any[]>(`/calendar/google/events${qs ? `?${qs}` : ''}`)
      },
    },
    microsoft: {
      connect: () => apiRequestRoot<{ authUrl: string }>('/calendar/microsoft/connect'),
      status: () => apiRequestRoot<any>('/calendar/microsoft/status'),
      disconnect: () =>
        apiRequestRoot<{ success: boolean }>('/calendar/microsoft/disconnect', {
          method: 'DELETE',
        }),
      events: (params?: { from?: string; to?: string; maxResults?: number }) => {
        const query = new URLSearchParams()
        if (params?.from) query.set('from', params.from)
        if (params?.to) query.set('to', params.to)
        if (params?.maxResults) query.set('maxResults', String(params.maxResults))
        const qs = query.toString()
        return apiRequestRoot<any[]>(`/calendar/microsoft/events${qs ? `?${qs}` : ''}`)
      },
    },
    upcoming: (lookAheadDays?: number) =>
      apiRequestRoot<any[]>(
        `/calendar/upcoming${lookAheadDays ? `?lookAheadDays=${lookAheadDays}` : ''}`
      ),
    suggestions: {
      list: () => apiRequestRoot<any[]>('/calendar/suggestions'),
      accept: (sessionId: string) =>
        apiRequestRoot<any>(`/calendar/suggestions/${sessionId}/accept`, { method: 'POST' }),
      dismiss: (sessionId: string) =>
        apiRequestRoot<{ success: boolean }>(`/calendar/suggestions/${sessionId}`, {
          method: 'DELETE',
        }),
    },
  },

  invitations: {
    createForSession: (sessionId: string, data: { inviteeIds: string[]; message?: string }) =>
      apiRequest<any>(`/simulation/sessions/${sessionId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getSessionInvitations: (sessionId: string) =>
      apiRequest<any>(`/simulation/sessions/${sessionId}/invitations`),
    getMyInvitations: (status?: string) => {
      const queryString = status ? `?status=${status}` : ''
      return apiRequest<any>(`/simulation/invitations/me${queryString}`)
    },
    getSentInvitations: (status?: string) => {
      const queryString = status ? `?status=${status}` : ''
      return apiRequest<any>(`/simulation/invitations/sent${queryString}`)
    },
    getById: (id: string) => apiRequest<any>(`/simulation/invitations/${id}`),
    accept: (id: string) =>
      apiRequest<any>(`/simulation/invitations/${id}/accept`, {
        method: 'POST',
      }),
    decline: (id: string) =>
      apiRequest<any>(`/simulation/invitations/${id}/decline`, {
        method: 'POST',
      }),
    revoke: (id: string) =>
      apiRequest<any>(`/simulation/invitations/${id}/revoke`, {
        method: 'DELETE',
      }),
    getPendingCount: () => apiRequest<{ count: number }>('/simulation/invitations/pending-count'),
  },

  tts: {
    listProviders: () =>
      apiRequest<
        Array<{ name: string; description?: string; voices: string[]; models?: string[] }>
      >('/tts/providers'),
    getVoices: (provider: string) =>
      apiRequest<{ provider: string; voices: string[]; models?: string[] }>(
        `/tts/voices?provider=${provider}`
      ),
    speak: async (data: {
      text: string
      provider: string
      voice: string
      model?: string
    }): Promise<Blob> => {
      const url = `${API_CONFIG.baseURL}/tts/speak`
      const token = getAccessToken()

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.blob()
    },
  },

  personas: {
    getAll: (params?: { orgId?: string }) => {
      const query = new URLSearchParams()
      if (params?.orgId) query.set('orgId', params.orgId)
      const queryString = query.toString()
      return apiRequest<{ personas: any[]; total: number }>(
        `/simulation/personas${queryString ? `?${queryString}` : ''}`
      )
    },
    create: (data: { orgId: string; name: string; traits?: Record<string, unknown> }) =>
      apiRequest<any>('/simulation/personas', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getById: (id: string) => apiRequest<any>(`/simulation/personas/${id}`),
    getPreviewAudio: async (id: string): Promise<Blob> => {
      const url = `${API_CONFIG.baseURL}/simulation/personas/${id}/preview-audio`
      const token = getAccessToken()

      const response = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.blob()
    },
  },

  challenges: {
    list: (params?: { period?: string; difficulty?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (params?.period) query.set('period', params.period)
      if (params?.difficulty) query.set('difficulty', params.difficulty)
      if (params?.limit) query.set('limit', params.limit.toString())
      if (params?.offset) query.set('offset', params.offset.toString())
      const qs = query.toString()
      return apiRequest<any>(`/challenges${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => apiRequest<any>(`/challenges/${id}`),
    participate: (challengeId: string) =>
      apiRequest<any>(`/challenges/${challengeId}/participate`, { method: 'POST' }),
    submitScore: (challengeId: string, sessionId: string, score: number) =>
      apiRequest<any>(`/challenges/${challengeId}/score`, {
        method: 'PUT',
        body: JSON.stringify({ sessionId, score }),
      }),
    challengeLeaderboard: (challengeId: string, limit?: number) =>
      apiRequest<any>(`/challenges/${challengeId}/leaderboard${limit ? `?limit=${limit}` : ''}`),
    globalLeaderboard: (limit?: number) =>
      apiRequest<any>(`/challenges/leaderboard${limit ? `?limit=${limit}` : ''}`),
    adminGenerate: (period: 'DAILY' | 'WEEKLY' | 'MONTHLY') =>
      apiRequest<any>('/challenges/admin/generate', {
        method: 'POST',
        body: JSON.stringify({ period }),
        timeoutMs: 60000,
      }),
  },

  support: {
    chat: (req: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      context?: {
        page?: string
        sessionId?: string
        recentTurns?: Array<{ role: string; text: string }>
      }
    }) =>
      apiRequest<{ reply: string }>('/support/chat', {
        method: 'POST',
        body: JSON.stringify(req),
        timeoutMs: 30000,
      }),
  },

  analytics: {
    getDashboard: (userId: string) =>
      apiRequest<{
        sessions: Array<{
          id: string
          name: string | null
          type: string
          status: string
          createdAt: string
          endedAt: string | null
          runId: string | null
          totalScore: number | null
          scoreBreakdown: Record<string, number> | null
        }>
      }>(`/simulation/analytics/dashboard?userId=${encodeURIComponent(userId)}`),
  },

  llm: {
    getProviders: () =>
      apiRequest<{
        providers: Array<{
          name: string
          enabled: boolean
          models: string[]
          modelDetails: Array<{
            name: string
            pricing: {
              inputTokensPerMillion: number
              outputTokensPerMillion: number
              imageTokens?: number
              audioSecondsToTokens?: number
            }
            maxTokens: number
            maxOutputTokens?: number
            supportsStreaming: boolean
            supportsTools: boolean
            supportsVision: boolean
            supportsAudio: boolean
            supportedModalities: Array<'text' | 'image' | 'audio'>
          }>
        }>
      }>('/simulation/llm/providers'),
  },
}
