import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, BillingInterval } from '@prisma/user-client';
import {
  Subscription,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  UpgradeSubscriptionDto,
  Period,
} from '@pitch/shared-backend/interfaces/user.interface';
import {
  SubscriptionRepository,
  SubscriptionWithPlan,
} from '../repositories/subscription.repository';
import { PlanRepository } from '../../plans/repositories/plans.repository';
import { CoinRefillService } from '../../coins/services/coin-refill.service';
import { CoinRedisService } from '../../coins/services/coin-redis.service';
import { CoinAccountingService } from '../../coins/services/coin-accounting.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly coinAccountingService: CoinAccountingService,
    private readonly coinRedisService: CoinRedisService,
    private readonly coinRefillService: CoinRefillService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
  ) {}

  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
    requesterId: string,
  ): Promise<SubscriptionWithPlan> {
    if (await this.checkExistingSubscription(createSubscriptionDto.teamId)) {
      throw new ConflictException(
        `Team with ID ${createSubscriptionDto.teamId} already has an active subscription`,
      );
    }

    const plan = await this.planRepository.findById(
      createSubscriptionDto.planId,
    );
    if (!plan) {
      throw new NotFoundException(
        `Plan with ID ${createSubscriptionDto.planId} not found`,
      );
    }
    if (
      createSubscriptionDto.currentPeriodStart === null ||
      !createSubscriptionDto.currentPeriodStart
    ) {
      createSubscriptionDto.currentPeriodStart = new Date();
    }

    const period_end = this.addInterval(
      createSubscriptionDto.currentPeriodStart,
      createSubscriptionDto.interval,
    );

    const sub = await this.subscriptionRepository.create({
      teamId: createSubscriptionDto.teamId,
      planId: createSubscriptionDto.planId,
      interval: createSubscriptionDto.interval,
      currentPeriodStart: createSubscriptionDto.currentPeriodStart,
      currentPeriodEnd: period_end,
      cancelAtPeriodEnd: createSubscriptionDto.cancelAtPeriodEnd ?? false,
    });
    await this.coinRefillService.refillInitialForSubscription(sub, requesterId);
    return sub;
  }

  async updateSubscription(
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    const data: Prisma.SubscriptionUpdateInput = {};

    if (dto.planId !== undefined) {
      (data as Prisma.SubscriptionUncheckedUpdateInput).planId = dto.planId;
    }
    if (dto.interval !== undefined) {
      data.interval = dto.interval;
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

    return this.subscriptionRepository.update(subscriptionId, data);
  }

  async upgradeSubscription(
    subscriptionId: string,
    dto: UpgradeSubscriptionDto,
  ): Promise<SubscriptionWithPlan> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    const newPlan = await this.planRepository.findById(dto.planId);
    if (!newPlan) {
      throw new NotFoundException(`Plan with ID ${dto.planId} not found`);
    }

    const teamId = existing.teamId;

    const periodKey = this.coinAccountingService.buildPeriodKey({
      subscriptionId: existing.id,
      startMs: existing.currentPeriodStart.getTime(),
      endMs: existing.currentPeriodEnd.getTime(),
    });

    const ttlSeconds = Math.max(
      60,
      Math.ceil((existing.currentPeriodEnd.getTime() - Date.now()) / 1000),
    );
    await this.coinRedisService.initRemainingIfMissing(
      teamId,
      periodKey,
      Number(existing.plan.maxCoins),
      ttlSeconds,
    );

    const oldAllowance = Number(existing.plan.maxCoins);
    const newAllowance = Number(newPlan.maxCoins);
    const deltaAllowance = newAllowance - oldAllowance;

    const eventId = `upgrade:${subscriptionId}:${dto.planId}:${existing.currentPeriodEnd.toISOString()}`;

    await this.coinRedisService.applyDeltaIdempotent({
      teamId,
      periodKey,
      deltaCoins: -deltaAllowance,
      eventId,
      ttlSeconds,
    });

    return await this.subscriptionRepository.update(subscriptionId, {
      planId: dto.planId,
    });
  }

  async removeSubscription(
    subscriptionId: string,
  ): Promise<{ message: string }> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }
    if (existing.cancelAtPeriodEnd) {
      return {
        message: `Subscription with ID ${subscriptionId} is already scheduled to cancel at period end`,
      };
    }

    const now = Date.now();
    const periodEndMs = existing.currentPeriodEnd.getTime();

    if (now < periodEndMs) {
      await this.subscriptionRepository.update(subscriptionId, {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(now),
      });

      return {
        message: `Subscription with ID ${subscriptionId} will be canceled at period end (${existing.currentPeriodEnd.toISOString()})`,
      };
    }
    await this.subscriptionRepository.update(subscriptionId, {
      isActive: false,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(now),
    });

    return {
      message: `Subscription with ID ${subscriptionId} has been canceled`,
    };
  }

  async updateSubscriptionPeriod(
    subscriptionId: string,
    dto: Period,
  ): Promise<Subscription> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    return this.subscriptionRepository.update(subscriptionId, {
      currentPeriodStart: dto.start,
      currentPeriodEnd: dto.end,
    });
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

  async findSubForTeam(teamId: string): Promise<Subscription> {
    const subscription =
      await this.subscriptionRepository.findActiveByTeamId(teamId);
    if (!subscription) {
      throw new NotFoundException(
        `Couldn't find a subscription for team with ID ${teamId}`,
      );
    }
    return subscription;
  }

  async findActiveSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.findAllActive();
  }

  async findDueForRollover(): Promise<SubscriptionWithPlan[]> {
    const now = Date.now();
    return this.subscriptionRepository.findDueForRollover(new Date(now));
  }

  public addInterval(d: Date, interval: BillingInterval) {
    const date = new Date(d);
    switch (interval) {
      case BillingInterval.MONTH:
        date.setMonth(date.getMonth() + 1);
        break;
      case BillingInterval.QUARTER:
        date.setMonth(date.getMonth() + 3);
        break;
      case BillingInterval.SEMIANNUAL:
        date.setMonth(date.getMonth() + 6);
        break;
      case BillingInterval.ANNUAL:
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        throw new Error(`Unsupported interval "${interval}"`);
    }
    return date;
  }
}
