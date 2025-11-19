import { api } from '@/lib/client'
import type {
  Team,
  TeamMembership,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  UpdateMemberInput,
} from '../types/teams.types'

export const TeamService = {
  // GET /v1/teams
  getAll(): Promise<Team[]> {
    return api.teams.getAll()
  },

  // GET /v1/teams/:id
  getById(id: string): Promise<Team> {
    return api.teams.getById(id)
  },

  // POST /v1/teams
  create(payload: CreateTeamInput): Promise<Team> {
    return api.teams.create(payload)
  },

  // PUT /v1/teams/:id
  update(id: string, payload: UpdateTeamInput): Promise<Team> {
    return api.teams.update(id, payload)
  },

  // DELETE /v1/teams/:id
  delete(id: string): Promise<void> {
    return api.teams.delete(id)
  },

  // POST /v1/teams/:teamId/members
  addMember(teamId: string, payload: AddMemberInput): Promise<TeamMembership> {
    return api.teams.addMember(teamId, payload)
  },

  // PUT /v1/teams/:teamId/members/:userId
  updateMember(
    teamId: string,
    userId: string,
    payload: UpdateMemberInput
  ): Promise<TeamMembership> {
    return api.teams.updateMember(teamId, userId, payload)
  },

  // DELETE /v1/teams/:teamId/members/:userId
  removeMember(teamId: string, userId: string): Promise<void> {
    return api.teams.deleteMember(teamId, userId, undefined as any)
  },
}
