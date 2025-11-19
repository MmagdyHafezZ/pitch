import { useTeamsStore } from '../stores/teams.store'

export function useTeams() {
  const teams = useTeamsStore((s) => s.teams)
  const activeTeamId = useTeamsStore((s) => s.activeTeamId)
  const currentTeam = useTeamsStore((s) => s.currentTeam)
  const loading = useTeamsStore((s) => s.loading)
  const error = useTeamsStore((s) => s.error)
  const fetchTeams = useTeamsStore((s) => s.fetchTeams)
  const fetchTeamById = useTeamsStore((s) => s.fetchTeamById)
  const createTeam = useTeamsStore((s) => s.createTeam)
  const setActiveTeamId = useTeamsStore((s) => s.setActiveTeamId)

  return {
    teams,
    activeTeamId,
    currentTeam,
    loading,
    error,
    fetchTeams,
    fetchTeamById,
    createTeam,
    setActiveTeamId,
  }
}
