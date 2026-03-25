import { act } from '@testing-library/react'
import { useOnboardingStore } from '../onboarding.store'
import type { OnboardingStep, OnboardingData } from '../../types'

const resetStore = () => {
  act(() => {
    useOnboardingStore.setState({
      step: 'welcome',
      data: {},
      isSaving: false,
    })
  })
}

describe('OnboardingStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useOnboardingStore.getState()

      expect(state.step).toBe('welcome')
      expect(state.data).toEqual({})
      expect(state.isSaving).toBe(false)
    })
  })

  describe('setStep', () => {
    it('should update the current step', () => {
      act(() => {
        useOnboardingStore.getState().setStep('role')
      })

      expect(useOnboardingStore.getState().step).toBe('role')
    })

    it.each<OnboardingStep>([
      'welcome',
      'role',
      'manager-salesforce',
      'manager-invite',
      'employee-career',
      'tutorial',
    ])('should set step to %s', (step) => {
      act(() => {
        useOnboardingStore.getState().setStep(step)
      })

      expect(useOnboardingStore.getState().step).toBe(step)
    })
  })

  describe('updateData', () => {
    it('should merge partial data into existing data', () => {
      act(() => {
        useOnboardingStore.getState().updateData({ role: 'MANAGER' })
      })

      expect(useOnboardingStore.getState().data.role).toBe('MANAGER')
    })

    it('should preserve existing fields when merging', () => {
      act(() => {
        useOnboardingStore.getState().updateData({ role: 'EMPLOYEE' })
      })

      act(() => {
        useOnboardingStore.getState().updateData({ wantsTutorial: true })
      })

      const data = useOnboardingStore.getState().data
      expect(data.role).toBe('EMPLOYEE')
      expect(data.wantsTutorial).toBe(true)
    })

    it('should overwrite existing fields with new values', () => {
      act(() => {
        useOnboardingStore.getState().updateData({ role: 'MANAGER' })
      })

      act(() => {
        useOnboardingStore.getState().updateData({ role: 'EMPLOYEE' })
      })

      expect(useOnboardingStore.getState().data.role).toBe('EMPLOYEE')
    })

    it('should allow updating careerInfo', () => {
      const careerInfo = {
        jobTitle: 'Sales Rep',
        yearsOfExperience: 3,
        industry: 'Tech',
        linkedIn: 'https://linkedin.com/in/salesrep',
      }

      act(() => {
        useOnboardingStore.getState().updateData({ careerInfo })
      })

      expect(useOnboardingStore.getState().data.careerInfo).toEqual(careerInfo)
    })

    it('should handle multiple simultaneous field updates', () => {
      const update: Partial<OnboardingData> = {
        role: 'MANAGER',
        wantsTutorial: false,
      }

      act(() => {
        useOnboardingStore.getState().updateData(update)
      })

      const data = useOnboardingStore.getState().data
      expect(data.role).toBe('MANAGER')
      expect(data.wantsTutorial).toBe(false)
    })
  })

  describe('setIsSaving', () => {
    it('should set isSaving to true', () => {
      act(() => {
        useOnboardingStore.getState().setIsSaving(true)
      })

      expect(useOnboardingStore.getState().isSaving).toBe(true)
    })

    it('should set isSaving to false', () => {
      act(() => {
        useOnboardingStore.setState({ isSaving: true })
        useOnboardingStore.getState().setIsSaving(false)
      })

      expect(useOnboardingStore.getState().isSaving).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      act(() => {
        useOnboardingStore.setState({
          step: 'tutorial',
          data: { role: 'MANAGER', wantsTutorial: true },
          isSaving: true,
        })
      })

      act(() => {
        useOnboardingStore.getState().reset()
      })

      const state = useOnboardingStore.getState()
      expect(state.step).toBe('welcome')
      expect(state.data).toEqual({})
      expect(state.isSaving).toBe(false)
    })

    it('should be idempotent when called on already-reset state', () => {
      act(() => {
        useOnboardingStore.getState().reset()
      })

      const state = useOnboardingStore.getState()
      expect(state.step).toBe('welcome')
      expect(state.data).toEqual({})
      expect(state.isSaving).toBe(false)
    })
  })

  describe('Step flow', () => {
    it('should support a complete onboarding flow for MANAGER role', () => {
      act(() => {
        useOnboardingStore.getState().setStep('role')
        useOnboardingStore.getState().updateData({ role: 'MANAGER' })
      })

      act(() => {
        useOnboardingStore.getState().setStep('manager-salesforce')
      })

      act(() => {
        useOnboardingStore.getState().setStep('manager-invite')
      })

      act(() => {
        useOnboardingStore.getState().setStep('tutorial')
        useOnboardingStore.getState().updateData({ wantsTutorial: true })
      })

      const state = useOnboardingStore.getState()
      expect(state.step).toBe('tutorial')
      expect(state.data.role).toBe('MANAGER')
      expect(state.data.wantsTutorial).toBe(true)
    })

    it('should support a complete onboarding flow for EMPLOYEE role', () => {
      act(() => {
        useOnboardingStore.getState().setStep('role')
        useOnboardingStore.getState().updateData({ role: 'EMPLOYEE' })
      })

      act(() => {
        useOnboardingStore.getState().setStep('employee-career')
        useOnboardingStore.getState().updateData({
          careerInfo: { jobTitle: 'AE', yearsOfExperience: 2 },
        })
      })

      act(() => {
        useOnboardingStore.getState().setStep('tutorial')
        useOnboardingStore.getState().updateData({ wantsTutorial: false })
      })

      const state = useOnboardingStore.getState()
      expect(state.step).toBe('tutorial')
      expect(state.data.role).toBe('EMPLOYEE')
      expect(state.data.careerInfo?.jobTitle).toBe('AE')
      expect(state.data.wantsTutorial).toBe(false)
    })
  })
})
