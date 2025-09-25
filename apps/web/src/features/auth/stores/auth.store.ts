import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AuthState, AuthActions, User } from '../types/auth.types'
import { api } from '@/lib/client'

export interface AuthStore extends AuthState, AuthActions {}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
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

          // Store token in localStorage for API requests
          if (typeof window !== 'undefined') {
            localStorage.setItem('authToken', response.token)
          }
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

          // Store token in localStorage for API requests
          if (typeof window !== 'undefined') {
            localStorage.setItem('authToken', response.token)
          }
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

        // Remove token from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authToken')
        }

        // Optionally call logout endpoint
        api.auth.logout().catch(() => {
          // Ignore logout errors
        })
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true })
      },

      setToken: (token: string) => {
        set({ token })
        if (typeof window !== 'undefined') {
          localStorage.setItem('authToken', token)
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
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('authToken')
          if (token) {
            set({ token })
            // Optionally validate token by fetching user info
            api.auth
              .me()
              .then((user) => {
                set({ user, isAuthenticated: true })
              })
              .catch(() => {
                // Token is invalid, remove it
                localStorage.removeItem('authToken')
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
