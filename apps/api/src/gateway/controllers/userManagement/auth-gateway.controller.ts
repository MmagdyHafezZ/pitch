import {
  Controller,
  Post,
  Get,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  Request,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { catchError, timeout, retry, delay } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Public } from '../../../microservices/userManagement/decorators/public.decorator';
import { CurrentUser } from '../../../microservices/userManagement/decorators/current-user.decorator';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { getWhitelistedRoutes } from '../../config/auth-whitelist.config';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  AuthResponseDto,
  UserResponseDto,
} from '../../../microservices/userManagement/auth/dto/auth.dto';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { UserClaims } from '../../decorators/user-claims.decorator';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';

@ApiTags('authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthGatewayController {
  private readonly logger = new Logger(AuthGatewayController.name);

  constructor(@Inject('USER_SERVICE') private userService: ClientProxy) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Registration attempt for: ${registerDto.email}`);

    return this.userService
      .send(USER_SERVICE_PATTERNS.REGISTER, registerDto)
      .pipe(
        timeout(10000),
        retry({
          count: 2,
          delay: (_error: Error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for registration: ${registerDto.email}`,
            );
            return delay(Math.min(1000 * retryCount, 3000))(
              throwError(() => _error),
            );
          },
        }),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Registration failed';
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(
            `Registration failed for ${registerDto.email}`,
            stack,
          );
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for: ${loginDto.email}`);

    return this.userService.send('auth.login', loginDto).pipe(
      timeout(10000),
      catchError((err: unknown) => {
        const error = normalizeError(err);
        const stack = error.stack ?? JSON.stringify(err);
        this.logger.error(`Login failed for ${loginDto.email}`, stack);
        const status = error.status ?? HttpStatus.UNAUTHORIZED;
        const message = error.message ?? 'Login failed';
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    this.logger.log('Token refresh attempt');

    return this.userService
      .send(USER_SERVICE_PATTERNS.REFRESH, {
        refreshToken: refreshTokenDto.refreshToken,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error('Token refresh failed', stack);
          const status = error.status ?? HttpStatus.UNAUTHORIZED;
          const message = error.message ?? 'Token refresh failed';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('logout')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logout(
    @CurrentUser('id') userId: string,
    @Body() body?: { refreshToken?: string },
  ) {
    this.logger.log(`Logout attempt for user: ${userId}`);

    return this.userService
      .send('auth.logout', {
        userId,
        refreshToken: body?.refreshToken,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(`Logout failed for user: ${userId}`, stack);
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Logout failed';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(
    @CurrentUser('id') userId: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    this.logger.log(`Profile request for user: ${userId}`);

    return this.userService
      .send(USER_SERVICE_PATTERNS.GET_USER, { id: userId, userClaims })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error(`Failed to get profile for user: ${userId}`, stack);
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Failed to get user profile';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get('validate')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Validate current token and get user info' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  validateToken(@CurrentUser() user: UserResponseDto) {
    this.logger.log(`Token validation for user: ${user.id}`);
    return user;
  }

  @Get('oauth/providers')
  @Public()
  @ApiOperation({
    summary: 'Get available OAuth providers',
    description: 'Returns list of configured OAuth providers for the frontend',
  })
  @ApiResponse({
    status: 200,
    description: 'Available OAuth providers',
    example: [
      {
        name: 'google',
        displayName: 'Google',
        icon: '🔍',
        color: '#4285f4',
        authUrl: '/auth/oauth/google',
      },
      {
        name: 'github',
        displayName: 'GitHub',
        icon: '🐙',
        color: '#333333',
        authUrl: '/auth/oauth/github',
      },
    ],
  })
  getOAuthProviders() {
    this.logger.log('Gateway: Fetching OAuth providers');
    const pattern = USER_SERVICE_PATTERNS.OAUTH_GET_PROVIDERS;
    this.logger.debug(
      `📤 Sending RabbitMQ message: pattern="${pattern}" to queue="user_queue"`,
    );

    return this.userService.send(pattern, {}).pipe(
      timeout(10000),
      catchError((err: unknown) => {
        const error = normalizeError(err);
        const stack = error.stack ?? JSON.stringify(err);
        this.logger.error('Gateway: Failed to get OAuth providers', stack);
        const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
        const message =
          error.message ?? 'Gateway: Failed to get OAuth providers';
        return throwError(() => new HttpException(message, status));
      }),
    );
  }

  @Get('whitelist')
  @Public()
  @ApiOperation({
    summary: 'Get auth whitelist configuration',
    description:
      'Returns list of routes that bypass authentication (for debugging)',
  })
  @ApiResponse({
    status: 200,
    description: 'Auth whitelist configuration',
  })
  getAuthWhitelist() {
    this.logger.log('Fetching auth whitelist configuration');
    return {
      routes: getWhitelistedRoutes(),
      message: 'These routes bypass the global JWT auth guard',
    };
  }

  @Post('check-email')
  @Public()
  @ApiOperation({
    summary: 'Check if email exists and return associated OAuth provider',
    description:
      'Returns the OAuth provider associated with the email for redirect-based login',
  })
  @ApiResponse({
    status: 200,
    description: 'Email check result',
    example: {
      exists: true,
      provider: 'google',
      requiresOAuth: true,
      message: 'Please continue with Google to sign in',
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Email not found',
    example: {
      exists: false,
      message: 'No account found with this email. Please sign up first.',
    },
  })
  checkEmail(@Body() checkEmailDto: { email: string }) {
    this.logger.log(`Checking email existence: ${checkEmailDto.email}`);

    return this.userService
      .send(USER_SERVICE_PATTERNS.CHECK_EMAIL, { email: checkEmailDto.email })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const stack = error.stack ?? JSON.stringify(err);
          this.logger.error('Email check failed', stack);
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message ?? 'Email check failed';
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
