// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy, VerifyCallback } from 'passport-microsoft';
// import { AuthService } from '../services/auth.service';
// import { AuthProvider } from '../factories/oauth-provider.factory';

// @Injectable()
// export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
//   constructor(private authService: AuthService) {
//     super({
//       clientID: process.env.MICROSOFT_CLIENT_ID,
//       clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
//       callbackURL:
//         process.env.MICROSOFT_CALLBACK_URL ||
//         'http://localhost:8000/api/v1/auth/oauth/microsoft/callback',
//       scope: ['user.read'],
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
//         provider: AuthProvider.MICROSOFT,
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
