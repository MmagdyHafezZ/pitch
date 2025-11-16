// auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import type { Request } from 'express';
import { OAuthProfile } from '../interfaces/oauth-provider.interface';
import { AuthService } from '../services/auth.service';
import { AuthProvider } from '../factories/oauth-provider.factory';
import { ITokenData } from '../interfaces/token-data.interface';

type GoogleProfile = Profile & { _json?: Record<string, unknown> };
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/oauth/google/callback'}`,
      scope: ['email', 'profile'],
      passReqToCallback: true,
      state: false, // Enable state parameter for CSRF protection
    });
  }

  async validate(
    _req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<any> {
    try {
      void _req;
      console.log('Google profile received:', JSON.stringify(profile, null, 2));

      // Check if profile exists and has required properties
      if (!profile?.id || !profile.emails?.[0]?.value) {
        throw new Error('Invalid profile data received from Google');
      }

      const primaryEmail = profile.emails[0].value;
      const fallbackName =
        profile.displayName ||
        (profile.name
          ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim()
          : '') ||
        primaryEmail.split('@')[0];

      const oauthProfile: OAuthProfile = {
        id: profile.id,
        email: primaryEmail,
        name: fallbackName,
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        avatar: profile.photos?.[0]?.value ?? undefined,
        provider: AuthProvider.GOOGLE,
        providerData: (profile as GoogleProfile)._json || profile,
      };

      const tokenData: ITokenData = {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      };

      const user: unknown = await this.authService.validateOAuthUser(
        oauthProfile,
        tokenData,
      );

      return user;
    } catch (error) {
      console.error('Google OAuth validation error:', error);
      throw error;
    }
  }
}
