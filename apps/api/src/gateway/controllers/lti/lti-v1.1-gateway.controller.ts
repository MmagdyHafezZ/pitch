import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Inject,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { Public } from '@microservices/userManagement/decorators/public.decorator';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';

/**
 * Gateway HTTP controller for LTI 1.1 launch and grade passback endpoints.
 *
 * LTI 1.1 uses OAuth 1.0a HMAC-SHA1 signed form POSTs.
 * Both launch and grade endpoints bypass JWT auth (they authenticate via OAuth).
 */
@ApiTags('LTI 1.1')
@Controller('lti/v1.1')
export class LtiV1p1GatewayController {
  private readonly logger = new Logger(LtiV1p1GatewayController.name);
  private readonly pitchAppUrl =
    process.env.PITCH_APP_URL ?? 'http://localhost:3000';

  constructor(@Inject('LTI_SERVICE') private readonly ltiClient: ClientProxy) {}

  /**
   * LTI 1.1 launch endpoint.
   * The LMS POSTs the signed form here with user and course context.
   * We validate the OAuth signature and redirect into the PITCH app.
   */
  @Public()
  @Post('launch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'LTI 1.1 launch — OAuth-signed form POST from LMS' })
  async launch(
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Reconstruct the full URL the LMS signed (must match exactly)
      const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      const result = await firstValueFrom(
        this.ltiClient.send<{ sessionId: string }>(LTI_PATTERNS.V1P1_LAUNCH, {
          dto: body,
          requestUrl,
          method: req.method,
        }),
      );

      // Redirect user into PITCH app with LTI session context
      const redirectUrl = new URL('/lti/launch', this.pitchAppUrl);
      redirectUrl.searchParams.set('sessionId', result.sessionId);
      redirectUrl.searchParams.set('version', '1.1');

      res.redirect(redirectUrl.toString());
    } catch (error) {
      this.logger.error('LTI 1.1 launch failed', error);
      res.status(400).json({
        error: 'LTI 1.1 launch failed',
        message: (error as Error).message,
      });
    }
  }
}
