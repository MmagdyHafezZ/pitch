import {
  Controller,
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import {
  CreateSubscriptionRequestDTO,
  UpdateSubscriptionRequestDTO,
  UpgradeSubscriptionRequestDTO,
} from '../dto/subscription.dto';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  UpgradeSubscriptionDto,
  SubscriptionMetadata,
} from '@pitch/shared-backend/interfaces/user.interface';
import { SubscriptionService } from '../services/subscription.service';
import { ElevatedAccessGuard } from '../../guards/elevated-access.guard';

@Controller()
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @UseGuards(ElevatedAccessGuard)
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
        interval: createSubscriptionDto.interval,
        currentPeriodStart: createSubscriptionDto.currentPeriodStart
          ? new Date(createSubscriptionDto.currentPeriodStart)
          : null,
        cancelAtPeriodEnd: createSubscriptionDto.cancelAtPeriodEnd ?? false,
        metadata:
          createSubscriptionDto.metadata as unknown as SubscriptionMetadata,
      };

      return await this.subscriptionService.createSubscription(
        dto,
        _userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
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

      const { id, ...updateData } = data;

      const dto: UpdateSubscriptionDto = {
        teamId: updateData.teamId,
        planId: updateData.planId,
        interval: updateData.interval,
        limits: updateData.limits,
        metadata: updateData.metadata as unknown as SubscriptionMetadata,
        cancelAtPeriodEnd: updateData.cancelAtPeriodEnd,
      };

      return await this.subscriptionService.updateSubscription(
        id,
        dto,
        data.userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.UPGRADE_SUBSCRIPTION)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async upgradeSubscription(
    @Payload()
    data: { id: string } & UpgradeSubscriptionRequestDTO &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating subscription ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );

      const { id, ...updateData } = data;

      const dto: UpgradeSubscriptionDto = {
        planId: updateData.planId,
        interval: updateData.interval,
        limits: updateData.limits,
        metadata: updateData.metadata as unknown as SubscriptionMetadata,
      };

      return await this.subscriptionService.upgradeSubscription(
        id,
        dto,
        data.userClaims.id,
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
      return await this.subscriptionService.removeSubscription(data.id);
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

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.GET_TEAM_SUBSCRIPTION)
  async getTeamSubscription(
    @Payload()
    data: { teamId: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting subscription for Team ${data.teamId} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.subscriptionService.findSubForTeam(data.teamId);
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

  @UseGuards(ElevatedAccessGuard)
  @MessagePattern(USER_SERVICE_PATTERNS.REQUEST_PLAN_CHANGE)
  async requestPlanChange(
    @Payload()
    data: {
      id: string;
      planId: string;
      interval?: string;
    } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Plan change requested for ${data.id} → planId=${data.planId} by ${data.userClaims.email}`,
      );
      return await this.subscriptionService.requestPlanChange(
        data.id,
        { planId: data.planId, interval: data.interval },
        data.userClaims.id,
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.LIST_PENDING_PLAN_CHANGES)
  async listPendingPlanChanges(
    @Payload() _data: userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      return await this.subscriptionService.listPendingPlanChanges();
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.APPROVE_PLAN_CHANGE)
  async approvePlanChange(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Approving plan change for ${data.id} by ${data.userClaims?.email ?? 'admin'}`,
      );
      return await this.subscriptionService.approvePlanChange(
        data.id,
        data.userClaims?.id ?? 'admin',
      );
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.REJECT_PLAN_CHANGE)
  async rejectPlanChange(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Rejecting plan change for ${data.id} by ${data.userClaims?.email ?? 'admin'}`,
      );
      return await this.subscriptionService.rejectPlanChange(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
