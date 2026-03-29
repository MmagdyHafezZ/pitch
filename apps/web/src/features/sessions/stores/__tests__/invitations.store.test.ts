import { act } from '@testing-library/react'
import { useInvitationsStore } from '../invitations.store'
import { InvitationService } from '../../services/invitations.service'
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

const makeBulkResponse = (
  invitations: Invitation[] = [],
  overrides: Partial<BulkCreateInvitationsResponse> = {}
): BulkCreateInvitationsResponse => ({
  invitations,
  created: invitations.length,
  failed: 0,
  ...overrides,
})

const makeListResponse = (invitations: Invitation[] = []): InvitationListResponse => ({
  invitations,
  total: invitations.length,
})

const resetStore = () => {
  act(() => {
    useInvitationsStore.setState({
      invitations: [],
      currentInvitation: null,
      pendingCount: 0,
      lastCreateResult: null,
      loading: false,
      error: null,
    })
  })
}

describe('InvitationsStore', () => {
  beforeEach(() => {
    resetStore()
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useInvitationsStore.getState()

      expect(state.invitations).toEqual([])
      expect(state.currentInvitation).toBeNull()
      expect(state.pendingCount).toBe(0)
      expect(state.lastCreateResult).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('createInvitations', () => {
    it('should create invitations and merge them into state', async () => {
      const invitation = makeInvitation()
      const result = makeBulkResponse([invitation])
      jest.spyOn(InvitationService, 'createForSession').mockResolvedValueOnce(result)

      await act(async () => {
        await useInvitationsStore.getState().createInvitations('session_1', {
          inviteeIds: ['user_2'],
        })
      })

      const state = useInvitationsStore.getState()
      expect(state.lastCreateResult).toEqual(result)
      expect(state.invitations).toContainEqual(invitation)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should merge without duplicating existing invitations', async () => {
      const existing = makeInvitation({ id: 'inv_1' })
      act(() => {
        useInvitationsStore.setState({ invitations: [existing] })
      })

      const updated = { ...existing, status: 'accepted' }
      jest
        .spyOn(InvitationService, 'createForSession')
        .mockResolvedValueOnce(makeBulkResponse([updated]))

      await act(async () => {
        await useInvitationsStore.getState().createInvitations('session_1', {
          inviteeIds: ['user_2'],
        })
      })

      const state = useInvitationsStore.getState()
      expect(state.invitations).toHaveLength(1)
      expect(state.invitations[0].status).toBe('accepted')
    })

    it('should set error when creation fails', async () => {
      jest
        .spyOn(InvitationService, 'createForSession')
        .mockRejectedValueOnce(new Error('Forbidden'))

      await act(async () => {
        await useInvitationsStore.getState().createInvitations('session_1', {
          inviteeIds: ['user_2'],
        })
      })

      const state = useInvitationsStore.getState()
      expect(state.error).toBe('Forbidden')
      expect(state.loading).toBe(false)
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'createForSession').mockRejectedValueOnce('net error')

      await act(async () => {
        await useInvitationsStore.getState().createInvitations('session_1', {
          inviteeIds: [],
        })
      })

      expect(useInvitationsStore.getState().error).toBe('Failed to create invitations')
    })
  })

  describe('fetchSessionInvitations', () => {
    it('should replace invitations with session invitations on success', async () => {
      const invitations = [makeInvitation({ id: 'inv_a' }), makeInvitation({ id: 'inv_b' })]
      jest
        .spyOn(InvitationService, 'getSessionInvitations')
        .mockResolvedValueOnce(makeListResponse(invitations))

      await act(async () => {
        await useInvitationsStore.getState().fetchSessionInvitations('session_1')
      })

      const state = useInvitationsStore.getState()
      expect(state.invitations).toEqual(invitations)
      expect(state.loading).toBe(false)
    })

    it('should set error when fetch fails', async () => {
      jest
        .spyOn(InvitationService, 'getSessionInvitations')
        .mockRejectedValueOnce(new Error('Not found'))

      await act(async () => {
        await useInvitationsStore.getState().fetchSessionInvitations('session_bad')
      })

      expect(useInvitationsStore.getState().error).toBe('Not found')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'getSessionInvitations').mockRejectedValueOnce(undefined)

      await act(async () => {
        await useInvitationsStore.getState().fetchSessionInvitations('session_bad')
      })

      expect(useInvitationsStore.getState().error).toBe('Failed to load session invitations')
    })
  })

  describe('fetchMyInvitations', () => {
    it('should fetch my invitations and set them in state', async () => {
      const invitations = [makeInvitation({ inviteeId: 'me' })]
      jest
        .spyOn(InvitationService, 'getMyInvitations')
        .mockResolvedValueOnce(makeListResponse(invitations))

      await act(async () => {
        await useInvitationsStore.getState().fetchMyInvitations()
      })

      expect(useInvitationsStore.getState().invitations).toEqual(invitations)
    })

    it('should pass status param to service', async () => {
      const spy = jest
        .spyOn(InvitationService, 'getMyInvitations')
        .mockResolvedValueOnce(makeListResponse([]))

      await act(async () => {
        await useInvitationsStore.getState().fetchMyInvitations('pending')
      })

      expect(spy).toHaveBeenCalledWith('pending')
    })

    it('should set error on failure', async () => {
      jest
        .spyOn(InvitationService, 'getMyInvitations')
        .mockRejectedValueOnce(new Error('Unauthorized'))

      await act(async () => {
        await useInvitationsStore.getState().fetchMyInvitations()
      })

      expect(useInvitationsStore.getState().error).toBe('Unauthorized')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'getMyInvitations').mockRejectedValueOnce(42)

      await act(async () => {
        await useInvitationsStore.getState().fetchMyInvitations()
      })

      expect(useInvitationsStore.getState().error).toBe('Failed to load invitations')
    })
  })

  describe('fetchSentInvitations', () => {
    it('should fetch sent invitations and set them in state', async () => {
      const invitations = [makeInvitation({ inviterId: 'me' })]
      jest
        .spyOn(InvitationService, 'getSentInvitations')
        .mockResolvedValueOnce(makeListResponse(invitations))

      await act(async () => {
        await useInvitationsStore.getState().fetchSentInvitations()
      })

      expect(useInvitationsStore.getState().invitations).toEqual(invitations)
    })

    it('should set error on failure', async () => {
      jest.spyOn(InvitationService, 'getSentInvitations').mockRejectedValueOnce(new Error('Failed'))

      await act(async () => {
        await useInvitationsStore.getState().fetchSentInvitations()
      })

      expect(useInvitationsStore.getState().error).toBe('Failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'getSentInvitations').mockRejectedValueOnce({})

      await act(async () => {
        await useInvitationsStore.getState().fetchSentInvitations()
      })

      expect(useInvitationsStore.getState().error).toBe('Failed to load sent invitations')
    })
  })

  describe('fetchInvitationById', () => {
    it('should fetch an invitation and upsert it into state', async () => {
      const invitation = makeInvitation({ id: 'inv_5' })
      jest.spyOn(InvitationService, 'getById').mockResolvedValueOnce(invitation)

      await act(async () => {
        await useInvitationsStore.getState().fetchInvitationById('inv_5')
      })

      const state = useInvitationsStore.getState()
      expect(state.currentInvitation).toEqual(invitation)
      expect(state.invitations).toContainEqual(invitation)
    })

    it('should update an existing invitation in place', async () => {
      const existing = makeInvitation({ id: 'inv_5', status: 'pending' })
      act(() => {
        useInvitationsStore.setState({ invitations: [existing] })
      })

      const updated = { ...existing, status: 'accepted' }
      jest.spyOn(InvitationService, 'getById').mockResolvedValueOnce(updated)

      await act(async () => {
        await useInvitationsStore.getState().fetchInvitationById('inv_5')
      })

      const state = useInvitationsStore.getState()
      expect(state.invitations).toHaveLength(1)
      expect(state.invitations[0].status).toBe('accepted')
    })

    it('should set error on failure', async () => {
      jest.spyOn(InvitationService, 'getById').mockRejectedValueOnce(new Error('Not found'))

      await act(async () => {
        await useInvitationsStore.getState().fetchInvitationById('inv_bad')
      })

      expect(useInvitationsStore.getState().error).toBe('Not found')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'getById').mockRejectedValueOnce('oops')

      await act(async () => {
        await useInvitationsStore.getState().fetchInvitationById('inv_bad')
      })

      expect(useInvitationsStore.getState().error).toBe('Failed to load invitation')
    })
  })

  describe('acceptInvitation', () => {
    it('should accept an invitation and update state', async () => {
      const invitation = makeInvitation({ id: 'inv_1', status: 'accepted' })
      jest.spyOn(InvitationService, 'accept').mockResolvedValueOnce(invitation)

      await act(async () => {
        await useInvitationsStore.getState().acceptInvitation('inv_1')
      })

      const state = useInvitationsStore.getState()
      expect(state.currentInvitation?.status).toBe('accepted')
      expect(state.loading).toBe(false)
    })

    it('should throw and set error when accept fails', async () => {
      jest.spyOn(InvitationService, 'accept').mockRejectedValueOnce(new Error('Accept failed'))

      await expect(
        act(async () => {
          await useInvitationsStore.getState().acceptInvitation('inv_1')
        })
      ).rejects.toThrow('Accept failed')

      expect(useInvitationsStore.getState().error).toBe('Accept failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'accept').mockRejectedValueOnce('net')

      await expect(
        act(async () => {
          await useInvitationsStore.getState().acceptInvitation('inv_1')
        })
      ).rejects.toBe('net')

      expect(useInvitationsStore.getState().error).toBe('Failed to accept invitation')
    })
  })

  describe('declineInvitation', () => {
    it('should decline an invitation and update state', async () => {
      const invitation = makeInvitation({ id: 'inv_1', status: 'declined' })
      jest.spyOn(InvitationService, 'decline').mockResolvedValueOnce(invitation)

      await act(async () => {
        await useInvitationsStore.getState().declineInvitation('inv_1')
      })

      expect(useInvitationsStore.getState().currentInvitation?.status).toBe('declined')
    })

    it('should throw and set error when decline fails', async () => {
      jest.spyOn(InvitationService, 'decline').mockRejectedValueOnce(new Error('Decline failed'))

      await expect(
        act(async () => {
          await useInvitationsStore.getState().declineInvitation('inv_1')
        })
      ).rejects.toThrow('Decline failed')

      expect(useInvitationsStore.getState().error).toBe('Decline failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'decline').mockRejectedValueOnce(null)

      await expect(
        act(async () => {
          await useInvitationsStore.getState().declineInvitation('inv_1')
        })
      ).rejects.toBeNull()

      expect(useInvitationsStore.getState().error).toBe('Failed to decline invitation')
    })
  })

  describe('revokeInvitation', () => {
    it('should revoke an invitation and remove it from the list', async () => {
      const inv = makeInvitation({ id: 'inv_1' })
      act(() => {
        useInvitationsStore.setState({ invitations: [inv], currentInvitation: inv })
      })

      jest
        .spyOn(InvitationService, 'revoke')
        .mockResolvedValueOnce({ message: 'Revoked', id: 'inv_1' })

      await act(async () => {
        await useInvitationsStore.getState().revokeInvitation('inv_1')
      })

      const state = useInvitationsStore.getState()
      expect(state.invitations).not.toContainEqual(expect.objectContaining({ id: 'inv_1' }))
      expect(state.currentInvitation).toBeNull()
    })

    it('should not clear currentInvitation when a different one is revoked', async () => {
      const inv1 = makeInvitation({ id: 'inv_1' })
      const inv2 = makeInvitation({ id: 'inv_2' })
      act(() => {
        useInvitationsStore.setState({
          invitations: [inv1, inv2],
          currentInvitation: inv2,
        })
      })

      jest
        .spyOn(InvitationService, 'revoke')
        .mockResolvedValueOnce({ message: 'Revoked', id: 'inv_1' })

      await act(async () => {
        await useInvitationsStore.getState().revokeInvitation('inv_1')
      })

      expect(useInvitationsStore.getState().currentInvitation?.id).toBe('inv_2')
    })

    it('should throw and set error when revoke fails', async () => {
      jest.spyOn(InvitationService, 'revoke').mockRejectedValueOnce(new Error('Revoke failed'))

      await expect(
        act(async () => {
          await useInvitationsStore.getState().revokeInvitation('inv_1')
        })
      ).rejects.toThrow('Revoke failed')

      expect(useInvitationsStore.getState().error).toBe('Revoke failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'revoke').mockRejectedValueOnce(false)

      await expect(
        act(async () => {
          await useInvitationsStore.getState().revokeInvitation('inv_1')
        })
      ).rejects.toBe(false)

      expect(useInvitationsStore.getState().error).toBe('Failed to revoke invitation')
    })
  })

  describe('fetchPendingCount', () => {
    it('should fetch and set the pending count', async () => {
      jest.spyOn(InvitationService, 'getPendingCount').mockResolvedValueOnce({ count: 7 })

      await act(async () => {
        await useInvitationsStore.getState().fetchPendingCount()
      })

      expect(useInvitationsStore.getState().pendingCount).toBe(7)
    })

    it('should set error when fetch fails', async () => {
      jest
        .spyOn(InvitationService, 'getPendingCount')
        .mockRejectedValueOnce(new Error('Count failed'))

      await act(async () => {
        await useInvitationsStore.getState().fetchPendingCount()
      })

      expect(useInvitationsStore.getState().error).toBe('Count failed')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(InvitationService, 'getPendingCount').mockRejectedValueOnce('bad')

      await act(async () => {
        await useInvitationsStore.getState().fetchPendingCount()
      })

      expect(useInvitationsStore.getState().error).toBe('Failed to load pending count')
    })
  })
})
