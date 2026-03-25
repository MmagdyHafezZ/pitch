/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { LoginForm } from '../LoginForm'

let mockCheckEmail: jest.Mock
let mockOAuthProviders: any[]
let mockIsLoading: boolean
let mockProvidersError: Error | null

jest.mock('../../services/auth.service', () => ({
  useOAuthProvidersQuery: () => ({
    data: mockOAuthProviders,
    isLoading: mockIsLoading,
    error: mockProvidersError,
  }),
  useLoginMutation: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
    reset: jest.fn(),
  }),
  useRegisterMutation: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
    reset: jest.fn(),
  }),
  useLogoutMutation: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useMeQuery: () => ({
    data: null,
    isLoading: false,
  }),
}))

jest.mock('@/lib/client', () => ({
  api: {
    auth: {
      checkEmail: (...args: any[]) => mockCheckEmail(...args),
    },
  },
}))

jest.mock('../../utils/oauth.utils', () => ({
  redirectToOAuthProvider: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks()
  mockCheckEmail = jest.fn()
  mockOAuthProviders = [
    { name: 'google', displayName: 'Google', icon: 'google', color: '#4285F4', authUrl: '' },
    { name: 'github', displayName: 'GitHub', icon: 'github', color: '#333', authUrl: '' },
  ]
  mockIsLoading = false
  mockProvidersError = null
})

describe('LoginForm', () => {
  it('renders sign-in heading and email input', () => {
    render(<LoginForm />)

    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('renders sign-up link', () => {
    const onSwitch = jest.fn()
    render(<LoginForm onSwitchToRegister={onSwitch} />)

    expect(screen.getByText('Sign up')).toBeInTheDocument()
  })

  it('calls onSwitchToRegister when sign-up link is clicked', async () => {
    const user = userEvent.setup()
    const onSwitch = jest.fn()
    render(<LoginForm onSwitchToRegister={onSwitch} />)

    await user.click(screen.getByText('Sign up'))
    expect(onSwitch).toHaveBeenCalled()
  })

  it('disables Continue button when email is empty', () => {
    render(<LoginForm />)

    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toBeDisabled()
  })

  it('enables Continue button when email is entered', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'test@example.com')

    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled()
  })

  it('shows error alert when provider loading fails', async () => {
    mockProvidersError = new Error('Network error')

    render(<LoginForm />)

    await waitFor(() => {
      expect(screen.getByText('Unable to load authentication providers')).toBeInTheDocument()
    })
  })

  it('submits email and shows providers when user does not exist', async () => {
    const user = userEvent.setup()
    mockCheckEmail.mockResolvedValue({
      exists: false,
      message: 'No account found. Sign up below.',
    })

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockCheckEmail).toHaveBeenCalledWith('new@example.com')
    })

    await waitFor(() => {
      expect(screen.getByText('No account found. Sign up below.')).toBeInTheDocument()
    })

    expect(screen.getByText(/Continue with Google/)).toBeInTheDocument()
    expect(screen.getByText(/Continue with GitHub/)).toBeInTheDocument()
  })

  it('redirects to OAuth provider when existing user requires OAuth', async () => {
    const user = userEvent.setup()
    const { redirectToOAuthProvider } = require('../../utils/oauth.utils')

    mockCheckEmail.mockResolvedValue({
      exists: true,
      requiresOAuth: true,
      provider: 'google',
      message: 'Please sign in with Google',
    })

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'oauth@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(redirectToOAuthProvider).toHaveBeenCalledWith(
        expect.any(String),
        'google',
        'oauth@example.com'
      )
    })
  })

  it('shows error when email check fails', async () => {
    const user = userEvent.setup()
    mockCheckEmail.mockRejectedValue(new Error('Server error'))

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'fail@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to check email. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows error when result exists but no OAuth', async () => {
    const user = userEvent.setup()
    mockCheckEmail.mockResolvedValue({
      exists: true,
      requiresOAuth: false,
      message: 'Password login not supported',
    })

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText('Password login not supported')).toBeInTheDocument()
    })
  })

  it('renders Terms of Service and Privacy Policy links', () => {
    render(<LoginForm />)

    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('does not show providers initially', () => {
    render(<LoginForm />)

    expect(screen.queryByText(/Continue with Google/)).not.toBeInTheDocument()
  })

  it('shows loading message when providers are loading and provider section is shown', async () => {
    const user = userEvent.setup()
    mockIsLoading = true
    mockOAuthProviders = []
    mockCheckEmail.mockResolvedValue({
      exists: false,
      message: 'Sign up',
    })

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText('Loading authentication providers...')).toBeInTheDocument()
    })
  })

  it('shows "No authentication providers available" when list is empty', async () => {
    const user = userEvent.setup()
    mockOAuthProviders = []
    mockIsLoading = false
    mockCheckEmail.mockResolvedValue({
      exists: false,
      message: 'Sign up',
    })

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText('No authentication providers available')).toBeInTheDocument()
    })
  })

  it('clicking an OAuth provider button triggers redirect', async () => {
    const user = userEvent.setup()
    const { redirectToOAuthProvider } = require('../../utils/oauth.utils')

    mockCheckEmail.mockResolvedValue({
      exists: false,
      message: 'Sign up below',
    })

    render(<LoginForm />)

    await user.type(screen.getByPlaceholderText('Enter your email address'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText(/Continue with Google/)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/Continue with Google/))

    expect(redirectToOAuthProvider).toHaveBeenCalledWith(
      expect.any(String),
      'google',
      'new@example.com'
    )
  })
})
