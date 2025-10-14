// auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { OAuthProfile } from '../interfaces/oauth-provider.interface';
import { AuthService } from '../services/auth.service';
import { AuthProvider } from '../factories/oauth-provider.factory';
import { ITokenData } from '../interfaces/token-data.interface';
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
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    try {
      console.log('Google profile received:', JSON.stringify(profile, null, 2));

      // Check if profile exists and has required properties
      if (!profile || !profile.id || !profile.emails || !profile.emails[0]) {
        throw new Error('Invalid profile data received from Google');
      }

      const oauthProfile: OAuthProfile = {
        id: profile.id,
        email: profile.emails[0].value,
        name:
          profile.displayName ||
          (profile.name
            ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim()
            : '') ||
          profile.emails[0].value.split('@')[0],
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        avatar: profile.photos?.[0]?.value || null,
        provider: AuthProvider.GOOGLE,
        providerData: profile._json || profile,
      };

      const tokenData: ITokenData = {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      };

      const user = await this.authService.validateOAuthUser(
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
