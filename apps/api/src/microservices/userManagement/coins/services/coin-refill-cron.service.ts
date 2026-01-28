import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { CoinAccountingService } from './coin-accounting.service';
import { CoinRefillService } from './coin-refill.service';
import { SubscriptionWithPlan } from '../../subscription/repositories/subscription.repository';

@Injectable()
export class CoinRefillCron {
  private readonly logger = new Logger(CoinRefillCron.name);

  constructor(
    private readonly coinRefillService: CoinRefillService,
    private readonly coinAccountingService: CoinAccountingService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async rolloverSubscriptions() {
    this.logger.log('Starting daily coin rollover job');

    const subs = await this.subscriptionService.findDueForRollover();

    for (const sub of subs) {
      try {
        await this.processSubscription(sub);
      } catch (err: any) {
        this.logger.error(
          `Failed rollover for subscription=${sub.id}: ${err?.message ?? err}`,
        );
      }
    }

    this.logger.log(
      `Rollover job finished. Processed ${subs.length} subscriptions`,
    );
  }

  private async processSubscription(sub: SubscriptionWithPlan) {
    const { id: subscriptionId, teamId, plan } = sub;

    if (sub.cancelAtPeriodEnd) {
      await this.subscriptionService.removeSubscription(subscriptionId);
      return;
    }

    const oldStart = new Date(sub.currentPeriodStart);
    const oldEnd = new Date(sub.currentPeriodEnd);

    const oldPeriodKey = this.coinRefillService.buildPeriodKey(
      subscriptionId,
      oldStart,
      oldEnd,
    );

    const balance = await this.coinAccountingService.getRemainingCoins(teamId, {
      periodKey: oldPeriodKey,
      allowanceFallback: plan.maxCoins,
    });

    if (balance.ok === false) return;

    const oldRemaining = balance.remaining;
    const debt = Math.max(0, -oldRemaining);

    const newStart = oldEnd;
    const newEnd = this.subscriptionService.addInterval(newStart, sub.interval);
    const newPeriodKey = this.coinRefillService.buildPeriodKey(
      subscriptionId,
      newStart,
      newEnd,
    );

    await this.coinRefillService.refillAfterRollover({
      teamId,
      subscriptionId,
      planId: sub.planId,
      allowance: plan.maxCoins,
      newPeriodKey,
      newPeriodEnd: newEnd,
      debt,
    });

    await this.subscriptionService.updateSubscriptionPeriod(subscriptionId, {
      start: newStart,
      end: newEnd,
    });
  }
}
