import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/user-client';
import {
  ReviewStudioAccessRequestDto,
  type Role,
  StudioAccessRequestSummary,
  StudioAccessSettings,
  UserSettings,
} from '@pitch/shared-backend/interfaces/user.interface';
import { UserRepository } from '../../user/repositories/user.repository';
import { TeamService } from '../../team/services/team.service';
import { TeamRepository } from '../../team/repositories/team.repository';
import { PlanRepository } from '../../plans/repositories/plans.repository';
import { PlanService } from '../../plans/services/plans.service';
import { SubscriptionRepository } from '../../subscription/repositories/subscription.repository';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { NotificationService } from '../../notifications/service/notification.service';
import {
  NotificationSeverity,
  NotificationSourceType,
} from '../../mongo/schemas/notification.schema';
import { StudioAccessEmailService } from './studio-access-email.service';

type RequestingUser = Pick<PrismaUser, 'id' | 'email' | 'name' | 'settings'>;
type ApprovedStudioRole = Extract<Role, 'ADMIN' | 'MEMBER'>;

@Injectable()
export class StudioAccessService {
  private readonly logger = new Logger(StudioAccessService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly teamService: TeamService,
    private readonly teamRepository: TeamRepository,
    private readonly planRepository: PlanRepository,
    private readonly planService: PlanService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly subscriptionService: SubscriptionService,
    private readonly notificationService: NotificationService,
    private readonly studioAccessEmailService: StudioAccessEmailService,
  ) {}

  async requestAccess(userId: string): Promise<StudioAccessSettings> {
    const user = await this.requireUser(userId);
    const existingSettings = this.toSettings(user.settings);
    const existingAccess = existingSettings.studioAccess ?? {};

    if (existingAccess.status === 'approved') {
      throw new ConflictException('Studio access is already approved');
    }

    if (existingAccess.status === 'pending' && existingAccess.requestedAt) {
      return existingAccess;
    }

    const now = new Date().toISOString();
    const nextAccess: StudioAccessSettings = {
      ...existingAccess,
      status: 'pending',
      requestedAt: now,
      reviewedAt: undefined,
      reviewedByUserId: undefined,
      reviewedByEmail: undefined,
      quota: undefined,
      role: undefined,
      teamId: existingAccess.teamId,
      planId: existingAccess.planId,
      subscriptionId: existingAccess.subscriptionId,
    };

    await this.userRepository.updateSettings(userId, {
      ...existingSettings,
      studioAccess: nextAccess,
    });

    await this.notifySuperAdminsOfAccessRequest(user);

    return nextAccess;
  }

  async listPendingRequests(): Promise<StudioAccessRequestSummary[]> {
    const users = await this.userRepository.findMany();

    return users
      .map((user) => this.toRequestSummary(user))
      .filter((request): request is StudioAccessRequestSummary => !!request)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }

  async approveRequest(
    userId: string,
    dto: ReviewStudioAccessRequestDto,
    reviewer: { id: string; email: string },
  ): Promise<StudioAccessRequestSummary> {
    const user = await this.requireUser(userId);
    const existingSettings = this.toSettings(user.settings);
    const existingAccess = existingSettings.studioAccess ?? {};

    if (existingAccess.status !== 'pending') {
      throw new ConflictException('Studio access request is not pending');
    }

    const quota = Number(dto.quota);
    if (!Number.isInteger(quota) || quota <= 0) {
      throw new ConflictException('Quota must be a positive integer');
    }

    const role = this.resolveApprovedRole(dto.role);
    const teamId = await this.ensureWorkspace(user, existingAccess, role);
    const plan = await this.ensureQuotaPlan(quota);
    const subscription = await this.ensureSubscription({
      teamId,
      planId: plan.id,
      reviewerId: reviewer.id,
      requesterName: user.name,
      requesterEmail: user.email,
    });

    const now = new Date().toISOString();
    const nextAccess: StudioAccessSettings = {
      ...existingAccess,
      status: 'approved',
      requestedAt: existingAccess.requestedAt ?? now,
      reviewedAt: now,
      reviewedByUserId: reviewer.id,
      reviewedByEmail: reviewer.email,
      quota,
      role,
      teamId,
      planId: plan.id,
      subscriptionId: subscription.id,
    };

    await this.userRepository.updateSettings(userId, {
      ...existingSettings,
      studioAccess: nextAccess,
    });

    await this.clearPendingRequestNotifications(user.id);
    await this.notifyRequesterReviewed(user, reviewer, nextAccess, 'approved');

    return this.toSummary(user, nextAccess);
  }

