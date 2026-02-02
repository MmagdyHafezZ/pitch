import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  RequestWithHeaders,
  RequestWithUser,
} from '@pitch/shared-backend/interfaces/request.interface';
import { JwtPayload } from './global-jwt-auth.guard';
import { extractBearer } from './global-jwt-auth.guard';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { ServiceError } from '@pitch/shared-backend/interfaces/error.interface';

@Injectable()
export class CheckSystemAdmin implements CanActivate {
  private readonly logger = new Logger(CheckSystemAdmin.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<RequestWithHeaders & RequestWithUser>();

    const token = extractBearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Access token is required');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'secret',
      });
      if (payload.email && process.env.SUPER_ADMIN_EMAILS) {
        const superAdminEmails = process.env.SUPER_ADMIN_EMAILS.split(',').map(
          (email) => email.trim().toLowerCase(),
        );
        if (superAdminEmails.includes(payload.email.toLowerCase())) {
          this.logger.log(`User ${payload.email} is a system admin.`);
          return Promise.resolve(true);
        }
      }
      return Promise.resolve(false);
    } catch (error) {
      const normalized = normalizeError(error) as ServiceError & {
        name?: string;
      };
      this.logger.warn(
        `JWT validation failed: ${normalized.message ?? 'Unknown error'}`,
      );

      return Promise.resolve(false);
    }
  }
}
