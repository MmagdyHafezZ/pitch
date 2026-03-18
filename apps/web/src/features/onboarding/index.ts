import { useCallback } from 'react'
import type { ReactElement } from 'react'

export type TourScreen =
  | 'home'
  | 'sessions'
  | 'analytics'
  | 'team-config'
  | 'challenges'
  | 'create-session'

type StartTourOptions = {
  mode?: 'full'
}

export function OnboardingWizard(): ReactElement | null {
  return null
}

export function useTour() {
  const startTour = useCallback(async (_screen: TourScreen, _options?: StartTourOptions) => {
    return
  }, [])

  return { startTour }
}
