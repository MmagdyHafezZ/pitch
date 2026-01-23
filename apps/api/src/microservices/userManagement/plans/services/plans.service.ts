import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/user-client';
import {
  Plan,
  CreatePlanDto,
  UpdatePlanDto,
} from '@pitch/shared-backend/interfaces/user.interface';
import { PlanRepository } from '../repositories/plans.repository';

@Injectable()
export class PlanService {
  constructor(private readonly planRepository: PlanRepository) {}

  async createPlan(
    createPlanDto: CreatePlanDto,
    requesterId: string,
  ): Promise<Plan> {
    const existingByName = await this.planRepository.findByName(
      createPlanDto.name,
    );
    if (existingByName) {
      throw new ConflictException(
        `Plan name '${createPlanDto.name}' is already in use`,
      );
    }

    const limits:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput
      | undefined =
      createPlanDto.limits === null || createPlanDto.limits === undefined
        ? undefined
        : (createPlanDto.limits as Prisma.InputJsonValue);

    return this.planRepository.create({
      name: createPlanDto.name,
      description: createPlanDto.description ?? null,
      planLevel: createPlanDto.planLevel,
      interval: createPlanDto.interval,
      maxCoins: createPlanDto.maxCoins,
      limits,
      isActive: createPlanDto.isActive ?? true,
    });
  }

  async updatePlan(
    planId: string,
    dto: UpdatePlanDto,
    requesterId: string,
  ): Promise<Plan> {
    const existingPlan = await this.planRepository.findById(planId);
    if (!existingPlan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    if (dto.name && dto.name !== existingPlan.name) {
      const planWithName = await this.planRepository.findByName(dto.name);
      if (planWithName && planWithName.id !== planId) {
        throw new ConflictException(
          `Plan name '${dto.name}' is already in use`,
        );
      }
    }

    const data: Prisma.PlanUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.planLevel !== undefined) data.planLevel = dto.planLevel;
    if (dto.interval !== undefined) data.interval = dto.interval;
    if (dto.maxCoins !== undefined) data.maxCoins = dto.maxCoins;

    if (dto.limits !== undefined) {
      const limits: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
        dto.limits === null
          ? Prisma.JsonNull
          : (dto.limits as Prisma.InputJsonValue);

      data.limits = limits;
    }

    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.planRepository.update(planId, data);
  }

  async removePlan(
    planId: string,
    requesterId: string,
  ): Promise<{ message: string }> {
    const existingPlan = await this.planRepository.findById(planId);
    if (!existingPlan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    await this.planRepository.update(planId, { isActive: false });

    return { message: `Plan with ID ${planId} has been deactivated` };
  }

  async findAll(): Promise<Plan[]> {
    return this.planRepository.findAll();
  }

  async findActive(): Promise<Plan[]> {
    return this.planRepository.findActive();
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async findByName(name: string): Promise<Plan | null> {
    return this.planRepository.findByName(name);
  }
}
