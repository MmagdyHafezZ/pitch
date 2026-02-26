import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { TokenService } from '../../v1.3/services/token.service';
import {
  CreateLineItemDto,
  SubmitScoreDto,
  GetResultsDto,
} from './dto/score.dto';
import { ActivityProgress, GradingProgress } from '@prisma/lti-client';

// OAuth2 scopes for AGS operations
const AGS_SCOPE_LINEITEM =
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';
const AGS_SCOPE_SCORE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';
const AGS_SCOPE_RESULT_READONLY =
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly';

interface LmsLineItem {
  id: string;
  scoreMaximum: number;
  label: string;
  resourceId?: string;
  tag?: string;
  resourceLinkId?: string;
}

interface LmsScore {
  scoreGiven?: number;
  scoreMaximum: number;
  comment?: string;
  timestamp: string;
  activityProgress: string;
  gradingProgress: string;
  userId: string;
}

/**
 * LTI Advantage Assignment and Grades Service (AGS).
 *
 * Handles:
 *  - Line Item creation/management (gradebook columns)
 *  - Score submission (push grades to LMS gradebook)
 *  - Result fetching (read past grades)
 *
 * AGS uses OAuth2 Bearer tokens from the platform's token endpoint.
 * Scopes must be pre-granted in the platform's tool registration.
 */
@Injectable()
export class AgsService {
  private readonly logger = new Logger(AgsService.name);

  constructor(
    private readonly db: LtiPrismaService,
    private readonly platformRepo: PlatformRepository,
    private readonly tokenService: TokenService,
  ) {}

  // ── Line Items ───────────────────────────────────────────────────────────────

  /**
   * Creates a line item (gradebook column) both locally and on the LMS.
   * If a lineItemUrl is provided, skips LMS creation and uses it directly.
   */
  async createLineItem(dto: CreateLineItemDto) {
    const session = await this.db.session.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session)
      throw new BadRequestException(`Session ${dto.sessionId} not found`);

    let lineItemUrl = dto.lineItemUrl;

    // If no URL provided, create line item on the LMS
    if (!lineItemUrl && session.lineItemsServiceUrl) {
      const platform = await this.platformRepo.findById(session.platformId);
      const token = await this.getToken(
        platform.authTokenUrl!,
        platform.clientId!,
        AGS_SCOPE_LINEITEM,
      );

      const { data } = await axios.post<LmsLineItem>(
        session.lineItemsServiceUrl,
        {
          scoreMaximum: dto.scoreMaximum,
          label: dto.label,
          resourceId: dto.resourceId,
          tag: dto.tag,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json',
          },
          timeout: 10000,
        },
      );

