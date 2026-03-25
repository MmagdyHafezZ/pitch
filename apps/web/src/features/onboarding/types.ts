export type UserRole = 'MANAGER' | 'EMPLOYEE'

export type OnboardingStep =
  | 'welcome'
  | 'role'
  | 'manager-salesforce'
  | 'manager-invite'
  | 'employee-career'
  | 'connect-calendar'
  | 'tutorial'

export interface CareerInfo {
  jobTitle?: string
  yearsOfExperience?: number
  industry?: string
  linkedIn?: string
}

export interface OnboardingData {
  role?: UserRole
  careerInfo?: CareerInfo
  wantsTutorial?: boolean
}

export type TourScreen =
  | 'home'
  | 'sessions'
  | 'create-session'
  | 'challenges'
  | 'analytics'
  | 'team-config'
