import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import { SessionRepository } from '../repositories/session.repository';
import { SessionMemberRepository } from '../repositories/session-member.repository';
import {
  AddSessionMembersDto,
  BulkAddSessionMembersResponseDto,
  RemoveSessionMemberResponseDto,
  SessionMemberListResponseDto,
  SessionMemberResponseDto,
  SessionMemberRoleDto,
} from '../dto/session-member.dto';
import type {
  SessionMember,
  SessionMemberRole,
  Prisma,
} from '@prisma/simulation-client';
import { SimulationRedisService } from './redis/redis.service';

@Injectable()
export class SessionMemberService {
  private readonly logger = new Logger(SessionMemberService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionMemberRepository: SessionMemberRepository,
    private readonly prisma: SimulationPrismaService,
    private readonly redis: SimulationRedisService,
  ) {}

  async listMembers(
    sessionId: string,
    requesterUserId: string,
  ): Promise<SessionMemberListResponseDto> {
    await this.assertMember(sessionId, requesterUserId);

    const members =
      await this.sessionMemberRepository.findBySessionId(sessionId);
    return {
      members: members.map(this.mapToResponseDto),
      total: members.length,
    };
  }

  async addMembers(
    sessionId: string,
    requesterUserId: string,
    dto: AddSessionMembersDto,
  ): Promise<BulkAddSessionMembersResponseDto> {
    if (!dto.userIds || dto.userIds.length === 0) {
      throw new BadRequestException('userIds is required');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.status === 'ended') {
      throw new BadRequestException(
        `Cannot add members to session ${sessionId} because it has ended`,
      );
    }

    await this.assertOwner(sessionId, requesterUserId);

    const existingMembers =
      await this.sessionMemberRepository.findBySessionId(sessionId);
    const existingUserIds = new Set(existingMembers.map((m) => m.userId));
    const errors: string[] = [];

    const role = dto.role || SessionMemberRoleDto.viewer;
    if (role === SessionMemberRoleDto.owner) {
      errors.push(
        'Cannot add a new owner via this endpoint. Use ownership transfer.',
      );
    }

    const createData = dto.userIds
      .filter((userId) => {
        if (existingUserIds.has(userId)) {
          errors.push(`User ${userId} already added to session ${sessionId}`);
          return false;
        }
        return true;
      })
      .map((userId) => ({
        sessionId,
        userId,
        role: (role === SessionMemberRoleDto.owner
          ? 'viewer'
          : role) as SessionMemberRole,
        userSnapshot: dto.userSnapshots?.[userId] as
          | Prisma.InputJsonValue
          | undefined,
      }));

    const result = await this.sessionMemberRepository.createMany(createData);

    const members =
      await this.sessionMemberRepository.findBySessionId(sessionId);
    const createdUserIds = new Set(createData.map((member) => member.userId));
    const createdMembers = members.filter((member) =>
      createdUserIds.has(member.userId),
    );

    const created = result.count;
    const failed = dto.userIds.length - created;

    this.logger.log(
      `Added ${created} members to session ${sessionId}, ${failed} failed`,
    );
    await this.invalidateSessionFullCache(sessionId);

    return {
      members: createdMembers.map(this.mapToResponseDto),
      created,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async removeMember(
    sessionId: string,
    requesterUserId: string,
    userId: string,
  ): Promise<RemoveSessionMemberResponseDto> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const actorMember =
      await this.sessionMemberRepository.findBySessionIdAndUserId(
        sessionId,
        requesterUserId,
      );

    if (!actorMember) {
      throw new ForbiddenException(
        `User ${requesterUserId} is not a member of session ${sessionId}`,
      );
    }

    if (actorMember.role !== 'owner' && requesterUserId !== userId) {
      throw new ForbiddenException(
        `User ${requesterUserId} cannot remove members from session ${sessionId}`,
      );
    }

    const targetMember =
      await this.sessionMemberRepository.findBySessionIdAndUserId(
        sessionId,
        userId,
      );
    if (!targetMember) {
      throw new NotFoundException(
        `User ${userId} is not a member of session ${sessionId}`,
      );
    }

    const removalResult = await this.prisma.client.$transaction(async (tx) => {
      await tx.sessionMember.delete({
        where: {
          sessionId_userId: {
            sessionId,
            userId,
          },
        },
      });

      const remainingMembers = await tx.sessionMember.findMany({
        where: { sessionId },
        orderBy: { joinedAt: 'asc' },
      });

      if (remainingMembers.length === 0) {
        await tx.session.delete({ where: { id: sessionId } });
        return {
          sessionDeleted: true,
          newOwnerId: undefined as string | undefined,
        };
      }

      if (targetMember.role === 'owner') {
        const nextOwner = remainingMembers[0];
        await tx.sessionMember.update({
          where: { id: nextOwner.id },
          data: { role: 'owner' },
        });
        return { sessionDeleted: false, newOwnerId: nextOwner.userId };
      }

      return { sessionDeleted: false, newOwnerId: undefined };
    });

    const message = removalResult.sessionDeleted
      ? `Session ${sessionId} deleted because it has no members`
      : `Member ${userId} removed from session ${sessionId}`;

    await this.invalidateSessionFullCache(sessionId);

    return {
      message,
      sessionId,
      removedUserId: userId,
      newOwnerId: removalResult.newOwnerId,
      sessionDeleted: removalResult.sessionDeleted || undefined,
    };
  }

  private async assertMember(
    sessionId: string,
    requesterUserId: string,
  ): Promise<SessionMember> {
    const member = await this.sessionMemberRepository.findBySessionIdAndUserId(
      sessionId,
      requesterUserId,
    );
    if (!member) {
      throw new ForbiddenException(
        `User ${requesterUserId} does not have access to session ${sessionId}`,
      );
    }
    return member;
  }

  private async assertOwner(
    sessionId: string,
    requesterUserId: string,
  ): Promise<SessionMember> {
    const member = await this.assertMember(sessionId, requesterUserId);
    if (member.role !== 'owner') {
      throw new ForbiddenException(
        `User ${requesterUserId} does not have permission to modify session ${sessionId}`,
      );
    }
    return member;
  }

  private mapToResponseDto = (
    member: SessionMember,
  ): SessionMemberResponseDto => {
    return {
      id: member.id,
      sessionId: member.sessionId,
      userId: member.userId,
      role: member.role as SessionMemberRoleDto,
      userSnapshot: member.userSnapshot as Record<string, any> | undefined,
      joinedAt: member.joinedAt,
      updatedAt: member.updatedAt,
    };
  };

  private async invalidateSessionFullCache(sessionId: string): Promise<void> {
    try {
      await this.redis.deleteSessionFull(sessionId);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate session full cache for ${sessionId}: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }
}
