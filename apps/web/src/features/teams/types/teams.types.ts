export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined }

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER' | string

/* ---------- READ MODELS (API responses) ---------- */

export interface UserSummary {
  id: string
  email: string
  name: string
  avatar?: string | null
  isActive: boolean
  invitedAt?: string
}

export interface TeamMembership {
  id: string
  userId: string
  teamId: string
  role: TeamRole
  tokenLimit: number
  isActive?: boolean
  acceptedAt?: string | null
  invitedByUserId: string | null
  user?: UserSummary
}

export interface Team {
  id: string
  name: string
  slug: string
  isActive: boolean
  billingEmail?: string | null
  billingAddress?: JsonValue | undefined
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  memberships?: TeamMembership[]
}

export interface CreateTeamInput {
  name: string
  slug?: string
  isActive?: boolean
  billingEmail?: string | null
  billingAddress?: JsonValue | undefined
  metadata?: JsonValue
}

export interface UpdateTeamInput {
  name?: string
  slug?: string
  isActive?: boolean
  billingEmail?: string | null
  billingAddress?: JsonValue | undefined
  metadata?: JsonValue
}

export interface AddMemberInput {
  userId: string
  role?: TeamRole
  tokenLimit?: number
  isActive?: boolean
}

export interface UpdateMemberInput {
  role?: TeamRole
  tokenLimit?: number
  isActive?: boolean
  acceptedAt?: string | null
}
