import { QueryClient } from '@tanstack/react-query'

// API configuration
export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1',
  timeout: 10000,
}

// Create a single QueryClient instance for the entire app
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
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

// Base API client function
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_CONFIG.baseURL}${endpoint}`

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  // Add auth token if available
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

// API methods
export const api = {
  // User endpoints
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

  // Business endpoints
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

  // Auth endpoints (to be implemented)
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
  },
}
