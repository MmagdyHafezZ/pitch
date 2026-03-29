import {
  getCachedAvatarForUser,
  setCachedAvatarForUser,
  applyAvatarCacheToUser,
} from '../avatar-cache'

const AVATAR_CACHE_PREFIX = 'pitch:user-avatar:'

describe('avatar-cache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getCachedAvatarForUser', () => {
    it('should return null when userId is undefined', () => {
      expect(getCachedAvatarForUser(undefined)).toBeNull()
    })

    it('should return null when userId is null', () => {
      expect(getCachedAvatarForUser(null)).toBeNull()
    })

    it('should return null when no cached avatar exists', () => {
      expect(getCachedAvatarForUser('user_1')).toBeNull()
    })

    it('should return the cached avatar when it exists', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_1`, 'https://cdn.example.com/avatar.png')
      expect(getCachedAvatarForUser('user_1')).toBe('https://cdn.example.com/avatar.png')
    })

    it('should return null when the stored value is an empty string', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_2`, '')
      expect(getCachedAvatarForUser('user_2')).toBeNull()
    })

    it('should return null when the stored value is only whitespace', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_3`, '   ')
      expect(getCachedAvatarForUser('user_3')).toBeNull()
    })

    it('should scope the cache key by user id', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_a`, 'https://avatar-a.png')
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_b`, 'https://avatar-b.png')

      expect(getCachedAvatarForUser('user_a')).toBe('https://avatar-a.png')
      expect(getCachedAvatarForUser('user_b')).toBe('https://avatar-b.png')
    })

    it('should return null when localStorage throws', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('storage error')
      })
      expect(getCachedAvatarForUser('user_1')).toBeNull()
    })
  })

  describe('setCachedAvatarForUser', () => {
    it('should store the avatar in localStorage', () => {
      setCachedAvatarForUser('user_1', 'https://cdn.example.com/avatar.png')
      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_1`)).toBe(
        'https://cdn.example.com/avatar.png'
      )
    })

    it('should remove the entry when avatar is null', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_1`, 'old-avatar')
      setCachedAvatarForUser('user_1', null)
      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_1`)).toBeNull()
    })

    it('should remove the entry when avatar is undefined', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_1`, 'old-avatar')
      setCachedAvatarForUser('user_1', undefined)
      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_1`)).toBeNull()
    })

    it('should do nothing when userId is undefined', () => {
      setCachedAvatarForUser(undefined, 'https://cdn.example.com/avatar.png')
      // localStorage should be empty because userId is falsy
      expect(localStorage.length).toBe(0)
    })

    it('should do nothing when userId is null', () => {
      setCachedAvatarForUser(null, 'https://cdn.example.com/avatar.png')
      expect(localStorage.length).toBe(0)
    })

    it('should scope the cache key by user id', () => {
      setCachedAvatarForUser('user_x', 'https://x.png')
      setCachedAvatarForUser('user_y', 'https://y.png')

      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_x`)).toBe('https://x.png')
      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_y`)).toBe('https://y.png')
    })

    it('should silently swallow localStorage errors', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('quota exceeded')
      })
      expect(() => setCachedAvatarForUser('user_1', 'https://cdn.example.com/a.png')).not.toThrow()
    })

    it('should silently swallow removeItem errors', () => {
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('storage error')
      })
      expect(() => setCachedAvatarForUser('user_1', null)).not.toThrow()
    })
  })

  describe('applyAvatarCacheToUser', () => {
    it('should return null as-is when user is null', () => {
      expect(applyAvatarCacheToUser(null)).toBeNull()
    })

    it('should return the user unchanged when user already has an avatar', () => {
      const user = { id: 'user_1', avatar: 'https://existing.png' }
      const result = applyAvatarCacheToUser(user)
      expect(result).toBe(user)
      expect(result?.avatar).toBe('https://existing.png')
    })

    it('should also update the cache when user has an avatar', () => {
      const user = { id: 'user_1', avatar: 'https://new.png' }
      applyAvatarCacheToUser(user)
      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_1`)).toBe('https://new.png')
    })

    it('should apply the cached avatar when user has no avatar', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_1`, 'https://cached.png')

      const user = { id: 'user_1', avatar: null }
      const result = applyAvatarCacheToUser(user)

      expect(result).toEqual({ id: 'user_1', avatar: 'https://cached.png' })
    })

    it('should return the user unchanged when no avatar and no cache', () => {
      const user = { id: 'user_1' }
      const result = applyAvatarCacheToUser(user)
      expect(result).toBe(user)
    })

    it('should not mutate the original user object', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_1`, 'https://cached.png')

      const user = { id: 'user_1', avatar: null }
      const result = applyAvatarCacheToUser(user)

      // result should be a new object, not the same reference
      expect(result).not.toBe(user)
    })

    it('should handle users with additional properties', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_5`, 'https://cached.png')

      const user = { id: 'user_5', name: 'Alice', email: 'alice@example.com', avatar: null }
      const result = applyAvatarCacheToUser(user)

      expect(result).toEqual({
        id: 'user_5',
        name: 'Alice',
        email: 'alice@example.com',
        avatar: 'https://cached.png',
      })
    })

    it('should preserve existing avatar over a different cached value', () => {
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}user_1`, 'https://old-cache.png')

      const user = { id: 'user_1', avatar: 'https://new-avatar.png' }
      const result = applyAvatarCacheToUser(user)

      // The user's own avatar takes priority — the function returns the user as-is
      // and also updates the cache to the new avatar
      expect(result?.avatar).toBe('https://new-avatar.png')
      expect(localStorage.getItem(`${AVATAR_CACHE_PREFIX}user_1`)).toBe('https://new-avatar.png')
    })
  })
})
