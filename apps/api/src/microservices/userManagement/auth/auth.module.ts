import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './controllers/auth.controller';
import { OAuthController } from './controllers/oauth.controller';

import { AuthService } from './services/auth.service';
import { AuthApplicationService } from './services/auth-application.service';

import { AuthRepository } from './repositories/auth.repository';
import { OAuthProviderFactory } from './factories/oauth-provider.factory';

import { JwtStrategy } from '../user/strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    AuthApplicationService,
    AuthRepository,
    OAuthProviderFactory,
    JwtStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService, AuthApplicationService, JwtModule, PassportModule],
})
export class AuthModule {}
