import { Injectable, NotFoundException } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/user-client';
import {
  CreateUserDto,
  UpdateUserDto,
  User,
  UserSettings,
} from '@pitch/shared-backend/interfaces/user.interface';
import { UserRepository } from '../repositories/user.repository';
import type { PrismaError } from '@pitch/shared-backend/interfaces/error.interface';
import { AuthProvider } from '../../auth/factories/oauth-provider.factory';

export interface EmailCheckResult {
  exists: boolean;
  provider?: string;
  requiresOAuth?: boolean;
  message: string;
  providers?: Array<{ provider: string; displayName: string }>;
}

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  private toUser<T extends PrismaUser & Record<string, unknown>>(
    user: T,
  ): User {
    const rawSettings: unknown = user.settings;
    const settings =
      rawSettings &&
      typeof rawSettings === 'object' &&
      !Array.isArray(rawSettings)
        ? (rawSettings as UserSettings)
        : null;

    return {
      ...user,
      settings,
    } as User;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.findMany();
    return users.map((user) => this.toUser(user));
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.toUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    return user ? this.toUser(user) : null;
  }

  async getSettings(id: string): Promise<UserSettings> {
    await this.findOne(id);
    return (await this.userRepository.getSettings(id)) ?? {};
  }

  async findByOAuthAccount(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    const user = await this.userRepository.findByOAuthAccount(
      provider,
      providerId,
    );
    return user ? this.toUser(user) : null;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.toUser(await this.userRepository.create(createUserDto));
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      return this.toUser(await this.userRepository.update(id, updateUserDto));
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.userRepository.delete(id);
      return { message: `User with ID ${id} has been deleted` };
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async getOAuthAccountsByUserId(userId: string) {
    return await this.userRepository.getOAuthAccounts(userId);
  }

  async updateSettings(
    id: string,
    settings: UserSettings,
  ): Promise<UserSettings> {
    try {
      return await this.userRepository.updateSettings(id, settings);
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }
}
