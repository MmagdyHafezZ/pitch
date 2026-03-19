/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import TeamConfigPage from '../page'

var mockPush: jest.Mock
var mockBack: jest.Mock
var mockUseTeams: jest.Mock
var mockUseAuth: jest.Mock
var mockUseCreateTeamForm: jest.Mock
var mockUseMediaQuery: jest.Mock
var mockTeamMembersPanel: jest.Mock
var mockTeamSubscriptionPanel: jest.Mock
var mockTeamServiceGetAll: jest.Mock
var searchMode: string | null = null
var searchTeamId: string | null = null
var searchTeamView: string | null = null

jest.mock('next/navigation', () => ({
  useRouter: () => {
    mockPush ??= jest.fn()
    mockBack ??= jest.fn()
    return {
      push: mockPush,
      replace: jest.fn(),
      back: mockBack,
    }
  },
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'mode') return searchMode
      if (key === 'teamId') return searchTeamId
      if (key === 'teamView') return searchTeamView
      return null
    },
    toString: () => '',
  }),
}))

jest.mock('@/features/teams/services/teams.service', () => ({
  TeamService: {
    getAll: (...args: any[]) => {
      mockTeamServiceGetAll ??= jest.fn()
      return mockTeamServiceGetAll(...args)
    },
  },
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
  mockBack = jest.fn()
  mockUseMediaQuery = jest.fn().mockReturnValue(overrides?.mediaQuery ?? false)
  mockTeamMembersPanel = jest.fn()
  mockTeamSubscriptionPanel = jest.fn()
  mockTeamServiceGetAll = jest.fn().mockResolvedValue([baseTeam])

  mockUseAuth = jest.fn().mockReturnValue(
    overrides?.auth ?? {
      user: { id: 'user-1', email: 'owner@example.com', name: 'Owner User' },
    }
  )

  mockUseTeams = jest.fn().mockReturnValue(
    overrides?.teams ?? {
      teams: [baseTeam],
      activeTeamId: 'team-1',
      currentTeam: baseTeam,
      updateTeam: jest.fn().mockResolvedValue(undefined),
      loading: false,
      fetchTeamById: jest.fn().mockResolvedValue(baseTeam),
      setActiveTeamId: jest.fn(),
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
    searchTeamId = null
    searchTeamView = null
    setupDefaultMocks()
  })

  it('renders the team list in default mode', async () => {
    render(<TeamConfigPage />)

    expect(await screen.findByRole('heading', { name: 'All Teams' })).toBeInTheDocument()
    expect(await screen.findByText('Pitch Team')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
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

  it('opens edit mode when teamId is present', async () => {
    searchTeamId = 'team-1'
    render(<TeamConfigPage />)

    expect(await screen.findByRole('heading', { name: 'Team profile' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Pitch Team')).toBeInTheDocument()
  })

  it('hides Edit button in My Teams view when user is not owner', async () => {
    searchTeamView = 'My Teams'
    setupDefaultMocks({
      auth: { user: { id: 'user-2', email: 'member@example.com' } },
      teams: {
        teams: [
          {
            ...baseTeam,
            memberships: [
              {
                id: 'm2',
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
        ],
        activeTeamId: 'team-1',
        currentTeam: baseTeam,
        updateTeam: jest.fn(),
        loading: false,
        fetchTeamById: jest.fn(),
        setActiveTeamId: jest.fn(),
      },
    })

    render(<TeamConfigPage />)
    expect(await screen.findByRole('heading', { name: 'My Teams' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
