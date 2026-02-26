import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import { PlatformRepository } from '../../platform/platform.repository';
import { JwksService } from '../../v1.3/services/jwks.service';
import { DeepLinkResponseDto, ContentItem } from './dto/content-item.dto';

/**
 * LTI Advantage Deep Linking 2.0 service.
 *
 * After an instructor selects content in the tool, this service builds the
 * signed Deep Linking Response JWT and returns it along with the LMS return URL.
 * The gateway then renders a self-submitting form that POSTs the JWT to the LMS.
 *
 * Flow:
 *   1. LMS launches tool with LtiDeepLinkingRequest (message_type)
 *   2. Tool UI shows content selection (assignments, simulations, etc.)
 *   3. Instructor selects content → POST to our deep-link endpoint
 *   4. We build & sign a DeepLinkingResponse JWT
 *   5. We return the JWT + return URL → gateway auto-submits to LMS
 *   6. LMS places the selected content item into the course
 */
@Injectable()
export class DeepLinkingService {
  private readonly logger = new Logger(DeepLinkingService.name);

  constructor(
    private readonly db: LtiPrismaService,
    private readonly platformRepo: PlatformRepository,
    private readonly jwksService: JwksService,
  ) {}

  /**
   * Builds a signed Deep Linking Response JWT for the given items.
   *
   * @returns { jwt, returnUrl } — use to POST back to the LMS
   */
  async buildResponse(
    dto: DeepLinkResponseDto,
  ): Promise<{ jwt: string; returnUrl: string }> {
    const session = await this.db.session.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session)
      throw new BadRequestException(`Session ${dto.sessionId} not found`);
    if (!session.deepLinkReturnUrl) {
      throw new BadRequestException(
        'Session does not have a deep_link_return_url — was this a Deep Linking launch?',
      );
    }

    const platform = await this.platformRepo.findById(session.platformId);

    const jwt = this.jwksService.signWithToolKey(
      {
        iss: platform.clientId,
        aud: platform.issuer,
        sub: session.sub,
        nonce: this.generateNonce(),
        'https://purl.imsglobal.org/spec/lti/claim/message_type':
          'LtiDeepLinkingResponse',
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
        'https://purl.imsglobal.org/spec/lti/claim/deployment_id':
          session.deploymentId,
        'https://purl.imsglobal.org/spec/lti-dl/claim/content_items':
          this.serializeItems(dto.items),
        ...(dto.data && {
          'https://purl.imsglobal.org/spec/lti-dl/claim/data': dto.data,
        }),
        ...(dto.message && {
          'https://purl.imsglobal.org/spec/lti-dl/claim/msg': dto.message,
        }),
      },
      600,
    );

    this.logger.log(
      `Deep Link response built for session=${dto.sessionId} items=${dto.items.length}`,
    );

    return { jwt, returnUrl: session.deepLinkReturnUrl };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private serializeItems(items: ContentItem[]): unknown[] {
    return items.map((item) => {
      if (item.type === 'ltiResourceLink') {
        return {
          type: 'ltiResourceLink',
          title: item.title,
          text: item.text,
          url: item.url,
          custom: item.custom,
          lineItem: item.lineItem,
          available: item.available,
          submission: item.submission,
        };
      }

      if (item.type === 'link') {
        return {
          type: 'link',
          title: item.title,
          url: item.url,
          thumbnail: item.thumbnail,
          window: item.window,
        };
      }

      if (item.type === 'html') {
        return {
          type: 'html',
          html: item.html,
          title: item.title,
        };
      }

      return item;
    });
  }

  private generateNonce(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
