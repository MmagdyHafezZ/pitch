// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy, VerifyCallback } from 'passport-discord';
// import { AuthService } from '../services/auth.service';
// import { AuthProvider } from '../factories/oauth-provider.factory';

// @Injectable()
// export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
//   constructor(private authService: AuthService) {
//     super({
//       clientID: process.env.DISCORD_CLIENT_ID,
//       clientSecret: process.env.DISCORD_CLIENT_SECRET,
//       callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:8000/api/v1/auth/oauth/discord/callback',
//       scope: ['identify', 'email'],
//     });
//   }

//   async validate(
//     accessToken: string,
//     refreshToken: string,
//     profile: any,
//     done: VerifyCallback,
//   ): Promise<any> {
//     try {
//       const { id, email, username, avatar } = profile;

//       const userData = {
//         id,
//         provider: AuthProvider.DISCORD,
//         email: email,
//         name: username,
//         avatar: avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null,
//       };

//       const user = await this.authService.validateOAuthUser(userData);
//       done(null, user);
//     } catch (error) {
//       done(error, null);
//     }
//   }
// }
