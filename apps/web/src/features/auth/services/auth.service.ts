import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, setAccessToken } from '@/lib/client'
import { LoginCredentials, RegisterCredentials, AuthResponse, User } from '../types/auth.types'

// Query keys
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

export const oauthKeys = {
  all: ['oauth'] as const,
  providers: () => [...oauthKeys.all, 'providers'] as const,
  linked: () => [...oauthKeys.all, 'linked-accounts'] as const,
}

// Login mutation
export const useLoginMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<AuthResponse, Error, LoginCredentials>({
    mutationFn: (credentials) => api.auth.login(credentials),
    onSuccess: async (data) => {
      queryClient.setQueryData(authKeys.me(), data.user)
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
      await queryClient.invalidateQueries({ queryKey: oauthKeys.linked() })
    },
  })
}

// Register mutation
export const useRegisterMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<AuthResponse, Error, RegisterCredentials>({
    mutationFn: (credentials) => api.auth.register(credentials),
    onSuccess: async (data) => {
      queryClient.setQueryData(authKeys.me(), data.user)
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
      await queryClient.invalidateQueries({ queryKey: oauthKeys.linked() })
    },
  })
}

// Logout mutation
export const useLogoutMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authKeys.all })
      queryClient.removeQueries({ queryKey: oauthKeys.all })
    },
  })
}

// Get current user query
export const useMeQuery = (enabled = true) => {
  return useQuery<User, Error>({
    queryKey: authKeys.me(),
    queryFn: () => api.auth.me(),
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 10,
  })
}

// Refresh token mutation
export const useRefreshTokenMutation = () => {
  return useMutation<{ accessToken: string }, Error, void>({
    mutationFn: () => api.auth.refreshToken(),
  })
}

// OAuth hooks
export const useOAuthProvidersQuery = () => {
  return useQuery({
    queryKey: oauthKeys.providers(),
    queryFn: () => api.oauth.getProviders(),
    staleTime: 1000 * 60 * 30,
    retry: 2,
  })
}

export const useLinkedAccountsQuery = (enabled = true) => {
  return useQuery({
    queryKey: oauthKeys.linked(),
    queryFn: () => api.oauth.getLinkedAccounts(),
    enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export const useUnlinkAccountMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (provider) => api.oauth.unlinkAccount(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oauthKeys.linked() })
    },
  })
}

export const useOAuthRefreshTokenMutation = () => {
  return useMutation<{ access_token: string; refresh_token: string }, Error, string>({
    mutationFn: (refreshToken: string) => api.oauth.refreshToken(refreshToken),
    onSuccess: (data) => {
      setAccessToken(data.access_token)
    },
    onError: () => {
      setAccessToken(null)
    },
  })
}
