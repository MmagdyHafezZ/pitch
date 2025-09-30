import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from '../../common/interfaces/request.interface';

export interface UserClaims {
  id: string;
  email: string;
  name: string;
}

export const UserClaims = createParamDecorator(
  (
    data: keyof UserClaims | undefined,
    ctx: ExecutionContext,
  ): UserClaims | string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (data && user) {
      const value = user[data as keyof typeof user];
      return typeof value === 'string' ? value : undefined;
    }
    return user as UserClaims | undefined;
  },
);
