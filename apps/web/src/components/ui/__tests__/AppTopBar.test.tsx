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
})
