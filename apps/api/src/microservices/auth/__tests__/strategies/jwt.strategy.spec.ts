import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from '../../strategies/jwt.strategy';
import { AuthService } from '../../auth.service';

// Mock factory for testing
const mockUserFactory = {
  createResponseDto: (overrides = {}) => ({
    id: 'user-id',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      getUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockPayload: JwtPayload = {
      sub: 'user-id',
      email: 'test@example.com',
      name: 'Test User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('should return user when user exists', async () => {
      const mockUser = mockUserFactory.createResponseDto({
        id: mockPayload.sub,
      });
      authService.getUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockPayload);

      expect(authService.getUser).toHaveBeenCalledWith(mockPayload.sub);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is null', async () => {
      authService.getUser.mockResolvedValue(null);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(authService.getUser).toHaveBeenCalledWith(mockPayload.sub);
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      authService.getUser.mockResolvedValue(undefined);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when authService.getUser throws error', async () => {
      authService.getUser.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );

      expect(authService.getUser).toHaveBeenCalledWith(mockPayload.sub);
    });

    it('should handle payload without optional fields', async () => {
      const minimalPayload: JwtPayload = {
        sub: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
      };
      const mockUser = mockUserFactory.createResponseDto({
        id: minimalPayload.sub,
      });
      authService.getUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(minimalPayload);

      expect(authService.getUser).toHaveBeenCalledWith(minimalPayload.sub);
      expect(result).toEqual(mockUser);
    });
  });
});
