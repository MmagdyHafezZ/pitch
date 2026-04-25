import { useRouter } from 'next/navigation'
import { api, queryClient } from '@/lib/client'
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
    const mergedSettings = {
      ...existing,
      onboarding: {
        ...existing.onboarding,
        ...data,
        role: data.role ?? existing.onboarding?.role,
        careerInfo: data.careerInfo ?? existing.onboarding?.careerInfo,
        completed,
        tutorialCompleted: existing.onboarding?.tutorialCompleted ?? false,
      },
    }
    const updatedSettings = await api.users.updateMySettings(mergedSettings)

    // Keep auth store and auth/me query cache synchronized to avoid redirect loops.
    if (user) {
      const nextUser = {
        ...user,
        settings: updatedSettings,
      }
      setUser(nextUser)
      queryClient.setQueryData(['auth', 'me'], nextUser)
    }
  }

  const completeOnboarding = async (data: OnboardingData, options?: { redirectTo?: string }) => {
    setIsSaving(true)
    try {
      await saveSettings(data, true)
      router.replace(options?.redirectTo ?? '/studio/home')
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
