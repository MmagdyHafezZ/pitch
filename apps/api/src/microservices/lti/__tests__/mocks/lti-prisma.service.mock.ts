/**
 * Factory for a fully-mocked LtiPrismaService.
 * Each Prisma delegate method returns a jest.fn() so tests can configure
 * return values with .mockResolvedValue() / .mockRejectedValue().
 */

const makeDelegate = () => ({
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
});

export const createMockLtiPrismaService = () => ({
  platform: makeDelegate(),
  deployment: makeDelegate(),
  nonce: makeDelegate(),
  session: makeDelegate(),
  lineItem: makeDelegate(),
  score: makeDelegate(),
});

export type MockLtiPrismaService = ReturnType<
  typeof createMockLtiPrismaService
>;
