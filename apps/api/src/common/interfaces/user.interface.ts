import { Prisma, Role } from '@prisma/user-client';

/* ---------- READ MODELS ---------- */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  oauthAccounts?: OAuthAccount[];
  memberships?: TeamMembership[];
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  isActive: boolean;
  invitedAt?: Date;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  billingEmail?: string | null;
  billingAddress?: Prisma.JsonValue | undefined;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  memberships?: TeamMembership[];
}

export interface OAuthAccount {
  id: string;
  provider: string;
  providerId: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMembership {
  id: string;
  userId: string;
  teamId: string;
  role: Role;
  tokenLimit: number;
  isActive?: boolean;
  acceptedAt?: Date | null;
  invitedByUserId: string | null;
  user?: UserSummary;
}

/* ---------- Write MODELS ---------- */

export interface CreateUserDto {
  email: string;
  name: string;
  avatar?: string;
  isActive?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  avatar?: string;
  isActive?: boolean;
}

export interface CreateTeamDto {
  name: string;
  slug?: string;
  isActive?: boolean;
  billingEmail?: string | null;
  billingAddress?: Prisma.JsonValue | undefined;
  metadata?: Prisma.JsonValue;
}

export interface UpdateTeamDto {
  name?: string;
  slug?: string;
  isActive?: boolean;
  billingEmail?: string | null;
  billingAddress?: Prisma.JsonValue | undefined;
  metadata?: Prisma.JsonValue;
}

export interface AddMemberDto {
  teamId: string;
  userId: string;
  role?: Role;
  tokenLimit?: number;
  isActive?: boolean;
  invitedByUserId?: string | null;
}

export interface UpdateMemberDto {
  teamId: string;
  userId: string;
  role?: Role;
  tokenLimit?: number;
  isActive?: boolean;
  acceptedAt?: Date | null;
}
