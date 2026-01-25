import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { Period } from '@pitch/shared-backend/interfaces/user.interface';
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

    const balance =
      (await this.coinAccountingService.getRemainingCoins(sub.teamId)) ?? null;

    if (balance.ok === false) {
      return;
    }
    const newStart = sub.currentPeriodEnd;
    const newEnd = this.addInterval(newStart, sub.plan.interval);

    const newPeriodKey = this.buildPeriodKey(subscriptionId, newStart, newEnd);

    const oldRemaining = balance.remaining ?? 0;
    const debt = Math.max(0, -oldRemaining);

    const allowance = plan.maxCoins;

    await this.coinRefillService.refillAfterRollover({
      teamId,
      subscriptionId,
      planId: sub.planId,
      allowance,
      newPeriodKey,
      newPeriodEnd: newEnd,
      debt,
    });

    const subUpdateDto: Period = {
      start: newStart,
      end: newEnd,
    };
    await this.subscriptionService.updateSubscriptionPeriod(
      subscriptionId,
      subUpdateDto,
    );
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
