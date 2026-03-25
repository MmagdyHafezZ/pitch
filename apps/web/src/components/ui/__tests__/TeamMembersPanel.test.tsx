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
            isActive: false,
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
    expect(within(table).getAllByText('In team').length).toBeGreaterThan(0)
    expect(within(table).getByText('Pending')).toBeInTheDocument()
    expect(within(table).getByText('Not in team')).toBeInTheDocument()
    const outsideRow = within(table).getByRole('row', {
      name: /Outside User outside@example.com Not in team/i,
    })
    expect(within(outsideRow).getByRole('button')).toBeInTheDocument()

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
      expect(sendSignupInvite).toHaveBeenCalledWith('team-1', {
        email: 'new@example.com',
        role: 'MEMBER',
      })
    })
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Signup invitation sent',
      })
    )
  })

  it('shows "No team selected" when currentTeam is null', async () => {
    mockUseTeams.mockReturnValue({
      currentTeam: null,
      addMember: jest.fn(),
      inviteMember: jest.fn(),
      sendSignupInvite: jest.fn(),
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
      loading: false,
    })

    render(<TeamMembersPanel />)
    expect(await screen.findByText(/no team selected/i)).toBeInTheDocument()
  })

  it('shows loading spinner while org users are loading', async () => {
    render(<TeamMembersPanel />)
    expect(await screen.findByText('Owner User')).toBeInTheDocument()
  })

  it('filters users by search input', async () => {
    const user = userEvent.setup()
    render(<TeamMembersPanel />)

    expect(await screen.findByText('Owner User')).toBeInTheDocument()
    expect(screen.getByText('Outside User')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search by name or email'), 'owner')

    await waitFor(() => {
      expect(screen.getByText('Owner User')).toBeInTheDocument()
      expect(screen.queryByText('Outside User')).not.toBeInTheDocument()
    })
  })

  it('invites an existing org user via quick-invite button', async () => {
    const inviteMember = jest.fn().mockResolvedValue(undefined)
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
        ],
      },
      addMember: jest.fn(),
      inviteMember,
      sendSignupInvite: jest.fn(),
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
      loading: false,
    })

    const user = userEvent.setup()
    render(<TeamMembersPanel />)

    await screen.findByText('Outside User')
    const table = screen.getByRole('table')
    const outsideRow = within(table).getByRole('row', {
      name: /Outside User outside@example.com Not in team/i,
    })
    const inviteBtn = within(outsideRow).getByRole('button')
    await user.click(inviteBtn)

    await waitFor(() => {
      expect(inviteMember).toHaveBeenCalledWith('team-1', { userId: 'u3', role: 'MEMBER' })
    })
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invitation sent' })
    )
  })

  it('shows validation error for invalid email in invite form', async () => {
    const user = userEvent.setup()
    mockUseTeams.mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Pitch Team', memberships: [] },
      addMember: jest.fn(),
      sendSignupInvite: jest.fn(),
      inviteMember: jest.fn(),
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
      loading: false,
    })

    render(<TeamMembersPanel />)
    await user.type(await screen.findByPlaceholderText('teammate@company.com'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /^Invite$/ }))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    })
  })

  it('invites by email a user that matches an existing org user', async () => {
    const inviteMember = jest.fn().mockResolvedValue(undefined)
    mockUseTeams.mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Pitch Team', memberships: [] },
      addMember: jest.fn(),
      sendSignupInvite: jest.fn(),
      inviteMember,
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
      loading: false,
    })

    const user = userEvent.setup()
    render(<TeamMembersPanel />)

    await user.type(await screen.findByPlaceholderText('teammate@company.com'), 'owner@example.com')
    await user.click(screen.getByRole('button', { name: /^Invite$/ }))

    await waitFor(() => {
      expect(inviteMember).toHaveBeenCalledWith('team-1', { userId: 'u1', role: 'MEMBER' })
    })
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invitation sent' })
    )
  })

  it('displays member stats correctly', async () => {
    render(<TeamMembersPanel />)

    expect(await screen.findByText('Active members')).toBeInTheDocument()
    expect(screen.getByText('Admins / Owners')).toBeInTheDocument()
    expect(screen.getByText('Pending invites')).toBeInTheDocument()
  })

  it('shows "No users match the current filters" when search has no results', async () => {
    const user = userEvent.setup()
    render(<TeamMembersPanel />)

    await screen.findByText('Owner User')
    await user.type(screen.getByPlaceholderText('Search by name or email'), 'nonexistent-user-xyz')

    await waitFor(() => {
      expect(screen.getByText('No users match the current filters.')).toBeInTheDocument()
    })
  })

  it('shows invite error when inviteMember API fails', async () => {
    const inviteMember = jest.fn().mockRejectedValue(new Error('Server error'))
    mockUseTeams.mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Pitch Team', memberships: [] },
      addMember: jest.fn(),
      sendSignupInvite: jest.fn(),
      inviteMember,
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
      loading: false,
    })

    const user = userEvent.setup()
    render(<TeamMembersPanel />)

    await user.type(await screen.findByPlaceholderText('teammate@company.com'), 'owner@example.com')
    await user.click(screen.getByRole('button', { name: /^Invite$/ }))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('displays pending email invites section when present', async () => {
    mockUseTeams.mockReturnValue({
      currentTeam: {
        id: 'team-1',
        name: 'Pitch Team',
        memberships: [],
        metadata: {
          pendingSignupInvites: [
            { email: 'pending@example.com', role: 'MEMBER', invitedAt: '2026-03-01T00:00:00.000Z' },
          ],
        },
      },
      addMember: jest.fn(),
      inviteMember: jest.fn(),
      sendSignupInvite: jest.fn(),
      updateMember: jest.fn(),
      deleteMember: jest.fn(),
      loading: false,
    })

    render(<TeamMembersPanel />)

    expect(await screen.findByText('Pending email invites')).toBeInTheDocument()
    expect(screen.getAllByText('pending@example.com').length).toBeGreaterThanOrEqual(1)
  })
})
