import { create } from 'zustand'
import { OnboardingData, OnboardingStep } from '../types'

interface OnboardingStore {
  step: OnboardingStep
  data: OnboardingData
  isSaving: boolean
  setStep: (step: OnboardingStep) => void
  updateData: (partial: Partial<OnboardingData>) => void
  setIsSaving: (saving: boolean) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingStore>()((set) => ({
  step: 'welcome',
  data: {},
  isSaving: false,

  setStep: (step) => set({ step }),
  updateData: (partial) => set((state) => ({ data: { ...state.data, ...partial } })),
  setIsSaving: (isSaving) => set({ isSaving }),
  reset: () => set({ step: 'welcome', data: {}, isSaving: false }),
}))
