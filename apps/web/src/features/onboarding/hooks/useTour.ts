'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  homeTourSteps,
  sessionsTourSteps,
  createSessionTourSteps,
  challengesTourSteps,
  analyticsTourSteps,
  teamConfigTourSteps,
} from '../tours'
import type { TourScreen } from '../types'

const tourStepsMap = {
  home: homeTourSteps,
  sessions: sessionsTourSteps,
  'create-session': createSessionTourSteps,
  challenges: challengesTourSteps,
  analytics: analyticsTourSteps,
  'team-config': teamConfigTourSteps,
}

const screenRoutes: Record<TourScreen, string> = {
  home: '/studio/home',
  sessions: '/studio/sessions',
  'create-session': '/studio/sessions/create',
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

  const showCoachHandoff = useCallback(async () => {
    const { driver } = await import('driver.js')
    const coachSelector = '[data-tour-id="coach-chat-trigger"]'
    const hasCoachTrigger = document.querySelector(coachSelector) !== null

    driverRef.current?.destroy()
    driverRef.current = driver({
      animate: true,
      showProgress: false,
      showButtons: ['close'],
      allowClose: true,
      steps: [
        hasCoachTrigger
          ? {
              element: coachSelector,
              popover: {
                title: 'Need help or actions?',
                description:
                  'Use this PITCH Coach button anytime to ask for help, generate guidance, or trigger assisted actions in the app.',
                side: 'left',
                align: 'start',
              },
            }
          : {
              popover: {
                title: 'Need help or actions?',
                description:
                  'Use the PITCH Coach chat button in the lower-right corner anytime for guidance or assisted actions.',
                side: 'bottom',
                align: 'center',
              },
            },
      ],
    })
    driverRef.current.drive()
  }, [])

  const finishFullTour = useCallback(async () => {
    await completeTour()
    await showCoachHandoff()
  }, [completeTour, showCoachHandoff])

  const startTour = useCallback(
    async (screen: TourScreen, options?: StartTourOptions) => {
      const { driver } = await import('driver.js')
      const mode = options?.mode ?? 'single'
      const onboardingRole = user?.settings?.onboarding?.role
      const fullFlowScreens: TourScreen[] =
        onboardingRole === 'MANAGER'
          ? ['home', 'sessions', 'create-session', 'challenges', 'analytics', 'team-config']
          : ['home', 'sessions', 'create-session', 'challenges', 'analytics']

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
          await finishFullTour()
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
          const shouldStopTour = window.confirm(
            'Stop tutorial?\n\nYou are about to exit the tutorial. You can restart it anytime from the help icon.'
          )

          if (!shouldStopTour) {
            return
          }

          activeDriver.destroy()
          driverRef.current = null
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

          activeDriver.destroy()
          driverRef.current = null
          if (mode === 'full') {
            void finishFullTour()
          } else {
            void completeTour()
          }
        },
      })

      driverRef.current.drive()
    },
    [completeTour, finishFullTour, router, user?.settings?.onboarding?.role]
  )

  const destroyTour = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  return { startTour, destroyTour }
}
