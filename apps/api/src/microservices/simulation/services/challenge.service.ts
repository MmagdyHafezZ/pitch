import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChallengeRepository } from '../repositories/challenge.repository';
import { ChallengeGenerationService } from './challenge-generation.service';
import { SessionRepository } from '../repositories/session.repository';
import type {
  ChallengePeriod,
  ChallengeDifficulty,
} from '@prisma/simulation-client';
import type {
  ListChallengesDto,
  TriggerGenerateDto,
} from '../dto/challenge.dto';

@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    private readonly challengeRepo: ChallengeRepository,
    private readonly generationService: ChallengeGenerationService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async list(query: ListChallengesDto, userId?: string) {
    const { challenges, total } = await this.challengeRepo.findMany({
      period: query.period as ChallengePeriod | undefined,
      difficulty: query.difficulty as ChallengeDifficulty | undefined,
      status: 'ACTIVE',
      limit: query.limit,
      offset: query.offset,
    });

    return {
      challenges: challenges.map((c) => ({
        id: c.id,
        period: c.period,
        difficulty: c.difficulty,
        status: c.status,
        title: c.title,
        description: c.description,
        topic: c.topic,
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
        participationCount: c._count.participations,
      })),
      total,
    };
  }

  async get(id: string, userId?: string) {
    const challenge = await this.challengeRepo.findById(id);
    if (!challenge) throw new NotFoundException(`Challenge ${id} not found`);

    const participation = userId
      ? await this.challengeRepo.findParticipation(id, userId)
      : null;

    return {
      id: challenge.id,
      period: challenge.period,
      difficulty: challenge.difficulty,
      status: challenge.status,
      title: challenge.title,
      description: challenge.description,
      topic: challenge.topic,
      scenarioPrompt: challenge.scenarioPrompt,
      evaluatorPersonaPrompt: challenge.evaluatorPersonaPrompt,
      startsAt: challenge.startsAt,
      expiresAt: challenge.expiresAt,
      participationCount: challenge._count.participations,
      myParticipation: participation
        ? {
            sessionId: participation.sessionId,
            score: participation.score,
            completedAt: participation.completedAt,
          }
        : null,
    };
  }

  async participate(challengeId: string, userId: string) {
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge)
      throw new NotFoundException(`Challenge ${challengeId} not found`);
    if (challenge.status !== 'ACTIVE') {
      throw new ConflictException('Challenge is not currently active');
    }

    const existing = await this.challengeRepo.findParticipation(
      challengeId,
      userId,
    );
    if (existing) {
      return {
        challengeId,
        sessionId: existing.sessionId,
        alreadyParticipating: true,
      };
    }

    await this.challengeRepo.createParticipation(challengeId, userId);
    return { challengeId, sessionId: null, alreadyParticipating: false };
  }

  async submitScore(
    challengeId: string,
    userId: string,
    sessionId: string,
    score: number,
  ) {
    const participation = await this.challengeRepo.findParticipation(
      challengeId,
      userId,
    );
    if (!participation) {
      throw new NotFoundException('No participation found for this challenge');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const owner = session.members?.[0];
    if (!owner || owner.userId !== userId) {
      throw new ForbiddenException(
        'You can only submit scores for sessions you own',
      );
    }

    const sessionConfig =
      session.sessionConfig && typeof session.sessionConfig === 'object'
        ? (session.sessionConfig as Record<string, unknown>)
        : null;
    const linkedChallengeId =
      sessionConfig && typeof sessionConfig.challengeId === 'string'
        ? sessionConfig.challengeId
        : null;

    if (linkedChallengeId !== challengeId) {
      throw new BadRequestException('Session is not linked to this challenge');
    }

    await this.challengeRepo.updateParticipationScore(
      challengeId,
      userId,
      sessionId,
      score,
    );
    return { success: true };
  }

  async leaderboard(challengeId?: string, limit = 10) {
    if (challengeId) {
      const entries = await this.challengeRepo.getLeaderboard(
        challengeId,
        limit,
      );
      return entries.map((e, index) => ({
        rank: index + 1,
        userId: e.userId,
        score: e.score,
        completedAt: e.completedAt,
      }));
    }

    const rows = await this.challengeRepo.getGlobalLeaderboard(limit);
    return rows.map((r, index) => ({
      rank: index + 1,
      userId: r.userId,
      totalScore: r._sum.score,
    }));
  }

  /**
   * Called by the jobs microservice via RabbitMQ.
   * Generates 4 challenges (one per difficulty) for a given period,
   * expires stale ones, and activates upcoming ones.
   */
  async triggerGenerate(dto: TriggerGenerateDto) {
    const now = new Date();
    const period = dto.period as ChallengePeriod;
    this.logger.log(`Triggering challenge generation for period: ${period}`);

    // Expire stale challenges
    await this.challengeRepo.expireStale(now);

    const { startsAt, expiresAt } = this.getPeriodWindow(period, now);

    const difficulties: ChallengeDifficulty[] = [
      'BEGINNER',
      'INTERMEDIATE',
      'EXPERT',
      'MASTER',
    ];

    for (const difficulty of difficulties) {
      try {
        const generated = await this.generationService.generate(
          period,
          difficulty,
        );
        await this.challengeRepo.create({
          period,
          difficulty,
          title: generated.title,
          description: generated.description,
          topic: generated.topic,
          scenarioPrompt: generated.scenarioPrompt,
          evaluatorPersonaPrompt: generated.evaluatorPersonaPrompt,
          startsAt,
          expiresAt,
        });
        this.logger.log(
          `Created ${period} ${difficulty} challenge: "${generated.title}"`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to generate ${period} ${difficulty} challenge: ${(err as Error).message}`,
        );
      }
    }

    // Activate any upcoming challenges whose startsAt has passed
    await this.challengeRepo.activateUpcoming(now);
  }

  private getPeriodWindow(
    period: ChallengePeriod,
    now: Date,
  ): { startsAt: Date; expiresAt: Date } {
    const startsAt = new Date(now);
    startsAt.setUTCHours(0, 0, 0, 0);

    const expiresAt = new Date(startsAt);
    if (period === 'DAILY') {
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);
    } else if (period === 'WEEKLY') {
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
    } else {
      expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);
    }

    return { startsAt, expiresAt };
  }
}
