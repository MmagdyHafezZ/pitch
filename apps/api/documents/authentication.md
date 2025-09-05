# Authentication & Authorization Guide

Comprehensive guide for implementing secure authentication and authorization in the PITCH API.

## Authentication Overview

- **Strategy**: JWT (JSON Web Tokens)
- **Token Types**: Access tokens (short-lived) + Refresh tokens (long-lived)
- **Security**: bcrypt for password hashing, secure token storage
- **Session Management**: Database-backed sessions for enhanced security

## JWT Configuration

### Token Structure
```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub: string      // user ID
  email: string
  role: UserRole
  iat: number      // issued at
  exp: number      // expires at
  type: 'access'
}

// Refresh Token Payload
interface RefreshTokenPayload {
  sub: string      // user ID
  sessionId: string
  iat: number
  exp: number
  type: 'refresh'
}
```

### Environment Configuration
```env
# JWT Settings
JWT_SECRET=your-super-secure-secret-key-minimum-32-characters
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Password Settings
BCRYPT_ROUNDS=12

# Rate Limiting
LOGIN_RATE_LIMIT=10
LOGIN_RATE_WINDOW=15m
```

## Implementation

### JWT Service
```typescript
// src/auth/jwt.service.ts
import { Injectable } from '@nestjs/common'
import { JwtService as NestJwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { User } from '@prisma/client'

@Injectable()
export class JwtService {
  constructor(
    private jwtService: NestJwtService,
    private configService: ConfigService
  ) {}

  generateAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    }

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
    })
  }

  generateRefreshToken(user: User, sessionId: string): string {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      sessionId,
      type: 'refresh',
    }

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    })
  }

  verifyToken(token: string): any {
    return this.jwtService.verify(token, {
      secret: this.configService.get('JWT_SECRET'),
    })
  }

  decodeToken(token: string): any {
    return this.jwtService.decode(token)
  }
}
```

### Authentication Service
```typescript
// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtService } from './jwt.service'
import * as bcrypt from 'bcryptjs'
import { User } from '@prisma/client'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async signUp(email: string, password: string, name?: string) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw new ConflictException('User already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    })

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user)

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    }
  }

  async signIn(email: string, password: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user)

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    }
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verifyToken(refreshToken)
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type')
      }

      // Find session
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
        include: { user: true },
      })

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired session')
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(session.user)

      // Update session expiration
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
      })

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: this.sanitizeUser(session.user),
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      // Logout specific session
      await this.prisma.session.delete({
        where: { id: sessionId },
      })
    } else {
      // Logout all sessions
      await this.prisma.session.deleteMany({
        where: { userId },
      })
    }

    return { message: 'Successfully logged out' }
  }

  private async generateTokens(user: User) {
    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user)
    const refreshToken = this.jwtService.generateRefreshToken(user, session.id)

    return { accessToken, refreshToken }
  }

  private sanitizeUser(user: User) {
    const { password, ...sanitizedUser } = user
    return sanitizedUser
  }
}
```

### Authentication Controller
```typescript
// src/auth/auth.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus,
  UseGuards,
  Request,
  Delete
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CreateUserDto, SignInDto, RefreshTokenDto } from './dto'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUp(
      createUserDto.email,
      createUserDto.password,
      createUserDto.name
    )
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.email, signInDto.password)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken)
  }

  @Delete('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    return this.authService.logout(req.user.id)
  }
}
```

## Guards and Decorators

### JWT Auth Guard
```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '../jwt.service'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService
  ) {
    super()
  }

  async canActivate(context: any): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractTokenFromHeader(request)

    if (!token) {
      throw new UnauthorizedException('Access token required')
    }

    try {
      const payload = this.jwtService.verifyToken(token)
      
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type')
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })

      if (!user) {
        throw new UnauthorizedException('User not found')
      }

      request.user = user
      return true
    } catch (error) {
      throw new UnauthorizedException('Invalid access token')
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
```

### Roles Guard
```typescript
// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.some((role) => user.role === role)
  }
}
```

### Custom Decorators
```typescript
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common'
import { UserRole } from '@prisma/client'

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles)

// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  }
)
```

## Authorization Examples

### Role-Based Access Control
```typescript
// Protected route with role requirement
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getUsers() {
    // Only admins and moderators can access
  }

  @Delete('users/:id')
  @Roles(UserRole.ADMIN)
  async deleteUser(@Param('id') id: string) {
    // Only admins can delete users
  }
}
```

### Resource-Based Access Control
```typescript
// src/auth/guards/project-owner.guard.ts
@Injectable()
export class ProjectOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const projectId = request.params.id

    if (user.role === UserRole.ADMIN) {
      return true // Admins can access all projects
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    })

    return project?.ownerId === user.id
  }
}

// Usage
@Controller('projects')
export class ProjectsController {
  @Get(':id')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  async getProject(@Param('id') id: string) {
    // Only project owner or admin can access
  }
}
```

## Password Security

