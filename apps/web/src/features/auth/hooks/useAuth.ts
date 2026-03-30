import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth.store'
import {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
} from '../services/auth.service'
import { LoginCredentials, RegisterCredentials, User } from '../types/auth.types'

const hasAuthRelevantUserChange = (currentUser: User | null, nextUser: User) => {
  if (!currentUser) return true

  return (
    currentUser.id !== nextUser.id ||
    currentUser.email !== nextUser.email ||
    currentUser.name !== nextUser.name ||
    currentUser.avatar !== nextUser.avatar ||
    currentUser.phoneNumber !== nextUser.phoneNumber ||
    currentUser.phoneVerifiedAt !== nextUser.phoneVerifiedAt ||
    currentUser.isActive !== nextUser.isActive ||
    currentUser.hasStudioAccess !== nextUser.hasStudioAccess ||
    currentUser.isSystemAdmin !== nextUser.isSystemAdmin ||
    currentUser.createdAt !== nextUser.createdAt ||
    currentUser.updatedAt !== nextUser.updatedAt ||
    JSON.stringify(currentUser.settings ?? null) !== JSON.stringify(nextUser.settings ?? null)
  )
}

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
    deleteAccount,
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
    if (meQuery.data && hasAuthRelevantUserChange(user, meQuery.data)) {
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
    deleteAccount,
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
