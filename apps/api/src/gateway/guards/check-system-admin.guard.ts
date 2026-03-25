import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { RequestWithUser } from '@pitch/shared-backend/interfaces/request.interface';
import { isSystemAdminEmail } from '../utils/system-admin-access';

@Injectable()
export class CheckSystemAdmin implements CanActivate {
  private readonly logger = new Logger(CheckSystemAdmin.name);

  canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const email = req.user?.email?.trim().toLowerCase();

    if (!email) {
      this.logger.warn('System admin check failed: authenticated user missing');
      return Promise.reject(
        new UnauthorizedException('Access token is required'),
      );
    }

    if (this.isAllowed(email)) {
      this.logger.log(`User ${email} is a system admin.`);
      return Promise.resolve(true);
    }

    this.logger.warn(`System admin check failed for ${email}`);
    return Promise.reject(
      new ForbiddenException('System administrator access is required'),
    );
  }

  private isAllowed(email: string): boolean {
    if (isSystemAdminEmail(email)) {
      if (process.env.DEV_BYPASS_ENABLED === 'true') {
        const bypassEmail = (process.env.DEV_BYPASS_EMAIL ?? 'dev@local')
          .trim()
          .toLowerCase();
        if (email === bypassEmail) {
          this.logger.warn(
            `Allowing DEV_BYPASS_EMAIL ${email} as system admin`,
          );
        }
      }
      return true;
    }
    return false;
  }
}
