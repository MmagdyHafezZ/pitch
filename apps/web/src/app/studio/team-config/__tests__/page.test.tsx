/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import TeamConfigPage from '../page'

var mockPush: jest.Mock
var mockReplace: jest.Mock
var mockBack: jest.Mock
var mockUseTeams: jest.Mock
var mockUseAuth: jest.Mock
var mockUseCreateTeamForm: jest.Mock
var mockUseMediaQuery: jest.Mock
var mockTeamMembersPanel: jest.Mock
var mockTeamSubscriptionPanel: jest.Mock
var searchMode: string | null = null

jest.mock('next/navigation', () => ({
  useRouter: () => {
    mockPush ??= jest.fn()
    mockReplace ??= jest.fn()
    mockBack ??= jest.fn()
    return {
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }
  },
  useSearchParams: () => ({
    get: (key: string) => (key === 'mode' ? searchMode : null),
  }),
}))

jest.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ className: 'font-space' }),
  Fraunces: () => ({ className: 'font-fraunces' }),
}))

jest.mock('@mantine/hooks', () => {
  const actual = jest.requireActual('@mantine/hooks')
  return {
    ...actual,
    useMediaQuery: (...args: any[]) => {
      mockUseMediaQuery ??= jest.fn()
      return mockUseMediaQuery(...args)
    },
  }
})

jest.mock('@/features/teams/hooks/useTeams', () => ({
  useTeams: (...args: any[]) => {
    mockUseTeams ??= jest.fn()
    return mockUseTeams(...args)
  },
}))

jest.mock('@/features/auth', () => ({
  useAuth: (...args: any[]) => {
    mockUseAuth ??= jest.fn()
    return mockUseAuth(...args)
  },
}))

jest.mock('@/features/teams/hooks/useTeamForm', () => ({
  useCreateTeamForm: (...args: any[]) => {
    mockUseCreateTeamForm ??= jest.fn()
    return mockUseCreateTeamForm(...args)
  },
}))

jest.mock('@/components/ui/TeamMembersPanel', () => ({
  TeamMembersPanel: (props: any) => {
    mockTeamMembersPanel ??= jest.fn()
    mockTeamMembersPanel(props)
    return <div data-testid="team-members-panel">Mock Members Panel</div>
  },
}))

jest.mock('@/components/ui/TeamSubscriptionPanel', () => ({
  TeamSubscriptionPanel: (props: any) => {
    mockTeamSubscriptionPanel ??= jest.fn()
    mockTeamSubscriptionPanel(props)
    return (
      <div data-testid="team-subscription-panel">
        Mock Subscription Panel: {props.teamId} / {props.teamName} / {String(props.canManage)}
      </div>
    )
  },
}))

const baseTeam = {
  id: 'team-1',
  name: 'Pitch Team',
  slug: 'pitch-team',
  isActive: true,
  billingEmail: 'billing@pitch.com',
  billingAddress: {
    street: '123 Main',
    city: 'New York',
    stateProvince: 'NY',
    postalCode: '10001',
    country: 'United States',
  },
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  memberships: [
    {
      id: 'm1',
      userId: 'user-1',
      teamId: 'team-1',
      role: 'OWNER',
      tokenLimit: 0,
      invitedByUserId: null,
      acceptedAt: '2026-02-01T00:00:00.000Z',
      isActive: true,
    },
  ],
}

function setupDefaultMocks(overrides?: {
  teams?: any
  auth?: any
  form?: any
  mediaQuery?: boolean
}) {
  mockPush = jest.fn()
  mockReplace = jest.fn()
  mockBack = jest.fn()
  mockUseMediaQuery = jest.fn().mockReturnValue(overrides?.mediaQuery ?? false)
  mockTeamMembersPanel = jest.fn()
  mockTeamSubscriptionPanel = jest.fn()

  mockUseAuth = jest.fn().mockReturnValue(
    overrides?.auth ?? {
      user: { id: 'user-1', email: 'owner@example.com', name: 'Owner User' },
    }
  )

  mockUseTeams = jest.fn().mockReturnValue(
    overrides?.teams ?? {
      currentTeam: baseTeam,
      updateTeam: jest.fn().mockResolvedValue(undefined),
      loading: false,
      fetchTeamById: jest.fn().mockResolvedValue(baseTeam),
    }
  )

  mockUseCreateTeamForm = jest.fn().mockReturnValue(
    overrides?.form ?? {
      values: {
        name: '',
        billingEmail: '',
        street: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: '',
      },
      errors: {},
      setField: jest.fn(),
      submit: jest.fn().mockResolvedValue(true),
      submitting: false,
      apiError: null,
    }
  )
}

