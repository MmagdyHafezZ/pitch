import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type {
  RequestWithUser,
  RequestWithBody,
  RequestWithUserClaims,
} from '@pitch/shared-backend/interfaces/request.interface';

export interface UserClaims {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class UserClaimsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UserClaimsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<RequestWithUser & RequestWithBody & RequestWithUserClaims>();
    const user = req.user;

    if (user) {
      req.userClaims = user;

      if (req.method !== 'GET' && req.body && typeof req.body === 'object') {
        req.body = {
          ...req.body,
          __claims: { id: user.id, email: user.email, name: user.name },
        };
      }

      this.logger.debug(`User claims attached: ${user.email} (${user.id})`);
    }
    return next.handle();
  }
}
