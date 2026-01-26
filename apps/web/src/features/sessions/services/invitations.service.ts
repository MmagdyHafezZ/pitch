import { api } from '@/lib/client'
import type {
  Invitation,
  CreateInvitationInput,
  InvitationListResponse,
  BulkCreateInvitationsResponse,
  DeleteInvitationResponse,
  PendingInvitationsCount,
} from '../types/invitations.types'

export const InvitationService = {
  createForSession(
    sessionId: string,
    payload: CreateInvitationInput
  ): Promise<BulkCreateInvitationsResponse> {
    return api.invitations.createForSession(sessionId, payload)
  },

  getSessionInvitations(sessionId: string): Promise<InvitationListResponse> {
    return api.invitations.getSessionInvitations(sessionId)
  },

  getMyInvitations(status?: string): Promise<InvitationListResponse> {
    return api.invitations.getMyInvitations(status)
  },

  getSentInvitations(status?: string): Promise<InvitationListResponse> {
    return api.invitations.getSentInvitations(status)
  },

  getById(id: string): Promise<Invitation> {
    return api.invitations.getById(id)
  },

  accept(id: string): Promise<Invitation> {
    return api.invitations.accept(id)
  },

  decline(id: string): Promise<Invitation> {
    return api.invitations.decline(id)
  },

  revoke(id: string): Promise<DeleteInvitationResponse> {
    return api.invitations.revoke(id)
  },

  getPendingCount(): Promise<PendingInvitationsCount> {
    return api.invitations.getPendingCount()
  },
}