  async denyRequest(
    userId: string,
    reviewer: { id: string; email: string },
  ): Promise<StudioAccessRequestSummary> {
    const user = await this.requireUser(userId);
    const existingSettings = this.toSettings(user.settings);
    const existingAccess = existingSettings.studioAccess ?? {};

    if (existingAccess.status !== 'pending') {
      throw new ConflictException('Studio access request is not pending');
    }

    const now = new Date().toISOString();
    const nextAccess: StudioAccessSettings = {
      ...existingAccess,
      status: 'denied',
      requestedAt: existingAccess.requestedAt ?? now,
      reviewedAt: now,
      reviewedByUserId: reviewer.id,
      reviewedByEmail: reviewer.email,
      quota: undefined,
      role: undefined,
      teamId: undefined,
      planId: undefined,
      subscriptionId: undefined,
    };

    await this.userRepository.updateSettings(userId, {
      ...existingSettings,
      studioAccess: nextAccess,
    });

    await this.clearPendingRequestNotifications(user.id);
    await this.notifyRequesterReviewed(user, reviewer, nextAccess, 'denied');

    return this.toSummary(user, nextAccess);
  }

  assertSuperAdmin(email?: string | null): void {
    const normalized = this.normalizeEmail(email);
    const admins = this.getSuperAdminEmails();
    if (!normalized || !admins.includes(normalized)) {
      throw new ForbiddenException('Super admin access is required');
    }
  }

  private getSuperAdminEmails(): string[] {
    return (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => this.normalizeEmail(value))
      .filter((value): value is string => Boolean(value));
  }

  private normalizeEmail(email?: string | null): string | null {
    const normalized = (email ?? '').trim().toLowerCase();
    return normalized || null;
  }

  private resolveApprovedRole(role?: Role): ApprovedStudioRole {
    if (role === 'OWNER') {
      throw new ConflictException(
        'Studio access approvals can assign only MEMBER or ADMIN roles',
      );
    }

    return role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
  }

