import { Injectable } from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import type { SessionType as PrismaSessionType } from '@prisma/simulation-client';
import { Prisma } from '@prisma/simulation-client';
import type { SessionType } from '../dto/session.dto';

const sessionOwnerInclude = {
  scenario: true,
  persona: true,
  members: {
    where: { role: 'owner' },
    take: 1,
  },
} satisfies Prisma.SessionInclude;

export type SessionWithOwner = Prisma.SessionGetPayload<{
  include: typeof sessionOwnerInclude;
}>;

/**
 * Interface for creating a new session
 */
export interface CreateSessionData {
  ownerUserId: string;
  orgId: string;
  ownerSnapshot?: Prisma.InputJsonValue;
  orgSnapshot?: Prisma.InputJsonValue;
  name?: string;
  type: SessionType;
  tags?: string[];
  sessionConfig?: Prisma.InputJsonValue;
  scenarioId?: string;
  personaId?: string;
  language?: string;
  crmContextId?: string;
  coinReservationId?: string;
  coinPeriodKey?: string;
  estimatedCoins?: number;
  coinPriceUsd?: number;
}

/**
 * Interface for updating a session
 */
export interface UpdateSessionData {
  orgId?: string;
  orgSnapshot?: Prisma.InputJsonValue;
  name?: string;
  type?: SessionType;
  tags?: string[];
  sessionConfig?: Prisma.InputJsonValue;
  scenarioId?: string;
  personaId?: string;
  language?: string;
  crmContextId?: string;
  status?: string;
  endedReason?: string | null;
  endedAt?: Date | null;
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

  private readonly ownerInclude = sessionOwnerInclude;

  /**
   * Find all sessions with optional filters and pagination
   */
  async findMany(
    filters?: SessionListFilters,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ sessions: SessionWithOwner[]; total: number }> {
    const where: Prisma.SessionWhereInput = {};

    if (filters?.userId) {
      where.members = {
        some: {
          userId: filters.userId,
        },
      };
    }
    if (filters?.orgId) {
      where.orgId = filters.orgId;
    }
    if (filters?.type) {
      where.type = filters.type as PrismaSessionType;
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
        include: this.ownerInclude,
      }),
      this.prisma.client.session.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * Find a session by ID
   */
  async findById(id: string): Promise<SessionWithOwner | null> {
    return await this.prisma.client.session.findUnique({
      where: { id },
      include: this.ownerInclude,
    });
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ sessions: SessionWithOwner[]; total: number }> {
    return this.findMany({ userId }, limit, offset);
  }

  /**
   * Find sessions by organization ID
   */
  async findByOrgId(
    orgId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ sessions: SessionWithOwner[]; total: number }> {
    return this.findMany({ orgId }, limit, offset);
  }

  /**
   * Create a new session
   */
  async create(data: CreateSessionData): Promise<SessionWithOwner> {
    return await this.prisma.client.session.create({
      data: {
        orgId: data.orgId,
        orgSnapshot: data.orgSnapshot,
        name: data.name,
        type: data.type as PrismaSessionType,
        tags: data.tags || [],
        sessionConfig: data.sessionConfig,
        scenarioId: data.scenarioId,
        personaId: data.personaId,
        language: data.language,
        crmContextId: data.crmContextId,
        coinReservationId: data.coinReservationId,
        coinPeriodKey: data.coinPeriodKey,
        estimatedCoins: data.estimatedCoins,
        coinPriceUsd: data.coinPriceUsd,
        members: {
          create: {
            userId: data.ownerUserId,
            role: 'owner',
            userSnapshot: data.ownerSnapshot,
          },
        },
      },
      include: this.ownerInclude,
    });
  }

  /**
   * Update a session
   */
  async update(id: string, data: UpdateSessionData): Promise<SessionWithOwner> {
    return await this.prisma.client.session.update({
      where: { id },
      data: {
        ...data,
        type: data.type as PrismaSessionType | undefined,
      },
      include: this.ownerInclude,
    });
  }

  /**
   * End a session
   */
  async end(id: string, reason?: string): Promise<SessionWithOwner> {
    return await this.prisma.client.session.update({
      where: { id },
      data: {
        status: 'ended',
        endedReason: reason,
        endedAt: new Date(),
      },
      include: this.ownerInclude,
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
      where.members = {
        some: {
          userId: filters.userId,
        },
      };
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
  async findActiveByUserId(userId: string): Promise<SessionWithOwner[]> {
    return await this.prisma.client.session.findMany({
      where: {
        members: {
          some: { userId },
        },
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      include: this.ownerInclude,
    });
  }

  /**
   * Find active sessions by organization ID
   */
  async findActiveByOrgId(orgId: string): Promise<SessionWithOwner[]> {
    return await this.prisma.client.session.findMany({
      where: {
        orgId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      include: this.ownerInclude,
    });
  }

  /**
   * Find sessions by IDs
   */
  async findByIds(ids: string[]): Promise<SessionWithOwner[]> {
    if (ids.length === 0) {
      return [];
    }

    return await this.prisma.client.session.findMany({
      where: {
        id: { in: ids },
      },
      include: this.ownerInclude,
    });
  }

  /**
   * Find a session created from a specific calendar event (deduplication).
   * Queries the sessionConfig JSON field for calendarEventId.
   */
  async findByCalendarEventId(
    calendarEventId: string,
    userId: string,
  ): Promise<SessionWithOwner | null> {
    const sessions = await this.prisma.client.session.findMany({
      where: {
        sessionConfig: {
          path: ['calendarEventId'],
          equals: calendarEventId,
        },
        members: { some: { userId } },
      },
      take: 1,
      include: this.ownerInclude,
    });
    return sessions[0] ?? null;
  }

  /**
   * Find calendar-generated suggestion sessions for a user in an org.
   */
  async findSuggestionsForUser(
    userId: string,
    orgId: string,
  ): Promise<SessionWithOwner[]> {
    return await this.prisma.client.session.findMany({
      where: {
        orgId,
        members: { some: { userId } },
        sessionConfig: {
          path: ['isSuggestion'],
          equals: true,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: this.ownerInclude,
    });
  }
}
