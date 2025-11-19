import { create } from 'zustand'
import { TeamService } from '../services/teams.service'
import type { Team } from '../types/teams.types'

type TeamsState = {
  teams: Team[]
  activeTeamId: string | null
  currentTeam: Team | null
  loading: boolean
  error: string | null

  fetchTeams: () => Promise<void>
  fetchTeamById: (id: string) => Promise<void>
  createTeam: (name: string) => Promise<void>
  setActiveTeamId: (id: string | null) => void
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [],
  activeTeamId: null,
  currentTeam: null,
  loading: false,
  error: null,

  setActiveTeamId: (id) => set({ activeTeamId: id }),

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
          : [...state.teams, team],
      }))
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load team details',
      })
    }
  },

  createTeam: async (name: string) => {
    if (!name.trim()) return

    set({ loading: true, error: null })
    try {
      const newTeam = await TeamService.create({ name })

      set((state) => ({
        loading: false,
        currentTeam: newTeam,
        activeTeamId: newTeam.id,
        teams: [...state.teams, newTeam],
      }))
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to create team',
      })
    }
  },
}))
