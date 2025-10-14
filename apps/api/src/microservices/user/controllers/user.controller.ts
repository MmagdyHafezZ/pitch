import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from '../services/user.service';
import {
  USER_SERVICE_PATTERNS,
  AUTH_SERVICE_PATTERNS,
} from '../../../common/interfaces/message-patterns.interface';
import { OAuthProviderFactory } from '../factories/oauth-provider.factory';
import * as userInterface from '../../../common/interfaces/user.interface';
import * as userClaimsInterface from '../../../common/interfaces/user-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';

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
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting user ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.findOne(data.id);
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
    data: { id: string } & userInterface.UpdateUserDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating user ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims: _userClaims, id, ...updateData } = data;
      return await this.userService.update(id, updateData);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_USER)
  async deleteUser(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting user ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.userService.remove(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(AUTH_SERVICE_PATTERNS.OAUTH_GET_PROVIDERS)
  async getOAuthProviders() {
    try {
      this.logger.log('Getting OAuth providers');
      return this.oauthProviderFactory.getEnabledProviders();
    } catch (error) {
      this.logger.error('Failed to get OAuth providers', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(AUTH_SERVICE_PATTERNS.CHECK_EMAIL)
  async checkEmail(@Payload() data: { email: string }) {
    try {
      this.logger.log(`Checking email: ${data.email}`);

      // Check if user exists with this email
      const user = await this.userService.findByEmail(data.email);

      if (!user) {
        return {
          exists: false,
          message: 'No account found with this email. Please sign up first.',
        };
      }

      // User exists, find their OAuth provider
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

      // Return the primary OAuth provider (first one)
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
