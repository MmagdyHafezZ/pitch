import { Controller, Logger, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, UserResponseDto } from './dto/auth.dto';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @MessagePattern('auth.register')
  async register(@Payload() registerDto: RegisterDto): Promise<AuthResponseDto> {
    this.logger.log('Processing registration request');
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      this.logger.error('Registration failed', error.stack);

      // Convert HttpException to RpcException with proper status
      if (error.status) {
        throw new RpcException({
          statusCode: error.status,
          message: error.message,
        });
      }

      throw new RpcException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Registration failed',
      });
    }
  }

  @MessagePattern('auth.login')
  async login(@Payload() loginDto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log('Processing login request');
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      this.logger.error('Login failed', error.stack);

      if (error.status) {
        throw new RpcException({
          statusCode: error.status,
          message: error.message,
        });
      }

      throw new RpcException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Login failed',
      });
    }
  }

  @MessagePattern('auth.refresh')
  async refreshToken(@Payload() payload: { refreshToken: string }): Promise<{ token: string; refreshToken: string }> {
    this.logger.log('Processing token refresh request');
    try {
      return await this.authService.refreshToken(payload.refreshToken);
    } catch (error) {
      this.logger.error('Token refresh failed', error.stack);
      throw error;
    }
  }

  @MessagePattern('auth.logout')
  async logout(@Payload() payload: { userId: string; refreshToken?: string }): Promise<void> {
    this.logger.log(`Processing logout request for user: ${payload.userId}`);
    try {
      return await this.authService.logout(payload.userId, payload.refreshToken);
    } catch (error) {
      this.logger.error('Logout failed', error.stack);
      throw error;
    }
  }

  @MessagePattern('auth.getUser')
  async getUser(@Payload() payload: { userId: string }): Promise<UserResponseDto> {
    this.logger.log(`Processing get user request for: ${payload.userId}`);
    try {
      return await this.authService.getUser(payload.userId);
    } catch (error) {
      this.logger.error('Get user failed', error.stack);
      throw error;
    }
  }

  @MessagePattern('auth.validateUser')
  async validateUser(@Payload() payload: { email: string; password: string }): Promise<UserResponseDto | null> {
    this.logger.log(`Processing user validation for: ${payload.email}`);
    try {
      const user = await this.authService.validateUser(payload.email, payload.password);
      return user ? this.authService.getUser(user.id) : null;
    } catch (error) {
      this.logger.error('User validation failed', error.stack);
      throw error;
    }
  }
}