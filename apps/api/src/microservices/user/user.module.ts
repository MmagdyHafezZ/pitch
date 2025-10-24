import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { UserPrismaService } from './prisma/user-prisma.service';
import { AuthService } from './services/auth.service';
import { OAuthProviderFactory } from './factories/oauth-provider.factory';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
// import { GitHubStrategy } from './strategies/github.strategy';
// import { LinkedInStrategy } from './strategies/linkedin.strategy';
// import { MicrosoftStrategy } from './strategies/microsoft.strategy';
// import { DiscordStrategy } from './strategies/discord.strategy';
import { OAuthController } from './controllers/oauth.controller';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [UserController, OAuthController],
  providers: [
    UserService,
    UserPrismaService,
    UserRepository,
    AuthService,
    OAuthProviderFactory,
    JwtAuthGuard,
    JwtStrategy,
    GoogleStrategy,
    // GitHubStrategy,
    // LinkedInStrategy,
    // MicrosoftStrategy,
    // DiscordStrategy,
  ],
  exports: [UserService, AuthService, JwtAuthGuard, JwtStrategy],
})
export class UserModule {}