describe('TeamConfigPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    searchMode = null
    setupDefaultMocks()
  })

  it('renders create mode layout and sends field changes to useCreateTeamForm', async () => {
    searchMode = 'create'
    const setField = jest.fn()
    setupDefaultMocks({
      form: {
        values: {
          name: '',
          billingEmail: '',
          street: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: '',
        },
        errors: {},
        setField,
        submit: jest.fn().mockResolvedValue(true),
        submitting: false,
        apiError: null,
      },
    })

    const user = userEvent.setup()
    render(<TeamConfigPage />)

    expect(await screen.findByRole('heading', { name: 'Create a new team' })).toBeInTheDocument()
    expect(screen.getByText('Team details')).toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Revenue Operations'), 'Revenue Ops')
    expect(setField).toHaveBeenCalledWith('name', 'R')
  })

  it('creates a team and routes to team config on successful create', async () => {
    searchMode = 'create'
    const submit = jest.fn().mockResolvedValue(true)
    setupDefaultMocks({
      form: {
        values: {
          name: 'Revenue Ops',
          billingEmail: '',
          street: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: '',
        },
        errors: {},
        setField: jest.fn(),
        submit,
        submitting: false,
        apiError: null,
      },
    })

    const user = userEvent.setup()
    render(<TeamConfigPage />)

    await user.click(await screen.findByRole('button', { name: 'Create team' }))

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/studio/team-config')
    })
  })

  it('does not route after create when form submission fails', async () => {
    searchMode = 'create'
    const submit = jest.fn().mockResolvedValue(false)
    setupDefaultMocks({
      form: {
        values: {
          name: '',
          billingEmail: '',
          street: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          country: '',
        },
        errors: {},
        setField: jest.fn(),
        submit,
        submitting: false,
        apiError: null,
      },
    })

    const user = userEvent.setup()
    render(<TeamConfigPage />)
    await user.click(await screen.findByRole('button', { name: 'Create team' }))

    await waitFor(() => {
      expect(submit).toHaveBeenCalled()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('renders edit mode with profile step active and prefilled team values', async () => {
    render(<TeamConfigPage />)

    expect(await screen.findByRole('heading', { name: 'Team profile' })).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Team profile' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Pitch Team')).toBeInTheDocument()
    expect(screen.getByDisplayValue('billing@pitch.com')).toBeInTheDocument()
  })

  it('switches step content and keeps only one current step marker', async () => {
    const user = userEvent.setup()
    render(<TeamConfigPage />)

    const expectSingleActiveTab = (label: 'Profile' | 'Members' | 'Billing' | 'Subscription') => {
      const activeTabs = screen
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('aria-selected') === 'true')
      expect(activeTabs).toHaveLength(1)
      expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
    }

    await screen.findByRole('heading', { name: 'Team profile' })
    expect(screen.getByRole('heading', { name: 'Team profile' })).toBeInTheDocument()
    expectSingleActiveTab('Profile')

    await user.click(screen.getByText('Members'))
    expect(await screen.findByTestId('team-members-panel')).toBeInTheDocument()
    expectSingleActiveTab('Members')

    await user.click(screen.getByText('Subscription'))
    expect(await screen.findByTestId('team-subscription-panel')).toBeInTheDocument()
    expectSingleActiveTab('Subscription')

    expect(mockTeamSubscriptionPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        teamName: 'Pitch Team',
        canManage: true,
      })
    )
  })

  it('saves edit mode profile and billing values through updateTeam', async () => {
    const updateTeam = jest.fn().mockResolvedValue(undefined)
    setupDefaultMocks({
      teams: {
        currentTeam: baseTeam,
        updateTeam,
        loading: false,
        fetchTeamById: jest.fn().mockResolvedValue(baseTeam),
      },
    })

    const user = userEvent.setup()
    render(<TeamConfigPage />)
    await screen.findByRole('heading', { name: 'Team profile' })

    const teamNameInput = screen.getByDisplayValue('Pitch Team')
    const billingEmailInput = screen.getByDisplayValue('billing@pitch.com')
    await user.clear(teamNameInput)
    await user.type(teamNameInput, 'Revenue Operations')
    await user.clear(billingEmailInput)
    await user.type(billingEmailInput, 'finance@pitch.com')

    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => {
      expect(updateTeam).toHaveBeenCalledWith('team-1', {
        name: 'Revenue Operations',
        billingEmail: 'finance@pitch.com',
        billingAddress: {
          street: '123 Main',
          city: 'New York',
          stateProvince: 'NY',
          postalCode: '10001',
          country: 'United States',
        },
      })
    })
  })

  it('shows validation error and returns to profile step when saving with empty team name', async () => {
    const user = userEvent.setup()
    render(<TeamConfigPage />)
    await screen.findByRole('heading', { name: 'Team profile' })

    const teamNameInput = screen.getByDisplayValue('Pitch Team')
    await user.clear(teamNameInput)

    await user.click(screen.getByText('Billing'))
    expect(await screen.findByRole('heading', { name: 'Billing address' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save billing details' }))

    expect(await screen.findByText('Team name is required')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Team profile' })).toBeInTheDocument()
  })

  it('redirects non-elevated users away from edit mode', async () => {
    setupDefaultMocks({
      auth: { user: { id: 'user-2', email: 'member@example.com' } },
      teams: {
        currentTeam: {
          ...baseTeam,
          memberships: [
            {
              id: 'm1',
              userId: 'user-2',
              teamId: 'team-1',
              role: 'MEMBER',
              tokenLimit: 0,
              invitedByUserId: null,
              acceptedAt: '2026-02-01T00:00:00.000Z',
              isActive: true,
            },
          ],
        },
        updateTeam: jest.fn(),
        loading: false,
        fetchTeamById: jest.fn(),
      },
    })

    render(<TeamConfigPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/studio/home')
    })
  })

  it('fetches current team details when memberships are missing in edit mode', async () => {
    const fetchTeamById = jest.fn().mockResolvedValue(baseTeam)
    setupDefaultMocks({
      teams: {
        currentTeam: {
          ...baseTeam,
          memberships: [],
        },
        updateTeam: jest.fn(),
        loading: false,
        fetchTeamById,
      },
    })

    render(<TeamConfigPage />)

    await waitFor(() => {
      expect(fetchTeamById).toHaveBeenCalledWith('team-1')
    })
  })

  it('uses vertical stepper on compact screens and still renders the same steps', async () => {
    setupDefaultMocks({ mediaQuery: true })
    render(<TeamConfigPage />)

    expect(await screen.findByRole('heading', { name: 'Team profile' })).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Subscription')).toBeInTheDocument()
  })
})
