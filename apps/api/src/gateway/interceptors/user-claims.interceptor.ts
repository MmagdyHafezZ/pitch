import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export interface UserClaims {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class UserClaimsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UserClaimsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as UserClaims | undefined;

    if (user) {
      // Expose on request for local use
      req.userClaims = user;

      // **Forward to microservices** by merging into body
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
