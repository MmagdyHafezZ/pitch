import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../microservices/userManagement/decorators/public.decorator';
import { isWhitelistedRoute } from '../config/auth-whitelist.config';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import type { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';
import type {
  RequestWithHeaders,
  RequestWithUser,
} from '@pitch/shared-backend/interfaces/request.interface';

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
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<RequestWithHeaders & RequestWithUser>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return Promise.resolve(true);

    const method = req.method;
    const path = req.url;
    if (isWhitelistedRoute(method, path)) {
      this.logger.log(`Allowing whitelisted route: ${method} ${path}`);
      return Promise.resolve(true);
    }
    this.logger.log(`Validating JWT for route: ${method} ${path}`);

    const token = extractBearer(req.headers.authorization);
    if (!token && !this.isBypassToken(token)) {
      this.logger.warn('No JWT token provided');
      throw new UnauthorizedException('Access token is required');
    }
    this.logger.log('JWT Token:', token);
    if (this.isBypassToken(token)) {
      req.user = {
        id: process.env.DEV_BYPASS_USER_ID || 'dev-user',
        email: process.env.DEV_BYPASS_EMAIL || 'dev@local',
        name: process.env.DEV_BYPASS_NAME || 'Developer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.logger.warn('DEV_BYPASS_TOKEN accepted; skipping JWT validation');
      return Promise.resolve(true);
    }

    try {
      if (!token) {
        throw new UnauthorizedException('Access token is required');
      }
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.logger.log(
        `JWT validated for user: ${payload.email} (${payload.sub})`,
      );
      return Promise.resolve(true);
    } catch (error: unknown) {
      const normalized = normalizeError(error) as ServiceError & {
        name?: string;
      };
      this.logger.warn(
        `JWT validation failed: ${normalized.message ?? 'Unknown error'}`,
      );

      if (normalized.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      }
      if (normalized.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid access token');
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private isBypassToken(token: string | undefined): boolean {
    return (
      process.env.DEV_BYPASS_ENABLED === 'true' &&
      token === process.env.DEV_BYPASS_TOKEN
    );
  }
}

export function extractBearer(auth?: string) {
  if (!auth) return;
  const [type, token] = auth.split(' ');
  return type?.toLowerCase() === 'bearer' ? token : undefined;
}
