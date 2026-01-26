import { Injectable } from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import type { Session, SessionType } from '@prisma/simulation-client';
import { Prisma } from '@prisma/simulation-client';

/**
 * Interface for creating a new session
 */
export interface CreateSessionData {
  userId: string;
  orgId: string;
  userSnapshot?: Prisma.InputJsonValue;
  orgSnapshot?: Prisma.InputJsonValue;
  name?: string;
  type: SessionType;
  tags?: string[];
  sessionConfig?: Prisma.InputJsonValue;
  scenarioId?: string;
  personaId?: string;
  language?: string;
  crmContextId?: string;
}

/**
 * Interface for updating a session
 */
export interface UpdateSessionData {
  name?: string;
  tags?: string[];
  sessionConfig?: Prisma.InputJsonValue;
  scenarioId?: string;
  personaId?: string;
  language?: string;
  status?: string;
  endedReason?: string;
  endedAt?: Date;
}

/**
 * Interface for session list filters
 */
export interface SessionListFilters {
  userId?: string;
  orgId?: string;
  type?: SessionType;
  status?: string;
  scenarioId?: string;
  personaId?: string;
}

/**
 * Session Repository
 *
 * Handles all data access operations for sessions
 */
@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  /**
   * Find all sessions with optional filters and pagination
   */
  async findMany(
    filters?: SessionListFilters,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ sessions: Session[]; total: number }> {
    const where: Prisma.SessionWhereInput = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.orgId) {
      where.orgId = filters.orgId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.scenarioId) {
      where.scenarioId = filters.scenarioId;
    }
    if (filters?.personaId) {
      where.personaId = filters.personaId;
    }

    const [sessions, total] = await Promise.all([
      this.prisma.client.session.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          scenario: true,
          persona: true,
        },
      }),
      this.prisma.client.session.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * Find a session by ID
   */
  async findById(id: string): Promise<Session | null> {
    return await this.prisma.client.session.findUnique({
      where: { id },
      include: {
        scenario: true,
        persona: true,
        turns: {
          orderBy: { order: 'asc' },
          take: 10,
        },
        metrics: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ sessions: Session[]; total: number }> {
    return this.findMany({ userId }, limit, offset);
  }

  /**
   * Find sessions by organization ID
   */
  async findByOrgId(
    orgId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ sessions: Session[]; total: number }> {
    return this.findMany({ orgId }, limit, offset);
  }

  /**
   * Create a new session
   */
  async create(data: CreateSessionData): Promise<Session> {
    return await this.prisma.client.session.create({
      data: {
        userId: data.userId,
        orgId: data.orgId,
        userSnapshot: data.userSnapshot,
        orgSnapshot: data.orgSnapshot,
        name: data.name,
        type: data.type,
        tags: data.tags || [],
        sessionConfig: data.sessionConfig,
        scenarioId: data.scenarioId,
        personaId: data.personaId,
        language: data.language,
        crmContextId: data.crmContextId,
      },
      include: {
        scenario: true,
        persona: true,
      },
    });
  }

  /**
   * Update a session
   */
  async update(id: string, data: UpdateSessionData): Promise<Session> {
    return await this.prisma.client.session.update({
      where: { id },
      data,
      include: {
        scenario: true,
        persona: true,
      },
    });
  }

  /**
   * End a session
   */
  async end(id: string, reason?: string): Promise<Session> {
    return await this.prisma.client.session.update({
      where: { id },
      data: {
        status: 'ended',
        endedReason: reason,
        endedAt: new Date(),
      },
      include: {
        scenario: true,
        persona: true,
      },
    });
  }

  /**
   * Delete a session
   */
  async delete(id: string): Promise<void> {
    await this.prisma.client.session.delete({
      where: { id },
    });
  }

  /**
   * Count sessions by filters
   */
  async count(filters?: SessionListFilters): Promise<number> {
    const where: Prisma.SessionWhereInput = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.orgId) {
      where.orgId = filters.orgId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.scenarioId) {
      where.scenarioId = filters.scenarioId;
    }
    if (filters?.personaId) {
      where.personaId = filters.personaId;
    }

    return await this.prisma.client.session.count({ where });
  }

  /**
   * Find active sessions by user ID
   */
  async findActiveByUserId(userId: string): Promise<Session[]> {
    return await this.prisma.client.session.findMany({
      where: {
        userId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        scenario: true,
        persona: true,
      },
    });
  }

  /**
   * Find active sessions by organization ID
   */
  async findActiveByOrgId(orgId: string): Promise<Session[]> {
    return await this.prisma.client.session.findMany({
      where: {
        orgId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        scenario: true,
        persona: true,
      },
    });
  }
}
