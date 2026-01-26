import { Injectable } from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import type {
  SessionInvitation,
  InvitationStatus,
} from '@prisma/simulation-client';
import { Prisma } from '@prisma/simulation-client';

/**
 * Interface for creating a new invitation
 */
export interface CreateInvitationData {
  sessionId: string;
  inviterId: string;
  inviterSnapshot?: Prisma.InputJsonValue;
  inviteeId: string;
  inviteeSnapshot?: Prisma.InputJsonValue;
  message?: string;
}

/**
 * Invitation Repository
 *
 * Handles all data access operations for session invitations
 */
@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  /**
   * Create a new invitation
   */
  async create(data: CreateInvitationData): Promise<SessionInvitation> {
    return await this.prisma.client.sessionInvitation.create({
      data: {
        sessionId: data.sessionId,
        inviterId: data.inviterId,
        inviterSnapshot: data.inviterSnapshot,
        inviteeId: data.inviteeId,
        inviteeSnapshot: data.inviteeSnapshot,
        message: data.message,
      },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Create multiple invitations at once
   */
  async createMany(
    invitations: CreateInvitationData[],
  ): Promise<{ count: number }> {
    return await this.prisma.client.sessionInvitation.createMany({
      data: invitations.map((inv) => ({
        sessionId: inv.sessionId,
        inviterId: inv.inviterId,
        inviterSnapshot: inv.inviterSnapshot,
        inviteeId: inv.inviteeId,
        inviteeSnapshot: inv.inviteeSnapshot,
        message: inv.message,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Find invitation by ID
   */
  async findById(id: string): Promise<SessionInvitation | null> {
    return await this.prisma.client.sessionInvitation.findUnique({
      where: { id },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Find invitations for a session
   */
  async findBySessionId(sessionId: string): Promise<SessionInvitation[]> {
    return await this.prisma.client.sessionInvitation.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Find invitations received by a user
   */
  async findByInviteeId(
    inviteeId: string,
    status?: InvitationStatus,
  ): Promise<SessionInvitation[]> {
    const where: Prisma.SessionInvitationWhereInput = { inviteeId };

    if (status) {
      where.status = status;
    }

    return await this.prisma.client.sessionInvitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Find invitations sent by a user
   */
  async findByInviterId(
    inviterId: string,
    status?: InvitationStatus,
  ): Promise<SessionInvitation[]> {
    const where: Prisma.SessionInvitationWhereInput = { inviterId };

    if (status) {
      where.status = status;
    }

    return await this.prisma.client.sessionInvitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Update invitation status
   */
  async updateStatus(
    id: string,
    status: InvitationStatus,
  ): Promise<SessionInvitation> {
    return await this.prisma.client.sessionInvitation.update({
      where: { id },
      data: {
        status,
        respondedAt: status !== 'pending' ? new Date() : null,
      },
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Check if invitation exists for a session and invitee
   */
  async existsForSessionAndInvitee(
    sessionId: string,
    inviteeId: string,
  ): Promise<SessionInvitation | null> {
    return await this.prisma.client.sessionInvitation.findUnique({
      where: {
        sessionId_inviteeId: {
          sessionId,
          inviteeId,
        },
      },
    });
  }

  /**
   * Delete/revoke an invitation
   */
  async delete(id: string): Promise<void> {
    await this.prisma.client.sessionInvitation.delete({
      where: { id },
    });
  }

  /**
   * Count pending invitations for a user
   */
  async countPendingForInvitee(inviteeId: string): Promise<number> {
    return await this.prisma.client.sessionInvitation.count({
      where: {
        inviteeId,
        status: 'pending',
      },
    });
  }

  /**
   * Count invitations for a session by status
   */
  async countBySessionAndStatus(
    sessionId: string,
    status?: InvitationStatus,
  ): Promise<number> {
    const where: Prisma.SessionInvitationWhereInput = { sessionId };

    if (status) {
      where.status = status;
    }

    return await this.prisma.client.sessionInvitation.count({ where });
  }
}
