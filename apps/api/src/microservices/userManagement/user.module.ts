import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserController } from './controllers/user.controller';
import { AuthController } from './controllers/auth.controller';
import { OAuthController } from './controllers/oauth.controller';
import { TeamController } from './controllers/team.controller';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { AuthApplicationService } from './services/auth-application.service';
import { TeamService } from './services/team.service';
import { UserPrismaService } from './prisma/user-prisma.service';
import { UserRepository } from './repositories/user.repository';
import { AuthRepository } from './repositories/auth.repository';
import { OAuthProviderFactory } from './factories/oauth-provider.factory';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
// import { GitHubStrategy } from './strategies/github.strategy';
// import { LinkedInStrategy } from './strategies/linkedin.strategy';
// import { MicrosoftStrategy } from './strategies/microsoft.strategy';
// import { DiscordStrategy } from './strategies/discord.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [
    // RPC Controllers (for gateway communication)
    UserController,
    AuthController,
    TeamController,
    // HTTP Controllers (for OAuth callbacks only)
    OAuthController,
  ],
  providers: [
    // Prisma Service
    UserPrismaService,

    // Repositories (Data Layer)
    UserRepository,
    AuthRepository,

    // Application Services (Orchestration Layer)
    AuthApplicationService,

    // Domain Services (Business Logic)
    UserService,
    AuthService,

    // Factories & Guards
    OAuthProviderFactory,
    JwtAuthGuard,

    // Strategies
    JwtStrategy,
    GoogleStrategy,
    // GitHubStrategy,
    // LinkedInStrategy,
    // MicrosoftStrategy,
    // DiscordStrategy,
    TeamService,
    TeamRepository,
  ],
  exports: [
    UserService,
    TeamService,
    AuthService,
    AuthApplicationService,
    JwtAuthGuard,
    JwtStrategy,
  ],
})
export class UserModule {}
