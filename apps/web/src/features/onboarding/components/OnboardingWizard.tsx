'use client'

import { Box, Button, Group, Progress, Text } from '@mantine/core'
import { AnimatePresence } from 'framer-motion'
import { useCallback, useMemo } from 'react'
import { useOnboardingStore } from '../stores/onboarding.store'
import { useOnboarding } from '../hooks/useOnboarding'
import { WelcomeStep } from './steps/WelcomeStep'
import { RoleStep } from './steps/RoleStep'
import { ManagerSalesforceStep } from './steps/ManagerSalesforceStep'
import { ManagerInviteStep } from './steps/ManagerInviteStep'
import { EmployeeCareerStep } from './steps/EmployeeCareerStep'
import { ConnectCalendarStep } from './steps/ConnectCalendarStep'
import { TutorialOfferStep } from './steps/TutorialOfferStep'
import type { OnboardingStep, UserRole, CareerInfo } from '../types'

function buildSteps(role: UserRole | undefined): OnboardingStep[] {
  if (role === 'MANAGER') {
    return [
      'welcome',
      'role',
      'manager-salesforce',
      'manager-invite',
      'connect-calendar',
      'tutorial',
    ]
  }
  if (role === 'EMPLOYEE') {
    return ['welcome', 'role', 'employee-career', 'connect-calendar', 'tutorial']
  }
  // Role not yet selected — show minimum steps
  return ['welcome', 'role', 'connect-calendar', 'tutorial']
}

export function OnboardingWizard() {
  const { step, data, isSaving, setStep, updateData } = useOnboardingStore()
  const { completeOnboarding, skipAll } = useOnboarding()

  const steps = useMemo(() => buildSteps(data.role), [data.role])
  const currentIndex = steps.indexOf(step)
  const progress = Math.round(((currentIndex + 1) / steps.length) * 100)

  const goNext = useCallback(() => {
    const nextIndex = currentIndex + 1
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex])
    }
  }, [currentIndex, steps, setStep])

  const handleRoleNext = useCallback(
    (role: UserRole) => {
      updateData({ role })
      // Recompute steps with new role and advance
      const newSteps = buildSteps(role)
      const nextStep = newSteps[newSteps.indexOf('role') + 1]
      setStep(nextStep)
    },
    [updateData, setStep]
  )

  const handleCareerNext = useCallback(
    (careerInfo: CareerInfo) => {
      updateData({ careerInfo })
      goNext()
    },
    [updateData, goNext]
  )

  const handleTutorialStart = useCallback(async () => {
    updateData({ wantsTutorial: true })
    await completeOnboarding(
      { ...data, wantsTutorial: true },
      {
        // Navigate once with tour params so the home screen auto-start effect can run.
        redirectTo: '/studio/home?startTour=full&tourScreen=home',
      }
    )
  }, [data, completeOnboarding, updateData])

  const handleTutorialSkip = useCallback(async () => {
    await completeOnboarding({ ...data, wantsTutorial: false })
  }, [data, completeOnboarding])

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onNext={goNext} />
      case 'role':
        return <RoleStep onNext={handleRoleNext} onSkip={goNext} />
      case 'manager-salesforce':
        return <ManagerSalesforceStep onNext={goNext} onSkip={goNext} />
      case 'manager-invite':
        return <ManagerInviteStep onNext={goNext} onSkip={goNext} />
      case 'employee-career':
        return <EmployeeCareerStep onNext={handleCareerNext} onSkip={goNext} />
      case 'connect-calendar':
        return <ConnectCalendarStep onNext={goNext} onSkip={goNext} />
      case 'tutorial':
        return <TutorialOfferStep onStartTour={handleTutorialStart} onSkip={handleTutorialSkip} />
      default:
        return null
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      {/* Header */}
      <Group
        justify="space-between"
        align="center"
        px="xl"
        py="md"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Text fw={700} size="lg" c="indigo">
          PITCH
        </Text>
        <Group gap="md">
          <Text size="sm" c="dimmed">
            Step {currentIndex + 1} of {steps.length}
          </Text>
          <Button variant="subtle" color="gray" size="sm" loading={isSaving} onClick={skipAll}>
            Skip all
          </Button>
        </Group>
      </Group>

      {/* Progress bar */}
      <Progress value={progress} size="xs" radius={0} color="indigo" />

      {/* Step content */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--mantine-spacing-xl)',
        }}
      >
        <Box style={{ width: '100%', maxWidth: 560 }}>
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </Box>
      </Box>
    </Box>
  )
}
