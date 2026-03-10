import { Injectable } from '@nestjs/common';
import { SimulationPrismaService } from '../prisma/simulation-prisma.service';
import type {
  ChallengePeriod,
  ChallengeDifficulty,
  ChallengeStatus,
  Prisma,
} from '@prisma/simulation-client';

@Injectable()
export class ChallengeRepository {
  constructor(private readonly prisma: SimulationPrismaService) {}

  async findMany(filters?: {
    period?: ChallengePeriod;
    difficulty?: ChallengeDifficulty;
    status?: ChallengeStatus;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.ChallengeWhereInput = {};
    if (filters?.period) where.period = filters.period;
    if (filters?.difficulty) where.difficulty = filters.difficulty;
    if (filters?.status) where.status = filters.status;

    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    const [challenges, total] = await Promise.all([
      this.prisma.client.challenge.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }],
        include: { _count: { select: { participations: true } } },
      }),
      this.prisma.client.challenge.count({ where }),
    ]);

    return { challenges, total };
  }

  async findById(id: string) {
    return this.prisma.client.challenge.findUnique({
      where: { id },
      include: { _count: { select: { participations: true } } },
    });
  }

  async create(data: {
    period: ChallengePeriod;
    difficulty: ChallengeDifficulty;
    title: string;
    description: string;
    topic: string;
    scenarioPrompt: string;
    evaluatorPersonaPrompt: string;
    startsAt: Date;
    expiresAt: Date;
  }) {
    return this.prisma.client.challenge.create({ data });
  }

  async updateStatus(id: string, status: ChallengeStatus) {
    return this.prisma.client.challenge.update({
      where: { id },
      data: { status },
    });
  }

  async expireStale(now: Date) {
    return this.prisma.client.challenge.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });
  }

  async activateUpcoming(now: Date) {
    return this.prisma.client.challenge.updateMany({
      where: { status: 'UPCOMING', startsAt: { lte: now } },
      data: { status: 'ACTIVE' },
    });
  }

  // --- Participations ---

  async findParticipation(challengeId: string, userId: string) {
    return this.prisma.client.challengeParticipation.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    });
  }

  async createParticipation(challengeId: string, userId: string) {
    return this.prisma.client.challengeParticipation.create({
      data: { challengeId, userId },
    });
  }

  async updateParticipationScore(
    challengeId: string,
    userId: string,
    sessionId: string,
    score: number,
  ) {
    return this.prisma.client.challengeParticipation.update({
      where: { challengeId_userId: { challengeId, userId } },
      data: { score, sessionId, completedAt: new Date() },
    });
  }

  async getLeaderboard(challengeId: string, limit = 10) {
    return this.prisma.client.challengeParticipation.findMany({
      where: { challengeId, score: { not: null } },
      orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
      take: limit,
    });
  }

  async getGlobalLeaderboard(limit = 20) {
    // Aggregate best score per user across all challenges
    const rows = await this.prisma.client.challengeParticipation.groupBy({
      by: ['userId'],
      _sum: { score: true },
      _max: { completedAt: true },
      where: { score: { not: null } },
      orderBy: { _sum: { score: 'desc' } },
      take: limit,
    });
    return rows;
  }
}
