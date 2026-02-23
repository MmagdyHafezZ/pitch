/* ---------- ENUMS ---------- */

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
export type PlanLevel = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'
export type BillingInterval = 'MONTH' | 'QUARTER' | 'SEMIANNUAL' | 'ANNUAL'

/* ---------- READ MODELS ---------- */

export interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  settings?: UserSettings | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  oauthAccounts?: OAuthAccount[]
  memberships?: TeamMembership[]
}

export interface UserSettings {
  account?: {
    timezone?: string
  }
  notifications?: {
    emailNotifications?: boolean
    desktopNotifications?: boolean
    productUpdates?: boolean
  }
  voiceVideo?: {
    preferredMicrophone?: string
    preferredSpeaker?: string
    noiseSuppression?: boolean
    echoCancellation?: boolean
    autoJoinMuted?: boolean
  }
  appearance?: {
    colorMode?: 'light' | 'dark' | 'system'
    activeProfileId?: string
    profiles?: unknown[]
    customDraft?: Record<string, string>
    customDraftGradient?: boolean
  }
  language?: {
    locale?: string
  }
  browser?: {
    openLinksInNewTab?: boolean
    compactMode?: boolean
    reduceMotion?: boolean
  }
  crm?: {
    provider?: string | null
    connected?: boolean
    providerEmail?: string | null
    lastSyncAt?: string | null
    autoSync?: boolean
  }
}

export interface UserSummary {
  id: string
  email: string
  name: string
  avatar?: string | null
  isActive: boolean
  invitedAt?: Date
}

export interface Team {
  id: string
  name: string
  slug: string
  isActive: boolean
  billingEmail?: string | null
  billingAddress?: unknown
  metadata?: TeamMetadata | null
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
  memberships?: TeamMembership[]
}

export interface OAuthAccount {
  id: string
  provider: string
  providerId: string
  email: string
  name?: string | null
  avatar?: string | null
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface TeamMembership {
  id: string
  userId: string
  teamId: string
  role: Role
  tokenLimit: number
  isActive?: boolean
  acceptedAt?: Date | null
  invitedByUserId: string | null
  user?: UserSummary
}

export interface Plan {
  id: string
  name: string
  description?: string | null
  planLevel: PlanLevel
  maxCoins: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  subscriptions?: Subscription[]
}

export interface Subscription {
  id: string
  teamId: string
  planId: string
  interval: BillingInterval
  limits?: number | null
  isActive: boolean
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  metadata?: SubscriptionMetadata | null
  createdAt: Date
  updatedAt: Date
  canceledAt?: Date | null
  team?: Team
  plan?: Plan
}

export interface TeamMetadata {
  audit?: {
    ownerUserId?: string
    createdByUserId?: string
    createdAt?: string
    updatedByUserId?: string
    updatedAt?: string
    version?: number
  }
  profile?: {
    industry?: string
    timezone?: string
    locale?: string
  }
  preferences?: {
    defaultColorMode?: 'light' | 'dark' | 'system'
    allowMemberInvites?: boolean
  }
  tags?: string[]
  notes?: string
}

export interface SubscriptionMetadata {
  audit?: {
    createdByUserId?: string
    createdAt?: string
    updatedByUserId?: string
    updatedAt?: string
    upgradedByUserId?: string
    upgradedAt?: string
    version?: number
  }
  billing?: {
    provider?: string
    externalSubscriptionId?: string
    externalCustomerId?: string
  }
  seating?: {
    seats?: number
  }
  notes?: string
}

/* ---------- Write MODELS ---------- */

export interface CreateUserDto {
  email: string
  name: string
  avatar?: string
  isActive?: boolean
}

export interface UpdateUserDto {
  email?: string
  name?: string
  avatar?: string
  isActive?: boolean
  settings?: UserSettings | null
}

export interface UpdateMySettingsDto {
  settings: UserSettings
}

export interface CreateTeamDto {
  name: string
  slug?: string
  isActive?: boolean
  billingEmail?: string | null
  billingAddress?: unknown
  metadata?: TeamMetadata | null
}

export interface UpdateTeamDto {
  name?: string
  slug?: string
  isActive?: boolean
  billingEmail?: string | null
  billingAddress?: unknown
  metadata?: TeamMetadata | null
}

export interface AddMemberDto {
  teamId: string
  userId: string
  role?: Role
  tokenLimit?: number
  isActive?: boolean
  invitedByUserId?: string | null
}

export interface UpdateMemberDto {
  teamId: string
  userId: string
  role?: Role
  tokenLimit?: number
  isActive?: boolean
  acceptedAt?: Date | null
}

export interface CreatePlanDto {
  name: string
  description?: string | null
  planLevel: PlanLevel
  maxCoins: number
  isActive?: boolean
}

export interface UpdatePlanDto {
  name?: string
  description?: string | null
  planLevel?: PlanLevel
  maxCoins?: number
  isActive?: boolean
}

export interface CreateSubscriptionDto {
  teamId: string
  planId: string
  interval: BillingInterval
  limits?: number
  currentPeriodStart?: Date | null
  cancelAtPeriodEnd?: boolean
  metadata?: SubscriptionMetadata | null
}

export interface UpdateSubscriptionDto {
  teamId?: string
  planId?: string
  interval?: BillingInterval
  limits?: number
  metadata?: SubscriptionMetadata | null
  cancelAtPeriodEnd?: boolean
}

export interface UpgradeSubscriptionDto {
  planId: string
  interval?: BillingInterval
  limits?: number
  metadata?: SubscriptionMetadata | null
  canceledAt?: Date | null
}

export interface Period {
  start: Date
  end: Date
}
