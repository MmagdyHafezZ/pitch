import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './user.service';
import { USER_SERVICE_PATTERNS } from '../../common/interfaces/message-patterns.interface';
import * as userInterface from '../../common/interfaces/user.interface';
import * as userClaimsInterface from '../../common/interfaces/user-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';

@Controller()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

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
      const { userClaims, ...createUserDto } = data;
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
      const { id, userClaims, ...updateData } = data;
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
}
