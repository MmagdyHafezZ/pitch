import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from '../services/user.service';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { OAuthProviderFactory } from '../../auth/factories/oauth-provider.factory';
import * as userInterface from '@pitch/shared-backend/interfaces/user.interface';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';

@Controller()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly oauthProviderFactory: OAuthProviderFactory,
  ) {}

  @MessagePattern(USER_SERVICE_PATTERNS.GET_USERS)
  async getUsers(@Payload() data: userClaimsInterface.MessageWithUserClaims) {
    try {
      this.logger.log(
        `Getting users - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.findAll();
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_USER)
  async getUser(
    @Payload()
    data: { userId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting user ${data.userId} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.findOne(data.userId);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_MY_SETTINGS)
  async getMySettings(
    @Payload() data: userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting settings for user ${data.userClaims.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.getSettings(data.userClaims.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.CREATE_USER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createUser(
    @Payload()
    data: userInterface.CreateUserDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating user - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, ...createUserDto } = data;
      void _userClaims;
      return await this.userService.create(createUserDto);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.UPDATE_USER)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateUser(
    @Payload()
    data: { userId: string } & userInterface.UpdateUserDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating user ${data.userId} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, userId, ...updateData } = data;
      void _userClaims;
      return await this.userService.update(userId, updateData);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.UPDATE_MY_SETTINGS)
  async updateMySettings(
    @Payload()
    data: userInterface.UpdateMySettingsDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating settings for user ${data.userClaims.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.updateSettings(
        data.userClaims.id,
        data.settings ?? {},
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_USER)
  async deleteUser(
    @Payload()
    data: { userId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting user ${data.userId} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.remove(data.userId);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.OAUTH_GET_PROVIDERS)
  getOAuthProviders() {
    try {
      this.logger.log('Getting OAuth providers');
      return this.oauthProviderFactory.getEnabledProviders();
    } catch (error) {
      this.logger.error('Failed to get OAuth providers', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.CHECK_EMAIL)
  async checkEmail(@Payload() data: { email: string }) {
    try {
      this.logger.log(`Checking email: ${data.email}`);

      const user = await this.userService.findByEmail(data.email);

      if (!user) {
        return {
          exists: false,
          message: 'No account found with this email. Please sign up first.',
        };
      }

      const oauthAccounts = await this.userService.getOAuthAccountsByUserId(
        user.id,
      );

      if (oauthAccounts.length === 0) {
        return {
          exists: true,
          requiresOAuth: false,
          message:
            'Account found but no OAuth provider configured. Please contact support.',
        };
      }

      const primaryProvider = oauthAccounts[0];

      return {
        exists: true,
        provider: primaryProvider.provider.toLowerCase(),
        requiresOAuth: true,
        message: `Please continue with ${primaryProvider.provider} to sign in`,
        providers: oauthAccounts.map((account) => ({
          provider: account.provider.toLowerCase(),
          displayName: account.provider,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to check email', error);
      throw toRpcException(error);
    }
  }
}
