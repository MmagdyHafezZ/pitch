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
