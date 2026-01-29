export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | string

export interface InvitationSessionSummary {
  id: string
  type: string
  status: string
  createdAt: string
}

export interface Invitation {
  id: string
  sessionId: string
  inviterId: string
  inviterSnapshot?: Record<string, unknown> | null
  inviteeId: string
  inviteeSnapshot?: Record<string, unknown> | null
  status: InvitationStatus
  message?: string | null
  respondedAt?: string | null
  createdAt: string
  updatedAt: string
  session?: InvitationSessionSummary
}

export interface CreateInvitationInput {
  inviteeIds: string[]
  message?: string
  inviterSnapshot?: Record<string, unknown>
}

export interface InvitationListResponse {
  invitations: Invitation[]
  total: number
}

export interface BulkCreateInvitationsResponse {
  invitations: Invitation[]
  created: number
  failed: number
  errors?: string[]
}

export interface DeleteInvitationResponse {
  message: string
  id: string
}

export interface PendingInvitationsCount {
  count: number
}
