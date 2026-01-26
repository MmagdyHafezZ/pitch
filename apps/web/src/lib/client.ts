import { QueryClient } from '@tanstack/react-query'
import { get } from 'http'

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

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_CONFIG.baseURL}${endpoint}`

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)

  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

export const api = {
  users: {
    getAll: () => apiRequest<any[]>('/users'),
    getById: (id: string) => apiRequest<any>(`/users/${id}`),
    create: (data: any) =>
      apiRequest<any>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
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
      apiRequest<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (userData: { email: string; password: string; name: string }) =>
      apiRequest<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    logout: () =>
      apiRequest<void>('/auth/logout', {
        method: 'POST',
      }),
    refreshToken: () =>
      apiRequest<{ token: string }>('/auth/refresh', {
        method: 'POST',
      }),
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
    end: (id: string, data?: { reason?: string }) =>
      apiRequest<any>(`/simulation/sessions/${id}/end`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    delete: (id: string) =>
      apiRequest<any>(`/simulation/sessions/${id}`, {
        method: 'DELETE',
      }),
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
}
