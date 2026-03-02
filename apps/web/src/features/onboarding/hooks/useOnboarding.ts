import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useOnboardingStore } from '../stores/onboarding.store'
import { OnboardingData } from '../types'

export function useOnboarding() {
  const router = useRouter()
  const setIsSaving = useOnboardingStore((s) => s.setIsSaving)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const saveSettings = async (data: OnboardingData, completed: boolean) => {
    const existing = user?.settings ?? {}
    await api.users.updateMySettings({
      ...existing,
      onboarding: {
        ...existing.onboarding,
        ...data,
        role: data.role ?? existing.onboarding?.role,
        careerInfo: data.careerInfo ?? existing.onboarding?.careerInfo,
        completed,
        tutorialCompleted: existing.onboarding?.tutorialCompleted ?? false,
      },
    })
    // Update local user state to reflect completed onboarding
    if (user) {
      setUser({
        ...user,
        settings: {
          ...existing,
          onboarding: {
            ...existing.onboarding,
            ...data,
            completed,
          },
        },
      })
    }
  }

  const completeOnboarding = async (data: OnboardingData) => {
    setIsSaving(true)
    try {
      await saveSettings(data, true)
      router.replace('/studio/home')
    } finally {
      setIsSaving(false)
    }
  }

  const skipAll = async () => {
    setIsSaving(true)
    try {
      await saveSettings({}, true)
      router.replace('/studio/home')
    } finally {
      setIsSaving(false)
    }
  }

  const saveProgress = async (data: Partial<OnboardingData>) => {
    const existing = user?.settings ?? {}
    await api.users.updateMySettings({
      ...existing,
      onboarding: {
        ...existing.onboarding,
        ...data,
        completed: false,
      },
    })
  }

  return { completeOnboarding, skipAll, saveProgress }
}
