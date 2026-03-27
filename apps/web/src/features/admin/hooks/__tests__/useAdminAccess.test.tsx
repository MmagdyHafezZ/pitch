import { renderHook } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { useAdminAccess } from '../useAdminAccess'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}))

jest.mock('@/features/auth', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('../../services/admin.service', () => ({
  adminApi: {
    getMe: jest.fn(),
  },
}))

type MockAuthState = {
  token: string | null
  user: { id: string } | null
}

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>
const mockUseAuthStore = useAuthStore as unknown as jest.Mock

const setAuthState = (state: MockAuthState) => {
  mockUseAuthStore.mockImplementation((selector: (value: MockAuthState) => unknown) =>
    selector(state)
  )
}

describe('useAdminAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('scopes the admin-access query to the current user id', () => {
    setAuthState({
      token: 'token-1',
      user: { id: 'admin-1' },
    })
    mockUseQuery.mockReturnValue({
      data: { id: 'admin-1', isSystemAdmin: true },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as never)

    const { result } = renderHook(() => useAdminAccess())

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['admin-access', 'me', 'admin-1'],
        enabled: true,
      })
    )
    expect(result.current.isSystemAdmin).toBe(true)
    expect(result.current.isCheckingAccess).toBe(false)
  })

  it('waits for the authenticated user id before checking admin access', () => {
    setAuthState({
      token: 'token-1',
      user: null,
    })
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as never)

    const { result } = renderHook(() => useAdminAccess())

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['admin-access', 'me', null],
        enabled: false,
      })
    )
    expect(result.current.isCheckingAccess).toBe(true)
    expect(result.current.isSystemAdmin).toBe(false)
  })
})
