import type { ExecutionContext } from '@nestjs/common';
import { currentUserFactory } from '../current-user.decorator';

describe('CurrentUser decorator', () => {
  const createContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('returns the full user object when no key provided', () => {
    const user = {
      id: '1',
      email: 'user@example.com',
      name: 'User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const context = createContext(user);

    expect(currentUserFactory(undefined, context)).toBe(user);
  });

  it('returns the requested property when present and string', () => {
    const user = {
      id: '1',
      email: 'user@example.com',
      name: 'User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const context = createContext(user);

    expect(currentUserFactory('email', context)).toBe('user@example.com');
  });

  it('returns undefined when user missing or property not string', () => {
    const contextWithoutUser = createContext(undefined);
    expect(currentUserFactory('email', contextWithoutUser)).toBeUndefined();

    const contextWithObject = createContext({
      id: '1',
      email: 'user@example.com',
      name: 'User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(currentUserFactory('createdAt', contextWithObject)).toBeUndefined();
  });
});
