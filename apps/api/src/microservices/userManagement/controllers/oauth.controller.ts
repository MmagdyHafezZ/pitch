import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  UseGuards,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GoogleOAuthGuard } from '../guards/google-oauth.guard';
import { AuthService } from '../services/auth.service';
import { AuthApplicationService } from '../services/auth-application.service';
import {
  OAuthProviderFactory,
  AuthProvider,
} from '../factories/oauth-provider.factory';
import type { JwtUser } from '../guards/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';
import { Public } from '../decorators/public.decorator';
import express from 'express';

type OAuthRequestUser = {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

const isOAuthRequestUser = (user: unknown): user is OAuthRequestUser => {
  if (!user || typeof user !== 'object') {
    return false;
  }

  const candidate = user as { id?: unknown; email?: unknown };
  return (
    typeof candidate.id === 'string' && typeof candidate.email === 'string'
  );
};

@ApiTags('OAuth Authentication')
@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);
  private readonly refreshCookieName =
    process.env.REFRESH_COOKIE_NAME ?? 'refreshToken';
  private readonly refreshCookiePath = process.env.COOKIE_PATH ?? '/';
  private readonly refreshCookieDomain = process.env.COOKIE_DOMAIN;
  private readonly refreshCookieSameSite =
    (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none' | undefined) ??
    'lax';
  private readonly refreshCookieSecure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production';
  private readonly refreshCookieMaxAgeMs = Number(
    process.env.REFRESH_COOKIE_MAX_AGE_MS ?? 1000 * 60 * 60 * 24 * 7,
  );

  constructor(
    private authService: AuthService,
    private authApplicationService: AuthApplicationService,
    private oauthProviderFactory: OAuthProviderFactory,
  ) {}

  @Get('google')
  @Public()
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth() {}

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      const user = this.ensureOAuthUser(req.user, 'Google');
      await this.redirectWithSession(res, user);
    } catch (error: unknown) {
      this.logger.error('Google OAuth callback error:', error);
      this.handleOAuthError(res, error, 'Google');
    }
  }

  @Get('linkedin')
  @Public()
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'Initiate LinkedIn OAuth login' })
  linkedinAuth() {}

  @Get('linkedin/callback')
  @Public()
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'LinkedIn OAuth callback' })
  async linkedinCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      const user = this.ensureOAuthUser(req.user, 'LinkedIn');
      await this.redirectWithSession(res, user);
    } catch (error: unknown) {
      this.logger.error('LinkedIn OAuth callback error:', error);
      this.handleOAuthError(res, error, 'LinkedIn');
    }
  }

  @Get('github')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  githubAuth() {}

  @Get('github/callback')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      const user = this.ensureOAuthUser(req.user, 'GitHub');
      await this.redirectWithSession(res, user);
    } catch (error: unknown) {
      this.logger.error('GitHub OAuth callback error:', error);
      this.handleOAuthError(res, error, 'GitHub');
    }
  }

  @Get('microsoft')
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @ApiOperation({ summary: 'Initiate Microsoft OAuth login' })
  microsoftAuth() {}

  @Get('microsoft/callback')
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  async microsoftCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      const user = this.ensureOAuthUser(req.user, 'Microsoft');
      await this.redirectWithSession(res, user);
    } catch (error: unknown) {
      this.logger.error('Microsoft OAuth callback error:', error);
      this.handleOAuthError(res, error, 'Microsoft');
    }
  }

  @Get('discord')
  @Public()
  @UseGuards(AuthGuard('discord'))
  @ApiOperation({ summary: 'Initiate Discord OAuth login' })
  discordAuth() {}

  @Get('discord/callback')
  @Public()
  @UseGuards(AuthGuard('discord'))
  @ApiOperation({ summary: 'Discord OAuth callback' })
  async discordCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      const user = this.ensureOAuthUser(req.user, 'Discord');
      await this.redirectWithSession(res, user);
    } catch (error: unknown) {
      this.logger.error('Discord OAuth callback error:', error);
      this.handleOAuthError(res, error, 'Discord');
    }
  }

  @Get('linked-accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get user's linked OAuth accounts",
    description: 'Returns all OAuth accounts linked to the current user',
  })
  async getLinkedAccounts(@GetUser() user: JwtUser | undefined) {
    const { id } = this.ensureAuthenticatedUser(user);
    return await this.authService.getUserOAuthAccounts(id);
  }

  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unlink OAuth account',
    description:
      'Removes the connection between user account and OAuth provider',
  })
  @ApiParam({
    name: 'provider',
    enum: AuthProvider,
    description: 'OAuth provider to unlink',
  })
  async unlinkAccount(
    @GetUser() user: JwtUser | undefined,
    @Param('provider') provider: AuthProvider,
  ) {
    const { id } = this.ensureAuthenticatedUser(user);
    return await this.authService.unlinkOAuthAccount(id, provider);
  }

  @Get('link/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Link additional OAuth account',
    description: 'Allows logged-in users to link additional OAuth providers',
  })
  @ApiParam({
    name: 'provider',
    enum: AuthProvider,
    description: 'OAuth provider to link',
  })
  linkAccount(
    @Param('provider') provider: AuthProvider,
    @Query('user_id') userId?: string,
  ) {
    const providerConfig = this.oauthProviderFactory.getProvider(provider);
    if (!providerConfig) {
      throw new BadRequestException('Unsupported OAuth provider');
    }

    const suffix = userId ? ` for user ${userId}` : '';
    return {
      message: `Linking ${providerConfig.displayName} account${suffix}...`,
      provider: providerConfig.name,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'New access and refresh tokens',
  })
  async refreshToken(@Req() req: express.Request) {
    const refreshToken = this.extractRefreshToken(req.body);
    return await this.authService.refreshToken(refreshToken);
  }

  private getFrontendUrl(): string {
    return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  }

  private setRefreshCookie(res: express.Response, refreshToken: string) {
    const secure =
      this.refreshCookieSameSite === 'none' ? true : this.refreshCookieSecure;
    res.cookie(this.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: this.refreshCookieSameSite,
      path: this.refreshCookiePath,
      domain: this.refreshCookieDomain,
      maxAge: this.refreshCookieMaxAgeMs,
    });
  }

  private async redirectWithSession(
    res: express.Response,
    user: OAuthRequestUser,
  ): Promise<void> {
    const response = await this.authApplicationService.issueTokensForUser({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      avatar: user.avatar ?? null,
      isActive: user.isActive ?? true,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
    });

    this.setRefreshCookie(res, response.refreshToken);

    const frontendUrl = this.getFrontendUrl();
    const redirectUrl = `${frontendUrl}/auth/callback?token=${response.token}`;
    res.redirect(redirectUrl);
  }

  private redirectWithError(res: express.Response, message: string): void {
    const frontendUrl = this.getFrontendUrl();
    res.redirect(
      `${frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`,
    );
  }

  private handleOAuthError(
    res: express.Response,
    error: unknown,
    providerName: string,
  ): void {
    const fallback = `${providerName} authentication failed`;
    this.redirectWithError(res, this.formatErrorMessage(error, fallback));
  }

  private ensureOAuthUser(
    user: unknown,
    providerName: string,
  ): OAuthRequestUser {
    if (!isOAuthRequestUser(user)) {
      throw new Error(`No user data received from ${providerName} OAuth`);
    }
    return user;
  }

  private ensureAuthenticatedUser(user: JwtUser | undefined): JwtUser {
    if (!user?.id) {
      throw new UnauthorizedException('Invalid user context');
    }
    return user;
  }

  private formatErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error.length > 0) {
      return error;
    }
    return fallback;
  }

  private extractRefreshToken(body: unknown): string {
    if (typeof body === 'object' && body !== null && 'refresh_token' in body) {
      const token = (body as { refresh_token?: unknown }).refresh_token;
      if (typeof token === 'string' && token.trim().length > 0) {
        return token.trim();
      }
    }
    throw new BadRequestException('Refresh token is required');
  }
}
