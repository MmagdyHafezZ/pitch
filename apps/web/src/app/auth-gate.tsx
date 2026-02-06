'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { isTokenExpiringSoon } from '@/features/auth/utils/token.utils'

const AUTH_PATH_PREFIX = '/auth'
const AUTH_CALLBACK_PATH = '/auth/callback'
const AUTH_REDIRECT = '/auth/login'
const AUTHENTICATED_REDIRECT = '/studio/home'
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000
const REFRESH_WINDOW_MS = 2 * 60 * 1000

type AuthGateProps = {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const token = useAuthStore((state) => state.token)
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken)
  const [checked, setChecked] = useState(false)
  const refreshInProgress = useRef(false)

  const isAuthRoute = useMemo(() => {
    if (!pathname) return false
    return pathname === AUTH_PATH_PREFIX || pathname.startsWith(`${AUTH_PATH_PREFIX}/`)
  }, [pathname])

  const isCallbackRoute = pathname === AUTH_CALLBACK_PATH

  useEffect(() => {
    if (!pathname) return

    let isActive = true

    const maybeRefreshToken = async () => {
      if (refreshInProgress.current) return false
      refreshInProgress.current = true
      try {
        return await refreshAccessToken()
      } finally {
        refreshInProgress.current = false
      }
    }

    const handleAuthFlow = async () => {
      if (!token) {
        await maybeRefreshToken()
      }

      if (!isActive) return

      const hasToken = Boolean(useAuthStore.getState().token)

      if (isAuthRoute) {
        if (hasToken && !isCallbackRoute) {
          router.replace(AUTHENTICATED_REDIRECT)
          return
        }
        setChecked(true)
        return
      }

      if (!hasToken) {
        router.replace(AUTH_REDIRECT)
        return
      }

      setChecked(true)
    }

    if (isCallbackRoute) {
      setChecked(true)
      return () => {
        isActive = false
      }
    }

    handleAuthFlow()

    return () => {
      isActive = false
    }
  }, [isAuthRoute, isCallbackRoute, pathname, refreshAccessToken, router, token])

  useEffect(() => {
    if (!token) return

    const interval = window.setInterval(async () => {
      if (!token) return
      if (!isTokenExpiringSoon(token, REFRESH_WINDOW_MS)) return
      await refreshAccessToken()
    }, REFRESH_CHECK_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [refreshAccessToken, token])

  if (!checked) {
    return null
  }

  return children
}
