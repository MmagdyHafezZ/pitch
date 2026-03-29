import { SessionService } from '../sessions.service'
import { api } from '@/lib/client'
import type { Session, SessionListResponse } from '../../types/sessions.types'

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session_1',
  userId: 'user_1',
  orgId: 'org_1',
  type: 'text',
  tags: [],
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const makeListResponse = (sessions: Session[] = []): SessionListResponse => ({
  sessions,
  total: sessions.length,
  limit: 10,
  offset: 0,
})

describe('SessionService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  describe('getAll', () => {
    it('should delegate to api.sessions.getAll and return the response', async () => {
      const response = makeListResponse([makeSession()])
      jest.spyOn(api.sessions, 'getAll').mockResolvedValueOnce(response)

      const result = await SessionService.getAll()

      expect(api.sessions.getAll).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(response)
    })

    it('should pass params to api.sessions.getAll', async () => {
      const response = makeListResponse([])
      jest.spyOn(api.sessions, 'getAll').mockResolvedValueOnce(response)

      await SessionService.getAll({ limit: 5, offset: 10, status: 'active' })

      expect(api.sessions.getAll).toHaveBeenCalledWith({ limit: 5, offset: 10, status: 'active' })
    })

    it('should propagate errors from api.sessions.getAll', async () => {
      jest.spyOn(api.sessions, 'getAll').mockRejectedValueOnce(new Error('Network error'))

      await expect(SessionService.getAll()).rejects.toThrow('Network error')
    })
  })

  describe('getById', () => {
    it('should delegate to api.sessions.getById and return the session', async () => {
      const session = makeSession({ id: 'session_5' })
      jest.spyOn(api.sessions, 'getById').mockResolvedValueOnce(session)

      const result = await SessionService.getById('session_5')

      expect(api.sessions.getById).toHaveBeenCalledWith('session_5')
      expect(result).toEqual(session)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'getById').mockRejectedValueOnce(new Error('Not found'))

      await expect(SessionService.getById('bad_id')).rejects.toThrow('Not found')
    })
  })

  describe('getUserSessions', () => {
    it('should delegate to api.sessions.getUserSessions', async () => {
      const response = makeListResponse([makeSession()])
      jest.spyOn(api.sessions, 'getUserSessions').mockResolvedValueOnce(response)

      const result = await SessionService.getUserSessions('user_1', { limit: 5 })

      expect(api.sessions.getUserSessions).toHaveBeenCalledWith('user_1', { limit: 5 })
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'getUserSessions').mockRejectedValueOnce(new Error('Forbidden'))

      await expect(SessionService.getUserSessions('user_bad')).rejects.toThrow('Forbidden')
    })
  })

  describe('getOrgSessions', () => {
    it('should delegate to api.sessions.getOrgSessions', async () => {
      const response = makeListResponse([])
      jest.spyOn(api.sessions, 'getOrgSessions').mockResolvedValueOnce(response)

      const result = await SessionService.getOrgSessions('org_1', { offset: 20 })

      expect(api.sessions.getOrgSessions).toHaveBeenCalledWith('org_1', { offset: 20 })
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'getOrgSessions').mockRejectedValueOnce(new Error('Org error'))

      await expect(SessionService.getOrgSessions('org_bad')).rejects.toThrow('Org error')
    })
  })

  describe('create', () => {
    it('should delegate to api.sessions.create and return the new session', async () => {
      const session = makeSession({ id: 'session_new' })
      jest.spyOn(api.sessions, 'create').mockResolvedValueOnce(session)

      const payload = { orgId: 'org_1', type: 'text' as const }
      const result = await SessionService.create(payload)

      expect(api.sessions.create).toHaveBeenCalledWith(payload)
      expect(result).toEqual(session)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'create').mockRejectedValueOnce(new Error('Create failed'))

      await expect(SessionService.create({ orgId: 'org_1', type: 'text' })).rejects.toThrow(
        'Create failed'
      )
    })
  })

  describe('update', () => {
    it('should delegate to api.sessions.update and return the updated session', async () => {
      const session = makeSession({ id: 'session_1', status: 'ended' })
      jest.spyOn(api.sessions, 'update').mockResolvedValueOnce(session)

      const result = await SessionService.update('session_1', { status: 'ended' })

      expect(api.sessions.update).toHaveBeenCalledWith('session_1', { status: 'ended' })
      expect(result).toEqual(session)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'update').mockRejectedValueOnce(new Error('Update failed'))

      await expect(SessionService.update('session_1', {})).rejects.toThrow('Update failed')
    })
  })

  describe('end', () => {
    it('should delegate to api.sessions.end', async () => {
      const session = makeSession({ status: 'ended' })
      jest.spyOn(api.sessions, 'end').mockResolvedValueOnce(session)

      const result = await SessionService.end('session_1', { reason: 'user request' })

      expect(api.sessions.end).toHaveBeenCalledWith('session_1', { reason: 'user request' })
      expect(result).toEqual(session)
    })

    it('should support calling end without payload', async () => {
      const session = makeSession({ status: 'ended' })
      jest.spyOn(api.sessions, 'end').mockResolvedValueOnce(session)

      await SessionService.end('session_1')

      expect(api.sessions.end).toHaveBeenCalledWith('session_1', undefined)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'end').mockRejectedValueOnce(new Error('End failed'))

      await expect(SessionService.end('session_1')).rejects.toThrow('End failed')
    })
  })

  describe('restart', () => {
    it('should delegate to api.sessions.restart', async () => {
      const session = makeSession({ status: 'active' })
      jest.spyOn(api.sessions, 'restart').mockResolvedValueOnce(session)

      const result = await SessionService.restart('session_1', { reason: 'retry' })

      expect(api.sessions.restart).toHaveBeenCalledWith('session_1', { reason: 'retry' })
      expect(result).toEqual(session)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'restart').mockRejectedValueOnce(new Error('Restart failed'))

      await expect(SessionService.restart('session_1')).rejects.toThrow('Restart failed')
    })
  })

  describe('delete', () => {
    it('should delegate to api.sessions.delete and return the response', async () => {
      const response = { message: 'Deleted', id: 'session_1' }
      jest.spyOn(api.sessions, 'delete').mockResolvedValueOnce(response)

      const result = await SessionService.delete('session_1')

      expect(api.sessions.delete).toHaveBeenCalledWith('session_1')
      expect(result).toEqual(response)
    })

    it('should propagate errors', async () => {
      jest.spyOn(api.sessions, 'delete').mockRejectedValueOnce(new Error('Delete failed'))

      await expect(SessionService.delete('session_1')).rejects.toThrow('Delete failed')
    })
  })
})
