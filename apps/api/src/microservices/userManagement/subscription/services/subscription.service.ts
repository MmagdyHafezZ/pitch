import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, BillingInterval } from '@prisma/user-client';
import {
  Subscription,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  UpgradeSubscriptionDto,
  Period,
  SubscriptionMetadata,
} from '@pitch/shared-backend/interfaces/user.interface';
import {
  SubscriptionRepository,
  SubscriptionWithPlan,
} from '../repositories/subscription.repository';
import { PlanRepository } from '../../plans/repositories/plans.repository';
import { CoinRefillService } from '../../coins/services/coin-refill.service';
import { CoinRedisService } from '../../coins/services/coin-redis.service';
import { CoinAccountingService } from '../../coins/services/coin-accounting.service';
import { PlanChangeNotificationService } from './plan-change-notification.service';
import { NotificationService } from '../../notifications/service/notification.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly coinAccountingService: CoinAccountingService,
    private readonly coinRedisService: CoinRedisService,
    private readonly coinRefillService: CoinRefillService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly planChangeNotificationService: PlanChangeNotificationService,
    private readonly notificationService: NotificationService,
  ) {}

  private toSubscription<T extends { metadata?: unknown }>(
    value: T,
  ): Subscription {
    const metadata =
      value.metadata &&
      typeof value.metadata === 'object' &&
      !Array.isArray(value.metadata)
        ? (value.metadata as SubscriptionMetadata)
        : value.metadata === null
          ? null
          : undefined;

    return {
      ...(value as unknown as Subscription),
      metadata,
    };
  }

  private toMetadataObject(value: unknown): SubscriptionMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as SubscriptionMetadata;
  }

  private buildMetadataOnCreate(
    input: SubscriptionMetadata | null | undefined,
    requesterId: string,
  ): Prisma.InputJsonValue {
    const now = new Date().toISOString();
    const metadata = this.toMetadataObject(input);
    const audit = metadata.audit ?? {};
    return {
      ...metadata,
      audit: {
        ...audit,
        createdByUserId: requesterId,
        createdAt: audit.createdAt ?? now,
        updatedByUserId: requesterId,
        updatedAt: now,
        version: typeof audit.version === 'number' ? audit.version : 1,
      },
    } as Prisma.InputJsonValue;
  }

  private buildMetadataOnUpdate(
    existing: unknown,
    patch: SubscriptionMetadata | null | undefined,
    requesterId: string,
    mode: 'update' | 'upgrade' = 'update',
  ): Prisma.InputJsonValue {
    const now = new Date().toISOString();
    const existingMetadata = this.toMetadataObject(existing);
    const patchMetadata = this.toMetadataObject(patch);
    const previousAudit = existingMetadata.audit ?? {};
    const patchAudit = patchMetadata.audit ?? {};
    const nextVersion =
      typeof previousAudit.version === 'number' ? previousAudit.version + 1 : 1;

    return {
      ...existingMetadata,
      ...patchMetadata,
      billing: {
        ...(existingMetadata.billing ?? {}),
        ...(patchMetadata.billing ?? {}),
      },
      seating: {
        ...(existingMetadata.seating ?? {}),
        ...(patchMetadata.seating ?? {}),
      },
      audit: {
        ...previousAudit,
        ...patchAudit,
        createdByUserId: previousAudit.createdByUserId ?? requesterId,
        createdAt: previousAudit.createdAt ?? now,
        updatedByUserId: requesterId,
        updatedAt: now,
        version: nextVersion,
        ...(mode === 'upgrade'
          ? { upgradedByUserId: requesterId, upgradedAt: now }
          : {}),
      },
    } as Prisma.InputJsonValue;
  }

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
      metadata: this.buildMetadataOnCreate(
        createSubscriptionDto.metadata,
        requesterId,
      ),
    });
    await this.coinRefillService.refillInitialForSubscription(sub, requesterId);
    return sub;
  }

  async updateSubscription(
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
    requesterId = 'system',
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
          : this.buildMetadataOnUpdate(
              existing.metadata,
              dto.metadata,
              requesterId,
            );

      data.metadata = metadata;
    } else {
      data.metadata = this.buildMetadataOnUpdate(
        existing.metadata,
        undefined,
        requesterId,
      );
    }

    return this.toSubscription(
      await this.subscriptionRepository.update(subscriptionId, data),
    );
  }

  async upgradeSubscription(
    subscriptionId: string,
    dto: UpgradeSubscriptionDto,
    requesterId = 'system',
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

    const redisResult = await this.coinRedisService.applyDeltaIdempotent({
      teamId,
      periodKey,
      deltaCoins: -deltaAllowance,
      eventId,
      ttlSeconds,
    });
    if (!redisResult.applied && redisResult.reason !== 'ALREADY_PROCESSED') {
      throw new ConflictException(
        `Unable to apply plan upgrade balance delta for subscription ${subscriptionId}`,
      );
    }

    const balanceSnapshot = await this.coinAccountingService.getRemainingCoins(
      teamId,
      {
        periodKey,
        allowanceFallback: newAllowance,
        initIfMissing: false,
      },
    );
    if (balanceSnapshot.ok === false) {
      throw new NotFoundException(
        `No active coin balance found for team ${teamId}`,
      );
    }
    const remainingAfter =
      redisResult.remainingAfter ?? balanceSnapshot.remaining;

    const updateData: Prisma.SubscriptionUncheckedUpdateInput = {
      planId: dto.planId,
      ...(dto.interval !== undefined ? { interval: dto.interval } : {}),
    };
    if (dto.metadata !== undefined) {
      updateData.metadata =
        dto.metadata === null
          ? Prisma.JsonNull
          : this.buildMetadataOnUpdate(
              existing.metadata,
              dto.metadata,
              requesterId,
              'upgrade',
            );
    } else {
      updateData.metadata = this.buildMetadataOnUpdate(
        existing.metadata,
        undefined,
        requesterId,
        'upgrade',
      );
    }

    const updatedSubscription = await this.subscriptionRepository.update(
      subscriptionId,
      updateData,
    );

    await this.coinAccountingService.recordPlanUpgrade({
      teamId,
      subscriptionId,
      planId: dto.planId,
      requesterId,
      periodKey,
      allowance: newAllowance,
      remainingAfter,
      deltaCoins: deltaAllowance,
      eventId,
    });

    return updatedSubscription;
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

    return this.toSubscription(
      await this.subscriptionRepository.update(subscriptionId, {
        currentPeriodStart: dto.start,
        currentPeriodEnd: dto.end,
      }),
    );
  }

  async checkExistingSubscription(teamId: string): Promise<boolean> {
    return (
      (await this.subscriptionRepository.findActiveByTeamId(teamId)) !== null
    );
  }

  async findAll(): Promise<Subscription[]> {
    const subs = await this.subscriptionRepository.findAll();
    return subs.map((sub) => this.toSubscription(sub));
  }

  async findActiveByTeam(teamId: string): Promise<Subscription | null> {
    const sub = await this.subscriptionRepository.findActiveByTeamId(teamId);
    return sub ? this.toSubscription(sub) : null;
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(id);
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return this.toSubscription(subscription);
  }

  async findSubForTeam(teamId: string): Promise<Subscription> {
    const subscription =
      await this.subscriptionRepository.findActiveByTeamId(teamId);
    if (!subscription) {
      throw new NotFoundException(
        `Couldn't find a subscription for team with ID ${teamId}`,
      );
    }
    return this.toSubscription(subscription);
  }

  async findActiveSubscriptions(): Promise<Subscription[]> {
    const subs = await this.subscriptionRepository.findAllActive();
    return subs.map((sub) => this.toSubscription(sub));
  }

  async findDueForRollover(): Promise<SubscriptionWithPlan[]> {
    const now = Date.now();
    return this.subscriptionRepository.findDueForRollover(new Date(now));
  }

  async requestPlanChange(
    subscriptionId: string,
    dto: { planId: string; interval?: string },
    requesterId: string,
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

    const existingMeta = this.toMetadataObject(existing.metadata);
    const updatedMeta: Prisma.InputJsonValue = {
      ...existingMeta,
      pendingPlanChange: {
        requestedPlanId: dto.planId,
        requestedInterval: dto.interval ?? existing.interval,
        requestedAt: new Date().toISOString(),
        requestedByUserId: requesterId,
      },
    };
    const updated = await this.subscriptionRepository.update(subscriptionId, {
      metadata: updatedMeta,
    });

    await this.planChangeNotificationService
      .notifyAdminsOfRequest({
        subscriptionId,
        requesterId,
        currentPlanName: existing.plan?.name,
        requestedPlanName: newPlan.name,
        requestedInterval: dto.interval ?? existing.interval,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to notify admins about plan change request for subscription ${subscriptionId}`,
          error as Error,
        );
      });

    return updated;
  }

  async listPendingPlanChanges(): Promise<SubscriptionWithPlan[]> {
    return this.subscriptionRepository.findAllWithPendingPlanChange();
  }

  async approvePlanChange(
    subscriptionId: string,
    requesterId: string,
  ): Promise<SubscriptionWithPlan> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }
    const meta = this.toMetadataObject(existing.metadata);
    const pending = meta.pendingPlanChange;
    if (!pending) {
      throw new NotFoundException(
        `No pending plan change for subscription ${subscriptionId}`,
      );
    }

    const requestedByUserId = pending.requestedByUserId;
    const requestedPlanId = pending.requestedPlanId;

    // Apply the actual plan change
    const upgraded = await this.upgradeSubscription(
      subscriptionId,
      {
        planId: requestedPlanId,
        interval:
          pending.requestedInterval as import('@prisma/user-client').BillingInterval,
      },
      requesterId,
    );

    // Clear the pending flag
    const cleanedMeta = this.toMetadataObject(upgraded.metadata);
    delete cleanedMeta.pendingPlanChange;
    const updated = await this.subscriptionRepository.update(subscriptionId, {
      metadata: cleanedMeta as Prisma.InputJsonValue,
    });

    await this.clearPendingPlanChangeNotifications(subscriptionId);

    if (requestedByUserId) {
      await this.planChangeNotificationService
        .notifyUserOfDecision({
          requesterId: requestedByUserId,
          decision: 'approved',
          planName: upgraded.plan?.name,
        })
        .catch((error: unknown) => {
          this.logger.error(
            `Failed to notify requester ${requestedByUserId} about approved plan change for subscription ${subscriptionId}`,
            error as Error,
          );
        });
    }

    return updated;
  }

  async rejectPlanChange(
    subscriptionId: string,
  ): Promise<SubscriptionWithPlan> {
    const existing = await this.subscriptionRepository.findById(subscriptionId);
    if (!existing) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }
    const meta = this.toMetadataObject(existing.metadata);
    if (!meta.pendingPlanChange) {
      throw new NotFoundException(
        `No pending plan change for subscription ${subscriptionId}`,
      );
    }
    const pending = meta.pendingPlanChange;
    const requestedPlan = pending.requestedPlanId
      ? await this.planRepository
          .findById(pending.requestedPlanId)
          .catch(() => null)
      : null;
    delete meta.pendingPlanChange;
    const updated = await this.subscriptionRepository.update(subscriptionId, {
      metadata: meta as Prisma.InputJsonValue,
    });

    await this.clearPendingPlanChangeNotifications(subscriptionId);

    if (pending.requestedByUserId) {
      await this.planChangeNotificationService
        .notifyUserOfDecision({
          requesterId: pending.requestedByUserId,
          decision: 'rejected',
          planName: requestedPlan?.name,
        })
        .catch((error: unknown) => {
          this.logger.error(
            `Failed to notify requester ${pending.requestedByUserId} about rejected plan change for subscription ${subscriptionId}`,
            error as Error,
          );
        });
    }

    return updated;
  }

  private async clearPendingPlanChangeNotifications(
    subscriptionId: string,
  ): Promise<void> {
    try {
      await this.notificationService.markMatchingRead({
        type: 'plan_change_request',
        metadata: {
          subscriptionId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark plan change request notifications as read for subscription ${subscriptionId}`,
        error as Error,
      );
    }
  }

  public addInterval(d: Date, interval: BillingInterval): Date {
    const date = new Date(d);
    switch (interval) {
      case BillingInterval.MONTH:
        date.setMonth(date.getMonth() + 1);
        return date;
      case BillingInterval.QUARTER:
        date.setMonth(date.getMonth() + 3);
        return date;
      case BillingInterval.SEMIANNUAL:
        date.setMonth(date.getMonth() + 6);
        return date;
      case BillingInterval.ANNUAL:
        date.setFullYear(date.getFullYear() + 1);
        return date;
      default:
        return assertNever(interval);
    }
  }
}

function assertNever(x: never): never {
  throw new Error(`Unsupported interval: ${String(x)}`);
}
