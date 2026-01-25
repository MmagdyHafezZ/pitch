/* ---------- ENUMS ---------- */

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
export type PlanLevel = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'
export type BillingInterval = 'MONTH' | 'QUARTER' | 'SEMIANNUAL' | 'ANNUAL'
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED'

/* ---------- READ MODELS ---------- */

export interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  oauthAccounts?: OAuthAccount[]
  memberships?: TeamMembership[]
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
  limits?: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  subscriptions?: Subscription[]
}

export interface Subscription {
  id: string
  teamId: string
  planId: string
  status: SubscriptionStatus
  interval: BillingInterval
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  metadata?: unknown
  createdAt: Date
  updatedAt: Date
  canceledAt?: Date | null
  team?: Team
  plan?: Plan
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
}

export interface CreateTeamDto {
  name: string
  slug?: string
  isActive?: boolean
  billingEmail?: string | null
  billingAddress?: unknown
  metadata?: unknown
}

export interface UpdateTeamDto {
  name?: string
  slug?: string
  isActive?: boolean
  billingEmail?: string | null
  billingAddress?: unknown
  metadata?: unknown
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
  limits?: unknown
  isActive?: boolean
}

export interface UpdatePlanDto {
  name?: string
  description?: string | null
  planLevel?: PlanLevel
  maxCoins?: number
  limits?: unknown
  isActive?: boolean
}

export interface CreateSubscriptionDto {
  teamId: string
  planId: string
  status?: SubscriptionStatus
  interval: BillingInterval
  currentPeriodStart: Date
  cancelAtPeriodEnd?: boolean
}

export interface UpdateSubscriptionDto {
  planId?: string
  status?: SubscriptionStatus
  interval?: BillingInterval
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  metadata?: unknown
  canceledAt?: Date | null
}

export interface UpgradeSubscriptionDto {
  planId: string
  status?: SubscriptionStatus
  interval?: BillingInterval
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  metadata?: unknown
  canceledAt?: Date | null
}
