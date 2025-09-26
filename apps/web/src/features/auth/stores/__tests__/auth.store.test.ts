import { act } from '@testing-library/react'
import { server } from '../../../../__tests__/mocks/server'
import { resetStores } from '../../../../__tests__/utils/store-utils'
import { useAuthStore, persistAuthToken, clearAuthToken } from '../auth.store'
import { api } from '@/lib/client'
import { http, HttpResponse } from 'msw'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

type LocalStorageMock = {
  getItem: jest.Mock<string | null, [string]>
  setItem: jest.Mock<void, [string, string]>
  removeItem: jest.Mock<void, [string]>
  clear: jest.Mock<void, []>
}

const localStorageMock: LocalStorageMock = {
  getItem: jest.fn<string | null, [string]>(() => null),
  setItem: jest.fn<void, [string, string]>(() => undefined),
  removeItem: jest.fn<void, [string]>(() => undefined),
  clear: jest.fn<void, []>(() => undefined),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('AuthStore', () => {
  beforeEach(() => {
    resetStores()
    localStorageMock.getItem.mockReset()
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    localStorageMock.clear.mockClear()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('Login', () => {
    it('should login successfully with valid credentials', async () => {
      await act(async () => {
        await useAuthStore.getState().login('test@example.com', 'password123')
      })

      const state = useAuthStore.getState()

      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
      expect(state.token).toBe('mock-jwt-token')
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'mock-jwt-token')
    })

    it('should handle login failure with invalid credentials', async () => {
      await expect(
        act(async () => {
          await useAuthStore.getState().login('wrong@example.com', 'wrongpassword')
        })
      ).rejects.toThrow('Invalid credentials')

      await flushPromises()

      const state = useAuthStore.getState()

      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('Invalid credentials')
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('should fallback to default error message when login throws non-Error', async () => {
      const loginSpy = jest.spyOn(api.auth, 'login').mockRejectedValueOnce('Network down')

      await expect(
        act(async () => {
          await useAuthStore.getState().login('any@example.com', 'password123')
        })
      ).rejects.toEqual('Network down')

      await flushPromises()

      const state = useAuthStore.getState()
      expect(state.error).toBe('Login failed')
      expect(state.isLoading).toBe(false)
      loginSpy.mockRestore()
    })

    it('should set loading state during login', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/login`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return HttpResponse.json({
            token: 'mock-jwt-token',
            refreshToken: 'mock-refresh-token',
            user: {
              id: '1',
              email: 'test@example.com',
              name: 'Test User',
              isActive: true,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          })
        })
      )

      await act(async () => {
        const loginPromise = useAuthStore.getState().login('test@example.com', 'password123')
        expect(useAuthStore.getState().isLoading).toBe(true)
        await loginPromise
      })

      const state = useAuthStore.getState()

      expect(state.isLoading).toBe(false)
      expect(state.isAuthenticated).toBe(true)
    })
  })

  describe('Register', () => {
    it('should register successfully with valid data', async () => {
      await act(async () => {
        await useAuthStore.getState().register('newuser@example.com', 'password123', 'New User')
      })

      const state = useAuthStore.getState()

      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual({
        id: '2',
        email: 'newuser@example.com',
        name: 'New User',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect(state.token).toBe('mock-jwt-token')
      expect(state.error).toBeNull()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'mock-jwt-token')
    })

    it('should handle registration failure', async () => {
      await expect(
        act(async () => {
          await useAuthStore.getState().register('', '', '')
        })
      ).rejects.toThrow('Validation failed')

      await flushPromises()

      const state = useAuthStore.getState()

      expect(state.isAuthenticated).toBe(false)
      expect(state.error).toBe('Validation failed')
    })

    it('should fallback to default error message when registration throws non-Error', async () => {
      const registerSpy = jest.spyOn(api.auth, 'register').mockRejectedValueOnce('Duplicate email')

      await expect(
        act(async () => {
          await useAuthStore.getState().register('fail@example.com', 'password123', 'Fail User')
        })
      ).rejects.toEqual('Duplicate email')

      await flushPromises()

      const state = useAuthStore.getState()
      expect(state.error).toBe('Registration failed')
      registerSpy.mockRestore()
    })
  })

  describe('Logout', () => {
    it('should logout and clear state', async () => {
      await act(async () => {
        await useAuthStore.getState().login('test@example.com', 'password123')
      })

      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      const logoutSpy = jest
        .spyOn(api.auth, 'logout')
        .mockRejectedValueOnce(new Error('network error'))
      await act(async () => {
        useAuthStore.getState().logout()
      })
      logoutSpy.mockRestore()

      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.error).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken')
    })
  })

  describe('State Management', () => {
    it('should set user correctly', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      act(() => {
        useAuthStore.getState().setUser(mockUser)
      })

      const state = useAuthStore.getState()

      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
    })

    it('should set token correctly', () => {
      act(() => {
        useAuthStore.getState().setToken('new-token')
      })

      const state = useAuthStore.getState()

      expect(state.token).toBe('new-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'new-token')
    })

    it('should set loading state', () => {
      act(() => {
        useAuthStore.getState().setLoading(true)
      })

      expect(useAuthStore.getState().isLoading).toBe(true)

      act(() => {
        useAuthStore.getState().setLoading(false)
      })

      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('should set and clear error', () => {
      act(() => {
        useAuthStore.getState().setError('Test error')
      })

      expect(useAuthStore.getState().error).toBe('Test error')

      act(() => {
        useAuthStore.getState().clearError()
      })

      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('Token helpers', () => {
    it('persistAuthToken should respect the shouldPersist flag', () => {
      persistAuthToken('helper-token', false)
      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      persistAuthToken('helper-token', true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'helper-token')
    })

    it('clearAuthToken should respect the shouldPersist flag', () => {
      clearAuthToken(false)
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()

      clearAuthToken(true)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken')
    })
  })

  describe('Initialize Auth', () => {
    it('should initialize auth with valid token in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('mock-jwt-token')

      await act(async () => {
        useAuthStore.getState().initializeAuth()
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const state = useAuthStore.getState()

      expect(state.token).toBe('mock-jwt-token')
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
    })

    it('should handle invalid token in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token')

      server.use(
        http.get(`${API_BASE_URL}/auth/me`, () => {
          return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        })
      )

      await act(async () => {
        useAuthStore.getState().initializeAuth()
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const state = useAuthStore.getState()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken')
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it('should do nothing when no token in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null)

      act(() => {
        useAuthStore.getState().initializeAuth()
      })

      const state = useAuthStore.getState()

      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })
})
