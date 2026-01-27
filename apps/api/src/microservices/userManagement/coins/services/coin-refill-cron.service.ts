import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { CoinAccountingService } from './coin-accounting.service';
import { CoinRefillService } from './coin-refill.service';

@Injectable()
export class CoinRefillCron {
  private readonly logger = new Logger(CoinRefillCron.name);

  constructor(
    private readonly coinRefillService: CoinRefillService,
    private readonly coinAccountingService: CoinAccountingService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Cron('59 23 * * *')
  async rolloverSubscriptions() {
    const now = new Date();
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

  private async processSubscription(sub: any) {
    const { id: subscriptionId, teamId, plan } = sub;

    if (sub.cancelAtPeriodEnd) {
      await this.subscriptionService.removeSubscription(subscriptionId);
      return;
    }

    const oldStart = new Date(sub.currentPeriodStart);
    const oldEnd = new Date(sub.currentPeriodEnd);

    const oldPeriodKey = this.buildPeriodKey(subscriptionId, oldStart, oldEnd);

    const balance = await this.coinAccountingService.getRemainingCoins(teamId, {
      periodKey: oldPeriodKey,
      allowanceFallback: plan.maxCoins,
    });

    if (balance.ok === false) return;

    const oldRemaining = balance.remaining;
    const debt = Math.max(0, -oldRemaining);

    const newStart = oldEnd;
    const newEnd = this.addInterval(newStart, sub.plan.interval);
    const newPeriodKey = this.buildPeriodKey(subscriptionId, newStart, newEnd);

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

  // helpers
  private buildPeriodKey(subscriptionId: string, start: Date, end: Date) {
    return `${subscriptionId}:${start.getTime()}-${end.getTime()}`;
  }

  private addInterval(d: Date, interval: string) {
    const date = new Date(d);
    if (interval === 'MONTH') date.setMonth(date.getMonth() + 1);
    if (interval === 'QUARTER') date.setMonth(date.getMonth() + 3);
    if (interval === 'SEMIANNUAL') date.setMonth(date.getMonth() + 6);
    if (interval === 'ANNUAL') date.setFullYear(date.getFullYear() + 1);
    return date;
  }
}
