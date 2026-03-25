import { Controller, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USER_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import * as userClaimsInterface from '@pitch/shared-backend/interfaces/user-claims.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { CreatePlanRequestDTO, UpdatePlanRequestDTO } from '../dto/plans.dto';
import {
  CreatePlanDto,
  UpdatePlanDto,
} from '@pitch/shared-backend/interfaces/user.interface';
import { PlanService } from '../services/plans.service';

@Controller()
export class PlanController {
  private readonly logger = new Logger(PlanController.name);

  constructor(private readonly planService: PlanService) {}

  @MessagePattern(USER_SERVICE_PATTERNS.CREATE_PLAN)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createPlan(
    @Payload()
    data: CreatePlanRequestDTO & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating plan - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { ...createPlanDto } = data;

      const dto: CreatePlanDto = {
        name: createPlanDto.name,
        description: createPlanDto.description,
        planLevel: createPlanDto.planLevel,
        maxCoins: createPlanDto.maxCoins,
        isActive: createPlanDto.isActive ?? true,
      };

      return await this.planService.createPlan(dto);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.UPDATE_PLAN)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updatePlan(
    @Payload()
    data: { id: string } & UpdatePlanRequestDTO &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating plan ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { id, ...updateData } = data;

      const dto: UpdatePlanDto = {
        name: updateData.name,
        description: updateData.description,
        planLevel: updateData.planLevel,
        maxCoins: updateData.maxCoins,
        isActive: updateData.isActive,
      };

      return await this.planService.updatePlan(id, dto);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.DELETE_PLAN)
  async deletePlan(
    @Payload()
    data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting plan ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.planService.removePlan(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_PLAN)
  async getPlan(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting plan ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.planService.findOne(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(USER_SERVICE_PATTERNS.GET_PLANS)
  async getPlans(@Payload() data: userClaimsInterface.MessageWithUserClaims) {
    try {
      this.logger.log(
        `Getting plans - Requested by: ${data.userClaims?.email ?? 'admin'} (${data.userClaims?.id ?? 'N/A'})`,
      );
      return await this.planService.findAll();
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
