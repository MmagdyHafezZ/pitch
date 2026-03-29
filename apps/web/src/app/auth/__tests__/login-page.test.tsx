/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/__tests__/utils/test-utils'
import { LoginPageClient } from '../login/LoginPageClient'

const mockPush = jest.fn()
const mockSearchParamsGet = jest.fn().mockReturnValue(null)
const mockSearchParamsToString = jest.fn().mockReturnValue('')

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}))

jest.mock('@/features/auth/components/LoginForm', () => ({
  LoginForm: ({ onSwitchToRegister }: any) => (
    <div data-testid="login-form">
      <button onClick={onSwitchToRegister}>Switch to register</button>
    </div>
  ),
}))

jest.mock('@/features/teams/utils/team-invite-context', () => ({
  readTeamInviteContextFromSearch: jest.fn().mockReturnValue(null),
  persistTeamInviteContext: jest.fn(),
}))

describe('LoginPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the login form', () => {
    render(<LoginPageClient />)
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
  })

  it('renders the brand text', () => {
    render(<LoginPageClient />)
    expect(screen.getByText('P.IT.C.H.')).toBeInTheDocument()
  })

  it('renders the welcome back title', () => {
    render(<LoginPageClient />)
    expect(screen.getByText('Welcome back.')).toBeInTheDocument()
  })

  it('navigates to register when onSwitchToRegister is called', async () => {
    const user = userEvent.setup()
    render(<LoginPageClient />)

    await user.click(screen.getByText('Switch to register'))
    expect(mockPush).toHaveBeenCalledWith('/auth/register')
  })

  it('preserves query params when navigating to register', async () => {
    mockSearchParamsToString.mockReturnValue('teamId=t1&email=a@b.com')

    const user = userEvent.setup()
    render(<LoginPageClient />)

    await user.click(screen.getByText('Switch to register'))
    expect(mockPush).toHaveBeenCalledWith('/auth/register?teamId=t1&email=a@b.com')
  })

  it('persists team invite context from search params', () => {
    const {
      readTeamInviteContextFromSearch,
      persistTeamInviteContext,
    } = require('@/features/teams/utils/team-invite-context')

    readTeamInviteContextFromSearch.mockReturnValue({ teamId: 't1' })

    render(<LoginPageClient />)

    expect(persistTeamInviteContext).toHaveBeenCalledWith({ teamId: 't1' })
  })
})
