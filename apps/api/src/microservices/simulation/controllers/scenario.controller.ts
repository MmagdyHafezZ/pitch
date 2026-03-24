import { Controller, Logger, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsePipes } from '@nestjs/common';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import type { MessageWithUserClaims } from '@pitch/shared-backend/interfaces/user-claims.interface';
import {
  CreateScenarioDto,
  GenerateScenarioBatchRequestDto,
  GenerateScenarioRequestDto,
  ScenarioListQueryDto,
  UpdateScenarioDto,
} from '../dto/scenario.dto';
import { ScenarioService } from '../services/scenario.service';

@Controller()
export class ScenarioController {
  private readonly logger = new Logger(ScenarioController.name);

  constructor(private readonly scenarioService: ScenarioService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO)
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateScenario(
    @Payload() data: GenerateScenarioRequestDto & MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Generating scenario draft for ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims, ...payload } = data;
      return await this.scenarioService.generate(payload, userClaims);
    } catch (error) {
      this.logger.error('Failed to generate scenario draft', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO_BATCH)
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateScenarioBatch(
    @Payload() data: GenerateScenarioBatchRequestDto & MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Generating scenario draft batch for ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims, ...payload } = data;
      return await this.scenarioService.generateBatch(payload, userClaims);
    } catch (error) {
      this.logger.error('Failed to generate scenario draft batch', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.CREATE_SCENARIO)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createScenario(
    @Payload() data: CreateScenarioDto & MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating scenario for ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims, ...payload } = data;
      return await this.scenarioService.create(payload, userClaims);
    } catch (error) {
      this.logger.error('Failed to create scenario', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LIST_SCENARIOS)
  @UsePipes(new ValidationPipe({ transform: true }))
  async listScenarios(
    @Payload() data: ScenarioListQueryDto & MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Listing scenarios for ${data.userClaims?.email || 'unknown'}`,
      );
      const { userClaims, ...query } = data;
      return await this.scenarioService.findAll(query, userClaims);
    } catch (error) {
      this.logger.error('Failed to list scenarios', error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.GET_SCENARIO)
  async getScenario(@Payload() data: { id: string } & MessageWithUserClaims) {
    try {
      this.logger.log(
        `Getting scenario ${data.id} for ${data.userClaims?.email || 'unknown'}`,
      );
      return await this.scenarioService.findById(data.id, data.userClaims);
    } catch (error) {
      this.logger.error(`Failed to get scenario ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.UPDATE_SCENARIO)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateScenario(
    @Payload()
    data: { id: string } & UpdateScenarioDto & MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating scenario ${data.id} for ${data.userClaims?.email || 'unknown'}`,
      );
      const { id, userClaims, ...payload } = data;
      return await this.scenarioService.update(id, payload, userClaims);
    } catch (error) {
      this.logger.error(`Failed to update scenario ${data.id}`, error);
      throw toRpcException(error);
    }
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.DELETE_SCENARIO)
  async deleteScenario(
    @Payload() data: { id: string } & MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting scenario ${data.id} for ${data.userClaims?.email || 'unknown'}`,
      );
      await this.scenarioService.remove(data.id, data.userClaims);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to delete scenario ${data.id}`, error);
      throw toRpcException(error);
    }
  }
}
