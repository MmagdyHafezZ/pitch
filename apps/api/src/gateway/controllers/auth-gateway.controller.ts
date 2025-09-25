import {
  Controller,
  Post,
  Get,
  Body,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
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
import { catchError, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Public } from '../../microservices/auth/decorators/public.decorator';
import { CurrentUser } from '../../microservices/auth/decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  AuthResponseDto,
  UserResponseDto,
} from '../../microservices/auth/dto/auth.dto';

@ApiTags('authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthGatewayController {
  private readonly logger = new Logger(AuthGatewayController.name);

  constructor(@Inject('AUTH_SERVICE') private authService: ClientProxy) {}

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
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Registration attempt for: ${registerDto.email}`);

    return this.authService.send('auth.register', registerDto).pipe(
      timeout(10000),
      catchError((err) => {
        const status = err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
        const message = err?.message ?? 'Registration failed';
        this.logger.error(
          `Registration failed for ${registerDto.email}`,
          err?.stack ?? JSON.stringify(err),
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
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for: ${loginDto.email}`);

    return this.authService.send('auth.login', loginDto).pipe(
      timeout(10000),
      catchError((error) => {
        this.logger.error(`Login failed for ${loginDto.email}`, error.stack);
        const status = error.status || HttpStatus.UNAUTHORIZED;
        const message = error.message || 'Login failed';
        throw new HttpException(message, status);
      }),
    );
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    this.logger.log('Token refresh attempt');

    return this.authService
      .send('auth.refresh', {
        refreshToken: refreshTokenDto.refreshToken,
      })
      .pipe(
        timeout(10000),
        catchError((error) => {
          this.logger.error('Token refresh failed', error.stack);
          const status = error.status || HttpStatus.UNAUTHORIZED;
          const message = error.message || 'Token refresh failed';
          throw new HttpException(message, status);
        }),
      );
  }

  @Post('logout')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() body?: { refreshToken?: string },
  ) {
    this.logger.log(`Logout attempt for user: ${userId}`);

    return this.authService
      .send('auth.logout', {
        userId,
        refreshToken: body?.refreshToken,
      })
      .pipe(
        timeout(10000),
        catchError((error) => {
          this.logger.error(`Logout failed for user: ${userId}`, error.stack);
          const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
          const message = error.message || 'Logout failed';
          throw new HttpException(message, status);
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
  async getProfile(@CurrentUser('id') userId: string) {
    this.logger.log(`Profile request for user: ${userId}`);

    return this.authService.send('auth.getUser', { userId }).pipe(
      timeout(10000),
      catchError((error) => {
        this.logger.error(
          `Failed to get profile for user: ${userId}`,
          error.stack,
        );
        const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const message = error.message || 'Failed to get user profile';
        throw new HttpException(message, status);
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
  async validateToken(@CurrentUser() user: UserResponseDto) {
    this.logger.log(`Token validation for user: ${user.id}`);
    return user;
  }
}
