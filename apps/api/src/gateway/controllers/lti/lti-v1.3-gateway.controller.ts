import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Inject,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { Public } from '@microservices/userManagement/decorators/public.decorator';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';

interface V1p3LaunchResult {
  context: {
    sessionId: string;
    platformId: string;
    user?: { email?: string };
  };
}

interface OidcLoginResult {
  redirectUrl: string;
  params: Record<string, string | undefined>;
}

/**
 * Gateway HTTP controller for LTI 1.3 OIDC and launch endpoints.
 *
 * These routes are called by the LMS browser (not our clients) so they must be
 * public (bypass JWT auth guard) and handle HTML redirects.
 *
 * Routes:
 *   GET/POST /api/v1/lti/v1.3/oidc/login  — Third-party initiated OIDC login
 *   POST     /api/v1/lti/v1.3/launch       — LTI 1.3 launch (id_token + state)
 *   GET      /api/v1/lti/v1.3/jwks         — Tool's public JWKS for LMS verification
 */
@ApiTags('LTI 1.3')
@Controller('lti/v1.3')
export class LtiV1p3GatewayController {
  private readonly logger = new Logger(LtiV1p3GatewayController.name);
  private readonly pitchAppUrl =
    process.env.PITCH_APP_URL ?? 'http://localhost:3000';

  constructor(@Inject('LTI_SERVICE') private readonly ltiClient: ClientProxy) {}

  /**
   * OIDC Third-Party Initiated Login.
   *
   * The LMS redirects the learner/instructor here first.
   * We validate the request, store a state nonce, and redirect back to the LMS
   * OIDC authorization endpoint with the correct parameters.
   *
   * Accepts both GET (query params) and POST (form body).
   */
  @Public()
  @Get('oidc/login')
  @ApiOperation({ summary: 'LTI 1.3 OIDC login initiation (GET)' })
  async oidcLoginGet(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    return this.handleOidcLogin(query, res);
  }

  @Public()
  @Post('oidc/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'LTI 1.3 OIDC login initiation (POST)' })
  async oidcLoginPost(
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    return this.handleOidcLogin(body, res);
  }

  /**
   * LTI 1.3 Launch endpoint.
   *
   * The LMS POSTs the signed id_token + state here after OIDC authentication.
   * We verify the token via the LTI microservice, create a PITCH session token,
   * and redirect the user into the PITCH app.
   */
  @Public()
  @Post('launch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'LTI 1.3 launch — receives id_token from LMS' })
  async launch(
    @Body() body: { id_token: string; state: string },
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.ltiClient.send<V1p3LaunchResult>(LTI_PATTERNS.V1P3_LAUNCH, {
          idToken: body.id_token,
          state: body.state,
        }),
      );

      // Redirect to PITCH app with session context
      const redirectUrl = new URL('/lti/launch', this.pitchAppUrl);
      redirectUrl.searchParams.set('sessionId', result.context.sessionId);
      redirectUrl.searchParams.set('platformId', result.context.platformId);

      // Encode user info for auto-login
      if (result.context.user?.email) {
        redirectUrl.searchParams.set('email', result.context.user.email);
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      this.logger.error('LTI 1.3 launch failed', error);
      const errorUrl = new URL('/lti/error', this.pitchAppUrl);
      errorUrl.searchParams.set('reason', 'launch_failed');
      res.redirect(errorUrl.toString());
    }
  }

  /**
   * Tool's JWKS endpoint.
   * The LMS fetches this to get our public key for verifying our signed JWTs
   * (Deep Linking responses, client assertions).
   */
  @Public()
  @Get('jwks')
  @ApiOperation({
    summary: "Tool's public JWKS for LMS signature verification",
  })
  async getJwks() {
    return firstValueFrom<unknown>(
      this.ltiClient.send(LTI_PATTERNS.V1P3_JWKS, {}),
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async handleOidcLogin(
    params: Record<string, string>,
    res: Response,
  ): Promise<void> {
    try {
      // The launch URL is where the LMS should redirect back to after OIDC auth
      const toolLaunchUrl = `${process.env.API_BASE_URL ?? 'http://localhost:4000'}/api/v1/lti/v1.3/launch`;

      const authRequest = await firstValueFrom(
        this.ltiClient.send<OidcLoginResult>(LTI_PATTERNS.V1P3_OIDC_LOGIN, {
          dto: {
            iss: params.iss,
            login_hint: params.login_hint,
            lti_message_hint: params.lti_message_hint,
            client_id: params.client_id,
            lti_deployment_id: params.lti_deployment_id,
            target_link_uri: params.target_link_uri,
          },
          toolLaunchUrl,
        }),
      );

      // Build redirect URL to platform's OIDC auth endpoint
      const redirectUrl = new URL(authRequest.redirectUrl);
      for (const [key, value] of Object.entries(authRequest.params)) {
        if (value !== undefined) {
          redirectUrl.searchParams.set(key, value);
        }
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      this.logger.error('OIDC login initiation failed', error);
      res.status(400).json({
        error: 'OIDC login failed',
        message: (error as Error).message,
      });
    }
  }
}
