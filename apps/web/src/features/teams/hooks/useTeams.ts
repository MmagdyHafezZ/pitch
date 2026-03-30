import { useTeamsStore } from '../stores/teams.store'

export function useTeams() {
  const teams = useTeamsStore((s) => s.teams)
  const activeTeamId = useTeamsStore((s) => s.activeTeamId)
  const currentTeam = useTeamsStore((s) => s.currentTeam)
  const loading = useTeamsStore((s) => s.loading)
  const error = useTeamsStore((s) => s.error)
  const fetchTeams = useTeamsStore((s) => s.fetchTeams)
  const fetchTeamById = useTeamsStore((s) => s.fetchTeamById)
  const fetchUserTeams = useTeamsStore((s) => s.fetchUserTeams)
  const createTeam = useTeamsStore((s) => s.createTeam)
  const updateTeam = useTeamsStore((s) => s.updateTeam)
  const deleteTeam = useTeamsStore((s) => s.deleteTeam)
  const addMember = useTeamsStore((s) => s.addMember)
  const inviteMember = useTeamsStore((s) => s.inviteMember)
  const sendSignupInvite = useTeamsStore((s) => s.sendSignupInvite)
  const acceptInvite = useTeamsStore((s) => s.acceptInvite)
  const updateMember = useTeamsStore((s) => s.updateMember)
  const deleteMember = useTeamsStore((s) => s.deleteMember)
  const leaveTeam = useTeamsStore((s) => s.leaveTeam)
  const reorderTeams = useTeamsStore((s) => s.reorderTeams)
  const setActiveTeamId = useTeamsStore((s) => s.setActiveTeamId)

  return {
    teams,
    activeTeamId,
    currentTeam,
    loading,
    error,
    fetchTeams,
    fetchTeamById,
    fetchUserTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    inviteMember,
    sendSignupInvite,
    acceptInvite,
    updateMember,
    deleteMember,
    leaveTeam,
    reorderTeams,
    setActiveTeamId,
  }
}
