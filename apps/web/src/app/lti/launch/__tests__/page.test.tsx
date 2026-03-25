/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: mockGet,
    toString: jest.fn().mockReturnValue(''),
  }),
}))

const mockSetToken = jest.fn()
const mockSetUser = jest.fn()
jest.mock('@/features/auth', () => ({
  useAuthStore: (selector: any) => {
    const state = { setToken: mockSetToken, setUser: mockSetUser }
    return selector(state)
  },
}))

const mockAuthMe = jest.fn()

jest.mock('@/lib/client', () => ({
  api: {
    auth: {
      me: (...args: any[]) => mockAuthMe(...args),
    },
  },
}))

jest.mock('@/features/auth/utils/oauth.utils', () => ({
  storeOAuthTokens: jest.fn(),
}))

import LtiLaunchPage from '../page'

function renderPage() {
  return render(
    <MantineProvider>
      <LtiLaunchPage />
    </MantineProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  mockGet.mockReturnValue(null)
  mockAuthMe.mockResolvedValue({ id: 'u1', name: 'LTI User' })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('LtiLaunchPage', () => {
  it('shows error when no token in search params', async () => {
    mockGet.mockReturnValue(null)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Launch Failed')).toBeInTheDocument()
    })
    expect(screen.getByText(/No authentication token received/)).toBeInTheDocument()
  })

  it('shows success when token is provided', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'token') return 'lti-token-123'
      if (key === 'refresh_token') return 'lti-refresh'
      return null
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Signed in successfully')).toBeInTheDocument()
    })
    expect(mockSetToken).toHaveBeenCalledWith('lti-token-123')
  })

  it('calls api.auth.me to fetch user profile', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'token') return 'tok'
      return null
    })

    renderPage()

    await waitFor(() => {
      expect(mockAuthMe).toHaveBeenCalled()
    })
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u1', name: 'LTI User' })
  })

  it('still shows success when api.auth.me fails', async () => {
    mockAuthMe.mockRejectedValue(new Error('unauthorized'))
    mockGet.mockImplementation((key: string) => {
      if (key === 'token') return 'tok'
      return null
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Signed in successfully')).toBeInTheDocument()
    })
  })

  it('redirects to session when pitchSessionId is present', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'token') return 'tok'
      if (key === 'pitchSessionId') return 'sess-42'
      return null
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Signed in successfully')).toBeInTheDocument()
    })

    jest.advanceTimersByTime(1500)

    expect(mockReplace).toHaveBeenCalledWith('/session/sess-42')
  })

  it('redirects to sessions list when no pitchSessionId', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'token') return 'tok'
      return null
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Signed in successfully')).toBeInTheDocument()
    })

    jest.advanceTimersByTime(1500)

    expect(mockReplace).toHaveBeenCalledWith('/studio/sessions')
  })

  it('shows sign in manually button on error', async () => {
    mockGet.mockReturnValue(null)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Sign in manually')).toBeInTheDocument()
    })

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(screen.getByText('Sign in manually'))

    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })
})
