import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AuthState, AuthActions, User } from '../types/auth.types'
import { api } from '@/lib/client'

export const isBrowser = () => typeof window !== 'undefined'

export const persistAuthToken = (token: string | null, shouldPersist = isBrowser()) => {
  if (shouldPersist && token !== null) {
    localStorage.setItem('authToken', token)
  }
}

export const clearAuthToken = (shouldPersist = isBrowser()) => {
  if (shouldPersist) {
    localStorage.removeItem('authToken')
  }
}

export interface AuthStore extends AuthState, AuthActions {}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null })

          const response = await api.auth.login({ email, password })

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          persistAuthToken(response.token)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed'
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          })
          throw error
        }
      },

      register: async (email: string, password: string, name: string) => {
        try {
          set({ isLoading: true, error: null })

          const response = await api.auth.register({ email, password, name })

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          persistAuthToken(response.token)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Registration failed'
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          })
          throw error
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

        clearAuthToken()

        window.location.href = '/auth/login'

        api.auth.logout().catch(() => {})
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: true })
      },

      setToken: (token: string | null) => {
        set({ token })
        persistAuthToken(token)
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
        if (isBrowser()) {
          const token = localStorage.getItem('authToken')
          if (token) {
            set({ token })
            api.auth
              .me()
              .then((user) => {
                set({ user, isAuthenticated: true })
              })
              .catch(() => {
                clearAuthToken()
                set({ token: null, isAuthenticated: false })
              })
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
