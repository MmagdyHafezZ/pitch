import { getTeamFundingWarning } from '../teamFundingWarning'

describe('getTeamFundingWarning', () => {
  const sharedTeam = {
    id: 'team-1',
    name: 'Pitch Team',
    memberships: [{ isActive: true }, { isActive: true }],
  }

  it('returns a warning when a shared team has no active team plan', () => {
    const warning = getTeamFundingWarning({
      selectedTeamId: 'team-1',
      teams: [sharedTeam],
      teamBalance: { ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' },
      personalBalance: {
        ok: true,
        userId: 'user-1',
        periodKey: 'personal:user-1:2026-03',
        allowance: 500,
        remaining: 400,
      },
      estimatedCoins: 120,
    })

    expect(warning).toEqual(
      expect.objectContaining({
        reason: 'no_team_plan',
        teamName: 'Pitch Team',
        estimatedCoins: 120,
        personalRemaining: 400,
        canContinue: true,
      })
    )
  })

  it('returns a warning when a shared team is short on credits for the estimate', () => {
    const warning = getTeamFundingWarning({
      selectedTeamId: 'team-1',
      teams: [sharedTeam],
      teamBalance: {
        ok: true,
        teamId: 'team-1',
        periodKey: 'sub-1:period',
        allowance: 1000,
        remaining: 80,
      },
      personalBalance: {
        ok: true,
        userId: 'user-1',
        periodKey: 'personal:user-1:2026-03',
        allowance: 500,
        remaining: 40,
      },
      estimatedCoins: 120,
    })

    expect(warning).toEqual(
      expect.objectContaining({
        reason: 'team_credits_exhausted',
        canContinue: false,
      })
    )
  })

  it('does not warn for a personal workspace selection', () => {
    const warning = getTeamFundingWarning({
      selectedTeamId: 'team-personal',
      teams: [
        {
          id: 'team-personal',
          name: 'My Workspace',
          memberships: [{ isActive: true }],
        },
      ],
      teamBalance: { ok: false, reason: 'NO_ACTIVE_SUBSCRIPTION' },
      personalBalance: {
        ok: true,
        userId: 'user-1',
        periodKey: 'personal:user-1:2026-03',
        allowance: 500,
        remaining: 400,
      },
      estimatedCoins: 120,
    })

    expect(warning).toBeNull()
  })
})
