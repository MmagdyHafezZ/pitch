import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../useAuth'
import { useAuthStore } from '../../stores/auth.store'

const mockLoginMutateAsync = jest.fn()
const mockRegisterMutateAsync = jest.fn()
const mockLogoutMutateAsync = jest.fn()
const mockLoginReset = jest.fn()
const mockRegisterReset = jest.fn()

jest.mock('../../services/auth.service', () => ({
  useLoginMutation: () => ({
    mutateAsync: mockLoginMutateAsync,
    isPending: false,
    error: null,
    reset: mockLoginReset,
  }),
  useRegisterMutation: () => ({
    mutateAsync: mockRegisterMutateAsync,
    isPending: false,
    error: null,
    reset: mockRegisterReset,
  }),
  useLogoutMutation: () => ({
    mutateAsync: mockLogoutMutateAsync,
    isPending: false,
  }),
  useMeQuery: () => ({
    data: null,
    isLoading: false,
  }),
}))

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      initializeAuth: jest.fn(),
    })
  })
})

describe('useAuth login', () => {
  it('calls loginMutation and sets user/token on success', async () => {
    const loginResult = {
      accessToken: 'tok-login',
      user: { id: '1', email: 'a@b.com', name: 'User' },
    }
    mockLoginMutateAsync.mockResolvedValue(loginResult)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    let returned: any
    await act(async () => {
      returned = await result.current.login({ email: 'a@b.com', password: 'pass123' })
    })

    expect(mockLoginMutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass123' })
    expect(returned).toBe(loginResult)
    expect(useAuthStore.getState().user).toEqual(loginResult.user)
    expect(useAuthStore.getState().token).toBe('tok-login')
  })

  it('sets error in store and re-throws on login failure', async () => {
    mockLoginMutateAsync.mockRejectedValue(new Error('Invalid credentials'))

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await expect(
      act(async () => {
        await result.current.login({ email: 'a@b.com', password: 'wrong' })
      })
    ).rejects.toThrow('Invalid credentials')

    expect(useAuthStore.getState().error).toBe('Invalid credentials')
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('sets generic error message for non-Error throws', async () => {
    mockLoginMutateAsync.mockRejectedValue('some string error')

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await expect(
      act(async () => {
        await result.current.login({ email: 'a@b.com', password: 'wrong' })
      })
    ).rejects.toBeDefined()

    expect(useAuthStore.getState().error).toBe('Login failed')
  })
})

describe('useAuth register', () => {
  it('calls registerMutation and sets user/token on success', async () => {
    const registerResult = {
      accessToken: 'tok-reg',
      user: { id: '2', email: 'new@b.com', name: 'New' },
    }
    mockRegisterMutateAsync.mockResolvedValue(registerResult)

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    let returned: any
    await act(async () => {
      returned = await result.current.register({
        email: 'new@b.com',
        password: 'pass123',
        name: 'New',
      })
    })

    expect(mockRegisterMutateAsync).toHaveBeenCalledWith({
      email: 'new@b.com',
      password: 'pass123',
      name: 'New',
    })
    expect(returned).toBe(registerResult)
    expect(useAuthStore.getState().user).toEqual(registerResult.user)
    expect(useAuthStore.getState().token).toBe('tok-reg')
  })

  it('sets error in store and re-throws on register failure', async () => {
    mockRegisterMutateAsync.mockRejectedValue(new Error('Email taken'))

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await expect(
      act(async () => {
        await result.current.register({
          email: 'dup@b.com',
          password: 'pass123',
          name: 'Dup',
        })
      })
    ).rejects.toThrow('Email taken')

    expect(useAuthStore.getState().error).toBe('Email taken')
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('sets generic error message for non-Error throws', async () => {
    mockRegisterMutateAsync.mockRejectedValue({ code: 500 })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await expect(
      act(async () => {
        await result.current.register({
          email: 'a@b.com',
          password: 'pass',
          name: 'User',
        })
      })
    ).rejects.toBeDefined()

    expect(useAuthStore.getState().error).toBe('Registration failed')
  })
})

describe('useAuth logout', () => {
  it('calls logoutMutation and clears user/token', async () => {
    mockLogoutMutateAsync.mockResolvedValue(undefined)

    act(() => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'User' } as any,
        token: 'tok',
        isAuthenticated: true,
      })
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.logout()
    })

    expect(mockLogoutMutateAsync).toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('still completes logout when mutation throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockLogoutMutateAsync.mockRejectedValue(new Error('network error'))

    act(() => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'User' } as any,
        token: 'tok',
        isAuthenticated: true,
      })
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.logout()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    consoleSpy.mockRestore()
  })
})

describe('useAuth state derivations', () => {
  it('isLoading reflects store isLoading', () => {
    act(() => {
      useAuthStore.setState({ isLoading: true })
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
  })

  it('syncs meQuery data to store when user is null', () => {
    const meUser = { id: 'm1', email: 'me@b.com', name: 'Me' }

    jest.resetModules()

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(result.current.isMeLoading).toBe(false)
  })
})
