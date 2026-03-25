import { InvitationService } from '../invitations.service'
import { api } from '@/lib/client'
import type {
  Invitation,
  BulkCreateInvitationsResponse,
  InvitationListResponse,
} from '../../types/invitations.types'

const makeInvitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: 'inv_1',
  sessionId: 'session_1',
  inviterId: 'user_1',
  inviteeId: 'user_2',
  status: 'pending',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const makeBulkResponse = (invitations: Invitation[] = []): BulkCreateInvitationsResponse => ({
  invitations,
  created: invitations.length,
  failed: 0,
})

const makeListResponse = (invitations: Invitation[] = []): InvitationListResponse => ({
  invitations,
  total: invitations.length,
})

describe('InvitationService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  describe('createForSession', () => {
    it('should delegate to api.invitations.createForSession and return the result', async () => {
      const response = makeBulkResponse([makeInvitation()])
      jest.spyOn(api.invitations, 'createForSession').mockResolvedValueOnce(response)

      const payload = { inviteeIds: ['user_2'] }
      const result = await InvitationService.createForSession('session_1', payload)

      expect(api.invitations.createForSession).toHaveBeenCalledWith('session_1', payload)
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.invitations, 'createForSession').mockRejectedValueOnce(new Error('Forbidden'))

      await expect(
        InvitationService.createForSession('session_1', { inviteeIds: [] })
      ).rejects.toThrow('Forbidden')
    })
  })

  describe('getSessionInvitations', () => {
    it('should delegate to api.invitations.getSessionInvitations', async () => {
      const response = makeListResponse([makeInvitation()])
      jest.spyOn(api.invitations, 'getSessionInvitations').mockResolvedValueOnce(response)

      const result = await InvitationService.getSessionInvitations('session_1')

      expect(api.invitations.getSessionInvitations).toHaveBeenCalledWith('session_1')
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest
        .spyOn(api.invitations, 'getSessionInvitations')
        .mockRejectedValueOnce(new Error('Not found'))

      await expect(InvitationService.getSessionInvitations('session_bad')).rejects.toThrow(
        'Not found'
      )
    })
  })

  describe('getMyInvitations', () => {
    it('should delegate to api.invitations.getMyInvitations without status', async () => {
      const response = makeListResponse([makeInvitation()])
      jest.spyOn(api.invitations, 'getMyInvitations').mockResolvedValueOnce(response)

      const result = await InvitationService.getMyInvitations()

      expect(api.invitations.getMyInvitations).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(response)
    })

    it('should pass status param to api.invitations.getMyInvitations', async () => {
      const response = makeListResponse([])
      jest.spyOn(api.invitations, 'getMyInvitations').mockResolvedValueOnce(response)

      await InvitationService.getMyInvitations('pending')

      expect(api.invitations.getMyInvitations).toHaveBeenCalledWith('pending')
    })

    it('should propagate errors', async () => {
      jest
        .spyOn(api.invitations, 'getMyInvitations')
        .mockRejectedValueOnce(new Error('Unauthorized'))

      await expect(InvitationService.getMyInvitations()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getSentInvitations', () => {
    it('should delegate to api.invitations.getSentInvitations', async () => {
      const response = makeListResponse([makeInvitation({ inviterId: 'me' })])
      jest.spyOn(api.invitations, 'getSentInvitations').mockResolvedValueOnce(response)

      const result = await InvitationService.getSentInvitations()

      expect(api.invitations.getSentInvitations).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(response)
    })

    it('should pass status param', async () => {
      const response = makeListResponse([])
      jest.spyOn(api.invitations, 'getSentInvitations').mockResolvedValueOnce(response)

      await InvitationService.getSentInvitations('accepted')

      expect(api.invitations.getSentInvitations).toHaveBeenCalledWith('accepted')
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.invitations, 'getSentInvitations').mockRejectedValueOnce(new Error('Error'))

      await expect(InvitationService.getSentInvitations()).rejects.toThrow('Error')
    })
  })

  describe('getById', () => {
    it('should delegate to api.invitations.getById', async () => {
      const invitation = makeInvitation({ id: 'inv_5' })
      jest.spyOn(api.invitations, 'getById').mockResolvedValueOnce(invitation)

      const result = await InvitationService.getById('inv_5')

      expect(api.invitations.getById).toHaveBeenCalledWith('inv_5')
      expect(result).toEqual(invitation)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.invitations, 'getById').mockRejectedValueOnce(new Error('Not found'))

      await expect(InvitationService.getById('bad_id')).rejects.toThrow('Not found')
    })
  })

  describe('accept', () => {
    it('should delegate to api.invitations.accept and return updated invitation', async () => {
      const invitation = makeInvitation({ status: 'accepted' })
      jest.spyOn(api.invitations, 'accept').mockResolvedValueOnce(invitation)

      const result = await InvitationService.accept('inv_1')

      expect(api.invitations.accept).toHaveBeenCalledWith('inv_1')
      expect(result.status).toBe('accepted')
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.invitations, 'accept').mockRejectedValueOnce(new Error('Accept failed'))

      await expect(InvitationService.accept('inv_1')).rejects.toThrow('Accept failed')
    })
  })

  describe('decline', () => {
    it('should delegate to api.invitations.decline and return updated invitation', async () => {
      const invitation = makeInvitation({ status: 'declined' })
      jest.spyOn(api.invitations, 'decline').mockResolvedValueOnce(invitation)

      const result = await InvitationService.decline('inv_1')

      expect(api.invitations.decline).toHaveBeenCalledWith('inv_1')
      expect(result.status).toBe('declined')
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.invitations, 'decline').mockRejectedValueOnce(new Error('Decline failed'))

      await expect(InvitationService.decline('inv_1')).rejects.toThrow('Decline failed')
    })
  })

  describe('revoke', () => {
    it('should delegate to api.invitations.revoke and return the response', async () => {
      const response = { message: 'Revoked', id: 'inv_1' }
      jest.spyOn(api.invitations, 'revoke').mockResolvedValueOnce(response)

      const result = await InvitationService.revoke('inv_1')

      expect(api.invitations.revoke).toHaveBeenCalledWith('inv_1')
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.invitations, 'revoke').mockRejectedValueOnce(new Error('Revoke failed'))

      await expect(InvitationService.revoke('inv_1')).rejects.toThrow('Revoke failed')
    })
  })

  describe('getPendingCount', () => {
    it('should delegate to api.invitations.getPendingCount and return the count', async () => {
      jest.spyOn(api.invitations, 'getPendingCount').mockResolvedValueOnce({ count: 3 })

      const result = await InvitationService.getPendingCount()

      expect(api.invitations.getPendingCount).toHaveBeenCalled()
      expect(result.count).toBe(3)
    })

    it('should propagate errors', async () => {
      jest
        .spyOn(api.invitations, 'getPendingCount')
        .mockRejectedValueOnce(new Error('Count failed'))

      await expect(InvitationService.getPendingCount()).rejects.toThrow('Count failed')
    })
  })
})
