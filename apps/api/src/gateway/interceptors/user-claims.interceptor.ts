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

      this.logger.debug(`User claims attached: ${user.email} (${user.id})`);
    }
    return next.handle();
  }
}
