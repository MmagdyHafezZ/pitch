import { faker } from '@faker-js/faker';
import { UserFactory } from './user.factory';

export interface CreateAuthData {
  email?: string;
  password?: string;
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Factory to create mock auth data for testing
 */
export class AuthFactory {
  /**
   * Create registration DTO
   */
  static createRegisterDto(overrides: CreateAuthData = {}) {
    return {
      email: faker.internet.email(),
      password: faker.internet.password({ length: 8 }),
      name: faker.person.fullName(),
      ...overrides,
    };
  }

  /**
   * Create login DTO
   */
  static createLoginDto(
    overrides: Pick<CreateAuthData, 'email' | 'password'> = {},
  ) {
    return {
      email: faker.internet.email(),
      password: faker.internet.password({ length: 8 }),
      ...overrides,
    };
  }

  /**
   * Create auth response DTO
   */
  static createAuthResponseDto(userOverrides = {}) {
    const user = UserFactory.createResponseDto(userOverrides);
    return {
      token: faker.string.alphanumeric(100),
      refreshToken: faker.string.alphanumeric(100),
      user,
    };
  }

  /**
   * Create refresh token DTO
   */
  static createRefreshTokenDto() {
    return {
      refreshToken: faker.string.alphanumeric(100),
    };
  }

  /**
   * Create JWT tokens for testing
   */
  static createTokens(): AuthTokens {
    return {
      accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({
          sub: faker.string.uuid(),
          email: faker.internet.email(),
          name: faker.person.fullName(),
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64')}.${faker.string.alphanumeric(43)}`,
      refreshToken: faker.string.alphanumeric(128),
    };
  }

  /**
   * Create refresh token entity
   */
  static createRefreshTokenEntity(userIdOverride?: string) {
    return {
      id: faker.string.uuid(),
      token: faker.string.alphanumeric(128),
      userId: userIdOverride || faker.string.uuid(),
      expiresAt: faker.date.future(),
      createdAt: faker.date.past(),
      user: UserFactory.create({ id: userIdOverride }),
    };
  }

  /**
   * Create multiple refresh tokens for a user
   */
  static createManyRefreshTokens(userId: string, count: number) {
    return Array.from({ length: count }, () =>
      this.createRefreshTokenEntity(userId),
    );
  }

  /**
   * Create expired refresh token
   */
  static createExpiredRefreshToken(userIdOverride?: string) {
    return this.createRefreshTokenEntity(userIdOverride).then((token) => ({
      ...token,
      expiresAt: faker.date.past(),
    }));
  }
}
