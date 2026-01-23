import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/user-client';
import {
  Subscription,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from '@pitch/shared-backend/interfaces/user.interface';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { PlanRepository } from '../../plans/repositories/plans.repository';
import { TeamService } from '../../team/services/team.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly teamService: TeamService,
  ) {}

  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
    requesterId: string,
  ): Promise<Subscription> {
    if (await this.checkExistingSubscription(createSubscriptionDto.teamId)) {
      throw new ConflictException(
        `Team with ID ${createSubscriptionDto.teamId} already has an active subscription`,
      );
    }

    await this.teamService.confirmAuthorityOrThrow(
      requesterId,
      createSubscriptionDto.teamId,
    );

    const plan = await this.planRepository.findById(
      createSubscriptionDto.planId,
    );
    if (!plan) {
      throw new NotFoundException(
        `Plan with ID ${createSubscriptionDto.planId} not found`,
      );
    }

    const period_end = createSubscriptionDto.currentPeriodStart + plan.interval;

    return this.subscriptionRepository.create({
      teamId: createSubscriptionDto.teamId,
      planId: createSubscriptionDto.planId,
      status: createSubscriptionDto.status ?? SubscriptionStatus.ACTIVE,
      currentPeriodStart: createSubscriptionDto.currentPeriodStart,
      currentPeriodEnd: period_end,
      cancelAtPeriodEnd: createSubscriptionDto.cancelAtPeriodEnd ?? false,
    });
  }

  async updateSubscription(
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
    requesterId: string,
  ): Promise<Subscription> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    await this.teamService.confirmAuthorityOrThrow(
      requesterId,
      existing.teamId,
    );

    const data: Prisma.SubscriptionUpdateInput = {};

    if (dto.planId !== undefined) {
      (data as Prisma.SubscriptionUncheckedUpdateInput).planId = dto.planId;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.currentPeriodStart !== undefined) {
      data.currentPeriodStart = dto.currentPeriodStart;
    }

    if (dto.currentPeriodEnd !== undefined) {
      data.currentPeriodEnd = dto.currentPeriodEnd;
    }

    if (dto.cancelAtPeriodEnd !== undefined) {
      data.cancelAtPeriodEnd = dto.cancelAtPeriodEnd;
    }

    if (dto.metadata !== undefined) {
      const metadata:
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput =
        dto.metadata === null
          ? Prisma.JsonNull
          : (dto.metadata as Prisma.InputJsonValue);

      data.metadata = metadata;
    }

    if (
      dto.status === SubscriptionStatus.CANCELED &&
      dto.canceledAt === undefined
    ) {
      data.canceledAt = new Date();
    } else if (dto.canceledAt !== undefined) {
      data.canceledAt = dto.canceledAt;
    }

    return this.subscriptionRepository.update(subscriptionId, data);
  }

  async removeSubscription(
    subscriptionId: string,
    requesterId: string,
  ): Promise<{ message: string }> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    await this.teamService.confirmAuthorityOrThrow(
      requesterId,
      existing.teamId,
    );

    await this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
    });

    return {
      message: `Subscription with ID ${subscriptionId} has been canceled`,
    };
  }

  async checkExistingSubscription(teamId: string): Promise<Boolean> {
    return (
      (await this.subscriptionRepository.findActiveByTeamId(teamId)) !== null
    );
  }

  async findAll(): Promise<Subscription[]> {
    return this.subscriptionRepository.findAll();
  }

  async findActiveByTeam(teamId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findActiveByTeamId(teamId);
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(id);
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return subscription;
  }
}
