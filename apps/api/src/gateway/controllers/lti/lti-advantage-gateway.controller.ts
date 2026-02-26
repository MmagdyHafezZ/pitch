import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Inject,
  Logger,
  Res,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';
import { DeepLinkResponseDto } from '@microservices/lti/advantage/deep-linking/dto/content-item.dto';
import { GetMembersDto } from '@microservices/lti/advantage/nrps/dto/member.dto';
import {
  CreateLineItemDto,
  SubmitScoreDto,
  GetResultsDto,
} from '@microservices/lti/advantage/ags/dto/score.dto';

interface DeepLinkResult {
  jwt: string;
  returnUrl: string;
}

/**
 * Gateway HTTP controller for LTI Advantage services.
 *
 * These are PITCH-internal endpoints (called from the PITCH frontend/backend),
 * not directly from the LMS. All routes require JWT authentication.
 *
 *  POST /api/v1/lti/advantage/deep-link        → Build Deep Link response for LMS
 *  GET  /api/v1/lti/advantage/deep-link/:id    → Auto-submit form page for LMS
 *  GET  /api/v1/lti/advantage/nrps/:sessionId  → Fetch course roster
 *  POST /api/v1/lti/advantage/ags/lineitem      → Create gradebook column
 *  GET  /api/v1/lti/advantage/ags/:sessionId   → Get all line items for session
 *  POST /api/v1/lti/advantage/ags/score        → Submit learner grade to LMS
 *  GET  /api/v1/lti/advantage/ags/results      → Fetch grades from LMS
 */
@ApiTags('LTI Advantage')
@ApiSecurity('bearer')
@Controller('lti/advantage')
export class LtiAdvantageGatewayController {
  private readonly logger = new Logger(LtiAdvantageGatewayController.name);

  constructor(@Inject('LTI_SERVICE') private readonly ltiClient: ClientProxy) {}

  // ── Deep Linking ─────────────────────────────────────────────────────────────

  /**
   * Builds a Deep Linking Response JWT and returns an HTML auto-submit form.
   * The instructor's browser posts this form to the LMS to place content items.
   */
  @Post('deep-link')
  @ApiOperation({ summary: 'Build and return Deep Link response form for LMS' })
  async deepLink(
    @Body() dto: DeepLinkResponseDto,
    @Res() res: Response,
  ): Promise<void> {
    const { jwt, returnUrl } = await firstValueFrom(
      this.ltiClient.send<DeepLinkResult>(LTI_PATTERNS.DEEP_LINK_RESPONSE, dto),
    );

    // Return a self-submitting HTML form that posts the JWT to the LMS return URL
    const html = this.buildAutoSubmitForm(returnUrl, jwt);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // ── NRPS ─────────────────────────────────────────────────────────────────────

  @Get('nrps/:sessionId')
  @ApiOperation({ summary: 'Fetch course roster from LMS via NRPS' })
  async getMembers(@Param('sessionId') sessionId: string) {
    const dto: GetMembersDto = { sessionId };
    return firstValueFrom<unknown>(
      this.ltiClient.send(LTI_PATTERNS.NRPS_GET_MEMBERS, dto),
    );
  }

  // ── AGS — Line Items ─────────────────────────────────────────────────────────

  @Post('ags/lineitem')
  @ApiOperation({ summary: 'Create a gradebook column (line item) on the LMS' })
  createLineItem(@Body() dto: CreateLineItemDto) {
    return firstValueFrom<unknown>(
      this.ltiClient.send(LTI_PATTERNS.AGS_CREATE_LINE_ITEM, dto),
    );
  }

  @Get('ags/:sessionId/lineitems')
  @ApiOperation({ summary: 'Get all line items for a session' })
  getLineItems(@Param('sessionId') sessionId: string) {
    return firstValueFrom<unknown>(
      this.ltiClient.send(LTI_PATTERNS.AGS_GET_LINE_ITEMS, { sessionId }),
    );
  }

  // ── AGS — Scores ─────────────────────────────────────────────────────────────

  @Post('ags/score')
  @ApiOperation({ summary: 'Submit a learner score to the LMS gradebook' })
  submitScore(@Body() dto: SubmitScoreDto) {
    return firstValueFrom<unknown>(
      this.ltiClient.send(LTI_PATTERNS.AGS_SUBMIT_SCORE, dto),
    );
  }

  @Post('ags/results')
  @ApiOperation({ summary: 'Fetch grade results from the LMS' })
  getResults(@Body() dto: GetResultsDto) {
    return firstValueFrom<unknown>(
      this.ltiClient.send(LTI_PATTERNS.AGS_GET_RESULTS, dto),
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Builds an HTML page with a form that auto-submits the Deep Linking JWT
   * to the LMS return URL. This follows the LTI form_post response mode.
   */
  private buildAutoSubmitForm(returnUrl: string, jwt: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Redirecting to LMS...</title>
</head>
<body>
  <p>Redirecting back to your LMS. Please wait...</p>
  <form id="lti_form" method="POST" action="${this.escapeHtml(returnUrl)}">
    <input type="hidden" name="JWT" value="${this.escapeHtml(jwt)}" />
  </form>
  <script>
    document.getElementById('lti_form').submit();
  </script>
  <noscript>
    <p>JavaScript is required to complete this action.</p>
    <button form="lti_form" type="submit">Continue to LMS</button>
  </noscript>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
