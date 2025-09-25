import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserClaims {
  id: string;
  email: string;
  name: string;
}

export const UserClaims = createParamDecorator(
  (
    data: keyof UserClaims | undefined,
    ctx: ExecutionContext,
  ): UserClaims | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
