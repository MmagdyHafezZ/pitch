import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/user-client';
import {
  CoinRefillRequest,
  Team,
  UserSettings,
} from '@pitch/shared-backend/interfaces/user.interface';
import { CoinRedisService } from './coin-redis.service';
import { CoinLedgerRepository } from '../repositories/coin-ledger.repository';
import { CoinBalanceRepository } from '../repositories/coin-balance.repository';
import { UserRepository } from '../../user/repositories/user.repository';
import {
  SubscriptionRepository,
  SubscriptionWithPlan,
} from '../../subscription/repositories/subscription.repository';
import { TeamRepository } from '../../team/repositories/team.repository';
import { NotificationService } from '../../notifications/service/notification.service';
import {
  NotificationSeverity,
  NotificationSourceType,
} from '../../mongo/schemas/notification.schema';
import { isSystemAdminEmail } from '../../../../gateway/utils/system-admin-access';

type RequestingUser = Pick<PrismaUser, 'id' | 'email' | 'name'>;
type StoredUser = Pick<PrismaUser, 'id' | 'email' | 'name' | 'settings'>;

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function getRemainingAfter(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

@Injectable()
export class CoinRefillService {
  private readonly logger = new Logger(CoinRefillService.name);

  constructor(
    private readonly coinRedis: CoinRedisService,
    private readonly coinLedgerRepo: CoinLedgerRepository,
    private readonly coinBalanceRepo: CoinBalanceRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly teamRepository: TeamRepository,
    private readonly notificationService: NotificationService,
  ) {}

  public buildPeriodKey(subscriptionId: string, start: Date, end: Date) {
    return `${subscriptionId}:${start.getTime()}-${end.getTime()}`;
  }

  private buildPersonalEntityKey(userId: string): string {
    return `user:${userId}`;
  }

  private buildPersonalPeriodKey(userId: string, at = new Date()): string {
    const ym = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
    return `personal:${userId}:${ym}`;
  }

  private getDefaultPersonalAllowance(): number {
    return Number(process.env.PERSONAL_COINS_PER_MONTH ?? 100);
  }

  private normalizePositiveCoins(value: number, fieldName: string): number {
    const normalized = Math.floor(Number(value));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return normalized;
  }

  private countActiveMemberships(team: Team): number {
    return Array.isArray(team.memberships)
      ? team.memberships.filter((membership) => membership?.isActive !== false)
          .length
      : 0;
  }

  private getStudioAccess(
    settings: UserSettings,
  ): NonNullable<UserSettings['studioAccess']> {
    return settings.studioAccess && typeof settings.studioAccess === 'object'
      ? settings.studioAccess
      : {};
  }

  private shouldAutoApproveRequester(user: StoredUser): boolean {
    if (isSystemAdminEmail(user.email)) {
      return true;
    }

    const access = this.getStudioAccess(this.toSettings(user.settings));
    return (
      access.status === 'approved' &&
      (access.role === 'ADMIN' || access.role === 'OWNER')
    );
  }

  private async resolvePersonalWorkspaceTeamId(
    user: StoredUser,
    fallbackTeamId?: string,
  ): Promise<string> {
    const settings = this.toSettings(user.settings);
    const preferredTeamId =
      typeof settings.studioAccess?.teamId === 'string'
        ? settings.studioAccess.teamId.trim()
        : '';
    const legacyTeamId = fallbackTeamId?.trim() ?? '';
    const teams = await this.teamRepository.findUserTeams(user.id);

    const validCandidates = [preferredTeamId, legacyTeamId].filter(Boolean);
    for (const candidateTeamId of validCandidates) {
      const matchingTeam = teams.find((team) => team.id === candidateTeamId);
      if (matchingTeam && this.countActiveMemberships(matchingTeam) <= 1) {
        return matchingTeam.id;
      }
    }

    const personalWorkspace = teams.find(
      (team) => this.countActiveMemberships(team) <= 1,
    );
    if (personalWorkspace) {
      return personalWorkspace.id;
    }

    const createdWorkspace = await this.teamRepository.createTeam(
      {
        name: `${(user.name || 'My').trim()}'s Workspace`,
        billingEmail: user.email,
        metadata: {
          notes: 'Auto-provisioned personal workspace for coin refill access.',
        },
      },
      user.id,
    );

    await this.userRepository.updateSettings(user.id, {
      ...settings,
      studioAccess: {
        ...this.getStudioAccess(settings),
        teamId: createdWorkspace.id,
      },
    });

    this.logger.log(
      `resolvePersonalWorkspaceTeamId: auto-provisioned workspace ${createdWorkspace.id} for user=${user.id}`,
    );

    return createdWorkspace.id;
  }

  private async getPersonalBalanceState(userId: string): Promise<{
    entityKey: string;
    periodKey: string;
    ttlSeconds: number;
    allowance: number;
    remaining: number;
  }> {
    const now = new Date();
    const entityKey = this.buildPersonalEntityKey(userId);
    const periodKey = this.buildPersonalPeriodKey(userId, now);
    const defaultAllowance = this.getDefaultPersonalAllowance();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ttlSeconds = Math.max(
      3600,
      Math.floor((endOfMonth.getTime() - now.getTime()) / 1000) + 7 * 24 * 3600,
    );

    const snapshot = await this.coinBalanceRepo.getSnapshot(
      entityKey,
      periodKey,
    );
    const allowance = snapshot?.allowance ?? defaultAllowance;

    await this.coinRedis.initRemainingIfMissing(
      entityKey,
      periodKey,
      allowance,
      ttlSeconds,
    );

    const remaining =
      (await this.coinRedis.getRemaining(entityKey, periodKey)) ??
      snapshot?.remaining ??
      allowance;

    return { entityKey, periodKey, ttlSeconds, allowance, remaining };
  }

  async refillInitialForSubscription(
    sub: SubscriptionWithPlan,
    requesterId: string,
  ) {
    const { id: subscriptionId, teamId: teamId, plan: plan } = sub;

    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    const periodKey = this.buildPeriodKey(subscriptionId, start, end);

    const allowance = Number(plan.maxCoins);

    const ttlSeconds = Math.max(
      60,
      Math.ceil((end.getTime() - Date.now()) / 1000),
    );
    await this.coinRedis.initRemainingIfMissing(
      teamId,
      periodKey,
      allowance,
      ttlSeconds,
    );

    const rem = await this.coinRedis.getRemaining(teamId, periodKey);
    const remainingAfter = rem ?? allowance;

    const eventId = `refill:init:${teamId}:${periodKey}`;

    await this.coinLedgerRepo.createRefillIfNotExists({
      userId: requesterId,
      eventId,
      teamId,
      subscriptionId,
      planId: sub.planId,
      requestId: eventId,
      reservationId: eventId,
      periodKey,
      allowance,
      debtApplied: 0,
      remainingAfter,
    });

    await this.coinBalanceRepo.upsertRefill({
      teamId,
      subscriptionId,
      periodKey,
      allowance,
      remainingAfter,
      debtApplied: 0,
      eventId,
    });

    return { periodKey, allowance, remainingAfter };
  }

  async refillAfterRollover(args: {
    teamId: string;
    subscriptionId: string;
    planId: string;
    allowance: number;
    newPeriodKey: string;
    newPeriodEnd: Date;
    debt: number;
  }): Promise<{ remainingAfter: number }> {
    const {
      teamId,
      subscriptionId,
      planId,
      allowance,
      newPeriodKey,
      newPeriodEnd,
      debt,
    } = args;

    const ttlSeconds = Math.max(
      60,
      Math.ceil((newPeriodEnd.getTime() - Date.now()) / 1000),
    );
    try {
      await this.coinRedis.initRemainingIfMissing(
        teamId,
        newPeriodKey,
        allowance,
        ttlSeconds,
      );
      Logger.log(`[REDIS INIT OK] ${newPeriodKey}`);
    } catch (err: unknown) {
      Logger.error(
        `[REDIS INIT FAIL] period=${newPeriodKey} err=${errorMessage(err)}`,
      );
      throw err;
    }

    const eventId = `refill:${teamId}:${newPeriodKey}`;

    let remainingAfter: number;
    try {
      const adj: unknown = await this.coinRedis.applyDeltaIdempotent({
        teamId,
        periodKey: newPeriodKey,
        deltaCoins: debt,
        eventId,
        ttlSeconds,
      });
      const ra =
        typeof adj === 'object' && adj !== null && 'remainingAfter' in adj
          ? getRemainingAfter((adj as Record<string, unknown>).remainingAfter)
          : undefined;

      remainingAfter = ra ?? allowance - debt;

      Logger.log(
        `[DELTA OK] event=${eventId} delta=${debt} remainingAfter=${remainingAfter}`,
      );
    } catch (err: unknown) {
      Logger.error(
        `[DELTA FAIL] event=${eventId} delta=${debt} err=${errorMessage(err)}`,
      );
      throw err;
    }

    try {
      await this.coinLedgerRepo.createRefillIfNotExists({
        userId: 'system',
        eventId,
        teamId,
        subscriptionId,
        planId,
        requestId: eventId,
        reservationId: eventId,
        periodKey: newPeriodKey,
        allowance,
        debtApplied: debt,
        remainingAfter,
      });

      Logger.log(`[LEDGER OK] ${eventId}`);
    } catch (err: unknown) {
      Logger.error(`[LEDGER FAIL] event=${eventId} err=${errorMessage(err)}`);
      throw err;
    }

    try {
      await this.coinBalanceRepo.upsertRefill({
        teamId,
        subscriptionId,
        periodKey: newPeriodKey,
        allowance,
        remainingAfter,
        debtApplied: debt,
        eventId,
      });

      Logger.log(`[BALANCE OK] ${eventId}`);
    } catch (err: unknown) {
      Logger.error(`[BALANCE FAIL] event=${eventId} err=${errorMessage(err)}`);
      throw err;
    }

    Logger.log(
      `[REFILL DONE] team=${teamId} period=${newPeriodKey} remaining=${remainingAfter}`,
    );
    return { remainingAfter };
  }

  // ─── User-request refill workflow ────────────────────────────────────────

  async requestRefill(dto: {
    userId: string;
    teamId?: string;
    requestedCoins: number;
    notifyAdmins?: boolean;
  }): Promise<CoinRefillRequest> {
    const requestedCoins = this.normalizePositiveCoins(
      dto.requestedCoins,
      'requestedCoins',
    );
    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    const settings = this.toSettings(user.settings);
    const shouldAutoApprove = this.shouldAutoApproveRequester(user);
    const existingRequest = settings.coinRefillRequest;
    if (existingRequest?.status === 'pending') {
      const resolvedTeamId = await this.resolvePersonalWorkspaceTeamId(
        user,
        existingRequest.teamId ?? dto.teamId,
      );
      if (existingRequest.teamId === resolvedTeamId) {
        return shouldAutoApprove
          ? this.approveRefill({
              userId: dto.userId,
              approvedCoins: existingRequest.requestedCoins,
              reviewer: user.email,
              notifyRequester: false,
            })
          : existingRequest;
      }

      const normalizedRequest: CoinRefillRequest = {
        ...existingRequest,
        teamId: resolvedTeamId,
      };
      await this.userRepository.updateSettings(dto.userId, {
        ...settings,
        coinRefillRequest: normalizedRequest,
      });
      return shouldAutoApprove
        ? this.approveRefill({
            userId: dto.userId,
            approvedCoins: normalizedRequest.requestedCoins,
            reviewer: user.email,
            notifyRequester: false,
          })
        : normalizedRequest;
    }

    const teamId = await this.resolvePersonalWorkspaceTeamId(user, dto.teamId);
    const now = new Date().toISOString();

    const refillRequest: CoinRefillRequest = {
      requestedCoins,
      requestedAt: now,
      status: 'pending',
      teamId,
    };

    await this.userRepository.updateSettings(dto.userId, {
      ...settings,
      coinRefillRequest: refillRequest,
    });

    if (shouldAutoApprove) {
      return this.approveRefill({
        userId: dto.userId,
        approvedCoins: requestedCoins,
        reviewer: user.email,
        notifyRequester: false,
      });
    }

    if (dto.notifyAdmins !== false) {
      await this.notifySuperAdminsOfRefillRequest(user, refillRequest);
    }

    this.logger.log(
      `requestRefill: user=${dto.userId} team=${teamId} coins=${requestedCoins}`,
    );
    return refillRequest;
  }

  async listPendingRefills(): Promise<
    Array<CoinRefillRequest & { userId: string; email: string; name: string }>
  > {
    const users = await this.userRepository.findMany();

    return users
      .flatMap((user) => {
        const settings = this.toSettings(user.settings);
        const req = settings.coinRefillRequest;
        if (!req || req.status !== 'pending') return [];
        return [
          { ...req, userId: user.id, email: user.email, name: user.name },
        ];
      })
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }

  async approveRefill(dto: {
    userId: string;
    approvedCoins: number;
    reviewer: string;
    notifyRequester?: boolean;
  }): Promise<CoinRefillRequest> {
    const approvedCoins = this.normalizePositiveCoins(
      dto.approvedCoins,
      'approvedCoins',
    );
    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    const settings = this.toSettings(user.settings);
    const req = settings.coinRefillRequest;
    if (!req || req.status !== 'pending') {
      throw new NotFoundException('No pending refill request found');
    }

    const resolvedTeamId = await this.resolvePersonalWorkspaceTeamId(
      user,
      req.teamId,
    );
    const personalBalance = await this.getPersonalBalanceState(dto.userId);
    const periodKey = personalBalance.periodKey;
    const newAllowance = personalBalance.allowance + approvedCoins;
    const eventId = `refill:personal:${dto.userId}:${periodKey}:${Date.now()}`;

    const deltaResult = await this.coinRedis.applyDeltaIdempotent({
      teamId: personalBalance.entityKey,
      periodKey,
      deltaCoins: -approvedCoins,
      eventId,
      ttlSeconds: personalBalance.ttlSeconds,
    });
    if (!deltaResult.applied && deltaResult.reason !== 'ALREADY_PROCESSED') {
      throw new Error(
        `Unable to apply personal refill delta: ${deltaResult.reason}`,
      );
    }
    const newRemaining =
      deltaResult.remainingAfter ?? personalBalance.remaining + approvedCoins;

    await this.coinBalanceRepo.upsertRefill({
      teamId: personalBalance.entityKey,
      subscriptionId: 'personal',
      periodKey,
      allowance: newAllowance,
      remainingAfter: newRemaining,
      debtApplied: 0,
      eventId,
    });

    await this.coinLedgerRepo.createRefillIfNotExists({
      userId: dto.userId,
      eventId,
      teamId: personalBalance.entityKey,
      subscriptionId: 'personal',
      planId: 'personal',
      requestId: eventId,
      reservationId: eventId,
      periodKey,
      allowance: newAllowance,
      debtApplied: 0,
      deltaCoins: approvedCoins,
      remainingAfter: newRemaining,
    });

    const now = new Date().toISOString();
    const updated: CoinRefillRequest = {
      ...req,
      teamId: resolvedTeamId,
      status: 'approved',
      approvedCoins,
      reviewedAt: now,
      reviewedBy: dto.reviewer,
      periodKey,
    };

    await this.userRepository.updateSettings(dto.userId, {
      ...settings,
      coinRefillRequest: updated,
    });

    await this.clearPendingRequestNotifications(user.id);
    if (dto.notifyRequester !== false) {
      await this.notifyRequesterReviewed(user, updated, 'approved');
    }

    this.logger.log(
      `approveRefill: user=${dto.userId} team=${resolvedTeamId} approvedCoins=${approvedCoins} allowance=${newAllowance} remaining=${newRemaining}`,
    );
    return updated;
  }

  async denyRefill(dto: {
    userId: string;
    reviewer: string;
  }): Promise<CoinRefillRequest> {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    const settings = this.toSettings(user.settings);
    const req = settings.coinRefillRequest;
    if (!req || req.status !== 'pending') {
      throw new NotFoundException('No pending refill request found');
    }

    const resolvedTeamId = await this.resolvePersonalWorkspaceTeamId(
      user,
      req.teamId,
    );
    const now = new Date().toISOString();
    const updated: CoinRefillRequest = {
      ...req,
      teamId: resolvedTeamId,
      status: 'denied',
      reviewedAt: now,
      reviewedBy: dto.reviewer,
    };

    await this.userRepository.updateSettings(dto.userId, {
      ...settings,
      coinRefillRequest: updated,
    });

    await this.clearPendingRequestNotifications(user.id);
    await this.notifyRequesterReviewed(user, updated, 'denied');

    this.logger.log(`denyRefill: user=${dto.userId} team=${resolvedTeamId}`);
    return updated;
  }

  async getMyRefillRequest(userId: string): Promise<CoinRefillRequest | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    const settings = this.toSettings(user.settings);
    const request = settings.coinRefillRequest ?? null;
    if (!request || request.status !== 'pending') {
      return request;
    }

    try {
      if (this.shouldAutoApproveRequester(user)) {
        return this.approveRefill({
          userId,
          approvedCoins: request.requestedCoins,
          reviewer: user.email,
          notifyRequester: false,
        });
      }

      const resolvedTeamId = await this.resolvePersonalWorkspaceTeamId(
        user,
        request.teamId,
      );
      if (request.teamId === resolvedTeamId) {
        return request;
      }

      const normalizedRequest: CoinRefillRequest = {
        ...request,
        teamId: resolvedTeamId,
      };
      await this.userRepository.updateSettings(userId, {
        ...settings,
        coinRefillRequest: normalizedRequest,
      });
      return normalizedRequest;
    } catch {
      return request;
    }
  }

  private toSettings(value: unknown): UserSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as UserSettings;
  }

  private getSuperAdminEmails(): string[] {
    return (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  private async notifySuperAdminsOfRefillRequest(
    requester: RequestingUser,
    refillRequest: CoinRefillRequest,
  ): Promise<void> {
    const adminEmails = this.getSuperAdminEmails();
    if (adminEmails.length === 0) {
      return;
    }

    try {
      const users = await this.userRepository.findMany();
      const recipientUserIds = users
        .filter((user) => {
          const normalizedEmail = user.email.trim().toLowerCase();
          return (
            user.id !== requester.id &&
            Boolean(normalizedEmail && adminEmails.includes(normalizedEmail))
          );
        })
        .map((user) => user.id);

      if (recipientUserIds.length === 0) {
        return;
      }

      await this.notificationService.createBatch({
        recipientUserIds,
        title: 'New credit top-up request',
        message: `${requester.name || requester.email} requested ${refillRequest.requestedCoins.toLocaleString()} credits.`,
        type: 'coin_refill_request',
        severity: NotificationSeverity.INFO,
        sourceType: NotificationSourceType.USER,
        sourceUserId: requester.id,
        metadata: {
          requesterUserId: requester.id,
          requesterEmail: requester.email,
          teamId: refillRequest.teamId,
          requestedCoins: refillRequest.requestedCoins,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify super admins about coin refill request for ${requester.email}`,
        error as Error,
      );
    }
  }

  private async notifyRequesterReviewed(
    requester: RequestingUser,
    refillRequest: CoinRefillRequest,
    decision: 'approved' | 'denied',
  ): Promise<void> {
    const title =
      decision === 'approved'
        ? 'Credit top-up approved'
        : 'Credit top-up request denied';
    const message =
      decision === 'approved'
        ? `${(refillRequest.approvedCoins ?? refillRequest.requestedCoins).toLocaleString()} personal credits were added to your account.`
        : `Your request for ${refillRequest.requestedCoins.toLocaleString()} credits was not approved.`;

    try {
      await this.notificationService.createOne({
        recipientUserId: requester.id,
        title,
        message,
        type: 'coin_refill_decision',
        severity:
          decision === 'approved'
            ? NotificationSeverity.INFO
            : NotificationSeverity.WARNING,
        sourceType: NotificationSourceType.SYSTEM,
        metadata: {
          decision,
          teamId: refillRequest.teamId,
          requestedCoins: refillRequest.requestedCoins,
          approvedCoins: refillRequest.approvedCoins,
          reviewedBy: refillRequest.reviewedBy,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create requester coin refill notification for ${requester.email}`,
        error as Error,
      );
    }
  }

  private async clearPendingRequestNotifications(
    requesterUserId: string,
  ): Promise<void> {
    try {
      await this.notificationService.markMatchingRead({
        type: 'coin_refill_request',
        metadata: {
          requesterUserId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark coin refill request notifications as read for ${requesterUserId}`,
        error as Error,
      );
    }
  }
}
