'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { OnboardingWizard } from '@/features/onboarding'

export default function OnboardingPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    // If not authenticated, auth-gate handles the redirect
    if (!token) return

    // If onboarding already completed, go to the app
    if (user?.settings?.onboarding?.completed) {
      router.replace('/studio/home')
    }
  }, [user, token, router])

  // Show loading until we know whether to redirect or show onboarding
  if (!token) return <LoadingScreen />

  // If already completed (and redirect hasn't fired yet), show loading
  if (user?.settings?.onboarding?.completed) return <LoadingScreen />

  return <OnboardingWizard />
}
