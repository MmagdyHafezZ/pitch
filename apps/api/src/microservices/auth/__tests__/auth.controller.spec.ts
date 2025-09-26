import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

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
  createAuthResponseDto: () => ({
    token: 'access-token',
    refreshToken: 'refresh-token',
    user: mockUserFactory.createResponseDto(),
  }),
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      getUser: jest.fn(),
      validateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = mockAuthFactory.createRegisterDto();
    const mockAuthResponse = mockAuthFactory.createAuthResponseDto();

    it('should successfully register a user', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw RpcException with proper status for ConflictException', async () => {
      const conflictError = new ConflictException(
        'User with this email already exists',
      );
      authService.register.mockRejectedValue(conflictError);

      await expect(controller.register(registerDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.CONFLICT,
          message: 'User with this email already exists',
        }),
      );
    });

    it('should throw RpcException with INTERNAL_SERVER_ERROR for unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      authService.register.mockRejectedValue(unknownError);

      await expect(controller.register(registerDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Unknown error',
        }),
      );
    });

    it('should handle errors without status property', async () => {
      const errorWithoutStatus = { message: 'Custom error' };
      authService.register.mockRejectedValue(errorWithoutStatus);

      await expect(controller.register(registerDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Custom error',
        }),
      );
    });

    it('should fall back to default message when none provided for http errors', async () => {
      authService.register.mockRejectedValue({
        status: HttpStatus.BAD_REQUEST,
      });

      await expect(controller.register(registerDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Registration failed',
        }),
      );
    });

    it('should fall back to default message when no details provided', async () => {
      authService.register.mockRejectedValue({});

      await expect(controller.register(registerDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Registration failed',
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto = mockAuthFactory.createLoginDto();
    const mockAuthResponse = mockAuthFactory.createAuthResponseDto();

    it('should successfully login a user', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw RpcException for UnauthorizedException', async () => {
      const unauthorizedError = new UnauthorizedException(
        'Invalid credentials',
      );
      authService.login.mockRejectedValue(unauthorizedError);

      await expect(controller.login(loginDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Invalid credentials',
        }),
      );
    });

    it('should throw RpcException with INTERNAL_SERVER_ERROR for unknown errors', async () => {
      const unknownError = new Error('Database connection failed');
      authService.login.mockRejectedValue(unknownError);

      await expect(controller.login(loginDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database connection failed',
        }),
      );
    });

    it('should use default message when login error has status but no message', async () => {
      authService.login.mockRejectedValue({ status: HttpStatus.BAD_REQUEST });

      await expect(controller.login(loginDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Login failed',
        }),
      );
    });

    it('should use default message when login error lacks details', async () => {
      authService.login.mockRejectedValue({});

      await expect(controller.login(loginDto)).rejects.toThrow(
        new RpcException({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Login failed',
        }),
      );
    });
  });

  describe('refreshToken', () => {
    const refreshTokenPayload = { refreshToken: 'valid-refresh-token' };
    const mockTokenResponse = {
      token: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    it('should successfully refresh tokens', async () => {
      authService.refreshToken.mockResolvedValue(mockTokenResponse);

      const result = await controller.refreshToken(refreshTokenPayload);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshTokenPayload.refreshToken,
      );
      expect(result).toEqual(mockTokenResponse);
    });

    it('should propagate errors from auth service', async () => {
      const unauthorizedError = new UnauthorizedException(
        'Invalid refresh token',
      );
      authService.refreshToken.mockRejectedValue(unauthorizedError);

      await expect(
        controller.refreshToken(refreshTokenPayload),
      ).rejects.toThrow(unauthorizedError);
    });
  });

  describe('logout', () => {
    const logoutPayload = { userId: 'user-id', refreshToken: 'refresh-token' };
    const logoutPayloadWithoutToken = { userId: 'user-id' };

    it('should successfully logout user with refresh token', async () => {
      authService.logout.mockResolvedValue();

      await controller.logout(logoutPayload);

      expect(authService.logout).toHaveBeenCalledWith(
        logoutPayload.userId,
        logoutPayload.refreshToken,
      );
    });

    it('should successfully logout user without refresh token', async () => {
      authService.logout.mockResolvedValue();

      await controller.logout(logoutPayloadWithoutToken);

      expect(authService.logout).toHaveBeenCalledWith(
        logoutPayloadWithoutToken.userId,
        undefined,
      );
    });

    it('should propagate errors from auth service', async () => {
      const error = new Error('Database error');
      authService.logout.mockRejectedValue(error);

      await expect(controller.logout(logoutPayload)).rejects.toThrow(error);
    });
  });

  describe('getUser', () => {
    const getUserPayload = { userId: 'user-id' };
    const mockUserResponse = mockUserFactory.createResponseDto();

    it('should successfully get user', async () => {
      authService.getUser.mockResolvedValue(mockUserResponse);

      const result = await controller.getUser(getUserPayload);

      expect(authService.getUser).toHaveBeenCalledWith(getUserPayload.userId);
      expect(result).toEqual(mockUserResponse);
    });

    it('should propagate NotFoundException from auth service', async () => {
      const notFoundError = new NotFoundException('User not found');
      authService.getUser.mockRejectedValue(notFoundError);

      await expect(controller.getUser(getUserPayload)).rejects.toThrow(
        notFoundError,
      );
    });

    it('should propagate other errors from auth service', async () => {
      const error = new Error('Database error');
      authService.getUser.mockRejectedValue(error);

      await expect(controller.getUser(getUserPayload)).rejects.toThrow(error);
    });
  });

  describe('validateUser', () => {
    const validateUserPayload = {
      email: 'test@example.com',
      password: 'password123',
    };
    const mockUser = mockUserFactory.create();
    const mockUserResponse = mockUserFactory.createResponseDto();

    it('should successfully validate user and return user data', async () => {
      authService.validateUser.mockResolvedValue(mockUser);
      authService.getUser.mockResolvedValue(mockUserResponse);

      const result = await controller.validateUser(validateUserPayload);

      expect(authService.validateUser).toHaveBeenCalledWith(
        validateUserPayload.email,
        validateUserPayload.password,
      );
      expect(authService.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUserResponse);
    });

    it('should return null if user validation fails', async () => {
      authService.validateUser.mockResolvedValue(null);

      const result = await controller.validateUser(validateUserPayload);

      expect(authService.validateUser).toHaveBeenCalledWith(
        validateUserPayload.email,
        validateUserPayload.password,
      );
      expect(authService.getUser).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should propagate errors from validateUser', async () => {
      const error = new Error('Database error');
      authService.validateUser.mockRejectedValue(error);

      await expect(
        controller.validateUser(validateUserPayload),
      ).rejects.toThrow(error);
    });

    it('should propagate errors from getUser when user is found', async () => {
      authService.validateUser.mockResolvedValue(mockUser);
      const error = new Error('Database error');
      authService.getUser.mockRejectedValue(error);

      await expect(
        controller.validateUser(validateUserPayload),
      ).rejects.toThrow(error);
    });
  });
});
