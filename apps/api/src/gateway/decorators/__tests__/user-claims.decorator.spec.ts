import { ExecutionContext } from '@nestjs/common';

const RESULT_METADATA_KEY = 'custom:paramtype';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    createParamDecorator: (factory: Function) => {
      (factory as any).__factory = factory;
      return factory;
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UserClaims } = require('../user-claims.decorator');
const factory = (UserClaims as any).__factory ?? UserClaims;

function makeExecutionContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('UserClaims decorator', () => {
  it('returns the full user object when no data key is specified', () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    const ctx = makeExecutionContext(user);

    const result = factory(undefined, ctx);

    expect(result).toEqual(user);
  });

  it('returns a specific field when data key is provided', () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    const ctx = makeExecutionContext(user);

    expect(factory('email', ctx)).toBe('a@b.com');
    expect(factory('id', ctx)).toBe('u1');
    expect(factory('name', ctx)).toBe('Alice');
  });

  it('returns undefined when user is not present on request', () => {
    const ctx = makeExecutionContext(undefined);

    const result = factory(undefined, ctx);

    expect(result).toBeUndefined();
  });

  it('returns undefined when data key is specified but user is not present', () => {
    const ctx = makeExecutionContext(undefined);

    const result = factory('email', ctx);

    expect(result).toBeUndefined();
  });

  it('returns undefined when data key points to a non-string field', () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      roles: ['admin'],
    };
    const ctx = makeExecutionContext(user);

    const result = factory('roles' as any, ctx);

    expect(result).toBeUndefined();
  });
});
