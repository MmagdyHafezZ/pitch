import { Prisma } from '@prisma/user-client';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  oauthAccounts?: OAuthAccount[];
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
