// global-jwt-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../microservices/auth/decorators/public.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class GlobalJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(GlobalJwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    // ⛔️ remove Logger from constructor
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token = extractBearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Access token is required');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      req.user = { id: payload.sub, email: payload.email, name: payload.name };
      this.logger.log(
        `JWT validated for user: ${payload.email} (${payload.sub})`,
      );
      return true;
    } catch (e: any) {
      this.logger.warn(`JWT validation failed: ${e?.message}`);
      if (e?.name === 'TokenExpiredError')
        throw new UnauthorizedException('Access token has expired');
      if (e?.name === 'JsonWebTokenError')
        throw new UnauthorizedException('Invalid access token');
      throw new UnauthorizedException('Token validation failed');
    }
  }
}

function extractBearer(auth?: string) {
  if (!auth) return;
  const [type, token] = auth.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : undefined;
}
