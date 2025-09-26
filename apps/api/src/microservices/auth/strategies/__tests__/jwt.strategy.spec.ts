import { UnauthorizedException } from '@nestjs/common';
import type { AuthService } from '../../auth.service';
import { JwtStrategy, JwtPayload } from '../jwt.strategy';

describe('JwtStrategy', () => {
  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    name: 'User',
  };

  type AuthServiceMock = {
    getUser: jest.Mock;
  };

  const createStrategy = () => {
    const authService: AuthServiceMock = {
      getUser: jest.fn(),
    };

    return {
      strategy: new JwtStrategy(authService as unknown as AuthService),
      authService,
    };
  };

  it('returns the user when validation succeeds', async () => {
    const { strategy, authService } = createStrategy();
    const user = { id: 'user-1', email: 'user@example.com' };
    authService.getUser.mockResolvedValue(user);

    await expect(strategy.validate(payload)).resolves.toBe(user);
  });

  it('throws UnauthorizedException when user lookup returns null', async () => {
    const { strategy, authService } = createStrategy();
    authService.getUser.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(
      new UnauthorizedException('Invalid token'),
    );
  });

  it('throws UnauthorizedException when fetching user fails', async () => {
    const { strategy, authService } = createStrategy();
    authService.getUser.mockRejectedValue(new Error('db unreachable'));

    await expect(strategy.validate(payload)).rejects.toThrow(
      new UnauthorizedException('Invalid token'),
    );
  });
});
