import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthPrismaService } from '../auth-prisma.service';
// Mock factories for testing
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

const mockAuthFactory = {
  createRegisterDto: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    ...overrides,
  }),
  createLoginDto: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'password123',
    ...overrides,
  }),
  createRefreshTokenEntity: (userId = 'user-id') => ({
    id: 'token-id',
    token: 'refresh-token',
    userId,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
  }),
};

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<AuthPrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthPrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(AuthPrismaService);
    jwtService = module.get(JwtService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = mockAuthFactory.createRegisterDto();
    const mockUser = mockUserFactory.create({ email: registerDto.email });

    it('should successfully register a new user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      prismaService.user.create.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      prismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.register(registerDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: 'hashed-password',
          name: registerDto.name,
        },
      });
      expect(result).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        }),
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw ConflictException if user already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during registration', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      prismaService.user.create.mockRejectedValue(new Error('Database error'));

      await expect(service.register(registerDto)).rejects.toThrow(
        'Database error',
      );
    });

    it('should rethrow errors without stack information during registration', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      const plainError = { message: 'Plain failure' } as unknown as Error;
      prismaService.user.create.mockRejectedValue(plainError);

      await expect(service.register(registerDto)).rejects.toBe(plainError);
    });
  });

  describe('login', () => {
    const loginDto = mockAuthFactory.createLoginDto();
    const mockUser = mockUserFactory.create({
      email: loginDto.email,
      isActive: true,
    });

    it('should successfully login with valid credentials', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      prismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.login(loginDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(result).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        }),
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = mockUserFactory.create({
        email: loginDto.email,
        isActive: false,
      });
      prismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Account is disabled'),
      );

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should rethrow non-Error failures during login', async () => {
      prismaService.user.findUnique.mockRejectedValue({
        message: 'Database down',
      });

      await expect(service.login(loginDto)).rejects.toEqual({
        message: 'Database down',
      });
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const mockUser = mockUserFactory.create();
    const mockRefreshTokenEntity = mockAuthFactory.createRefreshTokenEntity(
      mockUser.id,
    );

    it('should successfully refresh tokens with valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id, type: 'refresh' });
      prismaService.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshTokenEntity,
        user: mockUser,
        expiresAt: new Date(Date.now() + 86400000), // Future date
      });
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'new-token-id',
        token: 'new-refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      prismaService.refreshToken.delete.mockResolvedValue(
        mockRefreshTokenEntity,
      );
      prismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.refreshToken(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(prismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: refreshToken },
        include: { user: true },
      });
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: mockRefreshTokenEntity.id },
      });
      expect(result).toEqual({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException if refresh token is not found in database', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id, type: 'refresh' });
      prismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id, type: 'refresh' });
      prismaService.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshTokenEntity,
        user: mockUser,
        expiresAt: new Date(Date.now() - 86400000), // Past date
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException if JWT verification fails', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });

  describe('internal helpers', () => {
    const mockUser = mockUserFactory.create();

    it('handles cleanup failures when generating tokens', async () => {
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({} as any);
      prismaService.refreshToken.deleteMany.mockRejectedValueOnce(
        new Error('cleanup error'),
      );

      await expect((service as any).generateTokens(mockUser)).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('logout', () => {
    const userId = 'user-id';
    const refreshToken = 'refresh-token';

    it('should logout user with specific refresh token', async () => {
      prismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(userId, refreshToken);

      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId,
          token: refreshToken,
        },
      });
    });

    it('should logout user and remove all refresh tokens when no specific token provided', async () => {
      prismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await service.logout(userId);

      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should handle database errors during logout', async () => {
      prismaService.refreshToken.deleteMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.logout(userId, refreshToken)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getUser', () => {
    const userId = 'user-id';
    const mockUser = mockUserFactory.create({ id: userId });

    it('should return user without password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUser(userId);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        }),
      );
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUser(userId)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('should handle database errors when getting user', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getUser(userId)).rejects.toThrow('Database error');
    });
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockUser = mockUserFactory.create({ email });

    it('should return user if credentials are valid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser(email, password);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        password,
        mockUser.password,
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null if password is invalid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should return null and log error if database error occurs', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });
  });
});
