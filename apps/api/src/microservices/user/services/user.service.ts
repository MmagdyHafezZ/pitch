import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateUserDto,
  UpdateUserDto,
  User,
} from '../../../common/interfaces/user.interface';
import { UserRepository } from '../repositories/user.repository';
import type { PrismaError } from '../../../common/interfaces/error.interface';
import { AuthProvider } from '../factories/oauth-provider.factory';

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

  async findAll(): Promise<User[]> {
    return await this.userRepository.findMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  async findByOAuthAccount(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.userRepository.findByOAuthAccount(provider, providerId);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.userRepository.create(createUserDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      return await this.userRepository.update(id, updateUserDto);
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
}
