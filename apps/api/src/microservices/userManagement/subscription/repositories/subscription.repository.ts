import { Injectable, Logger } from '@nestjs/common';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import { Prisma, Subscription } from '@prisma/user-client';

export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

@Injectable()
export class SubscriptionRepository {
  private readonly logger = new Logger(SubscriptionRepository.name);

  constructor(private readonly prisma: UserPrismaService) {}

  async create(
    data: Prisma.SubscriptionUncheckedCreateInput,
  ): Promise<SubscriptionWithPlan> {
    this.logger.debug(
      `Creating subscription for team "${data.teamId}" on plan "${data.planId}"`,
    );

    return this.prisma.subscription.create({
      data,
      include: { plan: true },
    });
  }

  async update(
    id: string,
    data:
      | Prisma.SubscriptionUpdateInput
      | Prisma.SubscriptionUncheckedUpdateInput,
  ): Promise<SubscriptionWithPlan> {
    this.logger.debug(`Updating subscription "${id}"`);

    return this.prisma.subscription.update({
      where: { id },
      data,
      include: { plan: true },
    });
  }

  async delete(id: string): Promise<Subscription> {
    this.logger.debug(`Deleting subscription "${id}"`);

    return this.prisma.subscription.delete({
      where: { id },
    });
  }

  async findById(id: string): Promise<SubscriptionWithPlan | null> {
    this.logger.debug(`Finding subscription by id "${id}"`);

    return this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
  }

  async findAll(): Promise<Subscription[]> {
    this.logger.debug('Finding all subscriptions');

    return this.prisma.subscription.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findActiveByTeamId(teamId: string): Promise<Subscription | null> {
    this.logger.debug(`Finding active subscription for team "${teamId}"`);

    return this.prisma.subscription.findFirst({
      where: {
        teamId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllActive(): Promise<Subscription[]> {
    this.logger.debug('Finding all active subscriptions');

    return this.prisma.subscription.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findActiveWithPlanByTeamId(
    teamId: string,
  ): Promise<SubscriptionWithPlan | null> {
    this.logger.debug(
      `Finding active subscription with plan for team "${teamId}"`,
    );
    return this.prisma.subscription.findFirst({
      where: { teamId, isActive: true },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllWithPendingPlanChange(): Promise<SubscriptionWithPlan[]> {
    const all = await this.prisma.subscription.findMany({
      where: { isActive: true },
      include: { plan: true },
    });
    return all.filter((sub) => {
      const meta = sub.metadata as Record<string, unknown> | null;
      return meta?.pendingPlanChange != null;
    });
  }

  async findDueForRollover(currentDate: Date): Promise<SubscriptionWithPlan[]> {
    this.logger.debug('Finding subscriptions due for rollover');
    return this.prisma.subscription.findMany({
      where: {
        isActive: true,
        currentPeriodEnd: {
          lte: currentDate,
        },
      },
      include: {
        plan: true,
      },
    });
  }
}
