import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DeepLinkingService } from './advantage/deep-linking/deep-linking.service';
import { NrpsService } from './advantage/nrps/nrps.service';
import { AgsService } from './advantage/ags/ags.service';
import { LtiPrismaService } from './prisma/lti-prisma.service';
import { LTI_PATTERNS } from './common/constants/lti-patterns.constants';
import { DeepLinkResponseDto } from './advantage/deep-linking/dto/content-item.dto';
import { GetMembersDto } from './advantage/nrps/dto/member.dto';
import {
  CreateLineItemDto,
  SubmitScoreDto,
  GetResultsDto,
} from './advantage/ags/dto/score.dto';

/**
 * Root LTI controller — handles all Advantage RabbitMQ message patterns.
 * Individual v1.1 and v1.3 controllers live in their own sub-modules.
 */
@Controller()
export class LtiController {
  constructor(
    private readonly deepLinking: DeepLinkingService,
    private readonly nrps: NrpsService,
    private readonly ags: AgsService,
    private readonly db: LtiPrismaService,
  ) {}

  @MessagePattern(LTI_PATTERNS.HEALTH)
  health() {
    return { status: 'ok', service: 'lti' };
  }

  // ── Deep Linking ─────────────────────────────────────────────────────────────

  @MessagePattern(LTI_PATTERNS.DEEP_LINK_RESPONSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  deepLinkResponse(@Payload() dto: DeepLinkResponseDto) {
    return this.deepLinking.buildResponse(dto);
  }

  // ── NRPS ─────────────────────────────────────────────────────────────────────

  @MessagePattern(LTI_PATTERNS.NRPS_GET_MEMBERS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  getMembers(@Payload() dto: GetMembersDto) {
    return this.nrps.getMembers(dto);
  }

  // ── AGS ──────────────────────────────────────────────────────────────────────

  @MessagePattern(LTI_PATTERNS.AGS_CREATE_LINE_ITEM)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createLineItem(@Payload() dto: CreateLineItemDto) {
    return this.ags.createLineItem(dto);
  }

  @MessagePattern(LTI_PATTERNS.AGS_GET_LINE_ITEMS)
  getLineItems(@Payload() data: { sessionId: string }) {
    return this.ags.getLineItems(data.sessionId);
  }

  @MessagePattern(LTI_PATTERNS.AGS_SUBMIT_SCORE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  submitScore(@Payload() dto: SubmitScoreDto) {
    return this.ags.submitScore(dto);
  }

  @MessagePattern(LTI_PATTERNS.AGS_GET_RESULTS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  getResults(@Payload() dto: GetResultsDto) {
    return this.ags.getResults(dto);
  }

  // ── Session ──────────────────────────────────────────────────────────────────

  @MessagePattern(LTI_PATTERNS.SESSION_FIND)
  findSession(@Payload() data: { sessionId: string }) {
    return this.db.session.findUnique({ where: { id: data.sessionId } });
  }

  @MessagePattern(LTI_PATTERNS.SESSION_LINK_PITCH)
  linkToPitch(
    @Payload()
    data: {
      sessionId: string;
      pitchSessionId?: string;
      pitchUserId?: string;
    },
  ) {
    return this.db.session.update({
      where: { id: data.sessionId },
      data: {
        pitchSessionId: data.pitchSessionId,
        pitchUserId: data.pitchUserId,
      },
    });
  }
}
