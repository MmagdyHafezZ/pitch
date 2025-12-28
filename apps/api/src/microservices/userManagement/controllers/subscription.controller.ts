import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateSubscriptionRequestDTO,
  UpdateSubscriptionRequestDTO,
} from '../dto/subscription.dto';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from '@pitch/shared-backend/interfaces/user.interface';
import { Prisma } from '@prisma/user-client';
import { SubscriptionService } from '../services/subscription.service';

@Controller()
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @MessagePattern(USER_SERVICE_PATTERNS.CREATE_SUBSCRIPTION)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createSubscription(
    @Payload()
    data: CreateSubscriptionRequestDTO &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating subscription - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );

      const { userClaims: _userClaims, ...createSubscriptionDto } = data;

      const dto: CreateSubscriptionDto = {
        teamId: createSubscriptionDto.teamId,
        planId: createSubscriptionDto.planId,
        status: createSubscriptionDto.status,
        currentPeriodStart: createSubscriptionDto.currentPeriodStart,
        currentPeriodEnd: createSubscriptionDto.currentPeriodEnd,
        cancelAtPeriodEnd: createSubscriptionDto.cancelAtPeriodEnd ?? false,
        metadata:
          (createSubscriptionDto.metadata as unknown as Prisma.JsonValue) ??
          undefined,
      };

      return await this.subscriptionService.createSubscription(
        dto,
        _userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.UPDATE_SUBSCRIPTION)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateSubscription(
    @Payload()
    data: { id: string } & UpdateSubscriptionRequestDTO &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating subscription ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );

      const { userClaims: _userClaims, id, ...updateData } = data;

      const dto: UpdateSubscriptionDto = {
        planId: updateData.planId,
        status: updateData.status,
        currentPeriodStart: updateData.currentPeriodStart,
        currentPeriodEnd: updateData.currentPeriodEnd,
        cancelAtPeriodEnd: updateData.cancelAtPeriodEnd,
        metadata:
          updateData.metadata !== undefined
            ? (updateData.metadata as unknown as Prisma.JsonValue)
            : undefined,
        canceledAt: updateData.canceledAt,
      };

      return await this.subscriptionService.updateSubscription(
        id,
        dto,
        _userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_SUBSCRIPTION)
  async deleteSubscription(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting subscription ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.subscriptionService.removeSubscription(
        data.id,
        data.userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_SUBSCRIPTION)
  async getSubscription(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting subscription ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.subscriptionService.findOne(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_SUBSCRIPTIONS)
  async getSubscriptions(
    @Payload() data: userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting subscriptions - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.subscriptionService.findAll();
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
