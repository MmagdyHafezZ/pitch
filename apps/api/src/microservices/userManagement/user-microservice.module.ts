import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserController } from './controllers/user.controller';
import { AuthController } from './controllers/auth.controller';
import { TeamController } from './controllers/team.controller';
import { OAuthController } from './controllers/oauth.controller';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { AuthApplicationService } from './services/auth-application.service';
import { TeamService } from './services/team.service';
import { UserPrismaService } from './prisma/user-prisma.service';
import { UserRepository } from './repositories/user.repository';
import { AuthRepository } from './repositories/auth.repository';
import { TeamRepository } from './repositories/team.repository';
import { OAuthProviderFactory } from './factories/oauth-provider.factory';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

/**
 * UserMicroserviceModule - Module for RabbitMQ message handlers AND HTTP routes
 * This module contains:
 * - Controllers with @MessagePattern decorators for RabbitMQ
 * - Controllers with HTTP routes (like OAuthController)
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [
    UserController,
    AuthController,
    TeamController,
    OAuthController,
  ],
  providers: [
    UserPrismaService,
    UserRepository,
    AuthRepository,
    TeamRepository,
    AuthApplicationService,
    UserService,
    AuthService,
    TeamService,
    OAuthProviderFactory,
    JwtStrategy,
    GoogleStrategy,
  ],
  exports: [UserService, TeamService, AuthService, AuthApplicationService],
})
export class UserMicroserviceModule {}
