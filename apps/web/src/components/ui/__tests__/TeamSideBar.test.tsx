/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { TeamSideBar } from '../TeamSideBar'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('TeamSideBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('left-click switches team without opening leave-team menu', async () => {
    const user = userEvent.setup()
    const onSelectTeam = jest.fn()
    const onLeaveTeam = jest.fn()

    render(
      <TeamSideBar
        teams={[
          { id: 'team-1', name: 'Alpha Team', canLeave: true },
          { id: 'team-2', name: 'Bravo Team', canLeave: true },
        ]}
        activeTeamId="team-1"
        onSelectTeam={onSelectTeam}
        onLeaveTeam={onLeaveTeam}
      />
    )

    const bravoButton = screen.getByText('BT').closest('button')
    expect(bravoButton).not.toBeNull()

    await user.click(bravoButton!)

    expect(onSelectTeam).toHaveBeenCalledWith('team-2')
    expect(screen.queryByText('Leave team')).not.toBeInTheDocument()
    expect(onLeaveTeam).not.toHaveBeenCalled()
  })

  it('opens leave-team menu only on right-click and triggers callback', async () => {
    const user = userEvent.setup()
    const onSelectTeam = jest.fn()
    const onLeaveTeam = jest.fn()

    render(
      <TeamSideBar
        teams={[{ id: 'team-1', name: 'Alpha Team', canLeave: true }]}
        activeTeamId="team-1"
        onSelectTeam={onSelectTeam}
        onLeaveTeam={onLeaveTeam}
      />
    )

    const teamButton = screen.getByText('AT').closest('button')
    expect(teamButton).not.toBeNull()

    fireEvent.contextMenu(teamButton!)

    const leaveItem = await screen.findByText('Leave team')
    await user.click(leaveItem)

    expect(onLeaveTeam).toHaveBeenCalledWith({
      id: 'team-1',
      name: 'Alpha Team',
      canLeave: true,
    })
    expect(onSelectTeam).not.toHaveBeenCalled()
  })

  it('does not open team actions menu for non-leavable teams on right-click', async () => {
    const onSelectTeam = jest.fn()
    const onLeaveTeam = jest.fn()

    render(
      <TeamSideBar
        teams={[{ id: 'team-1', name: 'Owner Team', canLeave: false }]}
        activeTeamId="team-1"
        onSelectTeam={onSelectTeam}
        onLeaveTeam={onLeaveTeam}
      />
    )

    const teamButton = screen.getByText('OT').closest('button')
    expect(teamButton).not.toBeNull()

    fireEvent.contextMenu(teamButton!)

    await waitFor(() => {
      expect(screen.queryByText('Leave team')).not.toBeInTheDocument()
    })
    expect(onLeaveTeam).not.toHaveBeenCalled()
  })
})
