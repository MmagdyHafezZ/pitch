import {
  readTeamInviteContextFromSearch,
  persistTeamInviteContext,
  getTeamInviteContext,
  clearTeamInviteContext,
} from '../team-invite-context'

const STORAGE_KEY = 'pitch:team-invite-context'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  const origGetItem = localStorage.getItem
  const origSetItem = localStorage.setItem
  const origRemoveItem = localStorage.removeItem

  jest
    .spyOn(window.localStorage.__proto__, 'getItem')
    .mockImplementation((key: string) => storage.get(key) ?? null)
  jest
    .spyOn(window.localStorage.__proto__, 'setItem')
    .mockImplementation((key: string, value: string) => {
      storage.set(key, value)
    })
  jest.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation((key: string) => {
    storage.delete(key)
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('readTeamInviteContextFromSearch', () => {
  it('returns null when no teamId param', () => {
    const params = new URLSearchParams('')
    expect(readTeamInviteContextFromSearch(params)).toBeNull()
  })

  it('returns null when teamId is blank', () => {
    const params = new URLSearchParams('teamId=  ')
    expect(readTeamInviteContextFromSearch(params)).toBeNull()
  })

  it('returns context with teamId', () => {
    const params = new URLSearchParams('teamId=team-123')
    expect(readTeamInviteContextFromSearch(params)).toEqual({
      teamId: 'team-123',
      email: undefined,
    })
  })

  it('returns context with teamId and email', () => {
    const params = new URLSearchParams('teamId=team-123&email=user@example.com')
    expect(readTeamInviteContextFromSearch(params)).toEqual({
      teamId: 'team-123',
      email: 'user@example.com',
    })
  })

  it('trims whitespace from teamId and email', () => {
    const params = new URLSearchParams('teamId= team-1 &email= a@b.com ')
    const result = readTeamInviteContextFromSearch(params)
    expect(result?.teamId).toBe('team-1')
    expect(result?.email).toBe('a@b.com')
  })

  it('returns undefined email for empty email param', () => {
    const params = new URLSearchParams('teamId=team-1&email=')
    const result = readTeamInviteContextFromSearch(params)
    expect(result?.email).toBeUndefined()
  })
})

describe('persistTeamInviteContext', () => {
  it('persists context to localStorage', () => {
    persistTeamInviteContext({ teamId: 'team-1', email: 'a@b.com' })
    expect(storage.get(STORAGE_KEY)).toBe(JSON.stringify({ teamId: 'team-1', email: 'a@b.com' }))
  })

  it('persists context without email', () => {
    persistTeamInviteContext({ teamId: 'team-1' })
    expect(storage.get(STORAGE_KEY)).toBe(JSON.stringify({ teamId: 'team-1' }))
  })
})

describe('getTeamInviteContext', () => {
  it('returns null when nothing stored', () => {
    expect(getTeamInviteContext()).toBeNull()
  })

  it('returns parsed context with teamId and email', () => {
    storage.set(STORAGE_KEY, JSON.stringify({ teamId: 'team-1', email: 'a@b.com' }))
    expect(getTeamInviteContext()).toEqual({ teamId: 'team-1', email: 'a@b.com' })
  })

  it('returns context with undefined email if not present', () => {
    storage.set(STORAGE_KEY, JSON.stringify({ teamId: 'team-1' }))
    expect(getTeamInviteContext()).toEqual({ teamId: 'team-1', email: undefined })
  })

  it('returns null for invalid JSON', () => {
    storage.set(STORAGE_KEY, 'not-json')
    expect(getTeamInviteContext()).toBeNull()
  })

  it('returns null when teamId is missing', () => {
    storage.set(STORAGE_KEY, JSON.stringify({ email: 'a@b.com' }))
    expect(getTeamInviteContext()).toBeNull()
  })

  it('returns null when teamId is not a string', () => {
    storage.set(STORAGE_KEY, JSON.stringify({ teamId: 123 }))
    expect(getTeamInviteContext()).toBeNull()
  })

  it('ignores non-string email', () => {
    storage.set(STORAGE_KEY, JSON.stringify({ teamId: 'team-1', email: 42 }))
    const result = getTeamInviteContext()
    expect(result).toEqual({ teamId: 'team-1', email: undefined })
  })
})

describe('clearTeamInviteContext', () => {
  it('removes from localStorage', () => {
    storage.set(STORAGE_KEY, 'something')
    clearTeamInviteContext()
    expect(storage.has(STORAGE_KEY)).toBe(false)
  })
})