      lineItemUrl = data.id; // LMS returns the created line item's URL as `id`
      this.logger.log(`LMS line item created: ${lineItemUrl}`);
    }

    return this.db.lineItem.create({
      data: {
        sessionId: dto.sessionId,
        label: dto.label,
        scoreMaximum: dto.scoreMaximum,
        resourceId: dto.resourceId,
        tag: dto.tag,
        lineItemUrl,
      },
    });
  }

  async getLineItems(sessionId: string) {
    return this.db.lineItem.findMany({ where: { sessionId } });
  }

  // ── Scores ───────────────────────────────────────────────────────────────────

  /**
   * Submits a learner's score to the LMS gradebook.
   *
   * The score is stored locally first, then pushed to the LMS.
   * On LMS push failure, the local record is retained for retry.
   */
  async submitScore(dto: SubmitScoreDto): Promise<void> {
    const lineItem = await this.db.lineItem.findUnique({
      where: { id: dto.lineItemId },
    });
    if (!lineItem)
      throw new NotFoundException(`Line item ${dto.lineItemId} not found`);

    if (dto.scoreGiven !== undefined && dto.scoreGiven > dto.scoreMaximum) {
      throw new BadRequestException(
        `scoreGiven (${dto.scoreGiven}) exceeds scoreMaximum (${dto.scoreMaximum})`,
      );
    }

    // Upsert local score record
    await this.db.score.upsert({
      where: {
        lineItemId_userId: { lineItemId: dto.lineItemId, userId: dto.userId },
      },
      create: {
        lineItemId: dto.lineItemId,
        userId: dto.userId,
        scoreGiven: dto.scoreGiven,
        scoreMaximum: dto.scoreMaximum,
        comment: dto.comment,
        activityProgress: dto.activityProgress,
        gradingProgress: dto.gradingProgress,
        submittedAt: new Date(),
      },
      update: {
        scoreGiven: dto.scoreGiven,
        scoreMaximum: dto.scoreMaximum,
        comment: dto.comment,
        activityProgress: dto.activityProgress,
        gradingProgress: dto.gradingProgress,
        submittedAt: new Date(),
      },
    });

    // Push to LMS if we have a line item URL
    if (lineItem.lineItemUrl) {
      const session = await this.db.session.findUnique({
        where: { id: lineItem.sessionId },
      });
      const platform = await this.platformRepo.findById(session!.platformId);
      const token = await this.getToken(
        platform.authTokenUrl!,
        platform.clientId!,
        AGS_SCOPE_SCORE,
      );

      const scorePayload: LmsScore = {
        scoreGiven: dto.scoreGiven,
        scoreMaximum: dto.scoreMaximum,
        comment: dto.comment,
        timestamp: new Date().toISOString(),
        activityProgress: this.mapActivityProgress(dto.activityProgress),
        gradingProgress: this.mapGradingProgress(dto.gradingProgress),
        userId: dto.userId,
      };

      const scoreUrl = `${lineItem.lineItemUrl}/scores`;
      await axios.post(scoreUrl, scorePayload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/vnd.ims.lis.v1.score+json',
        },
        timeout: 10000,
      });

      this.logger.log(
        `Score submitted to LMS: userId=${dto.userId} lineItem=${lineItem.id} score=${dto.scoreGiven}/${dto.scoreMaximum}`,
      );
    } else {
      this.logger.warn(
        `No LMS line item URL — score saved locally only for lineItemId=${dto.lineItemId}`,
      );
    }
  }

  // ── Results ──────────────────────────────────────────────────────────────────

  /**
   * Fetches grade results from the LMS for a given line item.
   * Returns an array of result records.
   */
  async getResults(dto: GetResultsDto) {
    const lineItem = await this.db.lineItem.findUnique({
      where: { id: dto.lineItemId },
    });
    if (!lineItem)
      throw new NotFoundException(`Line item ${dto.lineItemId} not found`);

    if (!lineItem.lineItemUrl) {
      // Return local scores if no LMS URL
      return this.db.score.findMany({
        where: {
          lineItemId: dto.lineItemId,
          ...(dto.userId && { userId: dto.userId }),
        },
      });
    }

    const session = await this.db.session.findUnique({
      where: { id: lineItem.sessionId },
    });
    const platform = await this.platformRepo.findById(session!.platformId);
    const token = await this.getToken(
      platform.authTokenUrl!,
      platform.clientId!,
      AGS_SCOPE_RESULT_READONLY,
    );

    const resultsUrl = new URL(`${lineItem.lineItemUrl}/results`);
    if (dto.userId) resultsUrl.searchParams.set('user_id', dto.userId);

    const resp = await axios.get<unknown[]>(resultsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.ims.lis.v2.resultcontainer+json',
      },
      timeout: 10000,
    });

    return resp.data;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async getToken(
    tokenUrl: string,
    clientId: string,
    scope: string,
  ): Promise<string> {
    if (!tokenUrl || !clientId) {
      throw new BadRequestException(
        'Platform missing authTokenUrl or clientId for AGS',
      );
    }
    return this.tokenService.getAccessToken(tokenUrl, clientId, scope);
  }

  private mapActivityProgress(p: ActivityProgress): string {
    const map: Record<ActivityProgress, string> = {
      INITIALIZED: 'Initialized',
      STARTED: 'Started',
      IN_PROGRESS: 'InProgress',
      SUBMITTED: 'Submitted',
      COMPLETED: 'Completed',
    };
    return map[p] ?? 'Initialized';
  }

  private mapGradingProgress(p: GradingProgress): string {
    const map: Record<GradingProgress, string> = {
      NOT_READY: 'NotReady',
      FAILED: 'Failed',
      PENDING: 'Pending',
      PENDING_MANUAL: 'PendingManual',
      FULLY_GRADED: 'FullyGraded',
    };
    return map[p] ?? 'NotReady';
  }
}
