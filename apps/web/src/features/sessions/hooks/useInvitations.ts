import { useInvitationsStore } from '../stores/invitations.store'

export function useInvitations() {
  const invitations = useInvitationsStore((s) => s.invitations)
  const currentInvitation = useInvitationsStore((s) => s.currentInvitation)
  const pendingCount = useInvitationsStore((s) => s.pendingCount)
  const lastCreateResult = useInvitationsStore((s) => s.lastCreateResult)
  const loading = useInvitationsStore((s) => s.loading)
  const error = useInvitationsStore((s) => s.error)
  const createInvitations = useInvitationsStore((s) => s.createInvitations)
  const fetchSessionInvitations = useInvitationsStore((s) => s.fetchSessionInvitations)
  const fetchMyInvitations = useInvitationsStore((s) => s.fetchMyInvitations)
  const fetchSentInvitations = useInvitationsStore((s) => s.fetchSentInvitations)
  const fetchInvitationById = useInvitationsStore((s) => s.fetchInvitationById)
  const acceptInvitation = useInvitationsStore((s) => s.acceptInvitation)
  const declineInvitation = useInvitationsStore((s) => s.declineInvitation)
  const revokeInvitation = useInvitationsStore((s) => s.revokeInvitation)
  const fetchPendingCount = useInvitationsStore((s) => s.fetchPendingCount)

  return {
    invitations,
    currentInvitation,
    pendingCount,
    lastCreateResult,
    loading,
    error,
    createInvitations,
    fetchSessionInvitations,
    fetchMyInvitations,
    fetchSentInvitations,
    fetchInvitationById,
    acceptInvitation,
    declineInvitation,
    revokeInvitation,
    fetchPendingCount,
  }
}