  private async requireUser(userId: string): Promise<RequestingUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  private toSettings(value: unknown): UserSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as UserSettings;
  }

  private toRequestSummary(
    user: PrismaUser & { settings?: unknown },
  ): StudioAccessRequestSummary | null {
    const settings = this.toSettings(user.settings);
    const access = settings.studioAccess;
    if (access?.status !== 'pending' || !access.requestedAt) {
      return null;
    }

    return this.toSummary(user, access);
  }

  private toSummary(
    user: RequestingUser,
    access: StudioAccessSettings,
  ): StudioAccessRequestSummary {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      status: access.status ?? 'pending',
      requestedAt: access.requestedAt ?? new Date().toISOString(),
      reviewedAt: access.reviewedAt,
      reviewedByUserId: access.reviewedByUserId,
      reviewedByEmail: access.reviewedByEmail,
      quota: access.quota,
      role: access.role,
      teamId: access.teamId,
      planId: access.planId,
      subscriptionId: access.subscriptionId,
    };
  }

  private async ensureWorkspace(
    user: RequestingUser,
    access: StudioAccessSettings,
    role: ApprovedStudioRole,
  ): Promise<string> {
    const existingTeamId = access.teamId;
    let teamId = existingTeamId;

    if (existingTeamId) {
      const existingTeam = await this.teamRepository.findById(existingTeamId);
      if (existingTeam) {
        teamId = existingTeam.id;
      }
    }

    if (!teamId) {
      const createdTeam = await this.teamService.createTeam(
        {
          name: `${user.name}'s Workspace`,
          billingEmail: user.email,
          metadata: {
            notes:
              'Auto-provisioned personal workspace for approved studio access.',
          },
        },
        user.id,
      );

      teamId = createdTeam.id;
    }

    await this.assignWorkspaceRole(teamId, user.id, role);

    return teamId;
  }

  private async assignWorkspaceRole(
    teamId: string,
    userId: string,
    role: ApprovedStudioRole,
  ): Promise<void> {
    const membership = await this.teamRepository.findMembership(teamId, userId);

    if (!membership) {
      await this.teamRepository.createAcceptedMember({
        teamId,
        userId,
        role,
        tokenLimit: 0,
        isActive: true,
      });
      return;
    }

    await this.teamRepository.updateMember({
      teamId,
      userId,
      role,
      isActive: true,
      acceptedAt: new Date(),
    });
  }

  private async ensureQuotaPlan(quota: number) {
    const planName = `Studio Access ${quota} Coins`;
    const existing = await this.planRepository.findByName(planName);
    if (existing) {
      if (!existing.isActive) {
        return this.planService.updatePlan(existing.id, { isActive: true });
      }
      return existing;
    }

    return this.planService.createPlan({
      name: planName,
      description: 'Auto-generated plan for approved Studio access requests.',
      planLevel: 'FREE',
      maxCoins: quota,
      isActive: true,
    });
  }

  private async ensureSubscription(args: {
    teamId: string;
    planId: string;
    reviewerId: string;
    requesterName: string;
    requesterEmail: string;
  }) {
    const existing =
      await this.subscriptionRepository.findActiveWithPlanByTeamId(args.teamId);

    const metadata = {
      notes: `Approved Studio access for ${args.requesterName} <${args.requesterEmail}>`,
    };

    if (!existing) {
      return this.subscriptionService.createSubscription(
        {
          teamId: args.teamId,
          planId: args.planId,
          interval: 'MONTH',
          metadata,
        },
        args.reviewerId,
      );
    }

    if (existing.planId === args.planId) {
      return this.subscriptionService.updateSubscription(
        existing.id,
        {
          teamId: args.teamId,
          planId: args.planId,
          interval: 'MONTH',
          metadata,
        },
        args.reviewerId,
      );
    }

    return this.subscriptionService.upgradeSubscription(
      existing.id,
      {
        planId: args.planId,
        interval: 'MONTH',
        metadata,
      },
      args.reviewerId,
    );
  }

  private async notifySuperAdminsOfAccessRequest(
    requester: RequestingUser,
  ): Promise<void> {
    const adminEmails = this.getSuperAdminEmails();
    if (adminEmails.length === 0) {
      return;
    }

    try {
      const users = await this.userRepository.findMany();
      const recipientUserIds = users
        .filter((user) => {
          const email = this.normalizeEmail(user.email);
          return Boolean(email && adminEmails.includes(email));
        })
        .map((user) => user.id)
        .filter((id) => id !== requester.id);

      if (recipientUserIds.length === 0) {
        return;
      }

      await this.notificationService.createBatch({
        recipientUserIds,
        title: 'New Studio access request',
        message: `${requester.name || requester.email} requested Studio access.`,
        type: 'STUDIO_ACCESS_REQUEST',
        severity: NotificationSeverity.INFO,
        sourceType: NotificationSourceType.USER,
        sourceUserId: requester.id,
        metadata: {
          requesterUserId: requester.id,
          requesterEmail: requester.email,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify super admins about studio access request for ${requester.email}`,
        error as Error,
      );
    }
  }

  private async notifyRequesterReviewed(
    requester: RequestingUser,
    reviewer: { id: string; email: string },
    access: StudioAccessSettings,
    decision: 'approved' | 'denied',
  ): Promise<void> {
    const title =
      decision === 'approved'
        ? 'Studio access approved'
        : 'Studio access request denied';
    const message =
      decision === 'approved'
        ? `Your Studio access request was approved with ${access.quota} coins and the ${access.role?.toLowerCase() ?? 'member'} role.`
        : 'Your Studio access request was reviewed and not approved.';

    try {
      await this.notificationService.createOne({
        recipientUserId: requester.id,
        title,
        message,
        type: 'STUDIO_ACCESS_REVIEWED',
        severity:
          decision === 'approved'
            ? NotificationSeverity.INFO
            : NotificationSeverity.WARNING,
        sourceType: NotificationSourceType.USER,
        sourceUserId: reviewer.id,
        metadata: {
          decision,
          quota: access.quota,
          role: access.role,
          reviewedByEmail: reviewer.email,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create requester notification for ${requester.email}`,
        error as Error,
      );
    }

    await this.studioAccessEmailService.sendDecisionEmail({
      email: requester.email,
      recipientName: requester.name,
      decision,
      quota: access.quota,
      role:
        access.role === 'ADMIN'
          ? 'ADMIN'
          : access.role === 'MEMBER'
            ? 'MEMBER'
            : undefined,
    });
  }

  private async clearPendingRequestNotifications(
    requesterUserId: string,
  ): Promise<void> {
    try {
      await this.notificationService.markMatchingRead({
        type: 'STUDIO_ACCESS_REQUEST',
        metadata: {
          requesterUserId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark Studio access request notifications as read for ${requesterUserId}`,
        error as Error,
      );
    }
  }
}
