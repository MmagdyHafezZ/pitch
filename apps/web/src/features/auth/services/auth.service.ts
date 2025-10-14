import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client'
import { LoginCredentials, RegisterCredentials, AuthResponse, User } from '../types/auth.types'

// Query keys
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

// Login mutation
export const useLoginMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<AuthResponse, Error, LoginCredentials>({
    mutationFn: (credentials) => api.auth.login(credentials),
    onSuccess: (data) => {
      // Cache user data
      queryClient.setQueryData(authKeys.me(), data.user)
    },
    onError: (error) => {
      console.error('Login error:', error)
    },
  })
}

// Register mutation
export const useRegisterMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<AuthResponse, Error, RegisterCredentials>({
    mutationFn: (credentials) => api.auth.register(credentials),
    onSuccess: (data) => {
      // Cache user data
      queryClient.setQueryData(authKeys.me(), data.user)
    },
    onError: (error) => {
      console.error('Registration error:', error)
    },
  })
}

// Logout mutation
export const useLogoutMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear()
    },
    onError: (error) => {
      console.error('Logout error:', error)
    },
  })
}

// Get current user query
export const useMeQuery = (enabled: boolean = false) => {
  return useQuery<User, Error>({
    queryKey: authKeys.me(),
    queryFn: () => api.auth.me(),
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

// Refresh token mutation
export const useRefreshTokenMutation = () => {
  return useMutation<{ token: string }, Error, void>({
    mutationFn: () => api.auth.refreshToken(),
    onError: (error) => {
      console.error('Token refresh error:', error)
    },
  })
}

// OAuth hooks
export const useOAuthProvidersQuery = () => {
  return useQuery({
    queryKey: ['oauth', 'providers'],
    queryFn: () => api.oauth.getProviders(),
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
  })
}

export const useLinkedAccountsQuery = (enabled: boolean = false) => {
  return useQuery({
    queryKey: ['oauth', 'linked-accounts'],
    queryFn: () => api.oauth.getLinkedAccounts(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useUnlinkAccountMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (provider: string) => api.oauth.unlinkAccount(provider),
    onSuccess: () => {
      // Invalidate linked accounts query
      queryClient.invalidateQueries({ queryKey: ['oauth', 'linked-accounts'] })
    },
    onError: (error) => {
      console.error('Unlink account error:', error)
    },
  })
}

export const useOAuthRefreshTokenMutation = () => {
  return useMutation<{ access_token: string; refresh_token: string }, Error, string>({
    mutationFn: (refreshToken: string) => api.oauth.refreshToken(refreshToken),
    onSuccess: (data) => {
      // Store new tokens
      localStorage.setItem('authToken', data.access_token)
      localStorage.setItem('refreshToken', data.refresh_token)
    },
    onError: (error) => {
      console.error('OAuth token refresh error:', error)
      // Clear tokens on refresh failure
      localStorage.removeItem('authToken')
      localStorage.removeItem('refreshToken')
    },
  })
}
