'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { InvitationService } from '../services/invitations.service'
import type {
  Invitation,
  CreateInvitationInput,
  BulkCreateInvitationsResponse,
} from '../types/invitations.types'

type InvitationsState = {
  invitations: Invitation[]
  currentInvitation: Invitation | null
  pendingCount: number
  lastCreateResult: BulkCreateInvitationsResponse | null
  loading: boolean
  error: string | null

  createInvitations: (sessionId: string, input: CreateInvitationInput) => Promise<void>
  fetchSessionInvitations: (sessionId: string) => Promise<void>
  fetchMyInvitations: (status?: string) => Promise<void>
  fetchSentInvitations: (status?: string) => Promise<void>
  fetchInvitationById: (id: string) => Promise<void>
  acceptInvitation: (id: string) => Promise<void>
  declineInvitation: (id: string) => Promise<void>
  revokeInvitation: (id: string) => Promise<void>
  fetchPendingCount: () => Promise<void>
}

const mergeInvitations = (existing: Invitation[], incoming: Invitation[]) => {
  const byId = new Map(existing.map((invitation) => [invitation.id, invitation]))
  for (const invitation of incoming) {
    byId.set(invitation.id, invitation)
  }
  return Array.from(byId.values())
}

const upsertInvitation = (invitations: Invitation[], invitation: Invitation) => {
  const index = invitations.findIndex((item) => item.id === invitation.id)
  if (index === -1) return [...invitations, invitation]

  const next = invitations.slice()
  next[index] = invitation
  return next
}

export const useInvitationsStore = create<InvitationsState>()(
  persist(
    (set, get) => ({
      invitations: [],
      currentInvitation: null,
      pendingCount: 0,
      lastCreateResult: null,
      loading: false,
      error: null,

      createInvitations: async (sessionId: string, input: CreateInvitationInput) => {
        set({ loading: true, error: null })
        try {
          const result = await InvitationService.createForSession(sessionId, input)
          set((state) => ({
            loading: false,
            lastCreateResult: result,
            invitations: mergeInvitations(state.invitations, result.invitations),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to create invitations',
          })
        }
      },

      fetchSessionInvitations: async (sessionId: string) => {
        set({ loading: true, error: null })
        try {
          const data = await InvitationService.getSessionInvitations(sessionId)
          set({
            invitations: data.invitations,
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load session invitations',
          })
        }
      },

      fetchMyInvitations: async (status?: string) => {
        set({ loading: true, error: null })
        try {
          const data = await InvitationService.getMyInvitations(status)
          set({
            invitations: data.invitations,
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load invitations',
          })
        }
      },

      fetchSentInvitations: async (status?: string) => {
        set({ loading: true, error: null })
        try {
          const data = await InvitationService.getSentInvitations(status)
          set({
            invitations: data.invitations,
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load sent invitations',
          })
        }
      },

      fetchInvitationById: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const invitation = await InvitationService.getById(id)
          set((state) => ({
            loading: false,
            currentInvitation: invitation,
            invitations: upsertInvitation(state.invitations, invitation),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load invitation',
          })
        }
      },

      acceptInvitation: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const invitation = await InvitationService.accept(id)
          set((state) => ({
            loading: false,
            currentInvitation: invitation,
            invitations: upsertInvitation(state.invitations, invitation),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to accept invitation',
          })
          throw err
        }
      },

      declineInvitation: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const invitation = await InvitationService.decline(id)
          set((state) => ({
            loading: false,
            currentInvitation: invitation,
            invitations: upsertInvitation(state.invitations, invitation),
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to decline invitation',
          })
          throw err
        }
      },

      revokeInvitation: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await InvitationService.revoke(id)
          set((state) => ({
            loading: false,
            invitations: state.invitations.filter((invitation) => invitation.id !== id),
            currentInvitation: state.currentInvitation?.id === id ? null : state.currentInvitation,
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to revoke invitation',
          })
          throw err
        }
      },

      fetchPendingCount: async () => {
        try {
          const data = await InvitationService.getPendingCount()
          set({ pendingCount: data.count })
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to load pending count',
          })
        }
      },
    }),
    {
      name: 'invitations-store',
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        invitations: state.invitations,
        currentInvitation: state.currentInvitation,
        pendingCount: state.pendingCount,
        lastCreateResult: state.lastCreateResult,
      }),
    }
  )
)
