import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/user-client';
import {
  Team,
  TeamMembership,
  CreateTeamDto,
  UpdateTeamDto,
  AddMemberDto,
  UpdateMemberDto,
  TeamMetadata,
  TeamPendingSignupInvite,
} from '@pitch/shared-backend/interfaces/user.interface';
import { TeamRepository } from '../repositories/team.repository';
import { TeamInviteEmailService } from './team-invite-email.service';
import { NotificationService } from '../../notifications/service/notification.service';
import {
  NotificationSeverity,
  NotificationSourceType,
} from '../../mongo/schemas/notification.schema';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);
  private static readonly DEFAULT_INVITE_EXPIRY_DAYS = 15;
  private static readonly INVITE_EXPIRY_NOTICE_MINUTES = 15;

  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly teamInviteEmailService: TeamInviteEmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTeam(
    createTeamDto: CreateTeamDto,
    requesterId: string,
  ): Promise<Team> {
    const slug = await this.createSlug({
      name: createTeamDto.name,
      slug: createTeamDto.slug,
    });
    const metadata = this.buildMetadataOnCreate(
      createTeamDto.metadata ?? null,
      requesterId,
    );

    return this.teamRepository.createTeam(
      {
        ...createTeamDto,
        slug,
        isActive: false, // inactive until admin approves
        approvalStatus: 'PENDING',
        metadata,
      },
      requesterId,
    );
  }

  async updateTeam(
    teamId: string,
    dto: UpdateTeamDto,
    requesterId: string,
    skipAuthorityCheck = false,
  ): Promise<Team> {
    const existingTeam = await this.teamRepository.findById(teamId);
    if (!existingTeam) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }
    if (dto.name !== undefined && existingTeam.name !== dto.name) {
      const teamWithName = await this.teamRepository.findByName(dto.name);
      if (teamWithName && teamWithName.id !== teamId) {
        throw new ConflictException(
          `Team name '${dto.name}' is already in use`,
        );
      }
    }
    let slug = existingTeam.slug;
    if (dto.slug && dto.slug !== existingTeam.slug) {
      slug = await this.createSlug({
        name: dto.name ?? existingTeam.name,
        slug: dto.slug,
      });
    } else if (dto.name && dto.name !== existingTeam.name) {
      slug = await this.createSlug({ name: dto.name, slug: undefined });
    }

    if (!skipAuthorityCheck) {
      await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);
    }

    const metadata = this.buildMetadataOnUpdate(
      existingTeam.metadata ?? null,
      dto.metadata,
      requesterId,
    );

    return this.teamRepository.updateTeam(teamId, {
      ...dto,
      slug,
      metadata,
    });
  }

  async removeTeam(
    teamId: string,
    requesterId: string,
  ): Promise<{ message: string }> {
    await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);
    await this.teamRepository.deleteTeam(teamId);
    return { message: `Team with ID ${teamId} has been deleted` };
  }

  async addMember(
    addMemberDto: AddMemberDto,
    requesterId: string,
    skipAuthorityCheck = false,
  ): Promise<TeamMembership> {
    if (!skipAuthorityCheck) {
      await this.teamRepository.confirmAuthorityOrThrow(
        requesterId,
        addMemberDto.teamId,
      );
    }
    if (addMemberDto.role === Role.OWNER) {
      const activeOwners = await this.teamRepository.findActiveOwners(
        addMemberDto.teamId,
      );
      if (activeOwners.length > 0) {
        throw new ConflictException(
          'This team already has an owner. Transfer ownership from an existing member instead.',
        );
      }
    }

    const existingMembership = await this.teamRepository.findMembership(
      addMemberDto.teamId,
      addMemberDto.userId,
    );
    if (existingMembership) {
      if (existingMembership.isActive !== false) {
        throw new ConflictException('User is already a member of this team');
      }
      return this.teamRepository.reactivateMember({
        ...addMemberDto,
        isActive: true,
      });
    }

    return this.teamRepository.addMember({
      ...addMemberDto,
    });
  }

  async updateMember(
    updateMemberDto: UpdateMemberDto,
    requesterId: string,
    skipAuthorityCheck = false,
  ): Promise<TeamMembership> {
    if (!skipAuthorityCheck) {
      await this.teamRepository.confirmAuthorityOrThrow(
        requesterId,
        updateMemberDto.teamId,
      );
    }

    const existingMembership = await this.teamRepository.findMembership(
      updateMemberDto.teamId,
      updateMemberDto.userId,
    );
    if (!existingMembership) {
      throw new NotFoundException(
        `Membership for user ${updateMemberDto.userId} in team ${updateMemberDto.teamId} not found`,
      );
    }

    if (
      updateMemberDto.role &&
      updateMemberDto.role !== Role.OWNER &&
      existingMembership.role === Role.OWNER
    ) {
      throw new ConflictException(
        'Transfer ownership to another member before changing the current owner role.',
      );
    }

    if (
      updateMemberDto.role === Role.OWNER &&
      existingMembership.role !== Role.OWNER
    ) {
      return this.teamRepository.transferOwnership({
        ...updateMemberDto,
        acceptedAt: updateMemberDto.acceptedAt ?? new Date(),
      });
    }

    return this.teamRepository.updateMember({
      ...updateMemberDto,
      acceptedAt: updateMemberDto.acceptedAt ?? new Date(),
    });
  }

  async removeTeamMember(
    teamId: string,
    userId: string,
    requesterId: string,
    skipAuthorityCheck = false,
  ): Promise<{ message: string }> {
    const isSelfLeave = requesterId === userId;
    if (!isSelfLeave && !skipAuthorityCheck) {
      await this.teamRepository.confirmAuthorityOrThrow(requesterId, teamId);
    }
    const membership = await this.teamRepository.findMembership(teamId, userId);
    if (!membership) {
      throw new NotFoundException(
        `Membership for user ${userId} in team ${teamId} not found`,
      );
    }
    if (membership.isActive !== false && membership.role === Role.OWNER) {
      throw new ConflictException(
        'Transfer ownership to another member before removing the current owner.',
      );
    }
    await this.teamRepository.deleteTeamMember(teamId, userId);
    return {
      message: `User with ID ${userId} has been removed from team with ID: ${teamId}`,
    };
  }

  async sendSignupInvite(input: {
    teamId: string;
    email: string;
    requesterId: string;
    inviterName?: string;
    signupUrl?: string;
    role?: Role;
  }): Promise<{ message: string }> {
    if (input.role === Role.OWNER) {
      throw new BadRequestException(
        'Owner role cannot be assigned through signup invites',
      );
    }

    await this.teamRepository.confirmAuthorityOrThrow(
      input.requesterId,
      input.teamId,
    );

    const team = await this.teamRepository.findById(input.teamId);
    if (!team) {
      throw new NotFoundException(`Team with ID ${input.teamId} not found`);
    }

    const normalizedEmail = this.normalizeEmail(input.email);
    const metadataWithoutExpired = this.removeExpiredPendingSignupInvites(
      team.metadata ?? null,
    );
    const metadataWithInvite = this.addPendingSignupInvite(
      metadataWithoutExpired,
      {
        email: normalizedEmail,
        role: input.role ?? Role.MEMBER,
        invitedAt: new Date().toISOString(),
        invitedByUserId: input.requesterId,
      },
    );
    await this.teamRepository.updateTeamMetadata(
      input.teamId,
      metadataWithInvite as unknown as Prisma.InputJsonValue,
    );

    const signupUrl =
      input.signupUrl ??
      this.buildTeamSignupUrl({
        teamId: input.teamId,
        email: normalizedEmail,
      });

    await this.teamInviteEmailService.sendSignupInvite({
      email: normalizedEmail,
      signupUrl,
      invitedByName: input.inviterName,
      teamName: team.name,
      expiresMinutes: TeamService.INVITE_EXPIRY_NOTICE_MINUTES,
    });

    return {
      message: `Signup invite sent to ${normalizedEmail}`,
    };
  }

  async inviteMember(
    addMemberDto: AddMemberDto,
    requester: { id: string; name?: string | null },
  ): Promise<TeamMembership> {
    await this.teamRepository.confirmAuthorityOrThrow(
      requester.id,
      addMemberDto.teamId,
    );

    if (addMemberDto.userId === requester.id) {
      throw new BadRequestException('You are already a member of this team');
    }

    if (addMemberDto.role === Role.OWNER) {
      const activeOwners = await this.teamRepository.findActiveOwners(
        addMemberDto.teamId,
      );
      if (activeOwners.length > 0) {
        throw new ConflictException(
          'This team already has an owner. Transfer ownership from an existing member instead.',
        );
      }
    }

    const team = await this.teamRepository.findById(addMemberDto.teamId);
    if (!team) {
      throw new NotFoundException(
        `Team with ID ${addMemberDto.teamId} not found`,
      );
    }

    const invitedUser = await this.teamRepository.findUserById(
      addMemberDto.userId,
    );
    if (!invitedUser) {
      throw new NotFoundException(
        `User with ID ${addMemberDto.userId} not found`,
      );
    }

    const existingMembership = await this.teamRepository.findMembership(
      addMemberDto.teamId,
      addMemberDto.userId,
    );

    let membership: TeamMembership;
    if (existingMembership) {
      if (
        existingMembership.isActive !== false &&
        existingMembership.acceptedAt
      ) {
        throw new ConflictException('User is already a member of this team');
      }

      membership = await this.teamRepository.reinviteMember({
        ...addMemberDto,
        invitedByUserId: requester.id,
      });
    } else {
      membership = await this.teamRepository.inviteMember({
        ...addMemberDto,
        invitedByUserId: requester.id,
      });
    }

    await this.notificationService.createOne({
      recipientUserId: invitedUser.id,
      title: `Team invitation: ${team.name}`,
      message: `${requester.name ?? 'A team admin'} invited you to join ${team.name}. This invitation expires in ${TeamService.INVITE_EXPIRY_NOTICE_MINUTES} minutes.`,
      type: 'TEAM_INVITE',
      severity: NotificationSeverity.INFO,
      sourceType: NotificationSourceType.USER,
      sourceUserId: requester.id,
      metadata: {
        teamId: team.id,
        teamName: team.name,
        role: membership.role,
      },
    });

    await this.teamInviteEmailService.sendSignupInvite({
      email: invitedUser.email,
      invitedByName: requester.name ?? undefined,
      teamName: team.name,
      expiresMinutes: TeamService.INVITE_EXPIRY_NOTICE_MINUTES,
    });

    return membership;
  }

  async acceptInvite(
    teamId: string,
    userId: string,
  ): Promise<{ message: string; membership: TeamMembership }> {
    const membership = await this.teamRepository.findMembership(teamId, userId);
    if (!membership) {
      throw new BadRequestException('This invitation has expired');
    }

    if (membership.isActive !== false && membership.acceptedAt) {
      throw new ConflictException('Invitation has already been accepted');
    }

    if (membership.isActive !== false || !membership.invitedByUserId) {
      throw new BadRequestException('This invitation is no longer valid');
    }

    if (this.isInviteExpired(membership.invitedAt)) {
      await this.teamRepository.hardDeleteMembership(teamId, userId);
      throw new BadRequestException('This invitation has expired');
    }

    const updated = await this.teamRepository.acceptInvite(teamId, userId);
    return {
      message: 'Invitation accepted',
      membership: updated,
    };
  }

  async claimSignupInvite(
    teamId: string,
    userId: string,
  ): Promise<{ message: string; membership: TeamMembership }> {
    const team = await this.teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    const user = await this.teamRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const normalizedEmail = this.normalizeEmail(user.email);
    const pendingInvites = this.readPendingSignupInvites(team.metadata ?? null);
    const pendingInvite = pendingInvites.find(
      (invite) => this.normalizeEmail(invite.email) === normalizedEmail,
    );

    const expiredPendingInvite = pendingInvite
      ? this.isInviteExpired(new Date(pendingInvite.invitedAt))
      : false;

    if (expiredPendingInvite) {
      const remainingInvites = pendingInvites.filter(
        (invite) => this.normalizeEmail(invite.email) !== normalizedEmail,
      );
      const nextMetadata = this.writePendingSignupInvites(
        team.metadata ?? null,
        remainingInvites,
      );
      await this.teamRepository.updateTeamMetadata(
        teamId,
        nextMetadata as unknown as Prisma.InputJsonValue,
      );
      throw new BadRequestException('This invitation has expired');
    }

    if (!pendingInvite) {
      throw new NotFoundException(
        'No pending signup invite found for this user',
      );
    }

    const existingMembership = await this.teamRepository.findMembership(
      teamId,
      userId,
    );

    let membership: TeamMembership;
    if (existingMembership) {
      if (
        existingMembership.isActive !== false &&
        existingMembership.acceptedAt
      ) {
        throw new ConflictException('Invitation has already been accepted');
      } else {
        membership = await this.teamRepository.acceptInvite(teamId, userId);
      }
    } else {
      membership = await this.teamRepository.createAcceptedMember({
        teamId,
        userId,
        role: pendingInvite.role ?? Role.MEMBER,
        tokenLimit: 0,
        isActive: true,
        invitedByUserId: pendingInvite.invitedByUserId ?? null,
      });
    }

    const remainingInvites = pendingInvites.filter(
      (invite) => this.normalizeEmail(invite.email) !== normalizedEmail,
    );
    const nextMetadata = this.writePendingSignupInvites(
      team.metadata ?? null,
      remainingInvites,
    );
    await this.teamRepository.updateTeamMetadata(
      teamId,
      nextMetadata as unknown as Prisma.InputJsonValue,
    );

    return {
      message: 'Signup invite claimed',
      membership,
    };
  }

  async findAll(): Promise<Team[]> {
    return this.teamRepository.findMany();
  }

  async findById(id: string): Promise<Team> {
    const team = await this.teamRepository.findById(id);
    if (!team) throw new NotFoundException(`Team with ID ${id} not found`);
    return team;
  }

  async findUserTeams(userId: string): Promise<Team[]> {
    return this.teamRepository.findUserTeams(userId);
  }

  async findByName(name: string): Promise<Team | null> {
    return this.teamRepository.findByName(name);
  }

  async cleanupExpiredInvitations(): Promise<{
    deletedMembershipInvites: number;
    deletedSignupInvites: number;
  }> {
    const cutoff = this.getInviteExpiryCutoffDate();
    const deletedMembershipInvites =
      await this.teamRepository.deleteExpiredPendingInvites(cutoff);

    let deletedSignupInvites = 0;
    const teams = await this.teamRepository.listActiveTeamMetadata();
    for (const team of teams) {
      const pendingInvites = this.readPendingSignupInvites(
        team.metadata as TeamMetadata | null | undefined,
      );
      if (pendingInvites.length === 0) {
        continue;
      }

      const nextPending = pendingInvites.filter(
        (invite) => !this.isInviteExpired(new Date(invite.invitedAt)),
      );
      if (nextPending.length === pendingInvites.length) {
        continue;
      }

      deletedSignupInvites += pendingInvites.length - nextPending.length;
      const nextMetadata = this.writePendingSignupInvites(
        team.metadata as TeamMetadata | null | undefined,
        nextPending,
      );
      await this.teamRepository.updateTeamMetadata(
        team.id,
        nextMetadata as unknown as Prisma.InputJsonValue,
      );
    }

    if (deletedMembershipInvites > 0 || deletedSignupInvites > 0) {
      this.logger.log(
        `Expired invites cleanup: deleted ${deletedMembershipInvites} team memberships and ${deletedSignupInvites} signup invites`,
      );
    }

    return { deletedMembershipInvites, deletedSignupInvites };
  }

  private async createSlug(input: {
    name: string;
    slug?: string;
  }): Promise<string> {
    const base = this.slugify((input.slug ?? input.name).trim());
    return this.teamRepository.ensureUniqueSlug(base);
  }

  private slugify(s: string): string {
    const MAX = 50;
    const normalized = s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return normalized.slice(0, MAX);
  }

  private toMetadataObject(value: unknown): TeamMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as TeamMetadata;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getInviteExpiryDays(): number {
    const raw = process.env.TEAM_INVITE_EXPIRY_DAYS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return TeamService.DEFAULT_INVITE_EXPIRY_DAYS;
    }
    return Math.floor(parsed);
  }

  private getInviteExpiryCutoffDate(now = new Date()): Date {
    const days = this.getInviteExpiryDays();
    const ttlMs = days * 24 * 60 * 60 * 1000;
    return new Date(now.getTime() - ttlMs);
  }

  private isInviteExpired(invitedAt: Date | null | undefined): boolean {
    if (!invitedAt) return true;
    if (Number.isNaN(invitedAt.getTime())) return true;
    return invitedAt.getTime() < this.getInviteExpiryCutoffDate().getTime();
  }

  private buildTeamSignupUrl(input: { teamId: string; email: string }): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    const query = new URLSearchParams({
      teamId: input.teamId,
      email: input.email,
    });
    return `${baseUrl.replace(/\/+$/, '')}/auth/register?${query.toString()}`;
  }

  private readPendingSignupInvites(
    metadata: TeamMetadata | null | undefined,
  ): TeamPendingSignupInvite[] {
    const raw = metadata?.pendingSignupInvites;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((invite) => invite && typeof invite.email === 'string')
      .map((invite) => ({
        email: this.normalizeEmail(invite.email),
        role: invite.role,
        invitedAt: invite.invitedAt ?? new Date().toISOString(),
        invitedByUserId: invite.invitedByUserId,
      }));
  }

  private writePendingSignupInvites(
    metadata: TeamMetadata | null | undefined,
    pendingSignupInvites: TeamPendingSignupInvite[],
  ): TeamMetadata {
    const base = this.toMetadataObject(metadata);
    return {
      ...base,
      pendingSignupInvites,
    };
  }

  private addPendingSignupInvite(
    metadata: TeamMetadata | null | undefined,
    invite: TeamPendingSignupInvite,
  ): TeamMetadata {
    const pendingInvites = this.readPendingSignupInvites(metadata);
    const normalizedEmail = this.normalizeEmail(invite.email);
    const withoutExisting = pendingInvites.filter(
      (item) => this.normalizeEmail(item.email) !== normalizedEmail,
    );
    return this.writePendingSignupInvites(metadata, [
      ...withoutExisting,
      invite,
    ]);
  }

  private removeExpiredPendingSignupInvites(
    metadata: TeamMetadata | null | undefined,
  ): TeamMetadata {
    const pendingInvites = this.readPendingSignupInvites(metadata);
    if (pendingInvites.length === 0) {
      return this.toMetadataObject(metadata);
    }

    const validInvites = pendingInvites.filter(
      (invite) => !this.isInviteExpired(new Date(invite.invitedAt)),
    );
    return this.writePendingSignupInvites(metadata, validInvites);
  }

  private buildMetadataOnCreate(
    input: TeamMetadata | null | undefined,
    requesterId: string,
  ): TeamMetadata {
    const now = new Date().toISOString();
    const metadata = this.toMetadataObject(input);
    const audit = metadata.audit ?? {};

    return {
      ...metadata,
      audit: {
        ownerUserId: requesterId,
        createdByUserId: requesterId,
        createdAt: now,
        updatedByUserId: requesterId,
        updatedAt: now,
        version: typeof audit.version === 'number' ? audit.version : 1,
      },
    } satisfies TeamMetadata;
  }

  private buildMetadataOnUpdate(
    existing: TeamMetadata | null | undefined,
    patch: TeamMetadata | null | undefined,
    requesterId: string,
  ): TeamMetadata {
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
      profile: {
        ...(existingMetadata.profile ?? {}),
        ...(patchMetadata.profile ?? {}),
      },
      preferences: {
        ...(existingMetadata.preferences ?? {}),
        ...(patchMetadata.preferences ?? {}),
      },
      audit: {
        ownerUserId:
          patchAudit.ownerUserId ?? previousAudit.ownerUserId ?? requesterId,
        createdByUserId: previousAudit.createdByUserId ?? requesterId,
        createdAt: previousAudit.createdAt ?? now,
        updatedByUserId: requesterId,
        updatedAt: now,
        version: nextVersion,
      },
    } satisfies TeamMetadata;
  }

  async confirmAuthorityOrThrow(userId: string, teamId: string): Promise<Role> {
    return this.teamRepository.confirmAuthorityOrThrow(userId, teamId);
  }

  async listPendingTeams(): Promise<Team[]> {
    return this.teamRepository.findPendingTeams();
  }

  async approveTeam(teamId: string): Promise<Team> {
    const team = await this.teamRepository.findById(teamId);
    if (!team) throw new NotFoundException(`Team with ID ${teamId} not found`);
    if (team.approvalStatus !== 'PENDING') {
      throw new BadRequestException(`Team is not in PENDING state`);
    }
    return this.teamRepository.approveTeam(teamId);
  }

  async rejectTeam(teamId: string, note?: string): Promise<Team> {
    const team = await this.teamRepository.findById(teamId);
    if (!team) throw new NotFoundException(`Team with ID ${teamId} not found`);
    if (team.approvalStatus !== 'PENDING') {
      throw new BadRequestException(`Team is not in PENDING state`);
    }
    return this.teamRepository.rejectTeam(teamId, note);
  }
}
