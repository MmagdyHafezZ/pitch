'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TeamService } from '../services/teams.service'
import type {
  Team,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  InviteMemberInput,
  SendSignupInviteInput,
  UpdateMemberInput,
} from '../types/teams.types'

function orderTeamsByIds(teams: Team[], orderedIds: string[]): Team[] {
  if (teams.length <= 1 || orderedIds.length === 0) return teams

  const remainingTeams = new Map(teams.map((team) => [team.id, team]))
  const orderedTeams: Team[] = []

  orderedIds.forEach((teamId) => {
    const team = remainingTeams.get(teamId)
    if (!team) return

    orderedTeams.push(team)
    remainingTeams.delete(teamId)
  })

  remainingTeams.forEach((team) => {
    orderedTeams.push(team)
  })

  return orderedTeams
}

const getTeamOrderIds = (teams: Team[]) => teams.map((team) => team.id)

const syncCurrentTeam = (teams: Team[], currentTeam: Team | null) =>
  currentTeam ? (teams.find((team) => team.id === currentTeam.id) ?? currentTeam) : null

const upsertAndOrderTeams = (teams: Team[], team: Team, orderedIds: string[]) =>
  orderTeamsByIds(
    teams.some((existingTeam) => existingTeam.id === team.id)
      ? teams.map((existingTeam) => (existingTeam.id === team.id ? team : existingTeam))
      : [...teams, team],
    orderedIds
  )

type TeamsState = {
  teams: Team[]
  teamOrderIds: string[]
  activeTeamId: string | null
  currentTeam: Team | null
  loading: boolean
  error: string | null

  fetchTeams: () => Promise<void>
  fetchTeamById: (id: string) => Promise<void>
  fetchUserTeams: () => Promise<void>
  createTeam: (input: CreateTeamInput) => Promise<void>
  updateTeam: (id: string, input: UpdateTeamInput) => Promise<void>
  deleteTeam: (id: string) => Promise<void>

  addMember: (teamId: string, input: AddMemberInput) => Promise<void>
  inviteMember: (teamId: string, input: InviteMemberInput) => Promise<void>
  sendSignupInvite: (teamId: string, input: SendSignupInviteInput) => Promise<void>
  acceptInvite: (teamId: string) => Promise<void>
  updateMember: (teamId: string, userId: string, input: UpdateMemberInput) => Promise<void>
  deleteMember: (teamId: string, userId: string) => Promise<void>
  leaveTeam: (teamId: string, userId: string) => Promise<void>

  reorderTeams: (teamIds: string[]) => void
  setActiveTeamId: (id: string | null) => void
  resetStore: () => void
}

