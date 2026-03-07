'use client'

import { useCallback, useRef } from 'react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { homeTourSteps, sessionsTourSteps, analyticsTourSteps, teamConfigTourSteps } from '../tours'
import type { TourScreen } from '../types'

const tourStepsMap = {
  home: homeTourSteps,
  sessions: sessionsTourSteps,
  analytics: analyticsTourSteps,
  'team-config': teamConfigTourSteps,
}

export function useTour() {
  const driverRef = useRef<ReturnType<(typeof import('driver.js'))['driver']> | null>(null)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const completeTour = useCallback(async () => {
    const existing = user?.settings ?? {}
    await api.users.updateMySettings({
      ...existing,
      onboarding: { ...existing.onboarding, tutorialCompleted: true },
    })
    if (user) {
      setUser({
        ...user,
        settings: {
          ...existing,
          onboarding: { ...existing.onboarding, tutorialCompleted: true },
        },
      })
    }
  }, [user, setUser])

  const startTour = useCallback(
    async (screen: TourScreen) => {
      const { driver } = await import('driver.js')

      const steps = tourStepsMap[screen]
      // Filter to only steps whose elements actually exist in the DOM
      const availableSteps = steps.filter((step) => {
        if (!step.element) return true
        return document.querySelector(step.element as string) !== null
      })

      if (availableSteps.length === 0) return

      driverRef.current?.destroy()

      driverRef.current = driver({
        animate: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        steps: availableSteps,
        onDestroyStarted: () => {
          completeTour()
          driverRef.current?.destroy()
        },
      })

      driverRef.current.drive()
    },
    [completeTour]
  )

  const destroyTour = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  return { startTour, destroyTour }
}
