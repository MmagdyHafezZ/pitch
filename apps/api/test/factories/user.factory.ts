import { faker } from '@faker-js/faker';

export interface CreateUserData {
  id?: string;
  email?: string;
  name?: string;
  password?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Factory to create mock user data for testing
 */
export class UserFactory {
  static create(overrides: CreateUserData = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      password: '$2b$12$' + faker.string.alphanumeric(53), // Mock bcrypt hash
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: CreateUserData = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create a user for authentication testing
   */
  static createForAuth(overrides: CreateUserData = {}) {
    return this.create({
      email: 'test@example.com',
      password: '$2b$12$hashed-password',
      isActive: true,
      ...overrides,
    });
  }

  /**
   * Create a user DTO for API requests
   */
  static createDto(overrides: Partial<CreateUserData> = {}) {
    const user = this.create(overrides);
    // Remove fields that shouldn't be in DTOs
    const { id, createdAt, updatedAt, ...dto } = user;
    return dto;
  }

  /**
   * Create a user response DTO (without password)
   */
  static createResponseDto(overrides: CreateUserData = {}) {
    const user = this.create(overrides);
    const { password, ...responseDto } = user;
    return responseDto;
  }

  /**
   * Create a JWT payload for a user
   */
  static createJwtPayload(overrides: CreateUserData = {}) {
    const user = this.create(overrides);
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };
  }
}
