/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/__tests__/utils/test-utils'
import { RegisterPageClient } from '../register/RegisterPageClient'

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

jest.mock('@/features/auth/components/RegisterForm', () => ({
  RegisterForm: ({ onSwitchToLogin, inviteEmail }: any) => (
    <div data-testid="register-form">
      <span data-testid="invite-email">{inviteEmail ?? 'none'}</span>
      <button onClick={onSwitchToLogin}>Switch to login</button>
    </div>
  ),
}))

jest.mock('@/features/teams/utils/team-invite-context', () => ({
  readTeamInviteContextFromSearch: jest.fn().mockReturnValue(null),
  persistTeamInviteContext: jest.fn(),
}))

describe('RegisterPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParamsGet.mockReturnValue(null)
    mockSearchParamsToString.mockReturnValue('')
  })

  it('renders the register form', () => {
    render(<RegisterPageClient />)
    expect(screen.getByTestId('register-form')).toBeInTheDocument()
  })

  it('renders the brand text', () => {
    render(<RegisterPageClient />)
    expect(screen.getByText('P.IT.C.H.')).toBeInTheDocument()
  })

  it('renders the Get started title', () => {
    render(<RegisterPageClient />)
    expect(screen.getByText('Get started.')).toBeInTheDocument()
  })

  it('navigates to login when onSwitchToLogin is called', async () => {
    const user = userEvent.setup()
    render(<RegisterPageClient />)

    await user.click(screen.getByText('Switch to login'))
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })

  it('preserves query params when navigating to login', async () => {
    mockSearchParamsToString.mockReturnValue('teamId=t1')

    const user = userEvent.setup()
    render(<RegisterPageClient />)

    await user.click(screen.getByText('Switch to login'))
    expect(mockPush).toHaveBeenCalledWith('/auth/login?teamId=t1')
  })

  it('passes invite email from search params', () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === 'email' ? 'invited@test.com' : null
    )

    render(<RegisterPageClient />)
    expect(screen.getByTestId('invite-email').textContent).toBe('invited@test.com')
  })
})
