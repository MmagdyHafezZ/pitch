import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
  useRefreshTokenMutation,
  useOAuthProvidersQuery,
  useLinkedAccountsQuery,
  useUnlinkAccountMutation,
  useOAuthRefreshTokenMutation,
  authKeys,
  oauthKeys,
} from '../auth.service'
import { api, setAccessToken, getAccessToken } from '@/lib/client'

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, retryDelay: 0 },
      mutations: { retry: false },
    },
  })

const makeWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return Wrapper
}

describe('Auth Service Hooks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    jest.restoreAllMocks()
    setAccessToken(null)
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('authKeys and oauthKeys', () => {
    it('should define authKeys correctly', () => {
      expect(authKeys.all).toEqual(['auth'])
      expect(authKeys.me()).toEqual(['auth', 'me'])
    })

    it('should define oauthKeys correctly', () => {
      expect(oauthKeys.all).toEqual(['oauth'])
      expect(oauthKeys.providers()).toEqual(['oauth', 'providers'])
      expect(oauthKeys.linked()).toEqual(['oauth', 'linked-accounts'])
    })
  })

  describe('useLoginMutation', () => {
    it('should call api.auth.login with credentials', async () => {
      const mockResponse = {
        accessToken: 'mock-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      }
      jest.spyOn(api.auth, 'login').mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useLoginMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate({ email: 'test@example.com', password: 'pass' })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.auth.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'pass',
      })
      expect(result.current.data).toEqual(mockResponse)
    })

    it('should set user query data in cache on success', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      jest.spyOn(api.auth, 'login').mockResolvedValueOnce({ accessToken: 'tok', user })
      // invalidateQueries triggers a refetch — stub it so the cache value sticks
      jest.spyOn(api.auth, 'me').mockResolvedValue(user)
      jest.spyOn(api.oauth, 'getLinkedAccounts').mockResolvedValue([])

      const { result } = renderHook(() => useLoginMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate({ email: 'test@example.com', password: 'pass' })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // The onSuccess handler calls setQueryData then invalidateQueries; after the
      // subsequent me() refetch resolves the cache holds the user returned by me().
      await waitFor(() => expect(queryClient.getQueryData(authKeys.me())).toEqual(user))
    })

    it('should surface the error on login failure', async () => {
      jest.spyOn(api.auth, 'login').mockRejectedValueOnce(new Error('Invalid credentials'))

      const { result } = renderHook(() => useLoginMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate({ email: 'bad@example.com', password: 'wrong' })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error?.message).toBe('Invalid credentials')
    })
  })

  describe('useRegisterMutation', () => {
    it('should call api.auth.register with credentials', async () => {
      const user = {
        id: '2',
        email: 'new@example.com',
        name: 'New User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      jest.spyOn(api.auth, 'register').mockResolvedValueOnce({ accessToken: 'tok', user })

      const { result } = renderHook(() => useRegisterMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate({ email: 'new@example.com', password: 'pass', name: 'New User' })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.auth.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'pass',
        name: 'New User',
      })
    })

    it('should set user query data in cache on success', async () => {
      const user = {
        id: '2',
        email: 'new@example.com',
        name: 'New User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      jest.spyOn(api.auth, 'register').mockResolvedValueOnce({ accessToken: 'tok', user })

      const { result } = renderHook(() => useRegisterMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate({ email: 'new@example.com', password: 'pass', name: 'New User' })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(queryClient.getQueryData(authKeys.me())).toEqual(user)
    })

    it('should surface the error on registration failure', async () => {
      jest.spyOn(api.auth, 'register').mockRejectedValueOnce(new Error('Email taken'))

      const { result } = renderHook(() => useRegisterMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate({ email: 'taken@example.com', password: 'pass', name: 'User' })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error?.message).toBe('Email taken')
    })
  })

  describe('useLogoutMutation', () => {
    it('should call api.auth.logout', async () => {
      jest.spyOn(api.auth, 'logout').mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useLogoutMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.auth.logout).toHaveBeenCalled()
    })

    it('should clear auth and oauth query cache on success', async () => {
      jest.spyOn(api.auth, 'logout').mockResolvedValueOnce(undefined)

      queryClient.setQueryData(authKeys.me(), { id: '1' })
      queryClient.setQueryData(oauthKeys.linked(), [])

      const { result } = renderHook(() => useLogoutMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(queryClient.getQueryData(authKeys.me())).toBeUndefined()
      expect(queryClient.getQueryData(oauthKeys.linked())).toBeUndefined()
    })

    it('should surface the error on logout failure', async () => {
      jest.spyOn(api.auth, 'logout').mockRejectedValueOnce(new Error('Logout failed'))

      const { result } = renderHook(() => useLogoutMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error?.message).toBe('Logout failed')
    })
  })

  describe('useMeQuery', () => {
    it('should call api.auth.me and return user data', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      jest.spyOn(api.auth, 'me').mockResolvedValueOnce(user)

      const { result } = renderHook(() => useMeQuery(), {
        wrapper: makeWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(user)
    })

    it('should not run query when enabled=false', () => {
      jest.spyOn(api.auth, 'me')

      const { result } = renderHook(() => useMeQuery(false), {
        wrapper: makeWrapper(queryClient),
      })

      expect(result.current.isFetching).toBe(false)
      expect(api.auth.me).not.toHaveBeenCalled()
    })

    it('should surface error without retrying', async () => {
      jest.spyOn(api.auth, 'me').mockRejectedValue(new Error('Unauthorized'))

      const { result } = renderHook(() => useMeQuery(), {
        wrapper: makeWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(api.auth.me).toHaveBeenCalledTimes(1)
      expect(result.current.error?.message).toBe('Unauthorized')
    })
  })

  describe('useRefreshTokenMutation', () => {
    it('should call api.auth.refreshToken', async () => {
      jest.spyOn(api.auth, 'refreshToken').mockResolvedValueOnce({ accessToken: 'refreshed-token' })

      const { result } = renderHook(() => useRefreshTokenMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.accessToken).toBe('refreshed-token')
    })

    it('should surface error on refresh failure', async () => {
      jest.spyOn(api.auth, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'))

      const { result } = renderHook(() => useRefreshTokenMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error?.message).toBe('Refresh failed')
    })
  })

  describe('useOAuthProvidersQuery', () => {
    it('should call api.oauth.getProviders and return providers', async () => {
      const providers = [{ name: 'google', enabled: true }]
      jest.spyOn(api.oauth, 'getProviders').mockResolvedValueOnce(providers as any)

      const { result } = renderHook(() => useOAuthProvidersQuery(), {
        wrapper: makeWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(providers)
    })

    it('should surface error when getProviders fails', async () => {
      jest.spyOn(api.oauth, 'getProviders').mockRejectedValue(new Error('Provider error'))

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity, retryDelay: 0 } },
      })

      const { result } = renderHook(() => useOAuthProvidersQuery(), {
        wrapper: makeWrapper(qc),
      })

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    })
  })

  describe('useLinkedAccountsQuery', () => {
    it('should call api.oauth.getLinkedAccounts when enabled', async () => {
      const accounts = [{ provider: 'google', email: 'g@g.com' }]
      jest.spyOn(api.oauth, 'getLinkedAccounts').mockResolvedValueOnce(accounts as any)

      const { result } = renderHook(() => useLinkedAccountsQuery(), {
        wrapper: makeWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(accounts)
    })

    it('should not run query when enabled=false', () => {
      jest.spyOn(api.oauth, 'getLinkedAccounts')

      const { result } = renderHook(() => useLinkedAccountsQuery(false), {
        wrapper: makeWrapper(queryClient),
      })

      expect(result.current.isFetching).toBe(false)
      expect(api.oauth.getLinkedAccounts).not.toHaveBeenCalled()
    })
  })

  describe('useUnlinkAccountMutation', () => {
    it('should call api.oauth.unlinkAccount with the provider', async () => {
      jest.spyOn(api.oauth, 'unlinkAccount').mockResolvedValueOnce({ message: 'Unlinked' })

      const { result } = renderHook(() => useUnlinkAccountMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate('google')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.oauth.unlinkAccount).toHaveBeenCalledWith('google')
    })

    it('should invalidate linked accounts on success', async () => {
      jest.spyOn(api.oauth, 'unlinkAccount').mockResolvedValueOnce({ message: 'Unlinked' })
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useUnlinkAccountMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate('google')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: oauthKeys.linked() })
    })

    it('should surface error on unlink failure', async () => {
      jest.spyOn(api.oauth, 'unlinkAccount').mockRejectedValueOnce(new Error('Unlink failed'))

      const { result } = renderHook(() => useUnlinkAccountMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate('github')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useOAuthRefreshTokenMutation', () => {
    it('should call api.oauth.refreshToken and set the access token on success', async () => {
      jest.spyOn(api.oauth, 'refreshToken').mockResolvedValueOnce({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      })

      const { result } = renderHook(() => useOAuthRefreshTokenMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate('old-refresh-token')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.oauth.refreshToken).toHaveBeenCalledWith('old-refresh-token')
      expect(getAccessToken()).toBe('new-access')
    })

    it('should clear the access token on error', async () => {
      setAccessToken('stale-token')
      jest.spyOn(api.oauth, 'refreshToken').mockRejectedValueOnce(new Error('Refresh failed'))

      const { result } = renderHook(() => useOAuthRefreshTokenMutation(), {
        wrapper: makeWrapper(queryClient),
      })

      await act(async () => {
        result.current.mutate('bad-refresh-token')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(getAccessToken()).toBeNull()
    })
  })
})
