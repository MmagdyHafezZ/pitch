import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { AuthApplicationService } from '../services/auth-application.service';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { OAuthProviderFactory } from '../factories/oauth-provider.factory';

/**
 * Auth RPC Controller
 *
 * Handles authentication message patterns from the gateway.
 * This controller is THIN - it only receives messages, validates, and delegates to the application service.
 *
 * Layering: Gateway → [RPC] → Controller → Application Service → Domain/Repository
 */
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authApplicationService: AuthApplicationService,
    private readonly oauthProviderFactory: OAuthProviderFactory,
  ) {}

  /**
   * Register a new user
   * Pattern: auth.register
   */
  @MessagePattern(USER_SERVICE_PATTERNS.REGISTER)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(@Payload() dto: RegisterDto) {
    try {
      this.logger.log(`Registration request for: ${dto.email}`);
      return await this.authApplicationService.register(dto);
    } catch (error) {
      this.logger.error(`Registration failed for ${dto.email}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Login user
   * Pattern: auth.login
   */
  @MessagePattern(USER_SERVICE_PATTERNS.LOGIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async login(@Payload() dto: LoginDto) {
    try {
      this.logger.log(`Login request for: ${dto.email}`);
      return await this.authApplicationService.login(dto);
    } catch (error) {
      this.logger.error(`Login failed for ${dto.email}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Logout user
   * Pattern: auth.logout
   */
  @MessagePattern(USER_SERVICE_PATTERNS.LOGOUT)
  async logout(@Payload() data: { userId: string; refreshToken?: string }) {
    try {
      this.logger.log(`Logout request for user: ${data.userId}`);
      return await this.authApplicationService.logout(
        data.userId,
        data.refreshToken,
      );
    } catch (error) {
      this.logger.error(`Logout failed for user: ${data.userId}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Refresh access token
   * Pattern: auth.refresh
   */
  @MessagePattern(USER_SERVICE_PATTERNS.REFRESH)
  async refresh(@Payload() data: { refreshToken: string }) {
    try {
      this.logger.log('Token refresh request');
      return await this.authApplicationService.refreshToken(data.refreshToken);
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw toRpcException(error);
    }
  }

  /**
   * Validate user (internal use)
   * Pattern: auth.validateUser
   */
  @MessagePattern(USER_SERVICE_PATTERNS.VALIDATE_USER)
  async validateUser(@Payload() data: { email: string; password?: string }) {
    try {
      this.logger.log(`User validation request for: ${data.email}`);
      return await this.authApplicationService.validateUser(data.email);
    } catch (error) {
      this.logger.error(`User validation failed for ${data.email}`, error);
      throw toRpcException(error);
    }
  }

  /**
   * Get available OAuth providers
   * Pattern: auth.oauth.getProviders
   */
  @MessagePattern(USER_SERVICE_PATTERNS.OAUTH_GET_PROVIDERS)
  getOAuthProviders() {
    try {
      this.logger.log(
        '📥 UserMicroservice: Received RabbitMQ message on user_queue - Fetching OAuth providers',
      );
      const providers = this.oauthProviderFactory.getEnabledProviders();
      this.logger.log(
        `✅ UserMicroservice: Returning ${providers.length} enabled OAuth providers via RabbitMQ`,
      );
      return providers;
    } catch (error) {
      this.logger.error(
        '❌ UserMicroservice: Failed to get OAuth providers',
        error,
      );
      throw toRpcException(error);
    }
  }

  /**
   * Check if email exists and return associated OAuth provider
   * Pattern: auth.checkEmail
   */
  @MessagePattern(USER_SERVICE_PATTERNS.CHECK_EMAIL)
  async checkEmail(@Payload() data: { email: string }) {
    try {
      this.logger.log(`Email check request for: ${data.email}`);
      return await this.authApplicationService.checkEmail(data.email);
    } catch (error) {
      this.logger.error(`Email check failed for ${data.email}`, error);
      throw toRpcException(error);
    }
  }
}
