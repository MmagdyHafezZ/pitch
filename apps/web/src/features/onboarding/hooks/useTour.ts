'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { modals } from '@mantine/modals'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  homeTourSteps,
  sessionsTourSteps,
  challengesTourSteps,
  analyticsTourSteps,
  teamConfigTourSteps,
} from '../tours'
import type { TourScreen } from '../types'

const tourStepsMap = {
  home: homeTourSteps,
  sessions: sessionsTourSteps,
  challenges: challengesTourSteps,
  analytics: analyticsTourSteps,
  'team-config': teamConfigTourSteps,
}

const screenRoutes: Record<TourScreen, string> = {
  home: '/studio/home',
  sessions: '/studio/sessions',
  challenges: '/studio/challenges',
  analytics: '/studio/analytics',
  'team-config': '/studio/team-config',
}

type StartTourOptions = {
  mode?: 'single' | 'full'
}

export function useTour() {
  const router = useRouter()
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
    async (screen: TourScreen, options?: StartTourOptions) => {
      const { driver } = await import('driver.js')
      const mode = options?.mode ?? 'single'
      const onboardingRole = user?.settings?.onboarding?.role
      const fullFlowScreens: TourScreen[] =
        onboardingRole === 'MANAGER'
          ? ['home', 'sessions', 'challenges', 'analytics', 'team-config']
          : ['home', 'sessions', 'challenges', 'analytics']

      const steps = tourStepsMap[screen]
      // Filter to only steps whose elements actually exist in the DOM
      const availableSteps = steps.filter((step) => {
        if (!step.element) return true
        return document.querySelector(step.element as string) !== null
      })

      if (availableSteps.length === 0) {
        const activeIndex = fullFlowScreens.indexOf(screen)
        const nextScreen =
          mode === 'full' && activeIndex >= 0 ? fullFlowScreens[activeIndex + 1] : undefined

        if (nextScreen) {
          router.push(`${screenRoutes[nextScreen]}?startTour=full&tourScreen=${nextScreen}`)
          return
        }

        if (mode === 'full') {
          await completeTour()
        }
        return
      }

      driverRef.current?.destroy()

      driverRef.current = driver({
        animate: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        steps: availableSteps,
        onCloseClick: (_element, _step, { driver: activeDriver }) => {
          modals.openConfirmModal({
            title: 'Stop tutorial?',
            centered: true,
            labels: {
              confirm: 'Stop tutorial',
              cancel: 'Keep tutorial',
            },
            confirmProps: { color: 'red' },
            children:
              'You are about to exit the tutorial. You can restart it anytime from the help icon.',
            onConfirm: () => {
              activeDriver.destroy()
              driverRef.current = null
            },
          })
        },
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          if (!activeDriver.isLastStep()) {
            activeDriver.moveNext()
            return
          }

          const activeIndex = fullFlowScreens.indexOf(screen)
          const nextScreen =
            mode === 'full' && activeIndex >= 0 ? fullFlowScreens[activeIndex + 1] : undefined

          if (nextScreen) {
            activeDriver.destroy()
            driverRef.current = null
            router.push(`${screenRoutes[nextScreen]}?startTour=full&tourScreen=${nextScreen}`)
            return
          }

          void completeTour()
          activeDriver.destroy()
          driverRef.current = null
        },
      })

      driverRef.current.drive()
    },
    [completeTour, router, user?.settings?.onboarding?.role]
  )

  const destroyTour = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  return { startTour, destroyTour }
}
