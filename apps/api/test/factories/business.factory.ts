import { faker } from '@faker-js/faker';

export interface CreateBusinessData {
  id?: string;
  name?: string;
  description?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Factory to create mock business data for testing
 */
export class BusinessFactory {
  static create(overrides: CreateBusinessData = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      description: faker.company.catchPhrase(),
      userId: faker.string.uuid(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: CreateBusinessData = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create a business with a specific user
   */
  static createForUser(userId: string, overrides: CreateBusinessData = {}) {
    return this.create({
      userId,
      ...overrides,
    });
  }

  /**
   * Create a business DTO for API requests
   */
  static createDto(overrides: Partial<CreateBusinessData> = {}) {
    const business = this.create(overrides);
    // Remove fields that shouldn't be in DTOs
    const { id, createdAt, updatedAt, ...dto } = business;
    return dto;
  }

  /**
   * Create a business with user details
   */
  static createWithUser(
    userOverrides = {},
    businessOverrides: CreateBusinessData = {},
  ) {
    const business = this.create(businessOverrides);
    const user = {
      id: business.userId,
      email: faker.internet.email(),
      name: faker.person.fullName(),
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...userOverrides,
    };

    return {
      ...business,
      user,
    };
  }

  /**
   * Create multiple businesses for the same user
   */
  static createManyForUser(
    userId: string,
    count: number,
    overrides: CreateBusinessData = {},
  ) {
    return Array.from({ length: count }, () =>
      this.createForUser(userId, overrides),
    );
  }
}
