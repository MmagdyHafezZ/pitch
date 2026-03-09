/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { RegisterForm } from '../RegisterForm'

const mockRedirectToOAuthProvider = jest.fn()
const mockNotificationsShow = jest.fn()
const mockUseOAuthProvidersQuery = jest.fn()

jest.mock('@/features/auth/utils/oauth.utils', () => ({
  redirectToOAuthProvider: (...args: any[]) => mockRedirectToOAuthProvider(...args),
}))

jest.mock('@/features/auth/services/auth.service', () => ({
  useOAuthProvidersQuery: (...args: any[]) => mockUseOAuthProvidersQuery(...args),
}))

jest.mock('@mantine/notifications', () => {
  const actual = jest.requireActual('@mantine/notifications')
  return {
    ...actual,
    notifications: {
      show: (...args: any[]) => mockNotificationsShow(...args),
    },
  }
})

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseOAuthProvidersQuery.mockReturnValue({
      data: [{ name: 'google', displayName: 'Google' }],
      isLoading: false,
      error: null,
    })
  })

  it('passes invite email as login_hint when starting OAuth signup', async () => {
    const user = userEvent.setup()
    render(<RegisterForm inviteEmail="invitee@example.com" />)

    await user.click(screen.getByRole('button', { name: /sign up with google/i }))

    await waitFor(() => {
      expect(mockRedirectToOAuthProvider).toHaveBeenCalledWith(
        expect.any(String),
        'google',
        'invitee@example.com'
      )
    })
  })
})
