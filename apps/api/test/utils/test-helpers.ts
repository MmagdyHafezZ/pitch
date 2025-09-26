import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

/**
 * Creates a mock Prisma service with common methods
 */
export const createMockPrismaService = () => ({
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  user: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  business: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
});

/**
 * Creates a mock JWT service
 */
export const createMockJwtService = (): Partial<JwtService> => ({
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest
    .fn()
    .mockReturnValue({ sub: 'user-id', email: 'test@example.com' }),
  decode: jest
    .fn()
    .mockReturnValue({ sub: 'user-id', email: 'test@example.com' }),
});

/**
 * Creates a mock microservice client proxy
 */
export const createMockClientProxy = (): Partial<ClientProxy> => ({
  send: jest
    .fn()
    .mockImplementation((pattern, data) => of({ id: '1', ...data })),
  emit: jest.fn().mockImplementation(() => of({})),
  close: jest.fn().mockImplementation(() => Promise.resolve()),
});

/**
 * Creates a mock execution context for testing guards and decorators
 */
export const createMockExecutionContext = (
  user?: unknown,
): ExecutionContext => {
  const request = {
    user,
    headers: { authorization: 'Bearer mock-token' },
    body: {},
    method: 'GET',
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    getType: jest.fn(),
  } as ExecutionContext;
};

/**
 * Helper to create a mock user for tests
 */
export const createMockUser = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  name: 'Test User',
  password: '$2b$12$hashed-password',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Helper to create a mock business for tests
 */
export const createMockBusiness = (overrides = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440000',
  name: 'Test Business',
  description: 'A test business',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Helper to wait for a promise to resolve or reject
 */
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to create error responses for testing
 */
export const createErrorResponse = (code: string, message: string) => ({
  code,
  message,
  stack: 'Error stack trace',
});

/**
 * Helper to create RPC exception responses
 */
export const createRpcError = (status: number, message: string) => {
  const error = new Error(message);
  (error as unknown as { status: number }).status = status;
  return error;
};

export type MockedClass<T extends object> = {
  [K in keyof T]: T[K] extends (this: any, ...args: infer A) => infer R
    ? jest.Mock<R, A>
    : T[K];
};
