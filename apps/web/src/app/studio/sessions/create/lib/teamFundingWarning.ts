import type { CoinsBalance, PersonalCoinsBalance } from '@/features/coins/hooks/useCoinsBalance'

type TeamLike = {
  id: string
  name?: string | null
  memberships?: Array<{ isActive?: boolean | null } | null> | null
}

export type TeamFundingWarning = {
  reason: 'no_team_plan' | 'team_credits_exhausted'
  teamId: string
  teamName: string
  estimatedCoins: number | null
  personalRemaining: number | null
  canContinue: boolean
}

function countActiveMemberships(team: TeamLike | null | undefined) {
  return team?.memberships?.filter((membership) => membership?.isActive !== false).length ?? 0
}

export function getTeamFundingWarning(args: {
  selectedTeamId: string | null
  teams: TeamLike[]
  teamBalance: CoinsBalance | null | undefined
  personalBalance: PersonalCoinsBalance | null | undefined
  estimatedCoins: number | null
}): TeamFundingWarning | null {
  if (!args.selectedTeamId) return null

  const selectedTeam = args.teams.find((team) => team.id === args.selectedTeamId) ?? null
  if (!selectedTeam || countActiveMemberships(selectedTeam) <= 1) {
    return null
  }

  const reason =
    args.teamBalance?.ok === false
      ? args.teamBalance.reason === 'NO_ACTIVE_SUBSCRIPTION'
        ? 'no_team_plan'
        : null
      : args.teamBalance?.ok === true &&
          args.estimatedCoins != null &&
          args.teamBalance.remaining < args.estimatedCoins
        ? 'team_credits_exhausted'
        : null

  if (!reason) {
    return null
  }

  const personalRemaining = args.personalBalance?.remaining ?? null
  const canContinue =
    args.estimatedCoins == null ||
    personalRemaining == null ||
    personalRemaining >= args.estimatedCoins

  return {
    reason,
    teamId: selectedTeam.id,
    teamName: selectedTeam.name?.trim() || 'This team',
    estimatedCoins: args.estimatedCoins,
    personalRemaining,
    canContinue,
  }
}