export const useTeamsStore = create<TeamsState>()(
  persist(
    (set, get) => ({
      teams: [],
      teamOrderIds: [],
      activeTeamId: null,
      currentTeam: null,
      loading: false,
      error: null,

      setActiveTeamId: (id) => set({ activeTeamId: id }),
      reorderTeams: (teamIds) =>
        set((state) => {
          const orderedTeams = orderTeamsByIds(state.teams, teamIds)

          return {
            teams: orderedTeams,
            teamOrderIds: getTeamOrderIds(orderedTeams),
            currentTeam: syncCurrentTeam(orderedTeams, state.currentTeam),
          }
        }),
      resetStore: () =>
        set({
          teams: [],
          teamOrderIds: [],
          activeTeamId: null,
          currentTeam: null,
          loading: false,
          error: null,
        }),

      fetchTeams: async () => {
        const { loading, teams, teamOrderIds } = get()
        if (loading || teams.length > 0) return

        set({ loading: true, error: null })
        try {
          const data = await TeamService.getAll()
          const orderedTeams = orderTeamsByIds(data, teamOrderIds)

          set({
            teams: orderedTeams,
            teamOrderIds: getTeamOrderIds(orderedTeams),
            activeTeamId: orderedTeams[0]?.id ?? null,
            currentTeam: orderedTeams[0] ?? null,
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load teams',
          })
        }
      },

      fetchUserTeams: async () => {
        const {
          loading,
          activeTeamId: previousActiveTeamId,
          teamOrderIds: previousTeamOrderIds,
        } = get()
        if (loading) return

        // Always refresh from the user-scoped endpoint to avoid stale persisted team lists
        // (e.g. after switching accounts in the same browser session).
        set({
          loading: true,
          error: null,
          teams: [],
          activeTeamId: null,
          currentTeam: null,
        })
        try {
          const data = await TeamService.getUserTeams()
          const orderedTeams = orderTeamsByIds(data, previousTeamOrderIds)
          const nextActiveTeam =
            (previousActiveTeamId
              ? orderedTeams.find((team) => team.id === previousActiveTeamId)
              : null) ??
            orderedTeams[0] ??
            null

          set({
            teams: orderedTeams,
            teamOrderIds: getTeamOrderIds(orderedTeams),
            activeTeamId: nextActiveTeam?.id ?? null,
            currentTeam: nextActiveTeam,
            loading: false,
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load teams',
          })
        }
      },

      fetchTeamById: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const team = await TeamService.getById(id)
          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, team, state.teamOrderIds)

            return {
              loading: false,
              currentTeam: team,
              activeTeamId: id,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load team details',
          })
        }
      },

      createTeam: async (input: CreateTeamInput) => {
        const name = input.name?.trim()
        if (!name) {
          set({ error: 'Team name is required' })
          throw new Error('Team name is required')
        }

        set({ loading: true, error: null })
        try {
          const newTeam = await TeamService.create({
            ...input,
            name,
          })

          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, newTeam, state.teamOrderIds)

            return {
              loading: false,
              currentTeam: newTeam,
              activeTeamId: newTeam.id,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to create team',
          })
          throw err
        }
      },

      updateTeam: async (id: string, input: UpdateTeamInput) => {
        set({ loading: true, error: null })
        try {
          const updated = await TeamService.update(id, input)

          set((state) => {
            const orderedTeams = orderTeamsByIds(
              state.teams.map((team) => (team.id === id ? updated : team)),
              state.teamOrderIds
            )

            return {
              loading: false,
              currentTeam: updated,
              activeTeamId: id,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to update team',
          })
          throw err
        }
      },

      deleteTeam: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await TeamService.delete(id)

          set((state) => {
            const remaining = state.teams.filter((team) => team.id !== id)
            const nextActive = remaining[0] ?? null

            return {
              loading: false,
              teams: remaining,
              teamOrderIds: getTeamOrderIds(remaining),
              currentTeam: nextActive,
              activeTeamId: nextActive?.id ?? null,
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to delete team',
          })
          throw err
        }
      },

      addMember: async (teamId: string, input: AddMemberInput) => {
        set({ loading: true, error: null })
        try {
          await TeamService.addMember(teamId, input)

          const team = await TeamService.getById(teamId)

          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, team, state.teamOrderIds)

            return {
              loading: false,
              currentTeam:
                state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to add team member',
          })
          throw err
        }
      },

      inviteMember: async (teamId: string, input: InviteMemberInput) => {
        set({ loading: true, error: null })
        try {
          await TeamService.inviteMember(teamId, input)

          const team = await TeamService.getById(teamId)

          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, team, state.teamOrderIds)

            return {
              loading: false,
              currentTeam:
                state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to invite team member',
          })
          throw err
        }
      },

      sendSignupInvite: async (teamId: string, input: SendSignupInviteInput) => {
        set({ loading: true, error: null })
        try {
          await TeamService.sendSignupInvite(teamId, input)
          set({ loading: false })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to send signup invitation',
          })
          throw err
        }
      },

      acceptInvite: async (teamId: string) => {
        set({ loading: true, error: null })
        try {
          await TeamService.acceptInvite(teamId)
          const team = await TeamService.getById(teamId)

          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, team, state.teamOrderIds)

            return {
              loading: false,
              currentTeam:
                state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to accept invite',
          })
          throw err
        }
      },

      updateMember: async (teamId: string, userId: string, input: UpdateMemberInput) => {
        set({ loading: true, error: null })
        try {
          await TeamService.updateMember(teamId, userId, input)

          const team = await TeamService.getById(teamId)

          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, team, state.teamOrderIds)

            return {
              loading: false,
              currentTeam:
                state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to update team member',
          })
          throw err
        }
      },

      deleteMember: async (teamId: string, userId: string) => {
        set({ loading: true, error: null })
        try {
          await TeamService.removeMember(teamId, userId)

          const team = await TeamService.getById(teamId)

          set((state) => {
            const orderedTeams = upsertAndOrderTeams(state.teams, team, state.teamOrderIds)

            return {
              loading: false,
              currentTeam:
                state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
              teams: orderedTeams,
              teamOrderIds: getTeamOrderIds(orderedTeams),
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to remove team member',
          })
          throw err
        }
      },

      leaveTeam: async (teamId: string, userId: string) => {
        set({ loading: true, error: null })
        try {
          await TeamService.removeMember(teamId, userId)

          set((state) => {
            const remaining = state.teams.filter((team) => team.id !== teamId)
            const nextActiveId =
              state.activeTeamId === teamId ? (remaining[0]?.id ?? null) : state.activeTeamId
            const nextCurrentTeam =
              state.currentTeam?.id === teamId
                ? (remaining.find((team) => team.id === nextActiveId) ?? null)
                : state.currentTeam

            return {
              loading: false,
              teams: remaining,
              teamOrderIds: getTeamOrderIds(remaining),
              activeTeamId: nextActiveId,
              currentTeam: nextCurrentTeam,
            }
          })
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to leave team',
          })
          throw err
        }
      },
    }),
    {
      name: 'teams-store',
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        teams: state.teams,
        teamOrderIds: state.teamOrderIds,
        activeTeamId: state.activeTeamId,
        currentTeam: state.currentTeam,
      }),
    }
  )
)
