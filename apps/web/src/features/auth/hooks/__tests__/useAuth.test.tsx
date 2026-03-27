import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'

const mockStore = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    isActive: true,
    hasStudioAccess: true,
    isSystemAdmin: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  token: 'token-1',
  isAuthenticated: true,
  isLoading: false,
  error: null as string | null,
  setLoading: jest.fn(),
  setError: jest.fn(),
  clearError: jest.fn(),
  deleteAccount: jest.fn(),
  setUser: jest.fn(),
  setToken: jest.fn(),
  logout: jest.fn(),
  initializeAuth: jest.fn(),
}

const mockUseMeQuery = jest.fn()
const mockUseLoginMutation = jest.fn()
const mockUseRegisterMutation = jest.fn()
const mockUseLogoutMutation = jest.fn()

jest.mock('../../stores/auth.store', () => ({
  useAuthStore: jest.fn(() => mockStore),
}))

jest.mock('../../services/auth.service', () => ({
  useLoginMutation: () => mockUseLoginMutation(),
  useRegisterMutation: () => mockUseRegisterMutation(),
  useLogoutMutation: () => mockUseLogoutMutation(),
  useMeQuery: (...args: unknown[]) => mockUseMeQuery(...args),
}))

const createMutationMock = () => ({
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
  reset: jest.fn(),
})

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockStore.user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      isActive: true,
      hasStudioAccess: true,
      isSystemAdmin: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    mockUseLoginMutation.mockReturnValue(createMutationMock())
    mockUseRegisterMutation.mockReturnValue(createMutationMock())
    mockUseLogoutMutation.mockReturnValue(createMutationMock())
    mockUseMeQuery.mockReturnValue({
      data: null,
      isLoading: false,
    })
  })

  it('syncs newer auth flags from /auth/me into the store', async () => {
    mockUseMeQuery.mockReturnValue({
      data: {
        ...mockStore.user,
        isSystemAdmin: true,
        updatedAt: '2024-02-01T00:00:00.000Z',
      },
      isLoading: false,
    })

    renderHook(() => useAuth())

    await waitFor(() => {
      expect(mockStore.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystemAdmin: true,
          updatedAt: '2024-02-01T00:00:00.000Z',
        })
      )
    })
  })

  it('does not rewrite the store when /auth/me returns the same auth-relevant user data', async () => {
    mockUseMeQuery.mockReturnValue({
      data: {
        ...mockStore.user,
      },
      isLoading: false,
    })

    renderHook(() => useAuth())

    await waitFor(() => {
      expect(mockStore.initializeAuth).toHaveBeenCalled()
    })

    expect(mockStore.setUser).not.toHaveBeenCalled()
  })
})
