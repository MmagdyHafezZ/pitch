import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import {
  SupportEmailTemplate,
  type SupportPlanChangeRequestTemplateData,
  type SupportPlanChangeDecisionTemplateData,
  type SupportSendTemplatedEmailRequest,
  type SupportSendTemplatedEmailResponse,
} from '@pitch/shared-backend/interfaces/support-email.interface';
import { NotificationService } from '../../notifications/service/notification.service';
import {
  NotificationSeverity,
  NotificationSourceType,
} from '../../mongo/schemas/notification.schema';
import { UserRepository } from '../../user/repositories/user.repository';

@Injectable()
export class PlanChangeNotificationService {
  private readonly logger = new Logger(PlanChangeNotificationService.name);

  constructor(
    @Inject('SUPPORT_SERVICE')
    private readonly supportClient: ClientProxy,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  // ── Notify admins when a user requests a plan change ──────────────────────

  async notifyAdminsOfRequest(opts: {
    subscriptionId: string;
    requesterId: string;
    currentPlanName?: string;
    requestedPlanName: string;
    requestedInterval?: string;
  }): Promise<void> {
    const adminEmails = this.getSuperAdminEmails();
    if (adminEmails.length === 0) {
      this.logger.warn(
        'SUPER_ADMIN_EMAILS is not set — skipping plan-change-request notifications',
      );
      return;
    }

    // Look up requester info for richer email content
    const requester = await this.userRepository
      .findById(opts.requesterId)
      .catch(() => null);
    const requesterName = requester?.name ?? requester?.email ?? undefined;
    const requesterEmail = requester?.email ?? undefined;

    const reviewUrl = `${process.env.APP_URL ?? ''}/studio/admin/plans`;

    // Email all admins in one shot
    await this.sendEmail<SupportPlanChangeRequestTemplateData>(
      adminEmails,
      SupportEmailTemplate.PLAN_CHANGE_REQUEST,
      {
        requesterName,
        requesterEmail,
        currentPlanName: opts.currentPlanName,
        requestedPlanName: opts.requestedPlanName,
        requestedInterval: opts.requestedInterval,
        reviewUrl,
      },
      `plan-change-request notification to admins`,
    );

    // In-app notification for each admin who has an account
    const adminNotifMessage =
      `${requesterName ?? requesterEmail ?? 'A user'} requested a plan change` +
      ` to ${opts.requestedPlanName}` +
      (opts.requestedInterval ? ` (${opts.requestedInterval})` : '') +
      '.';

    const adminUserIds = await this.resolveUserIds(adminEmails);
    if (adminUserIds.length > 0) {
      await this.notificationService
        .createBatch({
          recipientUserIds: adminUserIds,
          title: 'New plan change request',
          message: adminNotifMessage,
          type: 'plan_change_request',
          severity: NotificationSeverity.INFO,
          sourceType: NotificationSourceType.USER,
          sourceUserId: opts.requesterId,
          metadata: {
            subscriptionId: opts.subscriptionId,
            requestedPlanName: opts.requestedPlanName,
            requestedInterval: opts.requestedInterval,
          },
        })
        .catch((err) =>
          this.logger.error(
            'Failed to create in-app plan-change-request notifications',
            err,
          ),
        );
    }
  }

  // ── Notify the user when their plan change is approved or rejected ─────────

  async notifyUserOfDecision(opts: {
    requesterId: string;
    decision: 'approved' | 'rejected';
    planName?: string;
  }): Promise<void> {
    const user = await this.userRepository
      .findById(opts.requesterId)
      .catch(() => null);
    if (!user?.email) {
      this.logger.warn(
        `Cannot notify user ${opts.requesterId}: no email found`,
      );
      return;
    }

    await this.sendEmail<SupportPlanChangeDecisionTemplateData>(
      user.email,
      SupportEmailTemplate.PLAN_CHANGE_DECISION,
      {
        recipientName: user.name ?? undefined,
        decision: opts.decision,
        planName: opts.planName,
      },
      `plan-change-decision (${opts.decision}) email to ${user.email}`,
    );

    const title =
      opts.decision === 'approved'
        ? 'Plan change approved'
        : 'Plan change request update';
    const message =
      opts.decision === 'approved'
        ? `Your plan change${opts.planName ? ` to ${opts.planName}` : ''} has been approved and is now active.`
        : `Your plan change request${opts.planName ? ` to ${opts.planName}` : ''} was not approved at this time.`;

    await this.notificationService
      .createOne({
        recipientUserId: opts.requesterId,
        title,
        message,
        type: 'plan_change_decision',
        severity:
          opts.decision === 'approved'
            ? NotificationSeverity.INFO
            : NotificationSeverity.WARNING,
        sourceType: NotificationSourceType.SYSTEM,
        metadata: { decision: opts.decision, planName: opts.planName },
      })
      .catch((err) =>
        this.logger.error(
          'Failed to create in-app plan-change-decision notification',
          err,
        ),
      );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getSuperAdminEmails(): string[] {
    return (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  /** Resolve a list of email addresses to their Prisma user IDs (best-effort). */
  private async resolveUserIds(emails: string[]): Promise<string[]> {
    const results = await Promise.allSettled(
      emails.map((email) => this.userRepository.findByEmail(email)),
    );
    return results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          NonNullable<Awaited<ReturnType<UserRepository['findByEmail']>>>
        > => r.status === 'fulfilled' && r.value != null,
      )
      .map((r) => r.value.id);
  }

  private async sendEmail<T>(
    to: string | string[],
    template: SupportEmailTemplate,
    data: T,
    logLabel: string,
  ): Promise<void> {
    const request: SupportSendTemplatedEmailRequest = {
      to,
      template,
      data: data as SupportSendTemplatedEmailRequest['data'],
    };

    try {
      const response = await firstValueFrom(
        this.supportClient
          .send<
            SupportSendTemplatedEmailResponse,
            SupportSendTemplatedEmailRequest
          >(SUPPORT_SERVICE_PATTERNS.EMAIL_SEND_TEMPLATE, request)
          .pipe(timeout(5000)),
      );
      if (!response.ok) {
        this.logger.error(
          `Email service rejected ${logLabel}: ${response.error ?? 'unknown error'}`,
        );
      }
    } catch (err) {
      // Fire-and-forget: log but never throw so the main operation succeeds
      this.logger.error(`Failed to send ${logLabel}`, err);
    }
  }
}
