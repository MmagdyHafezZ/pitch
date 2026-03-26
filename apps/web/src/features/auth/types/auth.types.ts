export interface UserOnboardingSettings {
  completed?: boolean
  tutorialCompleted?: boolean
  role?: 'MANAGER' | 'EMPLOYEE'
  careerInfo?: {
    jobTitle?: string
    yearsOfExperience?: number
    industry?: string
    linkedIn?: string
  }
}

export interface StudioAccessSettings {
  status?: 'pending' | 'approved' | 'denied'
  requestedAt?: string
  reviewedAt?: string
  reviewedByUserId?: string
  reviewedByEmail?: string
  quota?: number
  role?: 'MEMBER' | 'ADMIN' | 'OWNER'
  teamId?: string
  planId?: string
  subscriptionId?: string
}

export interface UserSettings {
  onboarding?: UserOnboardingSettings
  crm?: {
    connected?: boolean
    provider?: string | null
    name?: string | null
    providerEmail?: string | null
  }
  language?: {
    locale?: string
  }
  studioAccess?: StudioAccessSettings
  [key: string]: unknown
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  isSystemAdmin?: boolean
  phoneNumber?: string | null
  phoneVerifiedAt?: string | null
  isActive: boolean
  hasStudioAccess?: boolean
  isSystemAdmin?: boolean
  createdAt: string
  updatedAt: string
  settings?: UserSettings | null
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  deleteAccount: () => Promise<void>
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  refreshAccessToken: () => Promise<boolean>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  initializeAuth: () => void
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  name: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}
