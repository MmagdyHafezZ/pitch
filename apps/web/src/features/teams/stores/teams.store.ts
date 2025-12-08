'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TeamService } from '../services/teams.service'
import type {
  Team,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  UpdateMemberInput,
} from '../types/teams.types'

type TeamsState = {
  teams: Team[]
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
  updateMember: (teamId: string, userId: string, input: UpdateMemberInput) => Promise<void>
  deleteMember: (teamId: string, userId: string) => Promise<void>

  setActiveTeamId: (id: string | null) => void
}

export const useTeamsStore = create<TeamsState>()(
  persist(
    (set, get) => ({
      teams: [],
      activeTeamId: null,
      currentTeam: null,
      loading: false,
      error: null,

      setActiveTeamId: (id) => set({ activeTeamId: id }),

      // your existing logic stays the same:

      fetchTeams: async () => {
        const { loading, teams } = get()
        if (loading || teams.length > 0) return

        set({ loading: true, error: null })
        try {
          const data = await TeamService.getAll()
          set({
            teams: data,
            activeTeamId: data[0]?.id ?? null,
            currentTeam: data[0] ?? null,
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
        const { loading, teams } = get()
        if (loading || teams.length > 0) return

        set({ loading: true, error: null })
        try {
          const data = await TeamService.getUserTeams()
          set({
            teams: data,
            activeTeamId: data[0]?.id ?? null,
            currentTeam: data[0] ?? null,
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
          set((state) => ({
            loading: false,
            currentTeam: team,
            activeTeamId: id,
            teams: state.teams.some((t) => t.id === id)
              ? state.teams.map((t) => (t.id === id ? team : t))
              : [...state.teams.filter((t) => t.id !== team.id), team],
          }))
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
          return
        }

        set({ loading: true, error: null })
        try {
          const newTeam = await TeamService.create({
            ...input,
            name,
          })

          set((state) => ({
            loading: false,
            currentTeam: newTeam,
            activeTeamId: newTeam.id,
            teams: state.teams.some((t) => t.id === newTeam.id)
              ? state.teams
              : [...state.teams, newTeam],
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to create team',
          })
        }
      },

      updateTeam: async (id: string, input: UpdateTeamInput) => {
        set({ loading: true, error: null })
        try {
          const updated = await TeamService.update(id, input)

          set((state) => ({
            loading: false,
            currentTeam: updated,
            activeTeamId: id,
            teams: state.teams.map((t) => (t.id === id ? updated : t)),
          }))
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
            const remaining = state.teams.filter((t) => t.id !== id)
            const nextActive = remaining[0] ?? null

            return {
              loading: false,
              teams: remaining,
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

          set((state) => ({
            loading: false,
            currentTeam:
              state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
            teams: state.teams.some((t) => t.id === teamId)
              ? state.teams.map((t) => (t.id === teamId ? team : t))
              : [...state.teams, team],
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to add team member',
          })
          throw err
        }
      },

      updateMember: async (teamId: string, userId: string, input: UpdateMemberInput) => {
        set({ loading: true, error: null })
        try {
          await TeamService.updateMember(teamId, userId, input)

          const team = await TeamService.getById(teamId)

          set((state) => ({
            loading: false,
            currentTeam:
              state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
            teams: state.teams.some((t) => t.id === teamId)
              ? state.teams.map((t) => (t.id === teamId ? team : t))
              : [...state.teams, team],
          }))
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

          set((state) => ({
            loading: false,
            currentTeam:
              state.currentTeam && state.currentTeam.id === teamId ? team : state.currentTeam,
            teams: state.teams.some((t) => t.id === teamId)
              ? state.teams.map((t) => (t.id === teamId ? team : t))
              : [...state.teams, team],
          }))
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to remove team member',
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
        activeTeamId: state.activeTeamId,
        currentTeam: state.currentTeam,
      }),
    }
  )
)
