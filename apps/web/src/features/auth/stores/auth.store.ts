import { create } from 'zustand'
import { AuthState, AuthActions, User } from '../types/auth.types'
import {
  api,
  queryClient,
  setAccessToken,
  setAccessTokenListener,
  refreshAccessToken as refreshAccessTokenRequest,
} from '@/lib/client'
import { getJwtExpiry } from '../utils/token.utils'
import { applyAvatarCacheToUser } from '../utils/avatar-cache'
import { useTeamsStore } from '@/features/teams/stores/teams.store'

export interface AuthStore extends AuthState, AuthActions {}

// Prevents concurrent initializeAuth() calls from firing parallel /auth/me requests.
// Multiple components (or React Strict Mode's double-invocation) all share this gate.
let initInFlight: Promise<void> | null = null

const isTokenExpired = (token: string | null) => {
  if (!token) return true
  const expiry = getJwtExpiry(token)
  if (!expiry) return false
  return expiry <= Date.now()
}

const resolveAuthError = (error: unknown, fallback: string) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown })?.message === 'string'
        ? ((error as { message: string }).message ?? fallback)
        : fallback
  const shouldWrap =
    !(error instanceof Error) && typeof (error as { message?: unknown })?.message === 'string'
  return { message, throwValue: shouldWrap ? new Error(message) : error }
}

const clearAdminQueries = () => {
  queryClient.removeQueries({ queryKey: ['admin-access'] })
  queryClient.removeQueries({ queryKey: ['admin-console'] })
}

const clearSessionQueries = () => {
  queryClient.removeQueries({ queryKey: ['auth'] })
  queryClient.removeQueries({ queryKey: ['oauth'] })
  clearAdminQueries()
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null })

      const response = await api.auth.login({ email, password })
      const user = applyAvatarCacheToUser(response.user)
      useTeamsStore.getState().resetStore()
      clearAdminQueries()

      set({
        user,
        token: response.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      setAccessToken(response.accessToken)
    } catch (error) {
      const { message, throwValue } = resolveAuthError(error, 'Login failed')
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      })
      throw throwValue
    }
  },

  register: async (email: string, password: string, name: string) => {
    try {
      set({ isLoading: true, error: null })

      const response = await api.auth.register({ email, password, name })
      const user = applyAvatarCacheToUser(response.user)
      useTeamsStore.getState().resetStore()
      clearAdminQueries()

      set({
        user,
        token: response.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      setAccessToken(response.accessToken)
    } catch (error) {
      const { message, throwValue } = resolveAuthError(error, 'Registration failed')
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      })
      throw throwValue
    }
  },

  logout: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })

    api.auth.logout().catch(() => {})
    setAccessToken(null)
    clearSessionQueries()
    useTeamsStore.getState().resetStore()
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      window.location.href = '/auth/login'
    }
  },

  deleteAccount: async () => {
    const currentUser = get().user
    if (!currentUser?.id) {
      const error = new Error('No authenticated user found')
      set({ error: error.message })
      throw error
    }

    try {
      set({ isLoading: true, error: null })
      await api.users.delete(currentUser.id)

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      setAccessToken(null)
      clearSessionQueries()
      useTeamsStore.getState().resetStore()

      api.auth.logout().catch(() => {})
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
        window.location.href = '/auth/login'
      }
    } catch (error) {
      const { message, throwValue } = resolveAuthError(error, 'Failed to delete account')
      set({ isLoading: false, error: message })
      throw throwValue
    }
  },

  setUser: (user: User | null) => {
    set({ user: applyAvatarCacheToUser(user), isAuthenticated: !!user })
  },

  setToken: (token: string | null) => {
    set({ token, isAuthenticated: !!token })
    setAccessToken(token)
  },

  refreshAccessToken: async () => {
    const currentToken = get().token
    try {
      const refreshedToken = await refreshAccessTokenRequest()
      if (!refreshedToken) {
        throw new Error('Refresh failed')
      }
      set({
        token: refreshedToken,
        isAuthenticated: true,
      })
      setAccessToken(refreshedToken)
      return true
    } catch {
      if (!currentToken || isTokenExpired(currentToken)) {
        setAccessToken(null)
        clearSessionQueries()
        set({ token: null, isAuthenticated: false })
      }
      return false
    }
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },

  initializeAuth: () => {
    // If an init is already in-flight (e.g. multiple components mounting simultaneously,
    // or React Strict Mode double-invoking effects), reuse the existing promise.
    if (initInFlight) return

    initInFlight = api.auth
      .refreshToken()
      .then((response) => {
        set({
          token: response.accessToken,
          isAuthenticated: true,
        })
        setAccessToken(response.accessToken)
        return api.auth.me()
      })
      .then((user) => {
        set({ user: applyAvatarCacheToUser(user), isAuthenticated: true })
      })
      .catch(() => {
        setAccessToken(null)
        clearSessionQueries()
        set({ token: null, user: null, isAuthenticated: false })
        useTeamsStore.getState().resetStore()
      })
      .finally(() => {
        initInFlight = null
      })
  },
}))

setAccessTokenListener((token) => {
  const current = useAuthStore.getState()
  if (current.token !== token) {
    useAuthStore.setState({ token, isAuthenticated: !!token })
  }
})
