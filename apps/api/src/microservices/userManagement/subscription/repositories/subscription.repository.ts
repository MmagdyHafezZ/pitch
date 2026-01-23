import { Injectable, Logger } from '@nestjs/common';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import { Prisma, Subscription, SubscriptionStatus } from '@prisma/user-client';

@Injectable()
export class SubscriptionRepository {
  private readonly logger = new Logger(SubscriptionRepository.name);

  constructor(private readonly prisma: UserPrismaService) {}

  async create(
    data: Prisma.SubscriptionUncheckedCreateInput,
  ): Promise<Subscription> {
    this.logger.debug(
      `Creating subscription for team "${data.teamId}" on plan "${data.planId}"`,
    );

    return this.prisma.subscription.create({
      data,
    });
  }

  async update(
    id: string,
    data:
      | Prisma.SubscriptionUpdateInput
      | Prisma.SubscriptionUncheckedUpdateInput,
  ): Promise<Subscription> {
    this.logger.debug(`Updating subscription "${id}"`);

    return this.prisma.subscription.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Subscription> {
    this.logger.debug(`Deleting subscription "${id}"`);

    return this.prisma.subscription.delete({
      where: { id },
    });
  }

  async findById(id: string): Promise<Subscription | null> {
    this.logger.debug(`Finding subscription by id "${id}"`);

    return this.prisma.subscription.findUnique({
      where: { id },
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
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
