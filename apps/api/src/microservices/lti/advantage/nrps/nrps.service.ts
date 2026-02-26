import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios from 'axios';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { TokenService } from '../../v1.3/services/token.service';
import { GetMembersDto, NrpsMember, NrpsResponse } from './dto/member.dto';

const NRPS_SCOPE =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

/**
 * LTI Advantage Names and Roles Provisioning Service (NRPS).
 *
 * Fetches the course roster from the LMS including each member's roles.
 * Supports pagination via @odata.nextLink to handle large courses.
 *
 * Use cases:
 *  - Auto-enroll learners into PITCH/Mark
 *  - Sync instructor/TA assignments
 *  - Role-based access control
 */
@Injectable()
export class NrpsService {
  private readonly logger = new Logger(NrpsService.name);

  constructor(
    private readonly db: LtiPrismaService,
    private readonly platformRepo: PlatformRepository,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Fetches all members for the course context of a given session.
   * Handles pagination automatically and returns the full flattened list.
   */
  async getMembers(dto: GetMembersDto): Promise<NrpsMember[]> {
    const session = await this.db.session.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session)
      throw new BadRequestException(`Session ${dto.sessionId} not found`);
    if (!session.namesRolesServiceUrl) {
      throw new BadRequestException(
        'Session has no NRPS URL — the platform may not have granted NRPS access',
      );
    }

    const platform = await this.platformRepo.findById(session.platformId);
    if (!platform.authTokenUrl || !platform.clientId) {
      throw new BadRequestException(
        `Platform ${platform.id} missing token URL or clientId`,
      );
    }

    const token = await this.tokenService.getAccessToken(
      platform.authTokenUrl,
      platform.clientId,
      NRPS_SCOPE,
    );

    const members = await this.fetchAllMembers(
      session.namesRolesServiceUrl,
      token,
      dto.role,
      dto.limit,
    );

    this.logger.log(
      `NRPS fetched ${members.length} members for session=${dto.sessionId}`,
    );

    return members;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async fetchAllMembers(
    url: string,
    token: string,
    roleFilter?: string,
    limit?: number,
  ): Promise<NrpsMember[]> {
    const allMembers: NrpsMember[] = [];
    let nextUrl: string | undefined = this.buildMembersUrl(
      url,
      roleFilter,
      limit,
    );

    while (nextUrl) {
      const resp = await axios.get(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json',
        },
        timeout: 15000,
      });
      const data = resp.data as NrpsResponse;

      allMembers.push(...data.members);

      // Follow pagination link if present (and limit not yet reached)
      const nextLink = data['@odata.nextLink'];
      if (nextLink && (!limit || allMembers.length < limit)) {
        nextUrl = nextLink;
      } else {
        nextUrl = undefined;
      }
    }

    return limit ? allMembers.slice(0, limit) : allMembers;
  }

  private buildMembersUrl(
    baseUrl: string,
    role?: string,
    limit?: number,
  ): string {
    const url = new URL(baseUrl);
    if (role) url.searchParams.set('role', role);
    if (limit) url.searchParams.set('limit', String(limit));
    return url.toString();
  }
}