### Password Hashing
```typescript
// src/auth/password.service.ts
import * as bcrypt from 'bcryptjs'

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds)
  }

  async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  validatePasswordStrength(password: string): boolean {
    // Minimum 8 characters, at least one letter, one number, one special character
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/
    return regex.test(password)
  }
}
```

### Password Reset Flow
```typescript
// src/auth/password-reset.service.ts
@Injectable()
export class PasswordResetService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private passwordService: PasswordService
  ) {}

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link will be sent' }
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    })

    // Send email with reset link
    await this.emailService.sendPasswordResetEmail(user.email, token)

    return { message: 'If the email exists, a reset link will be sent' }
  }

  async resetPassword(token: string, newPassword: string) {
    // Find valid token
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        used: false,
      },
      include: { user: true },
    })

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    // Validate password strength
    if (!this.passwordService.validatePasswordStrength(newPassword)) {
      throw new BadRequestException('Password does not meet security requirements')
    }

    // Hash new password
    const hashedPassword = await this.passwordService.hashPassword(newPassword)

    // Update password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Invalidate all existing sessions
      this.prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ])

    return { message: 'Password reset successfully' }
  }
}
```

## Rate Limiting

### Login Rate Limiting
```typescript
// src/auth/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext, TooManyRequestsException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RedisService } from '../redis/redis.service'

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private redisService: RedisService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const ip = request.ip
    const key = `rate_limit:${ip}`
    
    const limit = 10 // 10 attempts
    const window = 15 * 60 // 15 minutes

    const current = await this.redisService.get(key)
    
    if (current && parseInt(current) >= limit) {
      throw new TooManyRequestsException('Too many login attempts')
    }

    // Increment counter
    await this.redisService.incr(key)
    await this.redisService.expire(key, window)

    return true
  }
}

// Usage
@Controller('auth')
export class AuthController {
  @Post('signin')
  @UseGuards(RateLimitGuard)
  async signIn(@Body() signInDto: SignInDto) {
    // Rate limited signin
  }
}
```

## Session Management

### Session Service
```typescript
// src/auth/session.service.ts
@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    })

    if (!session) {
      throw new NotFoundException('Session not found')
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    })

    return { message: 'Session revoked successfully' }
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    })

    return { message: 'All sessions revoked successfully' }
  }
}
```

## Security Best Practices

### 1. Token Security
```typescript
// Secure token storage and transmission
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}

// Use secure cookies for refresh tokens in web apps
@Post('signin')
async signIn(@Res({ passthrough: true }) response: Response) {
  const result = await this.authService.signIn(email, password)
  
  // Set secure cookie
  response.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
  
  return { accessToken: result.accessToken, user: result.user }
}
```

### 2. Input Validation
```typescript
// src/auth/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
    { message: 'Password must contain at least one letter, number, and special character' }
  )
  password: string

  @IsString()
  @MaxLength(100)
  name?: string
}
```

### 3. Audit Logging
```typescript
// src/auth/audit.service.ts
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAuthEvent(
    userId: string | null,
    action: string,
    ip: string,
    userAgent: string,
    success: boolean,
    details?: any
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: `auth.${action}`,
        entityType: 'auth',
        entityId: userId || 'anonymous',
        metadata: {
          ip,
          userAgent,
          success,
          details,
        },
      },
    })
  }
}
```

### 4. Environment Security
```bash
# Production environment variables
JWT_SECRET=$(openssl rand -base64 64)
BCRYPT_ROUNDS=12
DATABASE_URL=postgresql://user:secure_password@localhost:5432/pitch_prod

# Additional security
ENABLE_CORS=false
TRUSTED_ORIGINS=https://yourdomain.com
```

## Testing Authentication

### Auth Testing Utilities
```typescript
// src/auth/test-utils.ts
export class AuthTestUtils {
  constructor(private jwtService: JwtService) {}

  generateTestToken(user: Partial<User>): string {
    const payload = {
      sub: user.id || 'test-user-id',
      email: user.email || 'test@example.com',
      role: user.role || 'USER',
      type: 'access',
    }

    return this.jwtService.sign(payload, { expiresIn: '1h' })
  }

  createAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` }
  }
}
```

### Integration Tests
```typescript
// src/auth/auth.controller.spec.ts
describe('AuthController', () => {
  let app: INestApplication
  let authTestUtils: AuthTestUtils

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile()

    app = moduleRef.createNestApplication()
    authTestUtils = moduleRef.get(AuthTestUtils)
    await app.init()
  })

  describe('/auth/signin (POST)', () => {
    it('should authenticate valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401)
    })
  })

  describe('Protected routes', () => {
    it('should allow access with valid token', async () => {
      const token = authTestUtils.generateTestToken({ id: 'user-1' })
      
      await request(app.getHttpServer())
        .get('/users/profile')
        .set(authTestUtils.createAuthHeader(token))
        .expect(200)
    })

    it('should deny access without token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .expect(401)
    })
  })
})
```