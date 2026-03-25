/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { AuthGate } from '../auth-gate'

const mockReplace = jest.fn()
const mockRefreshAccessToken = jest.fn()
const mockSetUser = jest.fn()
const mockMe = jest.fn()
const mockUsePathname = jest.fn()
const mockUseSearchParams = jest.fn()
const mockUseAuthStore = jest.fn()
const mockAuthState = {
  token: 'token-1' as string | null,
  user: {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    hasStudioAccess: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  } as any,
  setUser: mockSetUser as (user: unknown) => void,
  refreshAccessToken: mockRefreshAccessToken as () => Promise<boolean>,
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}))

jest.mock('@/features/auth/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) => mockUseAuthStore(selector),
    {
      getState: () => mockAuthState,
    }
  ),
}))

jest.mock('@/lib/client', () => ({
  api: {
    auth: {
      me: () => mockMe(),
    },
    users: {
      updateMySettings: jest.fn().mockResolvedValue({}),
    },
  },
}))

describe('AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthState.token = 'token-1'
    mockAuthState.user = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      hasStudioAccess: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any
    mockRefreshAccessToken.mockResolvedValue(true)
    mockMe.mockResolvedValue(mockAuthState.user)
    mockUseAuthStore.mockImplementation((selector: (state: typeof mockAuthState) => unknown) =>
      selector(mockAuthState)
    )
  })

  it('does not redirect away from invite auth page when already authenticated', async () => {
    mockUsePathname.mockReturnValue('/auth/register')
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'teamId' ? 'team-1' : null),
    })

    render(
      <AuthGate>
        <div>Child</div>
      </AuthGate>
    )

    expect(await screen.findByText('Child')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects authenticated users away from non-invite auth pages', async () => {
    mockUsePathname.mockReturnValue('/auth/register')
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    })

    render(
      <AuthGate>
        <div>Child</div>
      </AuthGate>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/studio/home')
    })
  })

  it('allows unauthenticated users on the public home route', async () => {
    mockAuthState.token = null
    mockAuthState.user = null
    mockUsePathname.mockReturnValue('/')
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    })

    render(
      <AuthGate>
        <div>Child</div>
      </AuthGate>
    )

    expect(await screen.findByText('Child')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
  })

  it('redirects authenticated users without studio access to the request page', async () => {
    mockAuthState.user = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      hasStudioAccess: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any
    mockUsePathname.mockReturnValue('/studio/home')
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    })

    render(
      <AuthGate>
        <div>Child</div>
      </AuthGate>
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/access/request')
    })
  })
})
