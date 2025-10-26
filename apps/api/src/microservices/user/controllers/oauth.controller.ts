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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import {
  OAuthProviderFactory,
  AuthProvider,
} from '../factories/oauth-provider.factory';
import { GetUser } from '../decorators/get-user.decorator';
import { Public } from '../decorators/public.decorator';
import express from 'express';

@ApiTags('OAuth Authentication')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private authService: AuthService,
    private oauthProviderFactory: OAuthProviderFactory,
  ) {}

  // Google OAuth
  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth(@Req() req: express.Request) {
    // Passport handles the redirect
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      if (!req.user) {
        throw new Error('No user data received from Google OAuth');
      }

      const tokens = this.authService.generateTokens(req.user);

      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

      console.log('Using frontend URL:', frontendUrl);

      const redirectUrl = `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh=${tokens.refresh_token}`;
      console.log('Redirecting to:', redirectUrl);

      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = encodeURIComponent(
        error.message || 'Authentication failed',
      );
      res.redirect(`${frontendUrl}/auth/callback?error=${errorMessage}`);
    }
  }

  @Get('linkedin')
  @Public()
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'Initiate LinkedIn OAuth login' })
  linkedinAuth() {
    // Passport handles the redirect
  }

  @Get('linkedin/callback')
  @Public()
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'LinkedIn OAuth callback' })
  async linkedinCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      if (!req.user) {
        throw new Error('No user data received from LinkedIn OAuth');
      }

      const tokens = this.authService.generateTokens(req.user);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

      res.redirect(
        `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh=${tokens.refresh_token}`,
      );
    } catch (error) {
      console.error('LinkedIn OAuth callback error:', error);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = encodeURIComponent(
        error.message || 'Authentication failed',
      );
      res.redirect(`${frontendUrl}/auth/callback?error=${errorMessage}`);
    }
  }

  // GitHub OAuth
  @Get('github')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  githubAuth() {
    // Passport handles the redirect
  }

  @Get('github/callback')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      if (!req.user) {
        throw new Error('No user data received from GitHub OAuth');
      }

      const tokens = this.authService.generateTokens(req.user);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

      res.redirect(
        `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh=${tokens.refresh_token}`,
      );
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = encodeURIComponent(
        error.message || 'Authentication failed',
      );
      res.redirect(`${frontendUrl}/auth/callback?error=${errorMessage}`);
    }
  }

  // Microsoft OAuth
  @Get('microsoft')
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @ApiOperation({ summary: 'Initiate Microsoft OAuth login' })
  microsoftAuth() {
    // Passport handles the redirect
  }

  @Get('microsoft/callback')
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  async microsoftCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      if (!req.user) {
        throw new Error('No user data received from Microsoft OAuth');
      }

      const tokens = this.authService.generateTokens(req.user);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

      res.redirect(
        `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh=${tokens.refresh_token}`,
      );
    } catch (error) {
      console.error('Microsoft OAuth callback error:', error);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = encodeURIComponent(
        error.message || 'Authentication failed',
      );
      res.redirect(`${frontendUrl}/auth/callback?error=${errorMessage}`);
    }
  }

  // Discord OAuth
  @Get('discord')
  @Public()
  @UseGuards(AuthGuard('discord'))
  @ApiOperation({ summary: 'Initiate Discord OAuth login' })
  discordAuth() {
    // Passport handles the redirect
  }

  @Get('discord/callback')
  @Public()
  @UseGuards(AuthGuard('discord'))
  @ApiOperation({ summary: 'Discord OAuth callback' })
  async discordCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    try {
      if (!req.user) {
        throw new Error('No user data received from Discord OAuth');
      }

      const tokens = this.authService.generateTokens(req.user);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

      res.redirect(
        `${frontendUrl}/auth/callback?token=${tokens.access_token}&refresh=${tokens.refresh_token}`,
      );
    } catch (error) {
      console.error('Discord OAuth callback error:', error);
      const frontendUrl =
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = encodeURIComponent(
        error.message || 'Authentication failed',
      );
      res.redirect(`${frontendUrl}/auth/callback?error=${errorMessage}`);
    }
  }

  // Account linking endpoints
  @Get('linked-accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get user's linked OAuth accounts",
    description: 'Returns all OAuth accounts linked to the current user',
  })
  async getLinkedAccounts(@GetUser() user: any) {
    return await this.authService.getUserOAuthAccounts(user.id);
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
    @GetUser() user: any,
    @Param('provider') provider: AuthProvider,
  ) {
    return await this.authService.unlinkOAuthAccount(user.id, provider);
  }

  // Link additional OAuth accounts (when user is already logged in)
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
  async linkAccount(
    @Param('provider') provider: string,
    @Query('user_id') userId: string,
  ) {
    // This would redirect to the OAuth provider with a "link" state
    // Implementation depends on your specific linking flow
    return { message: `Linking ${provider} account...` };
  }

  // Refresh token endpoint
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'New access and refresh tokens',
  })
  async refreshToken(@Req() req: express.Request) {
    const refreshToken = req.body.refresh_token;
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    return await this.authService.refreshToken(refreshToken);
  }
}
