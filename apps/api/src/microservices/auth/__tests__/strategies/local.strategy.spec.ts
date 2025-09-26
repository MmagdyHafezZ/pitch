import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from '../../strategies/local.strategy';
import { AuthService } from '../../auth.service';

// Mock factory for testing
const mockUserFactory = {
  create: (overrides = {}) => ({
    id: 'user-id',
    email: 'test@example.com',
    name: 'Test User',
    password: '$2b$12$hashed-password',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }),
};

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      validateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const email = 'test@example.com';
    const password = 'password123';

    it('should return user when credentials are valid', async () => {
      const mockUser = mockUserFactory.create({ email });
      authService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(email, password);

      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is null', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(email, password)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      authService.validateUser.mockResolvedValue(undefined);

      await expect(strategy.validate(email, password)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should propagate errors from authService', async () => {
      const error = new Error('Database error');
      authService.validateUser.mockRejectedValue(error);

      await expect(strategy.validate(email, password)).rejects.toThrow(error);

      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
    });

    it('should handle empty email', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', password)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(authService.validateUser).toHaveBeenCalledWith('', password);
    });

    it('should handle empty password', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(email, '')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(authService.validateUser).toHaveBeenCalledWith(email, '');
    });
  });
});
