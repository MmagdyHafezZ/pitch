// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy, VerifyCallback } from 'passport-linkedin-oauth2';
// import { AuthService } from '../services/auth.service';
// import { AuthProvider } from '../factories/oauth-provider.factory';

// @Injectable()
// export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
//   constructor(private authService: AuthService) {
//     super({
//       clientID: process.env.LINKEDIN_CLIENT_ID,
//       clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
//       callbackURL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:8001/api/v1/auth/oauth/linkedin/callback',
//       scope: ['r_emailaddress', 'r_liteprofile'],
//     });
//   }

//   async validate(
//     accessToken: string,
//     refreshToken: string,
//     profile: any,
//     done: VerifyCallback,
//   ): Promise<any> {
//     try {
//       const { id, emails, displayName, photos } = profile;

//       const userData = {
//         id,
//         provider: AuthProvider.LINKEDIN,
//         email: emails[0].value,
//         name: displayName,
//         avatar: photos[0]?.value,
//       };

//       const user = await this.authService.validateOAuthUser(userData);
//       done(null, user);
//     } catch (error) {
//       done(error, null);
//     }
//   }
// }
