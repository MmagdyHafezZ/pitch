import { TeamService } from '../teams.service'
import { api } from '@/lib/client'
import type { Team, TeamMembership } from '../../types/teams.types'

const makeTeam = (overrides: Partial<Team> = {}): Team =>
  ({
    id: 'team_1',
    name: 'Test Team',
    orgId: 'org_1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }) as Team

const makeMembership = (overrides: Partial<TeamMembership> = {}): TeamMembership =>
  ({
    id: 'membership_1',
    teamId: 'team_1',
    userId: 'user_1',
    role: 'member',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }) as TeamMembership

describe('TeamService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  describe('getAll', () => {
    it('should delegate to api.teams.getAll and return teams', async () => {
      const teams = [makeTeam()]
      jest.spyOn(api.teams, 'getAll').mockResolvedValueOnce(teams)

      const result = await TeamService.getAll()

      expect(api.teams.getAll).toHaveBeenCalled()
      expect(result).toEqual(teams)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'getAll').mockRejectedValueOnce(new Error('Unauthorized'))

      await expect(TeamService.getAll()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getById', () => {
    it('should delegate to api.teams.getById', async () => {
      const team = makeTeam({ id: 'team_5' })
      jest.spyOn(api.teams, 'getById').mockResolvedValueOnce(team)

      const result = await TeamService.getById('team_5')

      expect(api.teams.getById).toHaveBeenCalledWith('team_5')
      expect(result).toEqual(team)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'getById').mockRejectedValueOnce(new Error('Not found'))

      await expect(TeamService.getById('bad_id')).rejects.toThrow('Not found')
    })
  })

  describe('getUserTeams', () => {
    it('should delegate to api.teams.getUserTeams', async () => {
      const teams = [makeTeam(), makeTeam({ id: 'team_2' })]
      jest.spyOn(api.teams, 'getUserTeams').mockResolvedValueOnce(teams)

      const result = await TeamService.getUserTeams()

      expect(api.teams.getUserTeams).toHaveBeenCalled()
      expect(result).toEqual(teams)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'getUserTeams').mockRejectedValueOnce(new Error('Error'))

      await expect(TeamService.getUserTeams()).rejects.toThrow('Error')
    })
  })

  describe('create', () => {
    it('should delegate to api.teams.create and return the new team', async () => {
      const team = makeTeam({ name: 'New Team' })
      jest.spyOn(api.teams, 'create').mockResolvedValueOnce(team)

      const payload = { name: 'New Team', orgId: 'org_1' }
      const result = await TeamService.create(payload)

      expect(api.teams.create).toHaveBeenCalledWith(payload)
      expect(result).toEqual(team)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'create').mockRejectedValueOnce(new Error('Create failed'))

      await expect(TeamService.create({ name: 'Bad', orgId: 'org_1' })).rejects.toThrow(
        'Create failed'
      )
    })
  })

  describe('update', () => {
    it('should delegate to api.teams.update and return the updated team', async () => {
      const team = makeTeam({ name: 'Updated Team' })
      jest.spyOn(api.teams, 'update').mockResolvedValueOnce(team)

      const result = await TeamService.update('team_1', { name: 'Updated Team' })

      expect(api.teams.update).toHaveBeenCalledWith('team_1', { name: 'Updated Team' })
      expect(result).toEqual(team)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'update').mockRejectedValueOnce(new Error('Update failed'))

      await expect(TeamService.update('team_1', {})).rejects.toThrow('Update failed')
    })
  })

  describe('delete', () => {
    it('should delegate to api.teams.delete', async () => {
      jest.spyOn(api.teams, 'delete').mockResolvedValueOnce(undefined)

      await TeamService.delete('team_1')

      expect(api.teams.delete).toHaveBeenCalledWith('team_1')
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'delete').mockRejectedValueOnce(new Error('Delete failed'))

      await expect(TeamService.delete('team_1')).rejects.toThrow('Delete failed')
    })
  })

  describe('addMember', () => {
    it('should delegate to api.teams.addMember and return the membership', async () => {
      const membership = makeMembership()
      jest.spyOn(api.teams, 'addMember').mockResolvedValueOnce(membership)

      const payload = { userId: 'user_1', role: 'member' }
      const result = await TeamService.addMember('team_1', payload)

      expect(api.teams.addMember).toHaveBeenCalledWith('team_1', payload)
      expect(result).toEqual(membership)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'addMember').mockRejectedValueOnce(new Error('Add member failed'))

      await expect(TeamService.addMember('team_1', { userId: 'u' })).rejects.toThrow(
        'Add member failed'
      )
    })
  })

  describe('inviteMember', () => {
    it('should delegate to api.teams.inviteMember and return the membership', async () => {
      const membership = makeMembership()
      jest.spyOn(api.teams, 'inviteMember').mockResolvedValueOnce(membership)

      const payload = { email: 'user@example.com' }
      const result = await TeamService.inviteMember('team_1', payload)

      expect(api.teams.inviteMember).toHaveBeenCalledWith('team_1', payload)
      expect(result).toEqual(membership)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'inviteMember').mockRejectedValueOnce(new Error('Invite failed'))

      await expect(TeamService.inviteMember('team_1', { email: 'x@y.com' })).rejects.toThrow(
        'Invite failed'
      )
    })
  })

  describe('sendSignupInvite', () => {
    it('should delegate to api.teams.sendSignupInvite and return the message', async () => {
      const response = { message: 'Invite sent' }
      jest.spyOn(api.teams, 'sendSignupInvite').mockResolvedValueOnce(response)

      const payload = { email: 'new@example.com' }
      const result = await TeamService.sendSignupInvite('team_1', payload)

      expect(api.teams.sendSignupInvite).toHaveBeenCalledWith('team_1', payload)
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest
        .spyOn(api.teams, 'sendSignupInvite')
        .mockRejectedValueOnce(new Error('Signup invite failed'))

      await expect(TeamService.sendSignupInvite('team_1', { email: 'x@y.com' })).rejects.toThrow(
        'Signup invite failed'
      )
    })
  })

  describe('acceptInvite', () => {
    it('should delegate to api.teams.acceptInvite and return message and membership', async () => {
      const membership = makeMembership()
      const response = { message: 'Accepted', membership }
      jest.spyOn(api.teams, 'acceptInvite').mockResolvedValueOnce(response)

      const result = await TeamService.acceptInvite('team_1')

      expect(api.teams.acceptInvite).toHaveBeenCalledWith('team_1')
      expect(result.message).toBe('Accepted')
      expect(result.membership).toEqual(membership)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'acceptInvite').mockRejectedValueOnce(new Error('Accept failed'))

      await expect(TeamService.acceptInvite('team_1')).rejects.toThrow('Accept failed')
    })
  })

  describe('claimInvite', () => {
    it('should delegate to api.teams.claimInvite and return message and membership', async () => {
      const membership = makeMembership()
      const response = { message: 'Claimed', membership }
      jest.spyOn(api.teams, 'claimInvite').mockResolvedValueOnce(response)

      const result = await TeamService.claimInvite('team_1')

      expect(api.teams.claimInvite).toHaveBeenCalledWith('team_1')
      expect(result.message).toBe('Claimed')
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'claimInvite').mockRejectedValueOnce(new Error('Claim failed'))

      await expect(TeamService.claimInvite('team_1')).rejects.toThrow('Claim failed')
    })
  })

  describe('updateMember', () => {
    it('should delegate to api.teams.updateMember and return the membership', async () => {
      const membership = makeMembership({ role: 'admin' })
      jest.spyOn(api.teams, 'updateMember').mockResolvedValueOnce(membership)

      const result = await TeamService.updateMember('team_1', 'user_1', { role: 'admin' })

      expect(api.teams.updateMember).toHaveBeenCalledWith('team_1', 'user_1', { role: 'admin' })
      expect(result).toEqual(membership)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'updateMember').mockRejectedValueOnce(new Error('Update failed'))

      await expect(TeamService.updateMember('team_1', 'user_1', {})).rejects.toThrow(
        'Update failed'
      )
    })
  })

  describe('removeMember', () => {
    it('should delegate to api.teams.deleteMember', async () => {
      jest.spyOn(api.teams, 'deleteMember').mockResolvedValueOnce(undefined)

      await TeamService.removeMember('team_1', 'user_1')

      expect(api.teams.deleteMember).toHaveBeenCalledWith('team_1', 'user_1', undefined)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.teams, 'deleteMember').mockRejectedValueOnce(new Error('Remove failed'))

      await expect(TeamService.removeMember('team_1', 'user_1')).rejects.toThrow('Remove failed')
    })
  })
})
