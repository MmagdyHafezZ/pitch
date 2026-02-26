type UserWithAvatar = {
  id: string
  avatar?: string | null
}

const AVATAR_CACHE_PREFIX = 'pitch:user-avatar:'

const getAvatarCacheKey = (userId: string) => `${AVATAR_CACHE_PREFIX}${userId}`

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage

export const getCachedAvatarForUser = (userId?: string | null): string | null => {
  if (!userId || !canUseStorage()) {
    return null
  }

  try {
    const value = window.localStorage.getItem(getAvatarCacheKey(userId))
    return value && value.trim().length > 0 ? value : null
  } catch {
    return null
  }
}

export const setCachedAvatarForUser = (userId?: string | null, avatar?: string | null): void => {
  if (!userId || !canUseStorage()) {
    return
  }

  try {
    if (!avatar) {
      window.localStorage.removeItem(getAvatarCacheKey(userId))
      return
    }

    window.localStorage.setItem(getAvatarCacheKey(userId), avatar)
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

export const applyAvatarCacheToUser = <T extends UserWithAvatar | null>(user: T): T => {
  if (!user) {
    return user
  }

  if (user.avatar) {
    setCachedAvatarForUser(user.id, user.avatar)
    return user
  }

  const cachedAvatar = getCachedAvatarForUser(user.id)
  if (!cachedAvatar) {
    return user
  }

  return {
    ...user,
    avatar: cachedAvatar,
  }
}
