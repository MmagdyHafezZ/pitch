/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import AuthCallbackPage from '../callback/page'

const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockSearchParams: URLSearchParams

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}))

const mockSetToken = jest.fn()
const mockSetUser = jest.fn()

jest.mock('@/features/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({
      setToken: mockSetToken,
      setUser: mockSetUser,
    }),
}))

jest.mock('@/lib/client', () => ({
  api: {
    auth: {
      me: jest.fn().mockResolvedValue({ id: 'u1', name: 'Test' }),
    },
    teams: {
      claimInvite: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('@/features/auth/utils/oauth.utils', () => ({
  parseOAuthCallback: (params: URLSearchParams) => ({
    token: params.get('token') || undefined,
    refresh_token: params.get('refresh') || undefined,
    error: params.get('error') || undefined,
  }),
  storeOAuthTokens: jest.fn(),
}))

jest.mock('@/features/teams/utils/team-invite-context', () => ({
  getTeamInviteContext: jest.fn().mockReturnValue(null),
  clearTeamInviteContext: jest.fn(),
}))

jest.mock('@mantine/notifications', () => {
  const actual = jest.requireActual('@mantine/notifications')
  return {
    ...actual,
    notifications: {
      show: jest.fn(),
    },
  }
})

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows loading state initially', () => {
    mockSearchParams = new URLSearchParams('token=abc')
    render(<AuthCallbackPage />)

    expect(screen.getByText('Processing authentication...')).toBeInTheDocument()
  })

  it('shows error when error parameter is present', async () => {
    jest.useRealTimers()
    mockSearchParams = new URLSearchParams('error=access_denied')

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument()
    })
    expect(screen.getByText('access_denied')).toBeInTheDocument()
  })

  it('shows error when no token is present', async () => {
    jest.useRealTimers()
    mockSearchParams = new URLSearchParams('')

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument()
    })
    expect(screen.getByText('No authentication token received')).toBeInTheDocument()
  })

  it('shows success when token is present', async () => {
    jest.useRealTimers()
    mockSearchParams = new URLSearchParams('token=valid-token')

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(screen.getByText('Authentication Successful!')).toBeInTheDocument()
    })

    expect(mockSetToken).toHaveBeenCalledWith('valid-token')
  })

  it('renders Try Again button on error', async () => {
    jest.useRealTimers()
    mockSearchParams = new URLSearchParams('error=bad')

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })
})
