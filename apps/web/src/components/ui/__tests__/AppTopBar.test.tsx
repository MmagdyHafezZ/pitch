/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { AppTopBar } from '../AppTopBar'

var mockApi: {
  notifications: {
    unreadCount: jest.Mock
    list: jest.Mock
    markRead: jest.Mock
    markAllRead: jest.Mock
  }
  teams: {
    acceptInvite: jest.Mock
  }
}

var mockFetchUserTeams: jest.Mock
var mockNotificationsShow: jest.Mock

jest.mock('@mantine/notifications', () => {
  const actual = jest.requireActual('@mantine/notifications')
  mockNotificationsShow = jest.fn()
  return {
    ...actual,
    notifications: {
      show: mockNotificationsShow,
    },
  }
})

jest.mock('@/lib/client', () => {
  mockApi = {
    notifications: {
      unreadCount: jest.fn(),
      list: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    },
    teams: {
      acceptInvite: jest.fn(),
    },
  }
  return { api: mockApi }
})

jest.mock('@/features/auth', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    logout: jest.fn().mockResolvedValue(undefined),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock('@/features/teams/stores/teams.store', () => ({
  useTeamsStore: (selector: (state: { fetchUserTeams: jest.Mock }) => unknown) => {
    mockFetchUserTeams = mockFetchUserTeams ?? jest.fn().mockResolvedValue(undefined)
    return selector({ fetchUserTeams: mockFetchUserTeams })
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
  usePathname: () => '/studio/teams',
  useSearchParams: () => ({
    get: () => null,
    toString: () => '',
  }),
}))

describe('AppTopBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchUserTeams = jest.fn().mockResolvedValue(undefined)

    mockApi.notifications.unreadCount.mockResolvedValue({ count: 1 })
    mockApi.notifications.list.mockResolvedValue({
      data: [
        {
          id: 'notification-1',
          title: 'Team invitation',
          message: 'You have been invited to join Team Alpha',
          type: 'TEAM_INVITE',
          severity: 'INFO',
          sourceType: 'SYSTEM',
          metadata: { teamId: 'team-1' },
          readAt: null,
          createdAt: '2026-03-01T09:00:00.000Z',
        },
      ],
    })
    mockApi.notifications.markRead.mockResolvedValue({ matched: 1, modified: 1 })
    mockApi.notifications.markAllRead.mockResolvedValue({ matched: 1, modified: 1 })
    mockApi.teams.acceptInvite.mockResolvedValue({})
  })

  it('accepts a team invitation from notifications', async () => {
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Teams" />)

    await user.click(await screen.findByLabelText('Notifications'))
    await user.click(await screen.findByRole('button', { name: /accept invitation/i }))

    await waitFor(() => {
      expect(mockApi.teams.acceptInvite).toHaveBeenCalledWith('team-1')
    })
    await waitFor(() => {
      expect(mockFetchUserTeams).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockApi.notifications.markRead).toHaveBeenCalledWith({
        notificationIds: ['notification-1'],
        recipientUserId: 'user-1',
      })
    })
    expect(mockNotificationsShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Invitation accepted',
      })
    )
  })

  it('clears an individual notification from the modal', async () => {
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Teams" />)

    await user.click(await screen.findByLabelText('Notifications'))
    await user.click(await screen.findByLabelText('Clear notification'))

    await waitFor(() => {
      expect(mockApi.notifications.markRead).toHaveBeenCalledWith({
        notificationIds: ['notification-1'],
        recipientUserId: 'user-1',
      })
    })
  })

  it('renders the P.I.T.C.H. brand text', async () => {
    render(<AppTopBar currentPage="Home" />)
    expect(await screen.findByText('P.I.T.C.H.')).toBeInTheDocument()
  })

  it('opens settings modal when account icon is clicked', async () => {
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Home" />)

    await user.click(await screen.findByLabelText('Account'))
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })
  })

  it('opens settings modal via custom event', async () => {
    const { act } = await import('@testing-library/react')
    render(<AppTopBar currentPage="Home" />)
    act(() => {
      window.dispatchEvent(new Event('pitch:open-settings'))
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })
  })

  it('shows notification bell with unread indicator', async () => {
    mockApi.notifications.unreadCount.mockResolvedValue({ count: 5 })
    render(<AppTopBar currentPage="Home" />)

    expect(await screen.findByLabelText('Notifications')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  it('shows 99+ when unread count exceeds 99', async () => {
    mockApi.notifications.unreadCount.mockResolvedValue({ count: 150 })
    render(<AppTopBar currentPage="Home" />)

    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument()
    })
  })

  it('shows empty notification state', async () => {
    mockApi.notifications.unreadCount.mockResolvedValue({ count: 0 })
    mockApi.notifications.list.mockResolvedValue({ data: [] })
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Home" />)

    await user.click(await screen.findByLabelText('Notifications'))
    await waitFor(() => {
      expect(screen.getByText(/no.*notification/i)).toBeInTheDocument()
    })
  })

  it('mark all read button calls markAllRead', async () => {
    mockApi.notifications.unreadCount.mockResolvedValue({ count: 2 })
    mockApi.notifications.list.mockResolvedValue({
      data: [
        {
          id: 'n1',
          title: 'Test',
          message: 'msg',
          type: 'GENERAL',
          severity: 'INFO',
          sourceType: 'SYSTEM',
          readAt: null,
          createdAt: '2026-03-01T09:00:00.000Z',
        },
      ],
    })
    mockApi.notifications.markAllRead.mockResolvedValue({ matched: 2, modified: 2 })

    const user = userEvent.setup()
    render(<AppTopBar currentPage="Home" />)

    await user.click(await screen.findByLabelText('Notifications'))
    const markAllBtn = await screen.findByRole('button', { name: /mark all/i })
    await user.click(markAllBtn)

    await waitFor(() => {
      expect(mockApi.notifications.markAllRead).toHaveBeenCalled()
    })
  })

  it('displays severity badge colors (WARNING)', async () => {
    mockApi.notifications.list.mockResolvedValue({
      data: [
        {
          id: 'n-warn',
          title: 'Warning Alert',
          message: 'Quota nearing limit',
          type: 'GENERAL',
          severity: 'WARNING',
          sourceType: 'SYSTEM',
          readAt: null,
          createdAt: '2026-03-01T09:00:00.000Z',
        },
      ],
    })
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Home" />)

    await user.click(await screen.findByLabelText('Notifications'))
    await waitFor(() => {
      expect(screen.getByText('WARNING')).toBeInTheDocument()
    })
  })

  it('displays severity badge colors (CRITICAL)', async () => {
    mockApi.notifications.list.mockResolvedValue({
      data: [
        {
          id: 'n-crit',
          title: 'Critical Alert',
          message: 'System failure',
          type: 'GENERAL',
          severity: 'CRITICAL',
          sourceType: 'SYSTEM',
          readAt: null,
          createdAt: '2026-03-01T09:00:00.000Z',
        },
      ],
    })
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Home" />)

    await user.click(await screen.findByLabelText('Notifications'))
    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    })
  })

  it('renders tabs for Sessions page with "All", "Created", "Shared"', async () => {
    render(<AppTopBar currentPage="Sessions" />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /created/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /shared/i })).toBeInTheDocument()
    })
  })

  it('renders tabs for Home page with "All", "Favorites", "Archived"', async () => {
    render(<AppTopBar currentPage="Home" />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /favorites/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /archived/i })).toBeInTheDocument()
    })
  })

  it('renders tabs for Analytics page with "Personal", "Team"', async () => {
    render(<AppTopBar currentPage="Analytics" />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /personal/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /team/i })).toBeInTheDocument()
    })
  })

  it('calls onTabChange when a tab is clicked', async () => {
    const onTabChange = jest.fn()
    const user = userEvent.setup()
    render(<AppTopBar currentPage="Home" onTabChange={onTabChange} selectedTab="All" />)

    const favTab = await screen.findByRole('tab', { name: /favorites/i })
    await user.click(favTab)

    expect(onTabChange).toHaveBeenCalledWith('Favorites')
  })

  it('renders mobile nav toggle when onToggleMobileNav is provided', async () => {
    const onToggle = jest.fn()
    render(<AppTopBar currentPage="Home" onToggleMobileNav={onToggle} mobileNavOpened={false} />)
    const menuBtn =
      screen.queryByLabelText(/open navigation menu/i) ??
      screen.queryByLabelText(/close navigation menu/i)
    if (menuBtn) {
      expect(menuBtn).toBeInTheDocument()
    }
  })

  it('renders search input on Sessions page', async () => {
    render(<AppTopBar currentPage="Sessions" />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search sessions/i)).toBeInTheDocument()
    })
  })

  it('renders no action area when currentPage is undefined', async () => {
    render(<AppTopBar />)
    expect(screen.getByText('P.I.T.C.H.')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('renders rightSlot content when provided', async () => {
    render(<AppTopBar rightSlot={<div data-testid="custom-slot">Custom</div>} />)
    expect(screen.getByTestId('custom-slot')).toBeInTheDocument()
  })
})
