/**
 * @jest-environment jsdom
 */
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { TeamMembersPanel } from '../TeamMembersPanel'
import { notifications } from '@mantine/notifications'

var mockApi: {
  users: { getAll: jest.Mock }
}

var mockUseTeams: jest.Mock

jest.mock('@mantine/notifications', () => {
  const actual = jest.requireActual('@mantine/notifications')
  return {
    ...actual,
    notifications: {
      show: jest.fn(),
    },
  }
})

jest.mock('@/lib/client', () => {
  mockApi = {
    users: {
      getAll: jest.fn(),
    },
  }
  return { api: mockApi }
})

jest.mock('@/features/teams/hooks/useTeams', () => {
  mockUseTeams = jest.fn()
  return {
    useTeams: () => mockUseTeams(),
  }
})

describe('TeamMembersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockApi.users.getAll.mockResolvedValue([
      { id: 'u1', name: 'Owner User', email: 'owner@example.com', avatarUrl: 'https://img/1.png' },
      { id: 'u2', name: 'Pending User', email: 'pending@example.com' },
      { id: 'u3', name: 'Outside User', email: 'outside@example.com' },
    ])

    mockUseTeams.mockReturnValue({
      currentTeam: {
        id: 'team-1',
        name: 'Pitch Team',
        memberships: [
          {
            id: 'm1',
            teamId: 'team-1',
            userId: 'u1',
            role: 'OWNER',
            tokenLimit: 0,
            isActive: true,
            acceptedAt: '2026-02-01T00:00:00.000Z',
            invitedByUserId: 'u1',
            user: { id: 'u1', name: 'Owner User', email: 'owner@example.com', isActive: true },
          },
          {
            id: 'm2',
            teamId: 'team-1',
            userId: 'u2',
            role: 'MEMBER',
            tokenLimit: 5,
            isActive: true,
            acceptedAt: null,
            invitedByUserId: 'u1',
            user: {
              id: 'u2',
              name: 'Pending User',
              email: 'pending@example.com',
              isActive: true,
              invitedAt: '2026-02-05T00:00:00.000Z',
            },
          },
        ],
      },
      addMember: jest.fn().mockResolvedValue(undefined),
      inviteMember: jest.fn().mockResolvedValue(undefined),
      sendSignupInvite: jest.fn().mockResolvedValue(undefined),
      updateMember: jest.fn().mockResolvedValue(undefined),
      deleteMember: jest.fn().mockResolvedValue(undefined),
      loading: false,
    })
  })

  it('shows all org users with team statuses and invite action for non-members', async () => {
    render(<TeamMembersPanel />)

    expect(await screen.findByText('Owner User')).toBeInTheDocument()
    expect(screen.getByText('Pending User')).toBeInTheDocument()
    expect(screen.getByText('Outside User')).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getByText('In team')).toBeInTheDocument()
    expect(within(table).getByText('Pending')).toBeInTheDocument()
    expect(within(table).getByText('Not in team')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: /invite to team/i })).toBeInTheDocument()

    const rows = within(table).getAllByRole('row')
    const dataRows = rows.slice(1)
    expect(dataRows).toHaveLength(3)

    expect(within(dataRows[0]).getByText('Owner User')).toBeInTheDocument()
    expect(screen.getByText('Pending User')).toBeInTheDocument()
    expect(screen.getByText('Outside User')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockApi.users.getAll).toHaveBeenCalledTimes(1)
    })
  })

  it('sends signup invite email when typed email has no matching user account', async () => {
    const user = userEvent.setup()
    const sendSignupInvite = jest.fn().mockResolvedValue(undefined)
    mockUseTeams.mockReturnValue({
      currentTeam: {
        id: 'team-1',
        name: 'Pitch Team',
        memberships: [],
      },
      addMember: jest.fn().mockResolvedValue(undefined),
      sendSignupInvite,
      inviteMember: jest.fn().mockResolvedValue(undefined),
      updateMember: jest.fn().mockResolvedValue(undefined),
      deleteMember: jest.fn().mockResolvedValue(undefined),
      loading: false,
    })

    render(<TeamMembersPanel />)

    await user.type(await screen.findByPlaceholderText('teammate@company.com'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /^Invite$/ }))

    await waitFor(() => {
      expect(sendSignupInvite).toHaveBeenCalledWith('team-1', { email: 'new@example.com' })
    })
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Signup invitation sent',
      })
    )
  })
})
