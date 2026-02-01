import { Injectable } from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import type {
  SessionMember,
  SessionMemberRole,
} from '@prisma/simulation-client';
import { Prisma } from '@prisma/simulation-client';

export interface CreateSessionMemberData {
  sessionId: string;
  userId: string;
  role?: SessionMemberRole;
  userSnapshot?: Prisma.InputJsonValue;
}

@Injectable()
export class SessionMemberRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  async findBySessionId(sessionId: string): Promise<SessionMember[]> {
    return await this.prisma.client.sessionMember.findMany({
      where: { sessionId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async findBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<SessionMember | null> {
    return await this.prisma.client.sessionMember.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    });
  }

  async findOwner(sessionId: string): Promise<SessionMember | null> {
    return await this.prisma.client.sessionMember.findFirst({
      where: {
        sessionId,
        role: 'owner',
      },
    });
  }

  async findNextOwner(
    sessionId: string,
    excludedUserId: string,
  ): Promise<SessionMember | null> {
    return await this.prisma.client.sessionMember.findFirst({
      where: {
        sessionId,
        NOT: { userId: excludedUserId },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async create(data: CreateSessionMemberData): Promise<SessionMember> {
    return await this.prisma.client.sessionMember.create({
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        role: data.role ?? 'viewer',
        userSnapshot: data.userSnapshot,
      },
    });
  }

  async createMany(
    members: CreateSessionMemberData[],
  ): Promise<{ count: number }> {
    if (members.length === 0) {
      return { count: 0 };
    }

    return await this.prisma.client.sessionMember.createMany({
      data: members.map((member) => ({
        sessionId: member.sessionId,
        userId: member.userId,
        role: member.role ?? 'viewer',
        userSnapshot: member.userSnapshot,
      })),
      skipDuplicates: true,
    });
  }

  async updateRole(
    id: string,
    role: SessionMemberRole,
  ): Promise<SessionMember> {
    return await this.prisma.client.sessionMember.update({
      where: { id },
      data: { role },
    });
  }

  async deleteBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.client.sessionMember.delete({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    });
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return await this.prisma.client.sessionMember.count({
      where: { sessionId },
    });
  }
}
