import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth.store'
import {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
} from '../services/auth.service'
import { LoginCredentials, RegisterCredentials } from '../types/auth.types'

export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    setLoading,
    setError,
    clearError,
    setUser,
    setToken,
    logout: logoutStore,
    initializeAuth,
  } = useAuthStore()

  // TanStack Query mutations
  const loginMutation = useLoginMutation()
  const registerMutation = useRegisterMutation()
  const logoutMutation = useLogoutMutation()

  // Query for user data (only when authenticated)
  const meQuery = useMeQuery(isAuthenticated)

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Sync user data from query to store
  useEffect(() => {
    if (meQuery.data && !user) {
      setUser(meQuery.data)
    }
  }, [meQuery.data, user, setUser])

  const login = async (credentials: LoginCredentials) => {
    try {
      clearError()
      setLoading(true)

      const result = await loginMutation.mutateAsync(credentials)

      setUser(result.user)
      setToken(result.accessToken)

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      setError(message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (credentials: RegisterCredentials) => {
    try {
      clearError()
      setLoading(true)

      const result = await registerMutation.mutateAsync(credentials)

      setUser(result.user)
      setToken(result.accessToken)

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      setError(message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync()
      setUser(null)
      setToken(null)
      clearError()
    } catch (error) {
      // Log error but don't prevent logout
      console.error('Logout error:', error)
    } finally {
      logoutStore()
    }
  }

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading:
      isLoading ||
      loginMutation.isPending ||
      registerMutation.isPending ||
      logoutMutation.isPending,
    error: error || loginMutation.error?.message || registerMutation.error?.message,

    // Actions
    login,
    register,
    logout,
    clearError,

    // Query states
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    isMeLoading: meQuery.isLoading,

    // Reset functions
    resetLogin: loginMutation.reset,
    resetRegister: registerMutation.reset,
  }
}
