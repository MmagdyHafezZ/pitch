// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy, VerifyCallback } from 'passport-github2';
// import { AuthService } from '../services/auth.service';
// import { AuthProvider } from '../factories/oauth-provider.factory';

// @Injectable()
// export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
//   constructor(private authService: AuthService) {
//     super({
//       clientID: process.env.GITHUB_CLIENT_ID,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET,
//       callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8001/api/v1/auth/oauth/github/callback',
//       scope: ['user:email'],
//     });
//   }

//   async validate(
//     accessToken: string,
//     refreshToken: string,
//     profile: any,
//     done: VerifyCallback,
//   ): Promise<any> {
//     try {
//       const { id, emails, displayName, username, photos } = profile;

//       const userData = {
//         id,
//         provider: AuthProvider.GITHUB,
//         email: emails[0].value,
//         name: displayName || username,
//         avatar: photos[0]?.value,
//       };

//       const user = await this.authService.validateOAuthUser(userData);
//       done(null, user);
//     } catch (error) {
//       done(error, null);
//     }
//   }
// }
